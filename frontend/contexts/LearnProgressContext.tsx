'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { StepResult, UserLeak } from '@/lib/learn/types'
import { levelForXP } from '@/lib/learn/types'
import {
  fetchFullProgress,
  submitStepResult,
  submitLessonComplete,
  submitModuleComplete,
  resolveLeak as apiResolveLeak,
  mergeGuestProgress,
  type LessonProgressEntry,
  type ConceptMasteryEntry,
  type ContinueLearningTarget,
  type ModuleCompleteContext,
} from '@/lib/learn/api'
import {
  recordGuestStep,
  recordGuestLessonComplete,
  hasGuestProgress,
  clearGuestProgress,
  guestLessonsForMerge,
  getGuestLessonProgress,
} from '@/lib/learn/guestProgress'
import { createSequentialQueue } from '@/lib/learn/saveQueue'

// ── Public shape ──────────────────────────────────────────────────────────────

export interface LearnProgressState {
  loading: boolean
  error: string | null
  isGuest: boolean
  /** True once progress has been loaded at least once for the current
   *  user/session (guest or authenticated) — distinct from `loading`, which
   *  can flip back to true on a later refetch. Authenticated persistence
   *  must never fire before this is true, or a save could race the initial
   *  server hydration. */
  hydrated: boolean
  skill: { total_xp: number; level: number; streak_days: number }
  lessons: Record<string, LessonProgressEntry>
  completedSteps: Record<string, string[]>
  concepts: Record<string, ConceptMasteryEntry>
  leaks: UserLeak[]
  achievementIds: Set<string>
  /** Module ids whose completion bonus has already been awarded to this user —
   *  guards against re-awarding it on replay/reopen. Always empty for guests. */
  completedModules: Set<string>
  continueTarget: ContinueLearningTarget | null
}

export interface StepCompletionContext {
  moduleId?: string
  pathId?: string
  stepIndex: number
  totalSteps: number
}

export interface LessonCompletionContext {
  moduleId?: string
  pathId?: string
  lessonXpReward: number
  pathLessonIds: string[]
}

interface LearnProgressContextType {
  progress: LearnProgressState
  recordStepResult: (
    lessonId: string,
    stepId: string,
    result: StepResult,
    response: unknown,
    conceptIds: string[],
    timeMs: number,
    ctx: StepCompletionContext,
  ) => void
  recordLessonComplete: (
    lessonId: string,
    score: number,
    timeSpentSec: number,
    ctx: LessonCompletionContext,
  ) => Promise<{ bonusXp: number; leveledUp: boolean; newLevel: number }>
  /** Awards a module's one-time completion bonus. Safe to call whenever the
   *  caller believes a module just became fully completed — server-side
   *  verification + the `completedModules` guard make it a no-op otherwise. */
  recordModuleComplete: (
    moduleId: string,
    ctx: ModuleCompleteContext,
  ) => Promise<{ bonusXp: number; leveledUp: boolean; newLevel: number }>
  resolveLeak: (leakId: string) => void
}

const EMPTY_STATE: LearnProgressState = {
  loading: true,
  error: null,
  isGuest: true,
  hydrated: false,
  skill: { total_xp: 0, level: 1, streak_days: 0 },
  lessons: {},
  completedSteps: {},
  concepts: {},
  leaks: [],
  achievementIds: new Set(),
  completedModules: new Set(),
  continueTarget: null,
}

const LearnProgressContext = createContext<LearnProgressContextType>({
  progress: EMPTY_STATE,
  recordStepResult: () => {},
  recordLessonComplete: async () => ({ bonusXp: 0, leveledUp: false, newLevel: 1 }),
  recordModuleComplete: async () => ({ bonusXp: 0, leveledUp: false, newLevel: 1 }),
  resolveLeak: () => {},
})

/**
 * Runs `fn` once, and if it throws, once more after a short delay. Every
 * failure is logged (never silent) so a lost save is at least debuggable —
 * previously these errors were swallowed entirely, which is how progress
 * could go missing without any trace. Returns `null` (never throws) after
 * both attempts fail, so callers can keep the optimistic UI without
 * pretending the server write actually succeeded.
 */
export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[LearnProgress] ${label} failed — retrying once…`, e)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    try {
      return await fn()
    } catch (e2) {
      console.error(`[LearnProgress] ${label} failed again — this update was NOT saved to the server.`, e2)
      return null
    }
  }
}

function computeContinueTarget(lessons: Record<string, LessonProgressEntry>): ContinueLearningTarget | null {
  const inProgress = Object.entries(lessons).filter(([, l]) => l.status === 'in_progress')
  if (inProgress.length === 0) return null
  const [lessonId, latest] = inProgress.sort((a, b) => (b[1].updated_at ?? '').localeCompare(a[1].updated_at ?? ''))[0]
  return {
    lesson_id: lessonId,
    module_id: latest.module_id,
    path_id: latest.path_id,
    step_index: latest.current_step_index,
    total_steps: latest.total_steps,
  }
}

export function LearnProgressProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth()
  const token = session?.access_token ?? ''

  const [progress, setProgress] = useState<LearnProgressState>(EMPTY_STATE)
  const mergedForUser = useRef<string | null>(null)
  // Mirrors progress.hydrated without needing `progress` in every callback's
  // dependency array — read synchronously inside recordStepResult/etc. so a
  // save can never fire before the initial load (guest or server) completes.
  const hydratedRef = useRef(false)
  // Which user id `hydratedRef` currently reflects — lets a background token
  // refresh for the same user skip re-arming the guard (see the effect below).
  const hydratedForUserRef = useRef<string | null>(null)
  // Authenticated saves are chained onto this queue so they always land in
  // the order they were initiated — an earlier (possibly slower) request can
  // never overwrite a later one's result once both settle out of order.
  const saveQueueRef = useRef(createSequentialQueue())
  const enqueueSave = useCallback(<T,>(task: () => Promise<T>) => saveQueueRef.current.enqueue(task), [])

  const loadGuestProgress = useCallback(() => {
    const lessons: Record<string, LessonProgressEntry> = {}
    const completedSteps: Record<string, string[]> = {}
    for (const gl of guestLessonsForMerge()) {
      lessons[gl.lesson_id] = {
        status: gl.status,
        attempts: gl.steps.length,
        best_score: gl.best_score,
        last_score: gl.last_score,
        current_step_index: gl.current_step_index,
        current_step_id: gl.current_step_id,
        total_steps: gl.total_steps,
        completed_at: gl.status === 'completed' ? new Date().toISOString() : null,
        module_id: gl.module_id ?? null,
        path_id: gl.path_id ?? null,
      }
      completedSteps[gl.lesson_id] = gl.steps.map((s) => s.step_id)
    }
    hydratedRef.current = true
    setProgress({
      loading: false,
      error: null,
      isGuest: true,
      hydrated: true,
      skill: { total_xp: 0, level: 1, streak_days: 0 },
      lessons,
      completedSteps,
      concepts: {},
      leaks: [],
      achievementIds: new Set(),
      completedModules: new Set(),
      continueTarget: computeContinueTarget(lessons),
    })
  }, [])

  const loadAuthedProgress = useCallback(async () => {
    if (!token) return
    setProgress((p) => ({ ...p, loading: true, error: null }))
    try {
      const full = await fetchFullProgress(token)
      hydratedRef.current = true
      setProgress({
        loading: false,
        error: null,
        isGuest: false,
        hydrated: true,
        skill: full.skill,
        lessons: full.lessons,
        completedSteps: full.completed_steps,
        concepts: full.concepts,
        leaks: full.leaks,
        achievementIds: new Set(full.achievements.map((a) => a.id)),
        completedModules: new Set(full.completed_modules),
        continueTarget: full.continue,
      })
    } catch (e) {
      // Hydration failed — do NOT mark hydrated. Authenticated saves stay
      // blocked (see recordStepResult/recordLessonComplete) until a retry
      // of this fetch actually succeeds, so a transient load failure can
      // never be followed by a save that looks like it started from scratch.
      console.error('[LearnProgress] failed to load authenticated progress — saves are blocked until this succeeds', e)
      setProgress((p) => ({ ...p, loading: false, error: (e as Error).message ?? 'Failed to load progress' }))
    }
  }, [token])

  // Initial load + guest→authenticated merge
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      hydratedRef.current = false
      hydratedForUserRef.current = null
      loadGuestProgress()
      return
    }

    // Only re-block persistence when this is genuinely a NEW identity (fresh
    // login or a different account) — a background access-token refresh for
    // the SAME already-hydrated user must not re-arm the guard and risk
    // dropping a save that's in flight.
    if (hydratedForUserRef.current !== user.id) {
      hydratedRef.current = false
    }

    const doMergeThenLoad = async () => {
      if (mergedForUser.current !== user.id && hasGuestProgress()) {
        mergedForUser.current = user.id
        try {
          await mergeGuestProgress(guestLessonsForMerge(), token)
        } catch {
          // Non-fatal — the account's own server-side progress still loads below.
        }
        clearGuestProgress()
      }
      await loadAuthedProgress()
      hydratedForUserRef.current = user.id
    }

    doMergeThenLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, token])

  const recordStepResult = useCallback(
    (
      lessonId: string,
      stepId: string,
      result: StepResult,
      response: unknown,
      conceptIds: string[],
      timeMs: number,
      ctx: StepCompletionContext,
    ) => {
      setProgress((prev) => {
        const alreadyDone = (prev.completedSteps[lessonId] ?? []).includes(stepId)
        const xpDelta = alreadyDone ? 0 : result.xp_earned
        const newTotalXp = prev.skill.total_xp + xpDelta
        const existingLesson = prev.lessons[lessonId]
        const nextLessons: Record<string, LessonProgressEntry> = {
          ...prev.lessons,
          [lessonId]: {
            status: existingLesson?.status === 'completed' ? 'completed' : 'in_progress',
            attempts: (existingLesson?.attempts ?? 0) + 1,
            best_score: Math.max(existingLesson?.best_score ?? 0, result.score),
            last_score: result.score,
            current_step_index: ctx.stepIndex,
            current_step_id: stepId,
            total_steps: ctx.totalSteps,
            completed_at: existingLesson?.completed_at ?? null,
            module_id: ctx.moduleId ?? existingLesson?.module_id ?? null,
            path_id: ctx.pathId ?? existingLesson?.path_id ?? null,
            updated_at: new Date().toISOString(),
          },
        }
        const nextCompletedSteps = {
          ...prev.completedSteps,
          [lessonId]: alreadyDone ? prev.completedSteps[lessonId] : [...(prev.completedSteps[lessonId] ?? []), stepId],
        }
        return {
          ...prev,
          skill: { ...prev.skill, total_xp: newTotalXp, level: levelForXP(newTotalXp) },
          lessons: nextLessons,
          completedSteps: nextCompletedSteps,
          continueTarget: computeContinueTarget(nextLessons),
        }
      })

      if (!user || !token) {
        recordGuestStep(
          lessonId,
          ctx.moduleId,
          ctx.pathId,
          {
            step_id: stepId,
            score: result.score,
            quality: result.quality,
            xp_earned: result.xp_earned,
            ev_loss_bb: result.ev_loss_bb,
            concept_ids: conceptIds,
            response,
          },
          ctx.stepIndex,
          ctx.totalSteps,
        )
        return
      }

      if (!hydratedRef.current) {
        // Should be unreachable — the lesson page holds the player unmounted
        // until progress.loading clears for a signed-in user — but logging
        // this loudly beats silently sending a save that predates hydration.
        console.warn(`[LearnProgress] step ${lessonId}/${stepId} saved before hydration completed`)
      }

      // Chained onto the save queue so two rapid step answers always reach
      // the server in the order they happened — an in-flight earlier save
      // can never land after (and overwrite) a later one.
      enqueueSave(async () => {
        const res = await withRetry(
          () => submitStepResult(lessonId, stepId, result, response, conceptIds, timeMs, ctx, token),
          `step ${lessonId}/${stepId}`,
        )
        if (res) {
          setProgress((prev) => ({
            ...prev,
            skill: { ...prev.skill, total_xp: res.new_total_xp, level: res.new_level },
            achievementIds: res.newly_unlocked_achievement_ids.length
              ? new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids])
              : prev.achievementIds,
          }))
        }
      })
    },
    [user, token, enqueueSave],
  )

  const recordLessonComplete = useCallback(
    async (lessonId: string, score: number, timeSpentSec: number, ctx: LessonCompletionContext) => {
      let bonusXp = 0
      let optimisticNewTotalXp = 0

      setProgress((prev) => {
        const existingLesson = prev.lessons[lessonId]
        const wasAlreadyCompleted = existingLesson?.status === 'completed'
        bonusXp = wasAlreadyCompleted ? 0 : Math.round(ctx.lessonXpReward * (Math.max(0, Math.min(100, score)) / 100))
        const newTotalXp = prev.skill.total_xp + bonusXp
        optimisticNewTotalXp = newTotalXp
        const nextLessons: Record<string, LessonProgressEntry> = {
          ...prev.lessons,
          [lessonId]: {
            status: 'completed',
            attempts: (existingLesson?.attempts ?? 0) + 1,
            best_score: Math.max(existingLesson?.best_score ?? 0, score),
            last_score: score,
            current_step_index: existingLesson?.current_step_index ?? 0,
            current_step_id: existingLesson?.current_step_id ?? null,
            total_steps: existingLesson?.total_steps ?? null,
            completed_at: existingLesson?.completed_at ?? new Date().toISOString(),
            module_id: ctx.moduleId ?? existingLesson?.module_id ?? null,
            path_id: ctx.pathId ?? existingLesson?.path_id ?? null,
            updated_at: new Date().toISOString(),
          },
        }
        return {
          ...prev,
          skill: { ...prev.skill, total_xp: newTotalXp, level: levelForXP(newTotalXp) },
          lessons: nextLessons,
          continueTarget: computeContinueTarget(nextLessons),
        }
      })

      if (!user || !token) {
        const totalSteps = getGuestLessonProgress(lessonId)?.total_steps ?? 0
        recordGuestLessonComplete(lessonId, ctx.moduleId, ctx.pathId, score, totalSteps)
        return { bonusXp, leveledUp: false, newLevel: levelForXP(optimisticNewTotalXp) }
      }

      if (!hydratedRef.current) {
        console.warn(`[LearnProgress] lesson ${lessonId} completion saved before hydration completed`)
      }

      // Same queue as step saves — a completion must not be applied out of
      // order relative to the step saves that led up to it.
      return enqueueSave(async () => {
        const res = await withRetry(
          () => submitLessonComplete(lessonId, score, timeSpentSec, ctx, token),
          `lesson complete ${lessonId}`,
        )
        if (!res) {
          // Save failed twice — keep the optimistic completion state as-is;
          // report the optimistic bonus back so the completion screen isn't broken.
          return { bonusXp, leveledUp: false, newLevel: levelForXP(optimisticNewTotalXp) }
        }
        setProgress((prev) => ({
          ...prev,
          skill: { ...prev.skill, total_xp: res.new_total_xp, level: res.new_level },
          achievementIds: res.newly_unlocked_achievement_ids.length
            ? new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids])
            : prev.achievementIds,
        }))
        return { bonusXp: res.bonus_xp_earned, leveledUp: res.leveled_up, newLevel: res.new_level }
      })
    },
    [user, token, enqueueSave],
  )

  const recordModuleComplete = useCallback(
    async (moduleId: string, ctx: ModuleCompleteContext) => {
      // Guests don't get durable module-completion XP — nothing to persist,
      // and no server-side idempotency guard to check against.
      if (!user || !token) {
        return { bonusXp: 0, leveledUp: false, newLevel: levelForXP(0) }
      }

      // Already recorded locally — skip the round-trip entirely rather than
      // relying solely on the server's idempotency check.
      if (progress.completedModules.has(moduleId)) {
        return { bonusXp: 0, leveledUp: false, newLevel: progress.skill.level }
      }

      if (!hydratedRef.current) {
        console.warn(`[LearnProgress] module ${moduleId} completion saved before hydration completed`)
      }

      // Same queue as step/lesson saves — a module completion must not be
      // applied out of order relative to the lesson completions that led up to it.
      return enqueueSave(async () => {
        const res = await withRetry(
          () => submitModuleComplete(moduleId, ctx, token),
          `module complete ${moduleId}`,
        )
        if (!res) {
          return { bonusXp: 0, leveledUp: false, newLevel: progress.skill.level }
        }
        setProgress((prev) => ({
          ...prev,
          skill: { ...prev.skill, total_xp: res.new_total_xp, level: res.new_level },
          completedModules: res.eligible
            ? new Set(prev.completedModules).add(moduleId)
            : prev.completedModules,
          achievementIds: res.newly_unlocked_achievement_ids.length
            ? new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids])
            : prev.achievementIds,
        }))
        return { bonusXp: res.bonus_xp_earned, leveledUp: res.leveled_up, newLevel: res.new_level }
      })
    },
    [user, token, enqueueSave, progress.completedModules, progress.skill.level],
  )

  const resolveLeak = useCallback(
    (leakId: string) => {
      setProgress((prev) => ({ ...prev, leaks: prev.leaks.filter((l) => l.id !== leakId) }))
      if (!user || !token) return
      withRetry(() => apiResolveLeak(leakId, token), `resolve leak ${leakId}`).then((res) => {
        if (res?.newly_unlocked_achievement_ids.length) {
          setProgress((prev) => ({
            ...prev,
            achievementIds: new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids]),
          }))
        }
      })
    },
    [user, token],
  )

  const value = useMemo(
    () => ({ progress, recordStepResult, recordLessonComplete, recordModuleComplete, resolveLeak }),
    [progress, recordStepResult, recordLessonComplete, recordModuleComplete, resolveLeak],
  )

  return <LearnProgressContext.Provider value={value}>{children}</LearnProgressContext.Provider>
}

export function useLearnProgress() {
  return useContext(LearnProgressContext)
}

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
  resolveLeak as apiResolveLeak,
  mergeGuestProgress,
  type LessonProgressEntry,
  type ConceptMasteryEntry,
  type ContinueLearningTarget,
} from '@/lib/learn/api'
import {
  recordGuestStep,
  recordGuestLessonComplete,
  hasGuestProgress,
  clearGuestProgress,
  guestLessonsForMerge,
  getGuestLessonProgress,
} from '@/lib/learn/guestProgress'

// ── Public shape ──────────────────────────────────────────────────────────────

export interface LearnProgressState {
  loading: boolean
  error: string | null
  isGuest: boolean
  skill: { total_xp: number; level: number; streak_days: number }
  lessons: Record<string, LessonProgressEntry>
  completedSteps: Record<string, string[]>
  concepts: Record<string, ConceptMasteryEntry>
  leaks: UserLeak[]
  achievementIds: Set<string>
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
  resolveLeak: (leakId: string) => void
}

const EMPTY_STATE: LearnProgressState = {
  loading: true,
  error: null,
  isGuest: true,
  skill: { total_xp: 0, level: 1, streak_days: 0 },
  lessons: {},
  completedSteps: {},
  concepts: {},
  leaks: [],
  achievementIds: new Set(),
  continueTarget: null,
}

const LearnProgressContext = createContext<LearnProgressContextType>({
  progress: EMPTY_STATE,
  recordStepResult: () => {},
  recordLessonComplete: async () => ({ bonusXp: 0, leveledUp: false, newLevel: 1 }),
  resolveLeak: () => {},
})

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
    setProgress({
      loading: false,
      error: null,
      isGuest: true,
      skill: { total_xp: 0, level: 1, streak_days: 0 },
      lessons,
      completedSteps,
      concepts: {},
      leaks: [],
      achievementIds: new Set(),
      continueTarget: computeContinueTarget(lessons),
    })
  }, [])

  const loadAuthedProgress = useCallback(async () => {
    if (!token) return
    setProgress((p) => ({ ...p, loading: true, error: null }))
    try {
      const full = await fetchFullProgress(token)
      setProgress({
        loading: false,
        error: null,
        isGuest: false,
        skill: full.skill,
        lessons: full.lessons,
        completedSteps: full.completed_steps,
        concepts: full.concepts,
        leaks: full.leaks,
        achievementIds: new Set(full.achievements.map((a) => a.id)),
        continueTarget: full.continue,
      })
    } catch (e) {
      setProgress((p) => ({ ...p, loading: false, error: (e as Error).message ?? 'Failed to load progress' }))
    }
  }, [token])

  // Initial load + guest→authenticated merge
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      loadGuestProgress()
      return
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

      submitStepResult(lessonId, stepId, result, response, conceptIds, timeMs, ctx, token)
        .then((res) => {
          setProgress((prev) => ({
            ...prev,
            skill: { ...prev.skill, total_xp: res.new_total_xp, level: res.new_level },
            achievementIds: res.newly_unlocked_achievement_ids.length
              ? new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids])
              : prev.achievementIds,
          }))
        })
        .catch(() => {
          // Save failed — keep the optimistic local state as-is (never destroy
          // current progress); the next successful write will reconcile totals.
        })
    },
    [user, token],
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

      try {
        const res = await submitLessonComplete(lessonId, score, timeSpentSec, ctx, token)
        setProgress((prev) => ({
          ...prev,
          skill: { ...prev.skill, total_xp: res.new_total_xp, level: res.new_level },
          achievementIds: res.newly_unlocked_achievement_ids.length
            ? new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids])
            : prev.achievementIds,
        }))
        return { bonusXp: res.bonus_xp_earned, leveledUp: res.leveled_up, newLevel: res.new_level }
      } catch {
        // Save failed — keep the optimistic completion state as-is; a later
        // reconciling fetch will catch up. Report the optimistic bonus back.
        return { bonusXp, leveledUp: false, newLevel: levelForXP(optimisticNewTotalXp) }
      }
    },
    [user, token],
  )

  const resolveLeak = useCallback(
    (leakId: string) => {
      setProgress((prev) => ({ ...prev, leaks: prev.leaks.filter((l) => l.id !== leakId) }))
      if (!user || !token) return
      apiResolveLeak(leakId, token)
        .then((res) => {
          if (res.newly_unlocked_achievement_ids.length) {
            setProgress((prev) => ({
              ...prev,
              achievementIds: new Set([...prev.achievementIds, ...res.newly_unlocked_achievement_ids]),
            }))
          }
        })
        .catch(() => {
          // Non-fatal — leak stays resolved locally even if the write is still in flight/retrying.
        })
    },
    [user, token],
  )

  const value = useMemo(
    () => ({ progress, recordStepResult, recordLessonComplete, resolveLeak }),
    [progress, recordStepResult, recordLessonComplete, resolveLeak],
  )

  return <LearnProgressContext.Provider value={value}>{children}</LearnProgressContext.Provider>
}

export function useLearnProgress() {
  return useContext(LearnProgressContext)
}

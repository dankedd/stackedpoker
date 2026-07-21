import type {
  StepResult,
  UserLeak,
  MasteryLevel,
  CoachMessage,
  TrainingSession,
} from './types'

/**
 * ARCHITECTURE NOTE
 * -----------------
 * Puzzle evaluation is LOCAL and DETERMINISTIC (see lib/learn/evaluator.ts).
 * The server is NOT responsible for scoring, quality, XP, or pass/fail — it
 * durably stores the client's already-computed result and does bookkeeping
 * that depends on server-held state (XP totals, SM-2 scheduling, leak
 * aggregation, streaks, idempotent achievement unlocking).
 *
 * "Analysis unavailable" can NEVER occur for core puzzle correctness.
 */

// ── Range trainer types (unrelated to progress persistence, left as-is) ──────

export interface RangeTrainerSetup {
  node_id: string
  position: string
  vs_position: string
  pot_type: string
  description: string
  target_combos: string[]
  hint: string
}

export interface RangeEvaluation {
  score: number
  quality: string
  overlap_pct: number
  missed_combos: string[]
  extra_combos: string[]
  feedback: string
  xp_earned: number
}

// ── Core fetch helper (mirrors frontend/lib/api.ts pattern) ───────────────────

const API_BASE = ''

async function learnFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...init,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
    const detail = body.detail ?? `HTTP ${res.status}`
    const message = typeof detail === 'string' ? detail : (detail.message ?? JSON.stringify(detail))
    const err = new Error(message)
    ;(err as Error & { detail?: unknown }).detail = detail
    throw err
  }

  return res.json() as Promise<T>
}

// ── Full progress bundle (hydration on Learn open) ───────────────────────────

export interface LessonProgressEntry {
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  attempts: number
  best_score: number
  last_score: number
  current_step_index: number
  current_step_id: string | null
  total_steps: number | null
  completed_at: string | null
  module_id: string | null
  path_id: string | null
  updated_at?: string | null
}

export interface ConceptMasteryEntry {
  mastery_level: MasteryLevel
  exposures: number
  correct_streak: number
  ease_factor: number
  interval_days: number
  next_review: string | null
  last_tested: string | null
}

export interface ContinueLearningTarget {
  lesson_id: string
  module_id: string | null
  path_id: string | null
  step_index: number
  total_steps: number | null
}

export interface AchievementRecord {
  id: string
  earned_at: string
}

export interface FullLearnProgress {
  skill: { total_xp: number; level: number; streak_days: number; last_active: string | null }
  lessons: Record<string, LessonProgressEntry>
  completed_steps: Record<string, string[]>
  concepts: Record<string, ConceptMasteryEntry>
  leaks: UserLeak[]
  achievements: AchievementRecord[]
  continue: ContinueLearningTarget | null
}

export async function fetchFullProgress(token: string): Promise<FullLearnProgress> {
  return learnFetch<FullLearnProgress>('/api/learn/progress', token)
}

// ── Step result submission ────────────────────────────────────────────────────

export interface StepResultContext {
  moduleId?: string
  pathId?: string
  stepIndex: number
  totalSteps: number
}

export interface StepSubmitResponse {
  new_total_xp: number
  new_level: number
  leveled_up: boolean
  xp_awarded_this_call: number
  mastery_updates: { concept_id: string; mastery_level: number }[]
  newly_unlocked_achievement_ids: string[]
}

export async function submitStepResult(
  lessonId: string,
  stepId: string,
  result: StepResult,
  response: unknown,
  conceptIds: string[],
  timeMs: number,
  ctx: StepResultContext,
  token: string,
): Promise<StepSubmitResponse> {
  return learnFetch<StepSubmitResponse>(
    `/api/learn/steps/${encodeURIComponent(lessonId)}/${encodeURIComponent(stepId)}`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        score: result.score,
        quality: result.quality,
        xp_earned: result.xp_earned,
        ev_loss_bb: result.ev_loss_bb,
        concept_ids: conceptIds,
        response,
        time_ms: timeMs,
        module_id: ctx.moduleId,
        path_id: ctx.pathId,
        step_index: ctx.stepIndex,
        total_steps: ctx.totalSteps,
      }),
    },
  )
}

// ── Lesson completion ─────────────────────────────────────────────────────────

export interface LessonCompleteContext {
  moduleId?: string
  pathId?: string
  /** lesson.xp_reward from curriculum.ts — scaled by score% into a one-time completion bonus */
  lessonXpReward: number
  /** every lesson id in this lesson's path (curriculum.ts) — used server-side to verify, not trust, path completion */
  pathLessonIds: string[]
}

export interface LessonCompleteResponse {
  lesson_id: string
  score: number
  bonus_xp_earned: number
  new_total_xp: number
  new_level: number
  leveled_up: boolean
  already_completed: boolean
  newly_unlocked_achievement_ids: string[]
}

export async function submitLessonComplete(
  lessonId: string,
  score: number,
  timeSpentSec: number,
  ctx: LessonCompleteContext,
  token: string,
): Promise<LessonCompleteResponse> {
  return learnFetch<LessonCompleteResponse>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/complete`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        score,
        time_spent_sec: timeSpentSec,
        module_id: ctx.moduleId,
        path_id: ctx.pathId,
        lesson_xp_reward: ctx.lessonXpReward,
        path_lesson_ids: ctx.pathLessonIds,
      }),
    },
  )
}

// ── Leaks ──────────────────────────────────────────────────────────────────────

export async function resolveLeak(
  leakId: string,
  token: string,
): Promise<{ leak_id: string; resolved: boolean; newly_unlocked_achievement_ids: string[] }> {
  return learnFetch(`/api/learn/leaks/${encodeURIComponent(leakId)}/resolve`, token, {
    method: 'POST',
  })
}

// ── Guest → account progress merge ────────────────────────────────────────────

export interface GuestStepEventPayload {
  step_id: string
  score: number
  quality: string
  xp_earned: number
  ev_loss_bb: number
  concept_ids: string[]
  response: unknown
}

export interface GuestLessonEventPayload {
  lesson_id: string
  module_id?: string
  path_id?: string
  status: 'in_progress' | 'completed'
  last_score: number
  best_score: number
  current_step_index: number
  current_step_id: string | null
  total_steps: number
  steps: GuestStepEventPayload[]
}

export interface MergeGuestProgressResponse {
  imported_lessons: string[]
  new_total_xp: number
  newly_unlocked_achievement_ids: string[]
}

export async function mergeGuestProgress(
  lessons: GuestLessonEventPayload[],
  token: string,
): Promise<MergeGuestProgressResponse> {
  return learnFetch<MergeGuestProgressResponse>('/api/learn/merge-guest-progress', token, {
    method: 'POST',
    body: JSON.stringify({ lessons }),
  })
}

// ── Optional AI explanation (enhancement only, never required for scoring) ────
// Unrelated to progress persistence — left as-is (endpoint is not implemented
// server-side today; call sites already treat this as best-effort).

export async function requestAIExplanation(
  lessonId: string,
  stepId: string,
  userResponse: unknown,
  result: StepResult,
  token: string,
): Promise<{ explanation: string }> {
  return learnFetch<{ explanation: string }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/explain`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ user_response: userResponse, result }),
    },
  )
}

// ── Range trainer (unrelated to progress persistence, left as-is) ────────────

export async function fetchRangeTrainer(nodeId: string, token: string): Promise<RangeTrainerSetup> {
  return learnFetch<RangeTrainerSetup>(`/api/learn/range-trainer/${encodeURIComponent(nodeId)}`, token)
}

export async function evaluateRange(
  nodeId: string,
  combos: string[],
  token: string,
): Promise<RangeEvaluation> {
  return learnFetch<RangeEvaluation>(`/api/learn/range-trainer/${encodeURIComponent(nodeId)}/evaluate`, token, {
    method: 'POST',
    body: JSON.stringify({ combos }),
  })
}

// ── Coach (unrelated to progress persistence, left as-is) ────────────────────

export async function sendCoachMessage(
  sessionId: string | null,
  message: string,
  context: Record<string, unknown>,
  token: string,
): Promise<{ session_id: string; reply: CoachMessage }> {
  return learnFetch<{ session_id: string; reply: CoachMessage }>('/api/learn/coach/message', token, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message, context }),
  })
}

export async function fetchCoachSession(sessionId: string, token: string): Promise<TrainingSession> {
  return learnFetch<TrainingSession>(`/api/learn/coach/sessions/${encodeURIComponent(sessionId)}`, token)
}

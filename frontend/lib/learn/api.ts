import type {
  PersonalizedDashboard,
  LearningPath,
  LearningModule,
  Lesson,
  StepResult,
  UserSkillProgress,
  UserConceptMastery,
  UserLeak,
  CoachMessage,
  TrainingSession,
} from './types'

// ── Range trainer types ───────────────────────────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function fetchLearningDashboard(token: string): Promise<PersonalizedDashboard> {
  return learnFetch<PersonalizedDashboard>('/api/learn/dashboard', token)
}

// ── Paths & modules ───────────────────────────────────────────────────────────

export async function fetchLearningPaths(token: string): Promise<LearningPath[]> {
  return learnFetch<LearningPath[]>('/api/learn/paths', token)
}

export async function fetchModuleDetail(slug: string, token: string): Promise<LearningModule> {
  return learnFetch<LearningModule>(`/api/learn/modules/${encodeURIComponent(slug)}`, token)
}

export async function fetchLessonDetail(slug: string, token: string): Promise<Lesson> {
  return learnFetch<Lesson>(`/api/learn/lessons/${encodeURIComponent(slug)}`, token)
}

// ── Step evaluation ───────────────────────────────────────────────────────────

export async function evaluateStep(
  lessonId: string,
  stepId: string,
  userResponse: unknown,
  timeMs: number,
  token: string,
): Promise<StepResult> {
  return learnFetch<StepResult>(`/api/learn/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/evaluate`, token, {
    method: 'POST',
    body: JSON.stringify({ user_response: userResponse, time_ms: timeMs }),
  })
}

// ── Lesson completion ─────────────────────────────────────────────────────────

export async function completeLesson(
  lessonId: string,
  score: number,
  token: string,
): Promise<{ xp_earned: number; leveled_up: boolean }> {
  return learnFetch<{ xp_earned: number; leveled_up: boolean }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/complete`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ score }),
    },
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function fetchUserProgress(token: string): Promise<UserSkillProgress> {
  return learnFetch<UserSkillProgress>('/api/learn/progress', token)
}

export async function fetchConceptMasteries(token: string): Promise<UserConceptMastery[]> {
  return learnFetch<UserConceptMastery[]>('/api/learn/progress/concepts', token)
}

export async function fetchUserLeaks(token: string): Promise<UserLeak[]> {
  return learnFetch<UserLeak[]>('/api/learn/progress/leaks', token)
}

export async function resolveLeak(leakId: string, token: string): Promise<void> {
  await learnFetch<void>(`/api/learn/progress/leaks/${encodeURIComponent(leakId)}/resolve`, token, {
    method: 'POST',
  })
}

// ── Range trainer ─────────────────────────────────────────────────────────────

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

// ── Coach ─────────────────────────────────────────────────────────────────────

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

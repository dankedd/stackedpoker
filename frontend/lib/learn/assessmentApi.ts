// Thin client for the skill-assessment endpoints — mirrors the learnFetch
// pattern in lib/learn/api.ts (relative /api/learn/... paths, bearer token).

import type { AssessmentTraceEntry } from './assessmentEngine'
import type { AssessmentLeague, AssessmentTopic } from './assessmentQuestions'

const API_BASE = ''

async function assessmentFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface SubmitAssessmentPayload {
  self_experience: string | null
  self_stakes: string | null
  self_confidence: number
  questions_answered: number
  correct_count: number
  assessment_score: number
  final_challenge_offered: boolean
  final_challenge_passed: boolean | null
  answer_trace: AssessmentTraceEntry[]
  estimated_league: AssessmentLeague
  recommended_league: AssessmentLeague
  chosen_start_league: AssessmentLeague
  fast_track_taken: boolean
  fast_track_passed: boolean | null
  recommended_module_id: string
  strongest_topics: AssessmentTopic[]
  weakest_topics: AssessmentTopic[]
  estimated_study_hours: number
}

export function submitAssessment(token: string, payload: SubmitAssessmentPayload) {
  return assessmentFetch<{ ok: boolean }>('/api/learn/assessment/submit', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface AssessmentStatus {
  assessment_completed: boolean
  estimated_league: AssessmentLeague | null
  recommended_module_id: string | null
  weakest_topics: AssessmentTopic[]
  completed_at: string | null
}

export function getAssessmentStatus(token: string) {
  return assessmentFetch<AssessmentStatus>('/api/learn/assessment/status', token)
}

export function retakeAssessment(token: string) {
  return assessmentFetch<{ ok: boolean }>('/api/learn/assessment/retake', token, { method: 'POST' })
}

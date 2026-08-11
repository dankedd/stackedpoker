// Thin client for the onboarding self-assessment endpoints — mirrors the
// learnFetch pattern in lib/learn/api.ts (relative /api/learn/... paths,
// bearer token).

import type { ExperienceLevel } from './experienceLevel'

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
  experience_level: ExperienceLevel
  recommended_module_id: string
}

export function submitAssessment(token: string, payload: SubmitAssessmentPayload) {
  return assessmentFetch<{ ok: boolean }>('/api/learn/assessment/submit', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface AssessmentStatus {
  assessment_completed: boolean
  experience_level: ExperienceLevel | null
  recommended_module_id: string | null
  completed_at: string | null
}

export function getAssessmentStatus(token: string) {
  return assessmentFetch<AssessmentStatus>('/api/learn/assessment/status', token)
}

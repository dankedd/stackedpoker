// Thin client for the onboarding self-assessment endpoints — mirrors the
// learnFetch pattern in lib/learn/api.ts (relative /api/learn/... paths,
// bearer token).

import type { ExperienceLevel } from './experienceLevel'

const API_BASE = ''

// Distinguishes *why* a call failed so the UI can say something more useful
// than a bare error string — a 404 here almost always means a frontend/
// backend deployment mismatch (the route genuinely doesn't exist on
// whatever's currently running), which is a very different problem from
// "you're not logged in" (401/403) or "the server choked" (500), and none
// of those should ever be shown to a learner as a flat "Not Found".
export type AssessmentApiErrorKind = 'auth' | 'not_found' | 'invalid' | 'server' | 'network' | 'timeout'

export class AssessmentApiError extends Error {
  kind: AssessmentApiErrorKind
  status: number | null

  constructor(kind: AssessmentApiErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'AssessmentApiError'
    this.kind = kind
    this.status = status
  }
}

/** User-facing copy per failure kind — one place so onboarding and the
 *  Settings level-picker never drift into inconsistent wording. */
export function describeAssessmentError(err: unknown): string {
  if (err instanceof AssessmentApiError) {
    switch (err.kind) {
      case 'auth':
        return "Your session expired — please sign in again."
      case 'not_found':
        return "This feature isn't available right now (a deployment is out of sync). We've been notified."
      case 'invalid':
        return "Something about that answer wasn't recognized. Please try again."
      case 'server':
        return "Our server hit a problem saving this. Please try again in a moment."
      case 'timeout':
        return "That took too long — check your connection and try again."
      case 'network':
        return "Couldn't reach the server — check your connection and try again."
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}

async function assessmentFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: controller.signal,
      ...init,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AssessmentApiError('timeout', 'Request timed out.')
    }
    // fetch() only rejects for genuine network failures (DNS, offline, a
    // blocked CORS preflight, connection refused) — never for HTTP error
    // statuses, which are handled below via res.ok instead.
    throw new AssessmentApiError('network', e instanceof Error ? e.message : 'Network request failed.')
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: null as string | null }))
    const detail = typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`
    const kind: AssessmentApiErrorKind =
      res.status === 401 || res.status === 403 ? 'auth'
      : res.status === 404 ? 'not_found'
      : res.status === 422 ? 'invalid'
      : 'server'
    throw new AssessmentApiError(kind, detail, res.status)
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

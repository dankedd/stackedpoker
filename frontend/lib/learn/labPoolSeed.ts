/**
 * Per-attempt seed for pooled lessons (Opening Range Drill, Preflop Foundation Lab).
 *
 * `lessonProgress.attempts` (LearnProgressContext) increments on every single answered
 * step, not once per lesson attempt, so it can't be reused as a stable-within-an-attempt
 * seed. Instead: a seed is generated once and persisted in localStorage the first time the
 * learner opens a pooled lesson, stays stable across refreshes/resumes (so the drawn
 * question set doesn't reshuffle mid-attempt), and is explicitly cleared on completion so
 * the next attempt draws a genuinely fresh stratified set.
 */

const STORAGE_PREFIX = 'pokercoach:learn:pool-seed:'

function storageKey(lessonId: string, userKey: string): string {
  return `${STORAGE_PREFIX}${lessonId}:${userKey}`
}

export function getOrCreateLabAttemptSeed(lessonId: string, userKey: string): string {
  if (typeof window === 'undefined') {
    // SSR/no-storage fallback — deterministic but not persisted; the client
    // re-derives (and persists) a real seed on hydration.
    return `${lessonId}:${userKey}:ssr`
  }
  const key = storageKey(lessonId, userKey)
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const fresh = `${lessonId}:${userKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, fresh)
  return fresh
}

export function clearLabAttemptSeed(lessonId: string, userKey: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(lessonId, userKey))
}

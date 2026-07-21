import type { GuestLessonEventPayload, GuestStepEventPayload } from './api'

/**
 * Guest (unauthenticated) learning progress, stored locally so it survives
 * refresh within the same browser. Mirrors the exact same event shapes the
 * authenticated API uses, so `mergeGuestProgress` can replay it unchanged
 * once the guest signs up/in — see LearnProgressContext.
 */

const STORAGE_KEY = 'pokercoach:learn:guest:v1'

interface GuestProgressStore {
  lessons: Record<string, GuestLessonEventPayload>
}

function readStore(): GuestProgressStore {
  if (typeof window === 'undefined') return { lessons: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lessons: {} }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.lessons) return parsed as GuestProgressStore
    return { lessons: {} }
  } catch {
    return { lessons: {} }
  }
}

function writeStore(store: GuestProgressStore): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // storage full/unavailable — this write just won't persist, never throws
  }
}

export function getGuestLessonProgress(lessonId: string): GuestLessonEventPayload | undefined {
  return readStore().lessons[lessonId]
}

export function hasGuestProgress(): boolean {
  return Object.keys(readStore().lessons).length > 0
}

export function recordGuestStep(
  lessonId: string,
  moduleId: string | undefined,
  pathId: string | undefined,
  step: GuestStepEventPayload,
  stepIndex: number,
  totalSteps: number,
): void {
  const store = readStore()
  const existing = store.lessons[lessonId]
  const stepsWithout = (existing?.steps ?? []).filter((s) => s.step_id !== step.step_id)

  store.lessons[lessonId] = {
    lesson_id: lessonId,
    module_id: moduleId ?? existing?.module_id,
    path_id: pathId ?? existing?.path_id,
    status: existing?.status === 'completed' ? 'completed' : 'in_progress',
    last_score: step.score,
    best_score: Math.max(existing?.best_score ?? 0, step.score),
    current_step_index: stepIndex,
    current_step_id: step.step_id,
    total_steps: totalSteps,
    steps: [...stepsWithout, step],
  }
  writeStore(store)
}

export function recordGuestLessonComplete(
  lessonId: string,
  moduleId: string | undefined,
  pathId: string | undefined,
  score: number,
  totalSteps: number,
): void {
  const store = readStore()
  const existing = store.lessons[lessonId]
  store.lessons[lessonId] = {
    lesson_id: lessonId,
    module_id: moduleId ?? existing?.module_id,
    path_id: pathId ?? existing?.path_id,
    status: 'completed',
    last_score: score,
    best_score: Math.max(score, existing?.best_score ?? 0),
    current_step_index: existing?.current_step_index ?? totalSteps,
    current_step_id: existing?.current_step_id ?? null,
    total_steps: totalSteps,
    steps: existing?.steps ?? [],
  }
  writeStore(store)
}

export function clearGuestProgress(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function guestLessonsForMerge(): GuestLessonEventPayload[] {
  return Object.values(readStore().lessons)
}

/**
 * Orchestrates the durable, server-confirmed lesson-completion write shared
 * between two triggers: the instant a lesson reaches its completed state
 * (LessonPlayer's `onLessonFinished`, fired before any click) and the
 * learner's "Continue Learning" click (LessonPlayer's `onComplete`).
 *
 * ROOT CAUSE this fixes: previously the lesson page awaited the completion
 * promise directly with no error handling. Any rejection (offline, a
 * transient network error, a thrown exception anywhere in the persistence
 * chain) became an unhandled promise rejection — `setCompletionData` never
 * ran, so the "Continue Learning" click produced no visible effect at all.
 * Worse, the in-flight promise ref was never cleared on failure, so every
 * subsequent click re-awaited the SAME rejected promise and failed the same
 * way again — the button was permanently dead, not just glitchy.
 *
 * `startCompletion` fixes both: on success the ref keeps holding the
 * resolved promise (so a second click / the fallback path never re-submits
 * — no duplicate writes, no double XP), but on failure the ref is cleared so
 * the next attempt (an automatic retry via the eager background call, or an
 * explicit "Retry" click) starts a genuinely fresh request instead of
 * replaying a dead promise forever.
 */

export interface CompletionFlowResult {
  bonusXp: number
  leveledUp: boolean
  newLevel: number
  moduleComplete?: { xp: number }
}

export interface PendingCompletionRef {
  current: Promise<CompletionFlowResult> | null
}

/**
 * Starts the durable completion write, or returns the already in-flight (or
 * already-settled) attempt if one exists. Safe to call concurrently — e.g. a
 * double-click — since the ref is checked and set synchronously before `run`
 * is ever invoked a second time.
 */
export function startCompletion(
  ref: PendingCompletionRef,
  run: () => Promise<CompletionFlowResult>,
): Promise<CompletionFlowResult> {
  if (ref.current) return ref.current
  const attempt = run().catch((err) => {
    // Only clear if nothing else has already replaced this attempt (e.g. a
    // near-simultaneous retry) — never clobber a newer attempt's slot.
    if (ref.current === attempt) ref.current = null
    throw err
  })
  ref.current = attempt
  return attempt
}

/**
 * The full "Continue Learning" click handler's logic, extracted so it can be
 * unit-tested without a DOM: await the shared/fresh attempt, and route the
 * outcome to exactly one of `onSuccess` / `onError` — never both, never
 * neither, and `onSuccess` fires at most once per successful attempt (repeat
 * calls while an attempt is already resolved just re-deliver the same
 * cached result, matching "never fire lesson completion twice").
 */
export async function completeLesson(
  ref: PendingCompletionRef,
  run: () => Promise<CompletionFlowResult>,
  callbacks: {
    onSuccess: (result: CompletionFlowResult) => void
    onError: (error: unknown) => void
  },
): Promise<void> {
  try {
    const result = await startCompletion(ref, run)
    callbacks.onSuccess(result)
  } catch (err) {
    callbacks.onError(err)
  }
}

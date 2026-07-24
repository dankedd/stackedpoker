import { describe, it, expect, vi } from 'vitest'
import {
  startCompletion,
  completeLesson,
  type CompletionFlowResult,
  type PendingCompletionRef,
} from '../completionFlow'

/**
 * Regression coverage for the "Continue Learning does nothing" bug.
 *
 * Root cause: app/learn/lesson/[slug]/page.tsx awaited the completion
 * promise directly with no error handling. Any rejection became an
 * unhandled promise rejection — setCompletionData (and therefore next-lesson
 * navigation) never ran, and the ref holding the rejected promise was never
 * cleared, so every later click re-awaited the same dead promise forever.
 *
 * These tests exercise the extracted orchestration logic (startCompletion /
 * completeLesson) directly — no DOM needed, since this project has no DOM
 * test environment configured (vitest.config.ts environment: 'node').
 */

const RESULT: CompletionFlowResult = { bonusXp: 40, leveledUp: false, newLevel: 3 }

function makeRef(): PendingCompletionRef {
  return { current: null }
}

describe('startCompletion', () => {
  it('finish lesson -> click Continue Learning -> existing promise resolves -> caller gets the result exactly once', async () => {
    const ref = makeRef()
    const run = vi.fn(() => Promise.resolve(RESULT))

    // The eager background write (onLessonFinished) starts the attempt...
    const eager = startCompletion(ref, run)
    // ...and the "Continue Learning" click reuses the SAME in-flight promise.
    const onClick = startCompletion(ref, run)

    expect(onClick).toBe(eager)
    await expect(onClick).resolves.toEqual(RESULT)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('double-click protection: two synchronous calls before the attempt settles only run once', async () => {
    const ref = makeRef()
    const run = vi.fn(() => Promise.resolve(RESULT))

    const [a, b] = [startCompletion(ref, run), startCompletion(ref, run)]
    await Promise.all([a, b])

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('already-completed/replayed lesson: server reports zero bonus XP, still resolves (and only calls run once)', async () => {
    const ref = makeRef()
    const replay: CompletionFlowResult = { bonusXp: 0, leveledUp: false, newLevel: 3 }
    const run = vi.fn(() => Promise.resolve(replay))

    const result = await startCompletion(ref, run)

    expect(result.bonusXp).toBe(0)
    expect(run).toHaveBeenCalledTimes(1)
    // A second consumer (e.g. a re-render re-invoking the click handler)
    // must reuse the cached resolution, not re-submit.
    await startCompletion(ref, run)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('last lesson in a module: moduleComplete bonus passes through untouched', async () => {
    const ref = makeRef()
    const withModule: CompletionFlowResult = { bonusXp: 25, leveledUp: true, newLevel: 4, moduleComplete: { xp: 100 } }
    const run = vi.fn(() => Promise.resolve(withModule))

    const result = await startCompletion(ref, run)

    expect(result.moduleComplete).toEqual({ xp: 100 })
  })

  it('failure clears the ref so a retry is a genuinely fresh attempt, not a replay of the dead promise', async () => {
    const ref = makeRef()
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(RESULT)

    await expect(startCompletion(ref, run)).rejects.toThrow('network down')
    // THE BUG: previously the ref kept holding the rejected promise forever,
    // so every subsequent "click" re-awaited it and failed identically —
    // this is what "the button does nothing, permanently" looked like.
    expect(ref.current).toBeNull()

    const retry = await startCompletion(ref, run)
    expect(retry).toEqual(RESULT)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('does not clear a newer attempt if an older one settles/rejects late (out-of-order settlement safety)', async () => {
    const ref = makeRef()
    let rejectFirst!: (e: unknown) => void
    const first = new Promise<CompletionFlowResult>((_, reject) => {
      rejectFirst = reject
    })
    const run = vi.fn(() => first)

    const firstAttempt = startCompletion(ref, run).catch(() => {})
    // A newer attempt replaces the slot (simulating startCompletion being
    // called again after the ref was cleared by some other failure path).
    ref.current = Promise.resolve(RESULT)
    const newer = ref.current

    rejectFirst(new Error('late rejection from an abandoned attempt'))
    await firstAttempt

    // The late rejection of the OLD attempt must not clobber the newer one.
    expect(ref.current).toBe(newer)
  })
})

describe('completeLesson (the exact "Continue Learning" click handler logic)', () => {
  it('resolves -> onSuccess fires exactly once with the result, onError never fires', async () => {
    const ref = makeRef()
    const run = vi.fn(() => Promise.resolve(RESULT))
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await completeLesson(ref, run, { onSuccess, onError })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(RESULT)
    expect(onError).not.toHaveBeenCalled()
  })

  it('completion request failure -> onError fires (not silently swallowed), onSuccess never fires', async () => {
    const ref = makeRef()
    const run = vi.fn(() => Promise.reject(new Error('offline')))
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await completeLesson(ref, run, { onSuccess, onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('failure then retry: second completeLesson call after a failure succeeds and navigates (onSuccess fires once)', async () => {
    const ref = makeRef()
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(RESULT)
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await completeLesson(ref, run, { onSuccess, onError }) // first click: fails
    await completeLesson(ref, run, { onSuccess, onError }) // retry click: succeeds

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(RESULT)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('guest flow: a synchronously-resolving run (no network round trip) still navigates exactly once', async () => {
    const ref = makeRef()
    // Guests persist to localStorage, not a server round trip — the
    // resulting promise settles on the next microtask rather than after a
    // real fetch, but the contract must be identical.
    const guestResult: CompletionFlowResult = { bonusXp: 15, leveledUp: false, newLevel: 1 }
    const run = vi.fn(() => Promise.resolve(guestResult))
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await completeLesson(ref, run, { onSuccess, onError })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(guestResult)
  })

  it('never fires lesson completion twice: two rapid completeLesson calls only ever invoke run once on success', async () => {
    const ref = makeRef()
    const run = vi.fn(() => Promise.resolve(RESULT))
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await Promise.all([
      completeLesson(ref, run, { onSuccess, onError }),
      completeLesson(ref, run, { onSuccess, onError }),
    ])

    expect(run).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(2) // both callers get the shared result...
    expect(onSuccess).toHaveBeenNthCalledWith(1, RESULT)
    expect(onSuccess).toHaveBeenNthCalledWith(2, RESULT) // ...but XP was only ever awarded once server-side (single run() call)
  })
})

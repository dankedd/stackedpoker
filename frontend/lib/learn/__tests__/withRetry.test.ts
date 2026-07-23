import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '@/contexts/LearnProgressContext'

describe('withRetry', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    errorSpy.mockRestore()
  })

  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, 'test-op')
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('retries exactly once after a failure, and returns the retry result if it succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('network blip')).mockResolvedValueOnce('recovered')
    const promise = withRetry(fn, 'test-op')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
    // The failure must be logged, not swallowed — this is the exact silent-failure
    // bug the persistence audit found (a lost save left zero trace anywhere).
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('returns null (never throws) after both attempts fail, and logs both failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('server down'))
    const promise = withRetry(fn, 'test-op')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBeNull()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(2)
  })

  it('never marks a doubly-failed save as successful to the caller', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('502'))
    const promise = withRetry(fn, 'submit-step')
    await vi.runAllTimersAsync()
    const result = await promise
    // null is the caller's signal to keep optimistic UI without claiming the
    // server write succeeded — never a falsy-but-truthy stand-in for success.
    expect(result).toBe(null)
  })
})

import { describe, it, expect } from 'vitest'
import { createSequentialQueue } from '../saveQueue'

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

describe('createSequentialQueue', () => {
  it('runs tasks strictly in enqueue order even when an earlier task resolves slower', async () => {
    const { enqueue } = createSequentialQueue()
    const order: string[] = []

    // Task A is enqueued first but is the SLOWER of the two — reproduces the
    // exact race from the persistence audit: "Step A save starts, Step B
    // save starts, Step B finishes, Step A finishes afterward."
    const a = enqueue(async () => {
      await delay(30, null)
      order.push('A')
      return 'A'
    })
    const b = enqueue(async () => {
      await delay(5, null)
      order.push('B')
      return 'B'
    })

    await Promise.all([a, b])

    // Despite B's underlying work finishing first, the queue must not have
    // let it START until A's task had already run to completion.
    expect(order).toEqual(['A', 'B'])
  })

  it('propagates each task result back to its own caller', async () => {
    const { enqueue } = createSequentialQueue()
    const a = enqueue(async () => 1)
    const b = enqueue(async () => 2)
    const c = enqueue(async () => 3)
    expect(await Promise.all([a, b, c])).toEqual([1, 2, 3])
  })

  it('a failed task does not block or poison tasks queued after it', async () => {
    const { enqueue } = createSequentialQueue()
    const order: string[] = []

    const a = enqueue(async () => {
      order.push('A')
      throw new Error('boom')
    })
    const b = enqueue(async () => {
      order.push('B')
      return 'ok'
    })

    await expect(a).rejects.toThrow('boom')
    await expect(b).resolves.toBe('ok')
    expect(order).toEqual(['A', 'B'])
  })

  it('three concurrently-enqueued saves for the same "lesson" apply in order (simulates 3 rapid step answers)', async () => {
    const { enqueue } = createSequentialQueue()
    let currentStepIndex = -1
    const applied: number[] = []

    function saveStepIndex(index: number, latencyMs: number) {
      return enqueue(async () => {
        await delay(latencyMs, null)
        currentStepIndex = index
        applied.push(index)
      })
    }

    // Reverse latency on purpose: the LAST-enqueued save is the FASTEST
    // network call. Without serialization this would let index 0 land last.
    await Promise.all([
      saveStepIndex(0, 40),
      saveStepIndex(1, 20),
      saveStepIndex(2, 0),
    ])

    expect(applied).toEqual([0, 1, 2])
    expect(currentStepIndex).toBe(2)
  })

  it('does not rely on fake timers or real delays to prove ordering — a synchronous stress test', async () => {
    const { enqueue } = createSequentialQueue()
    const results: number[] = []
    const tasks = Array.from({ length: 20 }, (_, i) =>
      enqueue(async () => {
        results.push(i)
        return i
      }),
    )
    await Promise.all(tasks)
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })
})

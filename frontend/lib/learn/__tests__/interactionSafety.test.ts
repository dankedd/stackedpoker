import { describe, it, expect } from 'vitest'
import { getNeutralSliderStart, shuffleBySeed } from '../interactionSafety'

describe('getNeutralSliderStart', () => {
  it('never returns the exact correct answer', () => {
    const answers = [0, 5, 8.5, 19.1, 20, 25, 32, 33.3, 50, 66.7, 75, 99, 100]
    for (const a of answers) {
      expect(getNeutralSliderStart(a, 0, 100)).not.toBe(a)
    }
  })

  it('stays within [min, max] bounds', () => {
    for (const a of [-10, 0, 6, 50, 8, 200]) {
      const start = getNeutralSliderStart(a, 0, 8)
      expect(start).toBeGreaterThanOrEqual(0)
      expect(start).toBeLessThanOrEqual(8)
    }
  })

  it('defaults to the midpoint when the answer is far from it', () => {
    expect(getNeutralSliderStart(25, 0, 100)).toBe(50)
    expect(getNeutralSliderStart(75, 0, 100)).toBe(50)
    expect(getNeutralSliderStart(19.1, 0, 100)).toBe(50)
  })

  it('does not sit suspiciously close to the correct answer even when the answer is near the midpoint', () => {
    const start = getNeutralSliderStart(50, 0, 100)
    expect(Math.abs(start - 50)).toBeGreaterThanOrEqual(8)
  })

  it('is deterministic — same inputs always produce the same output', () => {
    const a = getNeutralSliderStart(33.3, 0, 100)
    const b = getNeutralSliderStart(33.3, 0, 100)
    expect(a).toBe(b)
  })

  it('handles a small non-percentage range (e.g. clean-outs 0-8) correctly', () => {
    const start = getNeutralSliderStart(6, 0, 8)
    expect(start).not.toBe(6)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(start).toBeLessThanOrEqual(8)
  })
})

describe('shuffleBySeed', () => {
  it('returns a permutation containing exactly the same items', () => {
    const items = ['a', 'b', 'c', 'd']
    const shuffled = shuffleBySeed(items, 'step-1')
    expect(shuffled.slice().sort()).toEqual(items.slice().sort())
    expect(shuffled).toHaveLength(items.length)
  })

  it('is deterministic for a given seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const first = shuffleBySeed(items, 'poc-s5')
    const second = shuffleBySeed(items, 'poc-s5')
    expect(first).toEqual(second)
  })

  it('does not mutate the input array', () => {
    const items = ['a', 'b', 'c']
    const copy = items.slice()
    shuffleBySeed(items, 'seed')
    expect(items).toEqual(copy)
  })

  it('does not systematically place a fixed target at the same index across many different seeds', () => {
    // Regression test for the audit finding: ~46/48 Module 2 multiple-choice
    // questions had their correct option authored at index 0. Shuffling by a
    // varied seed (step id) must break that pattern up.
    const items = ['correct', 'wrong1', 'wrong2']
    const positions = { 0: 0, 1: 0, 2: 0 }
    const seeds = Array.from({ length: 200 }, (_, i) => `step-${i}`)
    for (const seed of seeds) {
      const shuffled = shuffleBySeed(items, seed)
      const idx = shuffled.indexOf('correct')
      positions[idx as 0 | 1 | 2] += 1
    }
    // With a fair shuffle each position should land roughly a third of the
    // time — assert no position dominates the way "always index 0" did.
    for (const count of Object.values(positions)) {
      expect(count).toBeGreaterThan(20) // well above chance-of-zero; loose bound to avoid flakiness
      expect(count).toBeLessThan(140)   // well below "always this position"
    }
  })
})

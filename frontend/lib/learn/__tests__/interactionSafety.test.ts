import { describe, it, expect } from 'vitest'
import {
  getNeutralSliderStart,
  shuffleBySeed,
  canonicalPokerAction,
  isCanonicalActionSet,
  orderStepOptions,
} from '../interactionSafety'
import type { StepOption } from '../types'

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

// ── Canonical poker-action ordering ───────────────────────────────────────────
// Fold -> Check -> Call -> Raise -> All-in must be the fixed, global visual order
// for standard poker-action decision spots everywhere in Learn, so learners build
// spatial muscle memory for button position. See interactionSafety.ts's
// `orderStepOptions` / `isCanonicalActionSet` / `canonicalPokerAction`.

function opt(id: string, label: string): StepOption {
  return { id, label, quality: 'perfect', feedback: '' }
}

describe('canonicalPokerAction', () => {
  it('recognizes the five canonical actions case-insensitively', () => {
    expect(canonicalPokerAction('Fold')).toBe('fold')
    expect(canonicalPokerAction('CHECK')).toBe('check')
    expect(canonicalPokerAction('call')).toBe('call')
    expect(canonicalPokerAction('Raise')).toBe('raise')
    expect(canonicalPokerAction('ALL-IN')).toBe('all_in')
  })

  it('recognizes all-in formatting variants', () => {
    expect(canonicalPokerAction('All-in')).toBe('all_in')
    expect(canonicalPokerAction('All in')).toBe('all_in')
    expect(canonicalPokerAction('Allin')).toBe('all_in')
    expect(canonicalPokerAction('ALLIN')).toBe('all_in')
  })

  it('allows a sizing/annotation suffix on raise', () => {
    expect(canonicalPokerAction('Raise to 3x')).toBe('raise')
    expect(canonicalPokerAction('RAISE (semi-bluff)')).toBe('raise')
  })

  it('rejects action vocabulary outside the canonical five (jam/limp/shove/bet/3bet)', () => {
    expect(canonicalPokerAction('Jam')).toBeNull()
    expect(canonicalPokerAction('Limp')).toBeNull()
    expect(canonicalPokerAction('Shove')).toBeNull()
    expect(canonicalPokerAction('Bet')).toBeNull()
    expect(canonicalPokerAction('3bet')).toBeNull()
  })

  it('never classifies a full sentence merely mentioning an action word', () => {
    expect(canonicalPokerAction('Raise now, planning to fold to real resistance')).toBeNull()
    expect(canonicalPokerAction('Calling is profitable, but not the best action')).toBeNull()
  })
})

describe('isCanonicalActionSet', () => {
  it('is true for clean canonical action sets', () => {
    expect(isCanonicalActionSet(['Fold', 'Raise'])).toBe(true)
    expect(isCanonicalActionSet(['Call', 'Check'])).toBe(true)
    expect(isCanonicalActionSet(['All-in', 'Call', 'Raise'])).toBe(true)
  })

  it('is false when any option is not a clean canonical action', () => {
    expect(isCanonicalActionSet(['Fold', 'Limp'])).toBe(false)
    expect(isCanonicalActionSet(['Fold', 'Raise now, planning to fold to real resistance'])).toBe(false)
    expect(isCanonicalActionSet(['Bet A', 'Bet B'])).toBe(false)
  })

  it('is false for an empty set', () => {
    expect(isCanonicalActionSet([])).toBe(false)
  })
})

describe('orderStepOptions — canonical action ordering', () => {
  it('[Raise, Fold] -> [Fold, Raise]', () => {
    const result = orderStepOptions([opt('raise', 'Raise'), opt('fold', 'Fold')], 'seed-a')
    expect(result.map((o) => o.label)).toEqual(['Fold', 'Raise'])
  })

  it('[All-in, Call, Raise] -> [Call, Raise, All-in]', () => {
    const result = orderStepOptions(
      [opt('allin', 'All-in'), opt('call', 'Call'), opt('raise', 'Raise')],
      'seed-b',
    )
    expect(result.map((o) => o.label)).toEqual(['Call', 'Raise', 'All-in'])
  })

  it('[Raise, Check] -> [Check, Raise]', () => {
    const result = orderStepOptions([opt('raise', 'Raise'), opt('check', 'Check')], 'seed-c')
    expect(result.map((o) => o.label)).toEqual(['Check', 'Raise'])
  })

  it('[All-in, Fold, Raise] -> [Fold, Raise, All-in]', () => {
    const result = orderStepOptions(
      [opt('allin', 'All-in'), opt('fold', 'Fold'), opt('raise', 'Raise')],
      'seed-d',
    )
    expect(result.map((o) => o.label)).toEqual(['Fold', 'Raise', 'All-in'])
  })

  it('[Call, Check] -> [Check, Call]', () => {
    const result = orderStepOptions([opt('call', 'Call'), opt('check', 'Check')], 'seed-e')
    expect(result.map((o) => o.label)).toEqual(['Check', 'Call'])
  })

  it('is stable regardless of authoring/seed order and never flips for the same set', () => {
    const forward = orderStepOptions(
      [opt('fold', 'Fold'), opt('check', 'Check'), opt('call', 'Call'), opt('raise', 'Raise'), opt('allin', 'All-in')],
      'lesson-3-step-7',
    )
    const reversed = orderStepOptions(
      [opt('allin', 'All-in'), opt('raise', 'Raise'), opt('call', 'Call'), opt('check', 'Check'), opt('fold', 'Fold')],
      'lesson-3-step-7',
    )
    const expected = ['Fold', 'Check', 'Call', 'Raise', 'All-in']
    expect(forward.map((o) => o.label)).toEqual(expected)
    expect(reversed.map((o) => o.label)).toEqual(expected)
  })

  it('produces the same logical order regardless of seed — desktop and mobile share one array, so CSS wrapping can never reverse it', () => {
    const seeds = ['step-1', 'step-2', 'a-totally-different-seed', 'zzz']
    for (const seed of seeds) {
      const result = orderStepOptions([opt('raise', 'Raise'), opt('fold', 'Fold'), opt('allin', 'All-in')], seed)
      expect(result.map((o) => o.label)).toEqual(['Fold', 'Raise', 'All-in'])
    }
  })

  it('preserves correct-answer identity (id/quality/feedback) after reordering', () => {
    const fold = { id: 'fold', label: 'Fold', quality: 'mistake' as const, feedback: 'wrong' }
    const raise = { id: 'raise', label: 'Raise', quality: 'perfect' as const, feedback: 'right' }
    const result = orderStepOptions([raise, fold], 'seed-f')
    expect(result.map((o) => o.label)).toEqual(['Fold', 'Raise'])
    const raiseAfter = result.find((o) => o.label === 'Raise')
    const foldAfter = result.find((o) => o.label === 'Fold')
    expect(raiseAfter).toEqual(raise)
    expect(foldAfter).toEqual(fold)
  })

  it('does NOT reorder conceptual/theoretical option sets — falls back to the existing seeded shuffle', () => {
    const items = [
      opt('profitable_not_best', 'Calling is profitable, but not the best action'),
      opt('profitable_and_best', 'Calling is profitable AND the best action'),
      opt('not_profitable', 'Calling is not profitable'),
    ]
    const viaOrderStepOptions = orderStepOptions(items, 'ev-s7')
    const viaShuffleBySeed = shuffleBySeed(items, 'ev-s7')
    expect(viaOrderStepOptions).toEqual(viaShuffleBySeed)
  })

  it('does NOT reorder non-canonical action vocabulary (e.g. Raise/Limp/Jam/Fold) — keeps existing randomized behavior', () => {
    const items = [opt('raise', 'Raise'), opt('limp', 'Limp'), opt('jam', 'Jam'), opt('fold', 'Fold')]
    const viaOrderStepOptions = orderStepOptions(items, 'mtt-rfi-seed')
    const viaShuffleBySeed = shuffleBySeed(items, 'mtt-rfi-seed')
    expect(viaOrderStepOptions).toEqual(viaShuffleBySeed)
  })

  it('remains a true permutation — same items in, same items out, just reordered', () => {
    const items = [opt('raise', 'Raise'), opt('fold', 'Fold'), opt('call', 'Call')]
    const result = orderStepOptions(items, 'seed-g')
    expect(result.slice().sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      items.slice().sort((a, b) => a.id.localeCompare(b.id)),
    )
  })
})

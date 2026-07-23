/**
 * Regression tests for the `hand_ranking_order` step type (Module 1, Lesson 1,
 * Step 11) — a scored drag/tap-reorder exercise replacing what used to be a
 * passive concept_reveal listing the hand rankings.
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally, isScoredStep } from '../evaluator'
import { shuffleBySeed } from '../interactionSafety'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

const REAL_STEP = findStep('l1-s11')
const CORRECT_ORDER = (REAL_STEP.hand_ranking_order_items ?? []).map((i) => i.id)

describe('l1-s11 is authored correctly', () => {
  it('is a hand_ranking_order step with all 10 standard categories', () => {
    expect(REAL_STEP.type).toBe('hand_ranking_order')
    expect(CORRECT_ORDER).toHaveLength(10)
    expect(new Set(CORRECT_ORDER).size).toBe(10) // no duplicate categories
  })

  it('every category has a 5-card example hand', () => {
    for (const item of REAL_STEP.hand_ranking_order_items ?? []) {
      expect(item.example, `${item.id} example`).toHaveLength(5)
    }
  })

  it('is ordered strongest to weakest, matching standard poker hand rankings', () => {
    expect(CORRECT_ORDER).toEqual([
      'royal_flush', 'straight_flush', 'four_of_a_kind', 'full_house', 'flush',
      'straight', 'three_of_a_kind', 'two_pair', 'one_pair', 'high_card',
    ])
  })
})

describe('hand_ranking_order is always a scored step', () => {
  it('isScoredStep is true regardless of authored fields', () => {
    expect(isScoredStep(REAL_STEP)).toBe(true)
  })
})

describe('deterministic shuffle: never pre-solved, stable across reloads', () => {
  it('shuffleBySeed(correctOrder, step.id) is a permutation of the same 10 ids', () => {
    const shuffled = shuffleBySeed(CORRECT_ORDER, REAL_STEP.id)
    expect(new Set(shuffled)).toEqual(new Set(CORRECT_ORDER))
    expect(shuffled).toHaveLength(CORRECT_ORDER.length)
  })

  it('produces the same order on every call (deterministic, not Math.random)', () => {
    const a = shuffleBySeed(CORRECT_ORDER, REAL_STEP.id)
    const b = shuffleBySeed(CORRECT_ORDER, REAL_STEP.id)
    expect(a).toEqual(b)
  })

  it('the real authored step does not happen to shuffle into the already-correct order', () => {
    // Not a hard requirement (the component has a swap safeguard for this exact
    // case), but confirms today's real content ships genuinely shuffled.
    const shuffled = shuffleBySeed(CORRECT_ORDER, REAL_STEP.id)
    expect(shuffled).not.toEqual(CORRECT_ORDER)
  })
})

describe('scoring: correct vs partial vs wrong submissions', () => {
  it('the exact correct order earns full XP and "perfect" quality', () => {
    const result = evaluateStepLocally(REAL_STEP, CORRECT_ORDER, 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).toBe('perfect')
    expect(result.score).toBe(100)
    expect(result.xp_earned).toBe(REAL_STEP.xp)
  })

  it('a single adjacent swap (Flush/Straight) earns partial credit and explains the specific mistake', () => {
    const swapped = [...CORRECT_ORDER]
    const flushIdx = swapped.indexOf('flush')
    const straightIdx = swapped.indexOf('straight')
    ;[swapped[flushIdx], swapped[straightIdx]] = [swapped[straightIdx], swapped[flushIdx]]

    const result = evaluateStepLocally(REAL_STEP, swapped, 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).not.toBe('perfect')
    expect(result.xp_earned).toBeGreaterThan(0) // 8/10 correct — not zeroed out
    expect(result.xp_earned).toBeLessThan(REAL_STEP.xp!)
    expect(result.feedback).toMatch(/flush.*beats.*straight/i)
  })

  it('a fully reversed order earns the lowest tier but never negative/undefined XP', () => {
    const reversed = [...CORRECT_ORDER].reverse()
    const result = evaluateStepLocally(REAL_STEP, reversed, 0)
    expect(result.unscored).toBe(false)
    expect(result.xp_earned).toBeGreaterThanOrEqual(0)
    expect(result.quality).toBe('mistake')
  })

  it('a malformed/missing response earns 0 and does not throw', () => {
    const result = evaluateStepLocally(REAL_STEP, undefined, 0)
    expect(result.unscored).toBe(false)
    expect(result.score).toBe(0)
    expect(result.xp_earned).toBe(0)
  })
})


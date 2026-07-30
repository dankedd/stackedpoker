/**
 * Module 11, Lesson 5 ("Protect the Checking Range") — Range Surgery's protection-verdict
 * layer over range_bucket. Verifies:
 *  1. Every EXISTING range_bucket lesson (no `range_bucket_protection_target` authored) keeps
 *     calling the original evalRangeBucket path unchanged — the regression guard that matters
 *     most here, since this dispatch branch is shared by every module from 4 onward.
 *  2. The new verdict layer correctly classifies 'unprotected' / 'protected' / 'over_protected'
 *     from the submitted CHECK-pile strong-hand combo share, using the SAME combo-weighting
 *     (handCombos: pair=6, suited=4, offsuit=12) evalRangeBucket already uses elsewhere.
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import type { LessonStep } from '../types'

const BASE_STEP: LessonStep = {
  id: 'test-range-surgery',
  type: 'range_bucket',
  range_bucket_pool: ['AA', '99', '88', 'AKs', 'AQo', '76s', '32o'],
  range_bucket_categories: [
    { id: 'bet', label: 'BET' },
    { id: 'check', label: 'CHECK' },
  ],
  // A simple, illustrative target: AA/99/88 are the pool's strong hands; the "book-correct"
  // split checks back 99 (6 combos) for protection while betting everything else.
  range_bucket_correct: {
    AA: 'bet',
    99: 'check',
    88: 'bet',
    AKs: 'bet',
    AQo: 'bet',
    '76s': 'bet',
    '32o': 'bet',
  },
  range_bucket_protection_target: {
    bet_category_id: 'bet',
    check_category_id: 'check',
    strong_hands: ['AA', '99', '88'], // 6 + 6 + 6 = 18 combos total
    min_check_strong_share: 0.15,
    max_check_strong_share: 0.55,
  },
  xp: 10,
}

describe('range_bucket dispatch — protection target is opt-in and additive', () => {
  it('a step WITHOUT range_bucket_protection_target scores via the original evalRangeBucket path (no verdict text)', () => {
    const plainStep: LessonStep = { ...BASE_STEP, range_bucket_protection_target: undefined }
    const allBet = { AA: 'bet', 99: 'bet', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' }
    const result = evaluateStepLocally(plainStep, allBet, 0)
    // Original evalRangeBucket feedback strings never mention "protect"/"checking range" —
    // this is the regression guard that every pre-existing range_bucket lesson is unaffected.
    expect(result.feedback.toLowerCase()).not.toContain('protect')
    expect(result.structured_points).toBeUndefined()
  })
})

describe('evalRangeSurgeryProtection — unprotected (capped) verdict', () => {
  it('betting every strong hand (0% checked back) is flagged unprotected, with a causal explanation', () => {
    const allBet = { AA: 'bet', 99: 'bet', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' }
    const result = evaluateStepLocally(BASE_STEP, allBet, 0)
    expect(result.feedback).toMatch(/capped|face-up/i)
    expect(result.structured_points?.[0]).toEqual({ term: 'Protection verdict', description: 'Unprotected (capped)' })
    expect(result.structured_points?.[1].description).toContain('0%')
  })
})

describe('evalRangeSurgeryProtection — protected verdict', () => {
  it('checking back exactly 99 (6 of 18 strong combos = 33%, inside the 15-55% band) is flagged protected', () => {
    const assignments = { AA: 'bet', 99: 'check', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' }
    const result = evaluateStepLocally(BASE_STEP, assignments, 0)
    expect(result.feedback).toMatch(/balance|protected/i)
    expect(result.structured_points?.[0]).toEqual({ term: 'Protection verdict', description: 'Protected' })
    expect(result.structured_points?.[1].description).toContain('33%')
  })
})

describe('evalRangeSurgeryProtection — over-protected verdict', () => {
  it('checking back ALL strong hands (100%) is flagged over-protected, not just "correct"', () => {
    const assignments = { AA: 'check', 99: 'check', 88: 'check', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' }
    const result = evaluateStepLocally(BASE_STEP, assignments, 0)
    expect(result.feedback).toMatch(/thin|too well|too much/i)
    expect(result.structured_points?.[0]).toEqual({ term: 'Protection verdict', description: 'Over-protected' })
    expect(result.structured_points?.[1].description).toContain('100%')
  })
})

describe('evalRangeSurgeryProtection — base accuracy score is preserved from evalRangeBucket, not recomputed', () => {
  it('the underlying quality/score tier matches what evalRangeBucket alone would have produced for the same submission', () => {
    const plainStep: LessonStep = { ...BASE_STEP, range_bucket_protection_target: undefined }
    const assignments = { AA: 'bet', 99: 'check', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' } // fully correct
    const withVerdict = evaluateStepLocally(BASE_STEP, assignments, 0)
    const withoutVerdict = evaluateStepLocally(plainStep, assignments, 0)
    expect(withVerdict.quality).toBe(withoutVerdict.quality)
    expect(withVerdict.score).toBe(withoutVerdict.score)
    expect(withVerdict.xp_earned).toBe(withoutVerdict.xp_earned)
  })
})

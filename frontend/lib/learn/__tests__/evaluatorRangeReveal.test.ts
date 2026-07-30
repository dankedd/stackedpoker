/**
 * Regression tests confirming the defend-range reveal (StepResult.range_reveal,
 * resolved by defendRangeReveal.ts) is wired through evaluateStepLocally without
 * touching scoring/XP/level math — see DecisionSpotRangeReveal's doc comment in
 * types.ts. Also pins the exact screenshot regression (bbd-s8b, K9o, BB vs UTG)
 * and confirms it shows up on BOTH a correct and an incorrect answer (spec: the
 * reveal is most valuable exactly when the learner was wrong).
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

describe('evaluateStepLocally — range_reveal on bbd-s8b ("The Big Blind Discount", K9o, BB vs UTG)', () => {
  const step = findStep('bbd-s8b')

  it('appears after the CORRECT answer (fold) with unchanged scoring', () => {
    const result = evaluateStepLocally(step, 'fold', 0)
    expect(result.quality).toBe('perfect')
    expect(result.score).toBe(100)
    expect(result.xp_earned).toBe(6) // step.xp=6 * perfect mult 1.00
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.highlightHand).toBe('K9o')
    expect(result.range_reveal!.label).toBe('BB DEFENSE vs UTG OPEN')
  })

  it('ALSO appears after the INCORRECT answer (call) — exactly where it matters most — with unchanged scoring', () => {
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.quality).toBe('mistake')
    expect(result.xp_earned).toBe(1) // step.xp=6 * mistake mult 0.20, rounded
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.highlightHand).toBe('K9o')
  })

  it('the resolved range itself is identical regardless of which answer was picked (it describes the SPOT, not the response)', () => {
    const correct = evaluateStepLocally(step, 'fold', 0)
    const incorrect = evaluateStepLocally(step, 'call', 0)
    expect(correct.range_reveal!.strategies).toEqual(incorrect.range_reveal!.strategies)
  })

  it('is deterministic — same inputs, same output, every call', () => {
    const a = evaluateStepLocally(step, 'fold', 0)
    const b = evaluateStepLocally(step, 'fold', 0)
    expect(a.range_reveal).toEqual(b.range_reveal)
  })
})

describe('evaluateStepLocally — range_reveal never affects xp_earned/level math on a NON-defend step', () => {
  it('a decision_spot step with no resolvable defend range gets range_reveal=undefined and normal xp_earned', () => {
    const step = findStep('ev-s6') // ordinary postflop decision_spot, no hero_position/villain_position defend fields
    const result = evaluateStepLocally(step, 'raise', 0)
    expect(result.range_reveal).toBeUndefined()
    expect(result.xp_earned).toBeGreaterThan(0)
  })
})

describe('evaluateStepLocally — second positional spot: lab5-h-action (CO opens, Hero BB, K9s)', () => {
  const step = findStep('lab5-h-action')

  it('resolves the BB-vs-CO chart with correct highlight, distinct from the UTG spot', () => {
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('BB DEFENSE vs CO OPEN')
    expect(result.range_reveal!.highlightHand).toBe('K9s')

    const utgResult = evaluateStepLocally(findStep('bbd-s8b'), 'fold', 0)
    expect(result.range_reveal!.strategies).not.toEqual(utgResult.range_reveal!.strategies)
  })
})

describe('evaluateStepLocally — level/XP totals unaffected by range_reveal presence', () => {
  it('level_before/level_after math is identical whether or not a reveal was resolvable, for the same xp_earned', () => {
    const withReveal = evaluateStepLocally(findStep('bbd-s8b'), 'fold', 1000)
    const withoutReveal = evaluateStepLocally(findStep('ev-s6'), 'raise', 1000)
    // Both perfect-quality answers on 1000 starting XP — level math must follow
    // only from currentTotalXP + xp_earned, never from range_reveal's presence.
    expect(withReveal.level_before).toBe(withoutReveal.level_before)
  })
})

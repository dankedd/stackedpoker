import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS_BY_MODULE } from '../curriculum'
import type { LessonStep } from '../types'

/**
 * Post-submission answer reveal — Module 2 ("The Math Behind Every Decision").
 *
 * Pre-submission leakage is fixed at the component level (see
 * lib/learn/__tests__/interactionSafety.test.ts and the components under
 * components/learn/steps/__tests__). This file verifies the OTHER half: once
 * a learner does submit, the result must actually say what they answered and
 * what the correct answer was — evaluateStepLocally's `feedback` string is
 * the one place that reliably renders after every step type today.
 */

const MODULE2_STEPS: LessonStep[] = (LESSONS_BY_MODULE['math-foundations-module'] ?? []).flatMap(
  (lesson) => lesson.steps,
)

function findStep(id: string): LessonStep {
  const step = MODULE2_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in Module 2 — did curriculum content change?`)
  return step
}

describe('Module 2 numeric steps reveal the learner\'s own answer on submit', () => {
  it('pot_odds_explorer (poc-s3, the originally-reported "build" mode leak)', () => {
    const step = findStep('poc-s3')
    expect(step.pot_odds_correct).toBe(25)

    const wrong = evaluateStepLocally(step, 60, 0)
    expect(wrong.feedback).toContain('You answered 60')
    expect(wrong.feedback).toMatch(/25%/)

    const right = evaluateStepLocally(step, 25, 0)
    expect(right.feedback).toContain('You answered 25')
    expect(right.quality).toBe('perfect')
  })

  it('outs_deck next_card challenge (cyw-s3)', () => {
    const step = findStep('cyw-s3')
    expect(step.outs_deck_correct).toBeCloseTo(19.1)

    const result = evaluateStepLocally(step, 50, 0)
    expect(result.feedback).toContain('You answered 50')
    expect(result.feedback).toMatch(/19\.1/)
  })

  it('outs_deck clean_dirty challenge (cyw-s8) states both the guess and the correct clean-out count', () => {
    const step = findStep('cyw-s8')
    expect(step.outs_deck_correct).toBe(6)

    const result = evaluateStepLocally(step, 8, 0)
    expect(result.feedback).toContain('You answered 8')
    expect(result.feedback).toMatch(/\b6\b/)
  })

  it('bluff_breakeven challenge (wws-s3)', () => {
    const step = findStep('wws-s3')
    expect(step.bluff_breakeven_correct).toBe(50)

    const result = evaluateStepLocally(step, 10, 0)
    expect(result.feedback).toContain('You answered 10')
    expect(result.feedback).toMatch(/50%/)
  })

  it('equity_realization calculator challenge (eqr-s13)', () => {
    const step = findStep('eqr-s13')
    expect(step.equity_realization_correct).toBe(32)

    const result = evaluateStepLocally(step, 40, 0)
    expect(result.feedback).toContain('You answered 40')
    expect(result.feedback).toMatch(/32%/)
  })

  it('a correct numeric answer still names the correct value (not just "correct")', () => {
    const step = findStep('wws-s9a')
    expect(step.bluff_breakeven_correct).toBe(33.3)
    const result = evaluateStepLocally(step, 33.3, 0)
    expect(result.quality).toBe('perfect')
    expect(result.feedback).toContain('You answered 33.3')
  })
})

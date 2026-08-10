/**
 * Module 12, Lessons 6/9 — unit + reasoning-stage tests for the two new evaluator resolvers
 * (evalGeometricBetLadder, evalRiverSizingCalculator), following the existing convention of
 * asserting `reasoning_stages` for both a fully-correct and a partially-correct submission
 * (Module 9's own multi-stage resolver test precedent, per module-12-architecture.md Section 14).
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import type { LessonStep } from '../types'

const LADDER_STEP: LessonStep = {
  id: 'test-ladder',
  type: 'geometric_bet_ladder',
  geometric_ladder_starting_pot: 70,
  geometric_ladder_effective_stack: 965,
  geometric_ladder_streets: 3,
  xp: 20,
}

describe('evalGeometricBetLadder — source-locked against the book\'s own worked example', () => {
  it('both R and bet-fraction correct -> perfect, both reasoning stages correct', () => {
    const result = evaluateStepLocally(LADDER_STEP, { rGuess: 3.057, betFractionGuess: 1.0285 }, 0)
    expect(result.quality).toBe('perfect')
    expect(result.reasoning_stages?.find((s) => s.stage === 'computation_correct')?.correct).toBe(true)
    expect(result.reasoning_stages?.find((s) => s.stage === 'formula_cited')?.correct).toBe(true)
  })

  it('R correct but bet-fraction forgets the ÷2 (common mistake: submits R-1 instead) -> acceptable, only the fraction stage flagged', () => {
    const result = evaluateStepLocally(LADDER_STEP, { rGuess: 3.057, betFractionGuess: 205.7 }, 0)
    expect(result.quality).toBe('acceptable')
    expect(result.reasoning_stages?.find((s) => s.stage === 'computation_correct')?.correct).toBe(true)
    expect(result.reasoning_stages?.find((s) => s.stage === 'formula_cited')?.correct).toBe(false)
    expect(result.feedback).toMatch(/÷2|forgetting the/i)
  })

  it('R wrong (stopped at the raw division, forgot the root) -> not perfect, computation stage flagged', () => {
    // 2000/70 = 28.57, forgetting to take the cube root.
    const result = evaluateStepLocally(LADDER_STEP, { rGuess: 28.57, betFractionGuess: 1.03 }, 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.reasoning_stages?.find((s) => s.stage === 'computation_correct')?.correct).toBe(false)
    expect(result.feedback).toMatch(/root/i)
  })

  it('both wrong -> mistake', () => {
    const result = evaluateStepLocally(LADDER_STEP, { rGuess: 1, betFractionGuess: 10 }, 0)
    expect(result.quality).toBe('mistake')
  })

  it('no answer -> punt, does not throw', () => {
    const result = evaluateStepLocally(LADDER_STEP, {}, 0)
    expect(result.quality).toBe('punt')
  })
})

const RIVER_STEP: LessonStep = {
  id: 'test-river-calc',
  type: 'river_sizing_calculator',
  river_calc_opponent_equity_pct: 10,
  river_calc_trap_pct: 0,
  xp: 18,
}

describe('evalRiverSizingCalculator — source-locked against the book\'s two cited results', () => {
  it('10% equity -> 12.5% of pot, correct answer scores perfect', () => {
    const result = evaluateStepLocally(RIVER_STEP, { minimumBetGuessPct: 12.5 }, 0)
    expect(result.quality).toBe('perfect')
    expect(result.feedback).toContain('12.5')
  })

  it('40% equity -> 200% of pot (2x pot)', () => {
    const step: LessonStep = { ...RIVER_STEP, river_calc_opponent_equity_pct: 40 }
    const result = evaluateStepLocally(step, { minimumBetGuessPct: 200 }, 0)
    expect(result.quality).toBe('perfect')
  })

  it('wrong answer -> not perfect, feedback states the correct formula and value', () => {
    const result = evaluateStepLocally(RIVER_STEP, { minimumBetGuessPct: 50 }, 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.feedback).toMatch(/12\.5/)
    expect(result.feedback).toMatch(/EQ.*÷.*1.*2.*EQ|1 − 2×EQ/)
  })

  it('no answer -> punt', () => {
    const result = evaluateStepLocally(RIVER_STEP, {}, 0)
    expect(result.quality).toBe('punt')
  })
})
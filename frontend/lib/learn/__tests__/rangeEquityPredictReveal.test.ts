/**
 * Regression tests for the "show the actual solver figure" fix on
 * `range_equity_predict` (Module 8, Lesson 3 "Range Advantage", steps
 * ra-s2/ra-s3). Previously a fully-correct answer's feedback said only
 * "That's close to the book's figure for this exact matchup" — the learner
 * never saw the real number. Now every tier (including 'perfect') surfaces
 * the actual solver-cited equity via `answer_reveal`, with a book source
 * citation and a signed delta, via `evalNumeric`'s `alwaysReveal` option —
 * a mechanism any other numeric step type can opt into, not hardcoded here.
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import { A76R_SCENARIO, CS_654R_SCENARIO } from '../rangeVsRangeContent'
import type { LessonStep } from '../types'

// Scoped to the 'range-advantage' lesson specifically (not a global id search
// across every lesson) — a step id can collide with an unrelated step in a
// different lesson elsewhere in the curriculum (LessonPlayer itself is always
// scoped to one lesson's own steps array, so this mirrors real usage and
// isn't fooled by a same-named step living in some other lesson).
const LESSON = LESSONS.find((l) => l.id === 'range-advantage')
if (!LESSON) throw new Error('Fixture lesson "range-advantage" not found in curriculum — did content change?')

function findStep(id: string): LessonStep {
  const step = LESSON!.steps.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in the "range-advantage" lesson — did content change?`)
  return step
}

describe('range_equity_predict (ra-s2, A76r) — always reveals the actual solver figure', () => {
  const step = findStep('ra-s2')
  const actual = A76R_SCENARIO.equity.ip // 62

  it('a perfect (within-tolerance) answer still gets a structured answer_reveal with the real number', () => {
    const result = evaluateStepLocally(step, actual, 0) // exact match
    expect(result.quality).toBe('perfect')
    expect(result.score).toBe(100) // scoring unchanged
    expect(result.answer_reveal).toBeDefined()
    expect(result.answer_reveal!.term).toBe('Solver equity')
    expect(result.answer_reveal!.correct).toBe(`${actual}%`)
  })

  it('feedback prose states the actual percentage instead of a vague "book\'s figure" reference', () => {
    const result = evaluateStepLocally(step, actual, 0)
    expect(result.feedback).toContain(`${actual}%`)
    expect(result.feedback).not.toMatch(/book's figure/i)
  })

  it('the reveal cites the book source (page 633) — never fabricated', () => {
    const result = evaluateStepLocally(step, actual, 0)
    expect(result.answer_reveal?.source).toBeDefined()
    expect(result.answer_reveal!.source).toContain('p.633')
    expect(result.answer_reveal!.source).toContain('Modern Poker Theory')
  })

  it('an off-target answer shows a signed delta from the solver figure', () => {
    const result = evaluateStepLocally(step, actual - 10, 0) // 52%, 10pp off
    expect(result.answer_reveal?.delta).toBe('-10%')
  })

  it('an exact match reports "Exact match" rather than "+0%"', () => {
    const result = evaluateStepLocally(step, actual, 0)
    expect(result.answer_reveal?.delta).toBe('Exact match')
  })
})

describe('range_equity_predict (ra-s3, 654r) — same mechanism, different cited figure', () => {
  const step = findStep('ra-s3')
  const actual = CS_654R_SCENARIO.equity.ip // 49

  it('reveals the correct 654r solver figure, not A76r\'s', () => {
    const result = evaluateStepLocally(step, actual, 0)
    expect(result.answer_reveal?.correct).toBe(`${actual}%`)
    expect(result.answer_reveal?.source).toContain('654r')
  })
})

describe('Scoring/XP are unaffected by the reveal — same as any other evalNumeric step', () => {
  it('a far-off ra-s2 answer still earns exactly the mistake-tier score/xp', () => {
    const step = findStep('ra-s2')
    const result = evaluateStepLocally(step, 5, 0) // wildly off
    expect(result.quality).toBe('mistake')
    expect(result.score).toBe(35) // QUALITY_SCORES.mistake, unchanged
    expect(result.xp_earned).toBe(Math.round((step.xp ?? 10) * 0.2))
  })
})

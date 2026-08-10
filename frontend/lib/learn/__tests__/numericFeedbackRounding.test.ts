import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS_BY_MODULE } from '../curriculum'
import type { LessonStep } from '../types'

/**
 * Regression coverage for a reported defect: a slider-computed response (e.g. MDF from
 * 1 - bet/(bet+pot)) can carry a raw JS floating-point artifact — 66.66666666666667, not
 * 66.67 — all the way into learner-facing feedback text ("You answered
 * 66.66666666666667%."). Fixed via a shared `roundForDisplay` helper in evaluator.ts,
 * applied everywhere a learner's own numeric input is echoed back (evalNumeric,
 * evalEquityPredict, evalRiverSizingCalculator). This file locks that fix in across every
 * affected step type, using real curriculum fixtures rather than synthetic ones.
 */

function findStep(moduleId: string, id: string): LessonStep {
  const steps = (LESSONS_BY_MODULE[moduleId] ?? []).flatMap((lesson) => lesson.steps)
  const step = steps.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in module "${moduleId}" — did curriculum content change?`)
  return step
}

/** No feedback string anywhere in this codebase should ever contain a genuine
 *  floating-point artifact — 3+ digits after a decimal point. This deliberately allows
 *  clean, author-set 2-decimal values (e.g. "66.67%", matching this module's own
 *  77.05/71.01-style EV precision) while still catching the reported bug
 *  (66.66666666666667%) and anything else a raw, unrounded computation could produce. */
const FLOAT_ARTIFACT_RE = /\d+\.\d{3,}/

describe('numeric feedback never exposes raw floating-point precision', () => {
  it('mdf_slider (Module 12 wsby-s3): a repeating-decimal response (200/3) rounds to 66.7%, not 66.66666666666667%', () => {
    const step = findStep('bet-sizing-language-module', 'wsby-s3')
    expect(step.mdf_slider_target).toBe(66.67)

    // The exact float a client-side `1 - bet/(bet+pot)` computation produces for a
    // half-pot bet — this is the literal reported bug value, not a rounded stand-in.
    const rawFloat = 100 - (50 / 150) * 100
    expect(rawFloat).toBeCloseTo(66.66666666666667, 10)

    const result = evaluateStepLocally(step, rawFloat, 0)
    expect(result.quality).toBe('perfect')
    expect(result.feedback).toContain('You answered 66.7%')
    expect(result.feedback).not.toMatch(FLOAT_ARTIFACT_RE)
  })

  it('mdf_slider (wsby-s3) now teaches the mechanism instead of just repeating the number', () => {
    const step = findStep('bet-sizing-language-module', 'wsby-s3')
    const result = evaluateStepLocally(step, 66.67, 0)
    expect(result.feedback).toMatch(/Alpha/)
    expect(result.feedback.length).toBeGreaterThan(120) // not a bare "Correct — 66.67%."
  })

  it('mdf_slider (wsby-s3) wrong-answer feedback also stays float-free and explains the fix', () => {
    const step = findStep('bet-sizing-language-module', 'wsby-s3')
    const result = evaluateStepLocally(step, (1 / 3) * 100, 0) // the bet÷pot mistake, as a raw float
    expect(result.quality).not.toBe('perfect')
    expect(result.feedback).not.toMatch(FLOAT_ARTIFACT_RE)
    expect(result.feedback).toMatch(/bet ÷ \(bet\+pot\)|bet ÷ pot/)
  })

  it('river_sizing_calculator (Module 12 rsc-s4): a repeating-decimal guess rounds cleanly in answer_reveal', () => {
    const step = findStep('bet-sizing-language-module', 'rsc-s4')
    const rawFloat = (1 / 3) * 100 // 33.33333333333333, a plausible mis-typed guess
    const result = evaluateStepLocally(step, { minimumBetGuessPct: rawFloat }, 0)
    expect(result.answer_reveal?.yours).not.toMatch(FLOAT_ARTIFACT_RE)
    expect(result.feedback).not.toMatch(FLOAT_ARTIFACT_RE)
  })

  it('equity_predict (ysp-s3): a repeating-decimal estimate rounds cleanly in the feedback header', () => {
    const step = findStep('math-foundations-module', 'ysp-s3')
    const rawFloat = (200 / 3) * 0.6 // an arbitrary repeating-decimal estimate
    const result = evaluateStepLocally(step, rawFloat, 0)
    expect(result.feedback).not.toMatch(FLOAT_ARTIFACT_RE)
    expect(result.answer_reveal?.yours ?? '').not.toMatch(FLOAT_ARTIFACT_RE)
  })
})

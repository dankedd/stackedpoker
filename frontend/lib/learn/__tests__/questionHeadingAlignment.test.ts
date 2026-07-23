/**
 * Regression test for LEARN_QUESTION_QA.md bug class #8
 * (QUESTION–INTERACTION ALIGNMENT): DecisionSpot.tsx must never show a
 * generic action heading ("What is your action?") over non-action options,
 * and every decision_spot step must have a resolvable primary question.
 * See DecisionSpot.tsx for the render-time logic this test guards.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { isPokerActionSet } from '../interactionSafety'
import type { LessonStep } from '../types'

const allSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const decisionSteps = allSteps.filter((s) => s.type === 'decision_spot')

const GENERIC_ACTION_HEADING_RE = /^(what is your action\??|what should (you|hero) do\??|your decision\.?:?)$/i

describe('Question–interaction alignment (LEARN_QUESTION_QA.md #8)', () => {
  it('has decision_spot steps to check', () => {
    expect(decisionSteps.length).toBeGreaterThan(0)
  })

  it('every decision_spot step has a resolvable primary question', () => {
    const offenders: string[] = []
    for (const step of decisionSteps) {
      const labels = (step.options ?? []).map((o) => o.label)
      const narrativeIsQuestion = !!step.narrative && /\?\s*$/.test(step.narrative.trim())
      const hasExplicitQuestion = !!step.decision_spot_question
      const actionSet = isPokerActionSet(labels)
      if (!hasExplicitQuestion && !narrativeIsQuestion && !actionSet) {
        offenders.push(step.id)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never uses a generic action-oriented heading over non-action options', () => {
    const offenders: string[] = []
    for (const step of decisionSteps) {
      const labels = (step.options ?? []).map((o) => o.label)
      const actionSet = isPokerActionSet(labels)
      if (actionSet) continue

      // Case 1: an authored decision_spot_question that is itself the generic phrase.
      if (step.decision_spot_question && GENERIC_ACTION_HEADING_RE.test(step.decision_spot_question.trim())) {
        offenders.push(`${step.id}: decision_spot_question is a generic action heading`)
      }
      // Case 2: narrative ends with the generic phrase instead of a real question.
      if (step.narrative && GENERIC_ACTION_HEADING_RE.test(step.narrative.trim())) {
        offenders.push(`${step.id}: narrative is a generic action heading`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('isPokerActionSet correctly classifies real actions vs. non-action options', () => {
    expect(isPokerActionSet(['Fold', 'Call', 'Raise'])).toBe(true)
    expect(isPokerActionSet(['Jam (all-in)', 'Call', 'Fold'])).toBe(true)
    expect(isPokerActionSet(['Raise to 3bb', 'Call', 'Fold'])).toBe(true)
    expect(isPokerActionSet(['Yes, always', 'No, never', 'Not enough information'])).toBe(false)
    expect(isPokerActionSet(['IP', 'OOP'])).toBe(false)
    expect(isPokerActionSet(['Linear', 'Polarized'])).toBe(false)
    expect(isPokerActionSet(['Bet A — 25', 'Bet B — 100'])).toBe(false)
    expect(isPokerActionSet([])).toBe(false)
  })
})

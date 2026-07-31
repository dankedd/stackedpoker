/**
 * Regression tests for the post-answer "facing-a-3-bet response range" reveal
 * (facingThreebetRangeReveal.ts) — the fourth leg of the reveal family.
 * Exercised on Module 4's `trb-final-1..7` (Hero opens HJ, CO 3-bets, seven
 * different hands one at a time — the exact real `HJ_vs_CO_3bet_response`
 * chart `trb-flip-reveal`/`trb-range-lab` already use directly).
 */
import { describe, it, expect } from 'vitest'
import { resolveFacingThreebetRangeReveal } from '../facingThreebetRangeReveal'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

function findStep(id: string): LessonStep {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === id)
  if (!step) throw new Error(`fixture step '${id}' not found in curriculum — has it been renamed?`)
  return step
}

describe('resolveFacingThreebetRangeReveal — trb-final-1 (HJ opens, CO 3-bets, QQ)', () => {
  const step = findStep('trb-final-1')
  const reveal = resolveFacingThreebetRangeReveal(step)

  it('step fixture matches the intended scenario', () => {
    expect(step.hero_position).toBe('HJ')
    expect(step.villain_position).toBe('CO')
    expect(step.hero_hand).toEqual(['Qs', 'Qh'])
    expect(step.range_reveal_direction).toBe('facing_3bet')
  })

  it('resolves a reveal (real THREEBET_RESPONSE_CHARTS.HJ_vs_CO_3bet_response data exists)', () => {
    expect(reveal).toBeDefined()
  })

  it('highlights QQ, not the raw card notation', () => {
    expect(reveal?.highlightHand).toBe('QQ')
  })

  it('labels it as a RESPONSE, not DEFENSE/3-BET RANGE', () => {
    expect(reveal?.label).toBe('HJ RESPONSE vs CO 3-BET')
    expect(reveal?.heroPosition).toBe('HJ')
    expect(reveal?.villainPosition).toBe('CO')
  })

  it('carries complete_strategy semantics — 4bet/call/fold are all genuinely known here', () => {
    expect(reveal?.strategySemantics).toEqual({ kind: 'complete_strategy' })
  })

  it('QQ is a pure 4-bet in this chart, matching the lesson\'s own answer key', () => {
    expect(reveal?.strategies.QQ).toEqual({ '4bet': 1 })
  })
})

describe('resolveFacingThreebetRangeReveal — every trb-final hand highlights correctly and matches its own answer', () => {
  const cases: [string, string, '4bet' | 'call' | 'fold'][] = [
    ['trb-final-1', 'QQ', '4bet'],
    ['trb-final-2', 'KQs', 'call'],
    ['trb-final-3', 'KQo', 'fold'],
    ['trb-final-4', 'A9s', 'fold'],
    ['trb-final-5', 'TT', 'call'],
    ['trb-final-6', 'JTs', 'call'],
    ['trb-final-7', 'QJo', 'fold'],
  ]

  it.each(cases)('%s highlights %s, and the chart\'s own action for it is %s', (stepId, hand, expectedAction) => {
    const step = findStep(stepId)
    const reveal = resolveFacingThreebetRangeReveal(step)
    expect(reveal?.highlightHand).toBe(hand)
    const mix = reveal?.strategies[hand]
    if (mix) {
      expect(Object.keys(mix)).toEqual([expectedAction])
    } else {
      // Absent from cells == fold, per this domain's own "everything else
      // defaults to fold" convention (see trb-range-lab's range_hint).
      expect(expectedAction).toBe('fold')
    }
  })
})

describe('resolveFacingThreebetRangeReveal — data-integrity guardrails', () => {
  it('missing hero_hand -> undefined (nothing to highlight)', () => {
    const step: LessonStep = {
      id: 'fixture-no-hand', type: 'decision_spot',
      hero_position: 'HJ', villain_position: 'CO',
    }
    expect(resolveFacingThreebetRangeReveal(step)).toBeUndefined()
  })

  it('an uncharted matchup (e.g. CO vs SB) -> undefined, never fabricated', () => {
    const step = findStep('trb-s7a')
    expect(step.hero_position).toBe('CO')
    expect(step.villain_position).toBe('SB')
    expect(resolveFacingThreebetRangeReveal(step)).toBeUndefined()
  })

  it('wrong action shape (e.g. a squeeze, not open-then-3bet) -> undefined', () => {
    const step: LessonStep = {
      id: 'fixture-squeeze', type: 'decision_spot',
      hero_position: 'HJ', villain_position: 'CO', hero_hand: ['Qs', 'Qh'],
      action_before_hero: ['UTG folds', 'HJ raises to 2.3bb', 'CO calls', 'BTN raises to 9bb'],
    }
    expect(resolveFacingThreebetRangeReveal(step)).toBeUndefined()
  })

  it('non-decision_spot step types never get a reveal, even with matching fields', () => {
    const step: LessonStep = {
      id: 'fixture-wrong-type', type: 'concept_reveal',
      hero_position: 'HJ', villain_position: 'CO', hero_hand: ['Qs', 'Qh'],
      action_before_hero: ['UTG folds', 'HJ raises to 2.3bb', 'CO raises to 7.5bb'],
    }
    expect(resolveFacingThreebetRangeReveal(step)).toBeUndefined()
  })
})

describe('evaluateStepLocally — facing_3bet direction dispatch, unchanged scoring', () => {
  it('trb-final-1 resolves via the facing_3bet resolver regardless of which answer was picked', () => {
    const step = findStep('trb-final-1')
    const correct = evaluateStepLocally(step, '4bet', 0)
    const incorrect = evaluateStepLocally(step, 'fold', 0)
    expect(correct.quality).toBe('perfect')
    expect(incorrect.quality).toBe('mistake')
    expect(correct.range_reveal!.strategies).toEqual(incorrect.range_reveal!.strategies)
    expect(correct.range_reveal!.label).toBe('HJ RESPONSE vs CO 3-BET')
  })

  it('never carries a secondaryRange — facing_3bet is already a complete standalone reveal', () => {
    const result = evaluateStepLocally(findStep('trb-final-1'), '4bet', 0)
    expect(result.range_reveal!.secondaryRange).toBeUndefined()
  })
})

describe('resolveFacingThreebetRangeReveal — full curriculum sweep', () => {
  const decisionSpots = LESSONS.flatMap((l) => l.steps).filter((s) => s.type === 'decision_spot')

  it('never throws for any real decision_spot step in the curriculum', () => {
    for (const step of decisionSpots) {
      expect(() => resolveFacingThreebetRangeReveal(step), step.id).not.toThrow()
    }
  })

  it('resolves a reveal for at least the seven trb-final spots', () => {
    const resolvedIds = new Set(
      decisionSpots.filter((s) => resolveFacingThreebetRangeReveal(s) !== undefined).map((s) => s.id),
    )
    for (let i = 1; i <= 7; i++) {
      expect(resolvedIds.has(`trb-final-${i}`)).toBe(true)
    }
  })
})

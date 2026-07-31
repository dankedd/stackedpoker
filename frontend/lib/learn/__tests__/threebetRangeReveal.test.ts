/**
 * Regression tests for the post-answer "full 3-betting range" reveal
 * (threebetRangeReveal.ts) — the 3-bet-as-aggressor mirror of
 * defendRangeReveal.ts's DEFEND reveal, exercised on Module 4's "The 3-Bet"
 * lesson (tb-s6a: BTN 3-bets vs CO with A5s; tb-s6b: HJ vs UTG with KJo, a
 * matchup with no charted 3-bet data yet).
 */
import { describe, it, expect } from 'vitest'
import { resolveThreebetRangeReveal } from '../threebetRangeReveal'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

function findStep(id: string): LessonStep {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === id)
  if (!step) throw new Error(`fixture step '${id}' not found in curriculum — has it been renamed?`)
  return step
}

describe('resolveThreebetRangeReveal — tb-s6a (BTN 3-bets vs CO open, 100bb, A5s)', () => {
  const step = findStep('tb-s6a')
  const reveal = resolveThreebetRangeReveal(step)

  it('step fixture matches the intended scenario', () => {
    expect(step.hero_position).toBe('BTN')
    expect(step.villain_position).toBe('CO')
    expect(step.hero_hand).toEqual(['As', '5s'])
    expect(step.range_reveal_direction).toBe('3bet')
  })

  it('resolves a reveal (real THREEBET_DEEP.BTN_vs_CO data exists)', () => {
    expect(reveal).toBeDefined()
  })

  it('highlights A5s, not the raw card notation', () => {
    expect(reveal?.highlightHand).toBe('A5s')
  })

  it('labels it as a 3-BET RANGE, never DEFENSE/DEFENDING', () => {
    expect(reveal?.label).toBe('BTN 3-BET RANGE vs CO OPEN')
    expect(reveal?.label).not.toMatch(/DEFEN/i)
    expect(reveal?.heroPosition).toBe('BTN')
    expect(reveal?.villainPosition).toBe('CO')
  })

  it('carries action_slice(3bet) semantics — this chart never proves fold', () => {
    expect(reveal?.strategySemantics).toEqual({ kind: 'action_slice', action: '3bet' })
  })

  it('A5s is a pure 3-bet in this chart', () => {
    expect(reveal?.strategies.A5s).toEqual({ '3bet': 1 })
  })
})

describe('resolveThreebetRangeReveal — tb-s6b (HJ vs UTG, 100bb, KJo) — no charted HJ 3-bet matchup', () => {
  const step = findStep('tb-s6b')

  it('step fixture matches the intended scenario', () => {
    expect(step.hero_position).toBe('HJ')
    expect(step.villain_position).toBe('UTG')
    expect(step.hero_hand).toEqual(['Kc', 'Jd'])
    // Changed to 'opener' — there's no HJ 3-bet chart, so this now shows UTG's own
    // opening range instead (see openerRangeReveal.test.ts).
    expect(step.range_reveal_direction).toBe('opener')
  })

  it('resolves to undefined — HJ is not a member of ThreebetMatchup, so this is honestly reported as no data, never fabricated', () => {
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })
})

describe('resolveThreebetRangeReveal — data-integrity guardrails, mirroring defendRangeReveal.ts', () => {
  it('missing hero_hand -> undefined (nothing to highlight)', () => {
    const step: LessonStep = {
      id: 'fixture-no-hand', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'CO', effective_stack_bb: 100,
    }
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })

  it('missing effective_stack_bb -> undefined (no way to pick shallow/medium/deep)', () => {
    const step: LessonStep = {
      id: 'fixture-no-stack', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'CO', hero_hand: ['As', '5s'],
    }
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })

  it('a squeeze-style action_before_hero (a call mixed in) -> undefined', () => {
    const step: LessonStep = {
      id: 'fixture-squeeze', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'CO', effective_stack_bb: 100,
      hero_hand: ['As', '5s'],
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'SB calls'],
    }
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })

  it('non-decision_spot step types never get a reveal, even with matching fields', () => {
    const step: LessonStep = {
      id: 'fixture-wrong-type', type: 'concept_reveal',
      hero_position: 'BTN', villain_position: 'CO', effective_stack_bb: 100, hero_hand: ['As', '5s'],
    }
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })

  it('an uncharted matchup (e.g. SB vs CO) -> undefined, never fabricated', () => {
    const step: LessonStep = {
      id: 'fixture-unsupported-matchup', type: 'decision_spot',
      hero_position: 'SB', villain_position: 'CO', effective_stack_bb: 100, hero_hand: ['9s', '2h'],
    }
    expect(resolveThreebetRangeReveal(step)).toBeUndefined()
  })
})

describe('evaluateStepLocally — range_reveal_direction dispatch', () => {
  it('tb-s6a (3bet direction) resolves via the 3-bet resolver, with unchanged scoring', () => {
    const step = findStep('tb-s6a')
    const result = evaluateStepLocally(step, '3bet', 0)
    expect(result.quality).toBe('perfect')
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('BTN 3-BET RANGE vs CO OPEN')
    expect(result.range_reveal!.highlightHand).toBe('A5s')
  })

  it('tb-s6a reveal is identical regardless of which answer was picked (it describes the SPOT, not the response)', () => {
    const step = findStep('tb-s6a')
    const correct = evaluateStepLocally(step, '3bet', 0)
    const incorrect = evaluateStepLocally(step, 'fold', 0)
    expect(correct.range_reveal!.strategies).toEqual(incorrect.range_reveal!.strategies)
  })

  it('tb-s6c (untouched, default defend direction) still resolves its existing complete-strategy reveal unchanged', () => {
    const step = findStep('tb-s6c')
    expect(step.range_reveal_direction).toBeUndefined()
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('BB DEFENSE vs BTN OPEN')
  })

  it('omitting range_reveal_direction defaults to the defend resolver (backward compatible)', () => {
    const step: LessonStep = {
      id: 'fixture-default-direction', type: 'decision_spot',
      hero_position: 'BB', villain_position: 'UTG', effective_stack_bb: 100,
      hero_hand: ['Ks', '9h'],
      options: [{ id: 'fold', label: 'Fold', quality: 'perfect', feedback: 'x' }],
      xp: 1,
    }
    const result = evaluateStepLocally(step, 'fold', 0)
    expect(result.range_reveal?.label).toBe('BB DEFENSE vs UTG OPEN')
  })
})

describe('resolveThreebetRangeReveal — full curriculum sweep', () => {
  const decisionSpots = LESSONS.flatMap((l) => l.steps).filter((s) => s.type === 'decision_spot')

  it('never throws for any real decision_spot step in the curriculum', () => {
    for (const step of decisionSpots) {
      expect(() => resolveThreebetRangeReveal(step), step.id).not.toThrow()
    }
  })

  it('every resolved reveal has internally consistent frequencies (no NaN, in (0,1]) and never carries a fabricated fold key', () => {
    for (const step of decisionSpots) {
      const reveal = resolveThreebetRangeReveal(step)
      if (!reveal) continue
      for (const [hand, mix] of Object.entries(reveal.strategies)) {
        for (const [action, freq] of Object.entries(mix)) {
          expect(Number.isFinite(freq), `${step.id}/${hand}/${action}`).toBe(true)
          expect(freq, `${step.id}/${hand}/${action}`).toBeGreaterThan(0)
          expect(freq, `${step.id}/${hand}/${action}`).toBeLessThanOrEqual(1)
        }
        expect(mix.fold, `${step.id}/${hand} carries a fabricated fold key`).toBeUndefined()
      }
    }
  })
})

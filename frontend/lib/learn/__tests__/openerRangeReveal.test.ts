/**
 * Regression tests for the post-answer "opener's opening range" reveal
 * (openerRangeReveal.ts) — the third leg of the defend/3bet/opener reveal
 * family. Exercised on Module 4's `tb-s6b` (HJ folds KJo vs UTG open — no HJ
 * 3-bet chart exists, so this is the pedagogically correct reveal), plus the
 * `secondaryRange` attachment path used by `resolveDefendRangeReveal`/
 * `resolveThreebetRangeReveal` via `evaluator.ts`.
 */
import { describe, it, expect } from 'vitest'
import { resolveOpenerRangePanel, resolveOpenerRangeReveal } from '../openerRangeReveal'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

function findStep(id: string): LessonStep {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === id)
  if (!step) throw new Error(`fixture step '${id}' not found in curriculum — has it been renamed?`)
  return step
}

describe('resolveOpenerRangeReveal — tb-s6b (HJ folds KJo vs UTG open, 100bb)', () => {
  const step = findStep('tb-s6b')
  const reveal = resolveOpenerRangeReveal(step)

  it('step fixture matches the intended scenario', () => {
    expect(step.hero_position).toBe('HJ')
    expect(step.villain_position).toBe('UTG')
    expect(step.hero_hand).toEqual(['Kc', 'Jd'])
    expect(step.range_reveal_direction).toBe('opener')
  })

  it('resolves a reveal (real RFI_DEEP.UTG data exists)', () => {
    expect(reveal).toBeDefined()
  })

  it('highlights KJo, not the raw card notation', () => {
    expect(reveal?.highlightHand).toBe('KJo')
  })

  it('labels it as UTG\'s OPENING RANGE, not a Hero-side chart', () => {
    expect(reveal?.label).toBe('UTG OPENING RANGE')
    expect(reveal?.heroPosition).toBe('HJ')
    expect(reveal?.villainPosition).toBe('UTG')
  })

  it('carries binary raise/fold semantics — RFI_SEMANTICS forwarded unchanged', () => {
    expect(reveal?.strategySemantics).toEqual({ kind: 'binary', action: 'raise', complement: 'fold' })
  })

  it('KJo is absent from UTG\'s tight opening range — a real hand not in the chart', () => {
    expect(reveal?.range).not.toContain('KJo')
  })
})

describe('resolveOpenerRangeReveal — data-integrity guardrails', () => {
  it('missing hero_hand -> undefined (nothing to highlight)', () => {
    const step: LessonStep = {
      id: 'fixture-no-hand', type: 'decision_spot',
      hero_position: 'HJ', villain_position: 'UTG', effective_stack_bb: 100,
    }
    expect(resolveOpenerRangeReveal(step)).toBeUndefined()
  })

  it('missing effective_stack_bb -> undefined (no way to pick shallow/medium/deep)', () => {
    const step: LessonStep = {
      id: 'fixture-no-stack', type: 'decision_spot',
      hero_position: 'HJ', villain_position: 'UTG', hero_hand: ['Kc', 'Jd'],
    }
    expect(resolveOpenerRangeReveal(step)).toBeUndefined()
  })

  it('a re-raise over the opener before Hero -> undefined (not a clean single-opener spot)', () => {
    const step: LessonStep = {
      id: 'fixture-reraised', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'CO', effective_stack_bb: 100,
      hero_hand: ['As', '5s'],
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'SB raises to 9bb'],
    }
    expect(resolveOpenerRangeReveal(step)).toBeUndefined()
  })

  it('an intervening CALL (squeeze shape) still resolves — the opener question has the same answer', () => {
    const step: LessonStep = {
      id: 'fixture-squeeze', type: 'decision_spot',
      hero_position: 'SB', villain_position: 'CO', effective_stack_bb: 100,
      hero_hand: ['Kd', 'Qc'],
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls'],
    }
    const panel = resolveOpenerRangePanel(step)
    expect(panel).toBeDefined()
    expect(panel?.label).toBe('CO OPENING RANGE')
  })

  it('non-decision_spot step types never get a reveal, even with matching fields', () => {
    const step: LessonStep = {
      id: 'fixture-wrong-type', type: 'concept_reveal',
      hero_position: 'HJ', villain_position: 'UTG', effective_stack_bb: 100, hero_hand: ['Kc', 'Jd'],
    }
    expect(resolveOpenerRangeReveal(step)).toBeUndefined()
  })

  it('an uncharted villain position -> undefined, never fabricated', () => {
    const step: LessonStep = {
      id: 'fixture-unsupported', type: 'decision_spot',
      hero_position: 'BB', villain_position: 'MP', effective_stack_bb: 100, hero_hand: ['9s', '2h'],
    }
    expect(resolveOpenerRangeReveal(step)).toBeUndefined()
  })
})

describe('evaluateStepLocally — opener direction dispatch + secondaryRange attachment', () => {
  it('tb-s6b resolves via the opener resolver, with unchanged scoring', () => {
    const step = findStep('tb-s6b')
    const result = evaluateStepLocally(step, 'fold', 0)
    expect(result.quality).toBe('perfect')
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('UTG OPENING RANGE')
    expect(result.range_reveal!.highlightHand).toBe('KJo')
    // Standalone 'opener' reveals never carry a secondaryRange of their own.
    expect(result.range_reveal!.secondaryRange).toBeUndefined()
  })

  it('tb-s6a (3bet direction) gets CO\'s opening range attached as secondaryRange', () => {
    const step = findStep('tb-s6a')
    const result = evaluateStepLocally(step, '3bet', 0)
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('BTN 3-BET RANGE vs CO OPEN')
    expect(result.range_reveal!.secondaryRange).toBeDefined()
    expect(result.range_reveal!.secondaryRange!.label).toBe('CO OPENING RANGE')
  })

  it('tb-s6c (default defend direction) gets BTN\'s opening range attached as secondaryRange', () => {
    const step = findStep('tb-s6c')
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.range_reveal).toBeDefined()
    expect(result.range_reveal!.label).toBe('BB DEFENSE vs BTN OPEN')
    expect(result.range_reveal!.secondaryRange).toBeDefined()
    expect(result.range_reveal!.secondaryRange!.label).toBe('BTN OPENING RANGE')
  })

  it('pce-s5a shows Hero\'s OWN 3-bet response (real THREEBET_DEEP.BTN_vs_CO data), not just CO\'s opening range, with CO\'s opening range attached as context', () => {
    const step = findStep('pce-s5a')
    expect(step.range_reveal_direction).toBe('3bet')
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.range_reveal!.label).toBe('BTN 3-BET RANGE vs CO OPEN')
    expect(result.range_reveal!.highlightHand).toBe('KQs')
    expect(result.range_reveal!.strategies.KQs).toEqual({ '3bet': 0.5, other: 0.5 })
    expect(result.range_reveal!.secondaryRange!.label).toBe('CO OPENING RANGE')
  })

  it('pce-s5b has no reveal at all — SB_vs_CO has no real 3-bet chart, and CO\'s opening range alone would repeat the text/visualization mismatch this step was fixed to avoid', () => {
    const step = findStep('pce-s5b')
    expect(step.range_reveal_direction).toBeUndefined()
    const result = evaluateStepLocally(step, '3bet', 0)
    expect(result.range_reveal).toBeUndefined()
  })

  it('sqz-s5b/sqz-s5c (squeeze spots) show NO opener chart — same text/visualization mismatch as pce-s5b, now answered with a theory panel', () => {
    // These two used to render 'CO OPENING RANGE'. The question they ask is what
    // HERO does when CO opens and BTN calls; CO's opening range answers a
    // different question, so the post-answer screen was reinforcing the wrong
    // concept. There is no chart to swap in — the source has no squeeze-response
    // range for any position — so both carry a `theory_panel` instead. Pinned
    // structurally in module4Audit.test.ts.
    for (const [id, answer] of [['sqz-s5b', 'fold'], ['sqz-s5c', 'fold']] as const) {
      const step = findStep(id)
      expect(step.range_reveal_direction, id).toBeUndefined()
      const result = evaluateStepLocally(step, answer, 0)
      expect(result.range_reveal, id).toBeUndefined()
      expect(result.theory_panel, id).toBeDefined()
    }
  })

  it('still TOLERATES an intervening call when the step genuinely wants an opener chart (resolver capability, not a curriculum claim)', () => {
    // The resolver deliberately accepts a raise-then-call sequence — unlike
    // `isCleanFacingOpen`, "who opened?" has the same answer either way. That
    // behavior stays covered here now that no shipped step relies on it, so a
    // future squeeze step that DOES test opener_range_strength can still use it.
    const step: LessonStep = {
      id: 'fixture-squeeze', type: 'decision_spot',
      hero_position: 'SB', villain_position: 'CO', effective_stack_bb: 100,
      hero_hand: ['Kd', 'Qc'],
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls'],
    }
    expect(resolveOpenerRangeReveal(step)?.label).toBe('CO OPENING RANGE')
  })
})

describe('resolveOpenerRangeReveal — full curriculum sweep', () => {
  const decisionSpots = LESSONS.flatMap((l) => l.steps).filter((s) => s.type === 'decision_spot')

  it('never throws for any real decision_spot step in the curriculum', () => {
    for (const step of decisionSpots) {
      expect(() => resolveOpenerRangeReveal(step), step.id).not.toThrow()
    }
  })

  it('every resolved reveal is internally consistent (finite frequencies in (0,1])', () => {
    for (const step of decisionSpots) {
      const reveal = resolveOpenerRangeReveal(step)
      if (!reveal) continue
      for (const [hand, mix] of Object.entries(reveal.strategies)) {
        for (const [action, freq] of Object.entries(mix)) {
          expect(Number.isFinite(freq), `${step.id}/${hand}/${action}`).toBe(true)
          expect(freq, `${step.id}/${hand}/${action}`).toBeGreaterThan(0)
          expect(freq, `${step.id}/${hand}/${action}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

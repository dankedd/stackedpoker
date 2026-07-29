/**
 * Regression tests for the post-answer "full defending range" reveal
 * (defendRangeReveal.ts) — the DEFEND-question equivalent of table_decision's
 * inline reveal. Covers the exact screenshot regression case (The Big Blind
 * Discount / K9o / BB vs UTG), a second, structurally different positional
 * spot (BB vs CO), and the data-integrity guardrails that keep this from
 * mislabeling untracked complement frequencies as "Fold" (see
 * __tests__/defendBaselines.test.ts for the root-cause bug this must not
 * reintroduce).
 */
import { describe, it, expect } from 'vitest'
import { resolveDefendRangeReveal } from '../defendRangeReveal'
import { cardsToHandClass } from '../combos'
import { stackBBToWorld } from '../preflopBaselines'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

function findStep(id: string): LessonStep {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === id)
  if (!step) throw new Error(`fixture step '${id}' not found in curriculum — has it been renamed?`)
  return step
}

describe('cardsToHandClass', () => {
  it.each([
    [['Ks', '9h'], 'K9o'],
    [['9h', 'Ks'], 'K9o'], // order-independent
    [['Ks', '9s'], 'K9s'],
    [['As', 'Ah'], 'AA'],
    [['7s', '6s'], '76s'],
  ] as [[string, string], string][])('%j -> %s', (cards, expected) => {
    expect(cardsToHandClass(cards)).toBe(expected)
  })
})

describe('stackBBToWorld', () => {
  it.each([
    [15, 'shallow'], [18, 'shallow'], [19, 'shallow'],
    [20, 'medium'], [40, 'medium'], [59, 'medium'],
    [60, 'deep'], [100, 'deep'],
  ] as [number, 'shallow' | 'medium' | 'deep'][])('%dbb -> %s', (bb, world) => {
    expect(stackBBToWorld(bb)).toBe(world)
  })
})

describe('resolveDefendRangeReveal — regression case: "The Big Blind Discount", bbd-s8b (UTG opens, Hero BB, K9o)', () => {
  const step = findStep('bbd-s8b')
  const reveal = resolveDefendRangeReveal(step)

  it('step fixture matches the screenshot scenario', () => {
    expect(step.hero_position).toBe('BB')
    expect(step.villain_position).toBe('UTG')
    expect(step.hero_hand).toEqual(['Ks', '9h'])
  })

  it('resolves a reveal (not undefined)', () => {
    expect(reveal).toBeDefined()
  })

  it('highlights K9o, not the raw card notation', () => {
    expect(reveal?.highlightHand).toBe('K9o')
  })

  it('labels it as the HERO calling range, never the villain\'s opening range', () => {
    expect(reveal?.label).toBe('BB CALLING RANGE vs UTG OPEN')
    expect(reveal?.label).not.toMatch(/UTG.*OPEN(ING)? RANGE/i)
    expect(reveal?.heroPosition).toBe('BB')
    expect(reveal?.villainPosition).toBe('UTG')
  })

  it('K9o itself carries no explicit strategy entry (absent from the calling chart, per defendBaselines.ts)', () => {
    // K9o never appears in DEFEND_DEEP.BB_vs_UTG. `strategySemantics` is
    // forwarded as `action_slice`, so PokerRangeGrid renders an absent hand as
    // the honest "untracked" bucket, never a fabricated pure fold — see
    // strategySemantics assertion below.
    expect(reveal?.strategies.K9o).toBeUndefined()
  })

  it('carries action_slice strategySemantics (never defaults to a fold-implying complete_strategy)', () => {
    expect(reveal?.strategySemantics).toEqual({ kind: 'action_slice', action: 'call' })
  })

  it('every resolved hand has only call/other, never a fabricated "fold" key', () => {
    for (const [hand, mix] of Object.entries(reveal?.strategies ?? {})) {
      expect(mix.fold, `${hand} should not carry a fold key`).toBeUndefined()
      const sum = Object.values(mix).reduce((s, f) => s + (f ?? 0), 0)
      expect(sum, `${hand}: ${JSON.stringify(mix)} sums to ${sum}`).toBeCloseTo(1, 6)
    }
  })

  it('AA is present as call/other, never mislabeled fold (the exact prior bug class)', () => {
    expect(reveal?.strategies.AA).toEqual({ call: 0.2, other: 0.8 })
  })
})

describe('resolveDefendRangeReveal — second positional spot: lab5-h-action (CO opens, Hero BB, K9s)', () => {
  const step = findStep('lab5-h-action')
  const reveal = resolveDefendRangeReveal(step)

  it('step fixture is a genuinely different matchup from the UTG case above', () => {
    expect(step.hero_position).toBe('BB')
    expect(step.villain_position).toBe('CO')
    expect(step.hero_hand).toEqual(['Ks', '9s'])
  })

  it('resolves a reveal using the BB-vs-CO chart, not BB-vs-UTG', () => {
    expect(reveal).toBeDefined()
    expect(reveal?.label).toBe('BB CALLING RANGE vs CO OPEN')
    expect(reveal?.highlightHand).toBe('K9s')
  })

  it('is a different strategy map from the UTG spot (proves this is not hardcoded to one matchup)', () => {
    const utgReveal = resolveDefendRangeReveal(findStep('bbd-s8b'))
    expect(reveal?.strategies).not.toEqual(utgReveal?.strategies)
  })
})

describe('resolveDefendRangeReveal — data-integrity gaps are reported as "no reveal", never fabricated', () => {
  it('hero not BB (no canonical defend chart for that side) -> undefined', () => {
    const step = findStep('lab5-a2') // HJ vs UTG
    expect(step.hero_position).not.toBe('BB')
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })

  it('a squeeze-style action_before_hero (a call mixed in, not a clean single open) -> undefined', () => {
    const step: LessonStep = {
      id: 'fixture-squeeze',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'CO',
      effective_stack_bb: 100,
      hero_hand: ['Ks', 'Qs'],
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls'],
    }
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })

  it('missing hero_hand -> undefined (nothing to highlight)', () => {
    const step: LessonStep = {
      id: 'fixture-no-hand',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'UTG',
      effective_stack_bb: 100,
    }
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })

  it('missing effective_stack_bb -> undefined (no way to pick shallow/medium/deep)', () => {
    const step: LessonStep = {
      id: 'fixture-no-stack',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'UTG',
      hero_hand: ['Ks', '9h'],
    }
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })

  it('non-decision_spot step types never get a reveal, even with matching fields', () => {
    const step: LessonStep = {
      id: 'fixture-wrong-type',
      type: 'concept_reveal',
      hero_position: 'BB',
      villain_position: 'UTG',
      effective_stack_bb: 100,
      hero_hand: ['Ks', '9h'],
    }
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })

  it('an unsupported hero/villain matchup (no canonical chart for that pair) -> undefined', () => {
    const step: LessonStep = {
      id: 'fixture-unsupported-matchup',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'HJ', // DEFEND_DEEP only covers BTN/CO/SB/UTG
      effective_stack_bb: 100,
      hero_hand: ['9s', '2h'],
    }
    expect(resolveDefendRangeReveal(step)).toBeUndefined()
  })
})

describe('resolveDefendRangeReveal — full curriculum sweep', () => {
  const decisionSpots = LESSONS.flatMap((l) => l.steps).filter((s) => s.type === 'decision_spot')

  it('never throws for any real decision_spot step in the curriculum', () => {
    for (const step of decisionSpots) {
      expect(() => resolveDefendRangeReveal(step), step.id).not.toThrow()
    }
  })

  it('resolves a reveal for at least the two regression-pinned spots', () => {
    const resolvedIds = new Set(
      decisionSpots.filter((s) => resolveDefendRangeReveal(s) !== undefined).map((s) => s.id),
    )
    expect(resolvedIds.has('bbd-s8b')).toBe(true)
    expect(resolvedIds.has('lab5-h-action')).toBe(true)
  })

  it('every resolved reveal has internally consistent frequencies (no NaN, sums ~1, no stray fold key)', () => {
    for (const step of decisionSpots) {
      const reveal = resolveDefendRangeReveal(step)
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

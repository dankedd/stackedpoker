/**
 * Regression tests for the post-answer "full defending range" reveal
 * (defendRangeReveal.ts) — the DEFEND-question equivalent of table_decision's
 * inline reveal. Covers the exact screenshot regression case (The Big Blind
 * Discount / K9o / BB vs UTG), a second, structurally different positional
 * spot (BB vs CO), and the data-integrity guardrails that keep this from
 * mislabeling untracked complement frequencies as "Fold" (see
 * __tests__/defendBaselines.test.ts for the root-cause bug this must not
 * reintroduce).
 *
 * Both regression spots (bbd-s8b, lab5-h-action) are 100bb cash BB-vs-open
 * spots, so since bbDefenseComplete.ts landed they now resolve through the
 * book-verified `complete_strategy` source (Modern Poker Theory), not the
 * calling-only `action_slice` fallback — see the "complete_strategy" describe
 * blocks below. The action_slice fallback is still covered separately, via a
 * 60bb spot the book data doesn't cover.
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

  it('labels it as the HERO defending strategy — complete_strategy is genuinely known, so "DEFENSE" is correct here', () => {
    expect(reveal?.label).toBe('BB DEFENSE vs UTG OPEN')
    expect(reveal?.label).not.toMatch(/UTG.*OPEN(ING)? RANGE/i)
    expect(reveal?.heroPosition).toBe('BB')
    expect(reveal?.villainPosition).toBe('UTG')
  })

  it('carries complete_strategy strategySemantics (100bb exactly matches the book\'s solved conditions)', () => {
    expect(reveal?.strategySemantics).toEqual({ kind: 'complete_strategy' })
  })

  it('K9o resolves to a real, explicit pure-fold entry from the book data — matching the lesson\'s own "Fold" answer key', () => {
    expect(reveal?.strategies.K9o).toEqual({ fold: 1 })
  })

  it('every resolved hand sums to ~1 across fold/call/3bet (a genuine complete strategy)', () => {
    for (const [hand, mix] of Object.entries(reveal?.strategies ?? {})) {
      const sum = Object.values(mix).reduce((s, f) => s + (f ?? 0), 0)
      expect(sum, `${hand}: ${JSON.stringify(mix)} sums to ${sum}`).toBeCloseTo(1, 2)
    }
  })

  it('AA is pure 3-bet — the book-verified complete strategy, not the old call-only chart\'s 20%/80% split', () => {
    expect(reveal?.strategies.AA).toEqual({ '3bet': 1 })
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
    expect(reveal?.label).toBe('BB DEFENSE vs CO OPEN')
    expect(reveal?.highlightHand).toBe('K9s')
    expect(reveal?.strategySemantics).toEqual({ kind: 'complete_strategy' })
  })

  it('K9s is a genuine call/3bet mix in this chart (matches lab5-h-action\'s own "close, real decision" framing)', () => {
    expect(reveal?.strategies.K9s).toEqual({ '3bet': 0.224, call: 0.776 })
  })

  it('is a different strategy map from the UTG spot (proves this is not hardcoded to one matchup)', () => {
    const utgReveal = resolveDefendRangeReveal(findStep('bbd-s8b'))
    expect(reveal?.strategies).not.toEqual(utgReveal?.strategies)
  })
})

describe('resolveDefendRangeReveal — action_slice fallback still applies off-100bb (bbd-s8c, BTN opens, Hero BB, 60bb)', () => {
  const step = findStep('bbd-s8c')
  const reveal = resolveDefendRangeReveal(step)

  it('step fixture is 60bb, not 100bb — the book\'s complete-strategy data must not be stretched to this depth', () => {
    expect(step.effective_stack_bb).toBe(60)
  })

  it('falls back to the calling-only action_slice source, not complete_strategy', () => {
    expect(reveal).toBeDefined()
    expect(reveal?.strategySemantics).toEqual({ kind: 'action_slice', action: 'call' })
    expect(reveal?.label).toBe('BB CALLING RANGE vs BTN OPEN')
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

  it('BB vs HJ at 100bb now resolves via the book\'s complete_strategy data (HJ is no longer an unsupported matchup)', () => {
    const step: LessonStep = {
      id: 'fixture-hj-now-supported',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'HJ',
      effective_stack_bb: 100,
      hero_hand: ['9s', '2h'],
    }
    const reveal = resolveDefendRangeReveal(step)
    expect(reveal).toBeDefined()
    expect(reveal?.strategySemantics).toEqual({ kind: 'complete_strategy' })
    expect(reveal?.label).toBe('BB DEFENSE vs HJ OPEN')
  })

  it('a genuinely unsupported villain position (no chart in either source) -> undefined', () => {
    const step: LessonStep = {
      id: 'fixture-unsupported-matchup',
      type: 'decision_spot',
      hero_position: 'BB',
      villain_position: 'MP', // not a modeled opener in either bbDefenseComplete.ts or defendBaselines.ts
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

  it('every resolved reveal has internally consistent frequencies (no NaN, sums ~1); action_slice reveals never carry a "fold" key', () => {
    for (const step of decisionSpots) {
      const reveal = resolveDefendRangeReveal(step)
      if (!reveal) continue
      for (const [hand, mix] of Object.entries(reveal.strategies)) {
        for (const [action, freq] of Object.entries(mix)) {
          expect(Number.isFinite(freq), `${step.id}/${hand}/${action}`).toBe(true)
          expect(freq, `${step.id}/${hand}/${action}`).toBeGreaterThan(0)
          expect(freq, `${step.id}/${hand}/${action}`).toBeLessThanOrEqual(1)
        }
        // A genuine complete_strategy (book data) legitimately has a fold key —
        // only the calling-only action_slice fallback must never fabricate one.
        if (reveal.strategySemantics.kind === 'action_slice') {
          expect(mix.fold, `${step.id}/${hand} carries a fabricated fold key`).toBeUndefined()
        }
      }
    }
  })
})

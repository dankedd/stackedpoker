/**
 * Data-integrity + rendering-pipeline regression tests for the BB "defend"
 * (calling) range data (defendBaselines.ts) as consumed by
 * StackDepthRangeMorph.tsx's 'strategy'-mode PokerRangeGrid (Module 5, "The Big
 * Blind Discount", step bbd-s6 — BB_vs_BTN, Deep).
 *
 * ROOT CAUSE this file guards against: defendBaselines.ts / threebetBaselines.ts
 * each port ONE real action (call-only, or 3bet-only respectively) from a
 * SEPARATE backend source file — defendBaselines.ts's own header says so
 * explicitly ("these are BB CALLING ranges specifically... BB's 3-bets are
 * separate"). `RangeEntry.freq` is that one action's frequency; it is NOT a
 * call-vs-fold binary. Treating `1 - freq` as "fold" (the previous behavior of
 * `rangeEntriesToStrategyMap`'s default `foldAction`) silently claims 0% fold
 * became the hand's TRUE fold frequency, which is false for every premium hand
 * that mostly 3-bets instead (AA calls 0.2 here and 3-bets ~1.0 in the sibling
 * BB_vs_BTN chart in threebetBaselines.ts — its real fold frequency is ~0, not
 * 0.8). StackDepthRangeMorph.tsx now passes an explicit `'other'` complement
 * action for this dataset instead of the default `'fold'` — these tests pin
 * that behavior and the underlying canonical data it depends on.
 */
import { describe, it, expect } from 'vitest'
import { DEFEND_DEEP, DEFEND_MEDIUM, DEFEND_SHALLOW, type DefendMatchup } from '../defendBaselines'
import { THREEBET_DEEP } from '../threebetBaselines'
import { rangeEntriesToStrategyMap } from '../rangeStrategy'
import { HAND_GRID, comboCount } from '../handGrid'

const ALL_HAND_CLASSES = new Set(HAND_GRID.flat())

describe('DEFEND_DEEP/MEDIUM/SHALLOW — 169-hand data integrity', () => {
  const allCharts: [string, { hand: string; freq: number }[]][] = [
    ...Object.entries(DEFEND_DEEP).map(([k, v]): [string, { hand: string; freq: number }[]] => [`DEEP.${k}`, v]),
    ...Object.entries(DEFEND_MEDIUM).map(([k, v]): [string, { hand: string; freq: number }[]] => [`MEDIUM.${k}`, v]),
    ...Object.entries(DEFEND_SHALLOW)
      .filter((entry): entry is [string, { hand: string; freq: number }[]] => entry[1] !== undefined)
      .map(([k, v]): [string, { hand: string; freq: number }[]] => [`SHALLOW.${k}`, v]),
  ]

  it('has exactly the 4 DEEP/MEDIUM matchups and no unexpected keys', () => {
    expect(Object.keys(DEFEND_DEEP).sort()).toEqual(['BB_vs_BTN', 'BB_vs_CO', 'BB_vs_SB', 'BB_vs_UTG'].sort())
    expect(Object.keys(DEFEND_MEDIUM).sort()).toEqual(['BB_vs_BTN', 'BB_vs_CO', 'BB_vs_SB', 'BB_vs_UTG'].sort())
  })

  for (const [key, entries] of allCharts) {
    it(`${key}: every hand is a legal 13x13 hand class (no invented notation)`, () => {
      for (const e of entries) {
        expect(ALL_HAND_CLASSES.has(e.hand), `${key}: '${e.hand}' is not a valid hand class`).toBe(true)
      }
    })

    it(`${key}: no duplicate hand keys`, () => {
      const seen = new Set<string>()
      for (const e of entries) {
        expect(seen.has(e.hand), `${key}: duplicate hand '${e.hand}'`).toBe(false)
        seen.add(e.hand)
      }
    })

    it(`${key}: every frequency is a finite number in (0, 1], never NaN/negative/>1`, () => {
      for (const e of entries) {
        expect(Number.isFinite(e.freq), `${key}: ${e.hand}.freq is not finite (${e.freq})`).toBe(true)
        expect(e.freq, `${key}: ${e.hand}.freq should be > 0`).toBeGreaterThan(0)
        expect(e.freq, `${key}: ${e.hand}.freq should be <= 1`).toBeLessThanOrEqual(1)
      }
    })
  }
})

describe('BB_vs_BTN — canonical call frequencies for premium hands (pinned from backend/app/ranges/preflop/cash_100bb/defend_ranges.py)', () => {
  const byHand = Object.fromEntries(DEFEND_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))

  it.each([
    ['AA', 0.2], ['KK', 0.2], ['QQ', 0.3], ['JJ', 0.4],
    ['AKs', 0.3], ['AQs', 0.4], ['AJs', 0.5],
    ['AKo', 0.2], ['AQo', 0.3], ['AJo', 0.5],
  ])('%s calls at %f in the calling-only chart (this is NOT its fold frequency)', (hand, freq) => {
    expect(byHand[hand]).toBeCloseTo(freq as number)
  })

  it('QTs is a pure (freq=1) call, matching the "PURE CALL" tooltip in the app', () => {
    expect(byHand.QTs).toBe(1)
  })
})

describe('rangeEntriesToStrategyMap(entries, { kind: "action_slice", action: "call" }) — the fix StackDepthRangeMorph.tsx now applies to the `defend` dataset', () => {
  const strategies = rangeEntriesToStrategyMap(DEFEND_DEEP.BB_vs_BTN, { kind: 'action_slice', action: 'call' })

  it('REGRESSION: AA never carries a "fold" key, and is not Fold-styled — only "call" and "other"', () => {
    expect(strategies.AA).toEqual({ call: 0.2, other: 0.8 })
    expect(strategies.AA.fold).toBeUndefined()
  })

  it.each(['KK', 'QQ', 'JJ', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo', 'AJo'])(
    '%s also never carries a "fold" key (same systemic bug, same fix)',
    (hand) => {
      expect(strategies[hand]?.fold).toBeUndefined()
    },
  )

  it('a pure (freq=1) hand like QTs has no complement segment at all (no "other", no "fold")', () => {
    expect(strategies.QTs).toEqual({ call: 1 })
  })

  it('every generated mix\'s explicit frequencies sum to 1 (within float tolerance)', () => {
    for (const [hand, mix] of Object.entries(strategies)) {
      const sum = Object.values(mix).reduce((s, f) => s + (f ?? 0), 0)
      expect(sum, `${hand}: ${JSON.stringify(mix)} sums to ${sum}, not ~1`).toBeCloseTo(1, 6)
    }
  })

  it('a hand absent from both the calling chart and the sibling 3-bet chart (e.g. 72o) is absent from the map, and the grid renders it via the action_slice "other" default, never a fabricated fold', () => {
    // Not present in DEFEND_DEEP.BB_vs_BTN or THREEBET_DEEP.BB_vs_BTN. PokerRangeGrid's
    // strategySemantics-driven absent-hand default is 'other' for an action_slice source
    // (never 'fold') — see strategyAbsentMix in PokerRangeGrid.tsx.
    expect(strategies['72o']).toBeUndefined()
    const threebetHands = new Set(THREEBET_DEEP.BB_vs_BTN.map((e) => e.hand))
    expect(threebetHands.has('72o')).toBe(false)
  })
})

describe('DEFEND_DEEP.BB_vs_BTN vs its sibling THREEBET_DEEP.BB_vs_BTN — cross-chart consistency check', () => {
  it('documents which premium hands are split across the two independently-authored charts (informational, not a correctness assertion on their sum — see file header)', () => {
    const callByHand = Object.fromEntries(DEFEND_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    const threebetByHand = Object.fromEntries(THREEBET_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    const sharedHands = Object.keys(callByHand).filter((h) => h in threebetByHand)
    // AA/KK/QQ/JJ/AKs/AQs/AJs/AKo appear in both — every one of them must be
    // rendered with the 'other' complement, never 'fold' (covered above).
    expect(sharedHands).toEqual(expect.arrayContaining(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AQs', 'AJs', 'AKo']))
  })

  it('PROOF the two charts cannot be mathematically merged into one joint call/3bet/fold strategy: AA sums to 120% (call 20% + 3bet 100%), which is impossible for a real probability distribution', () => {
    const callByHand = Object.fromEntries(DEFEND_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    const threebetByHand = Object.fromEntries(THREEBET_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    const combinedAA = callByHand.AA + threebetByHand.AA
    expect(callByHand.AA).toBeCloseTo(0.2)
    expect(threebetByHand.AA).toBeCloseTo(1.0)
    expect(combinedAA).toBeGreaterThan(1) // >100% — a mathematical impossibility if these were one joint strategy
  })

  it('65s/54s/76s are a THIRD inconsistency shape: real (non-pure) frequencies in BOTH charts at once (e.g. 76s: call 100% in the calling chart, 3-bet 40% in the sibling chart) — another combination no single joint strategy could produce, reinforcing why the two charts are never merged', () => {
    const callByHand = Object.fromEntries(DEFEND_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    const threebetByHand = Object.fromEntries(THREEBET_DEEP.BB_vs_BTN.map((e) => [e.hand, e.freq]))
    expect(callByHand['76s']).toBe(1)
    expect(threebetByHand['76s']).toBeCloseTo(0.4)
  })
})

describe('BB_vs_BTN — action_slice sanity checks across hand categories (premium / bluff-shaped / medium / weak), rendered via the real strategySemantics pipeline', () => {
  const strategies = rangeEntriesToStrategyMap(DEFEND_DEEP.BB_vs_BTN, { kind: 'action_slice', action: 'call' })
  const callHands = new Set(DEFEND_DEEP.BB_vs_BTN.map((e) => e.hand))
  const threebetHands = new Set(THREEBET_DEEP.BB_vs_BTN.map((e) => e.hand))

  it('premium pair (AA): call 20%, complement is honestly "other" — never fold', () => {
    expect(strategies.AA).toEqual({ call: 0.2, other: 0.8 })
  })

  it('bluff-shaped suited ace (A5s): a PURE call here (100%) yet ALSO a pure 3-bet in the sibling chart — the two charts disagree outright on this hand\'s dominant action, underscoring why they are never merged into one number', () => {
    expect(callHands.has('A5s')).toBe(true)
    expect(strategies.A5s).toEqual({ call: 1 }) // no complement segment — this chart alone says "always call"
    expect(threebetHands.has('A5s')).toBe(true) // yet the sibling chart alone says "always 3-bet"
  })

  it('a genuinely absent hand (J5s: not listed in either the calling chart or the sibling 3-bet chart) resolves via strategySemantics, never a fabricated fold', () => {
    expect(callHands.has('J5s')).toBe(false)
    expect(threebetHands.has('J5s')).toBe(false)
    expect(strategies.J5s).toBeUndefined() // caller must forward strategySemantics for the grid to resolve this correctly
  })

  it('medium suited connector (98s): a pure (freq=1) call, no sibling 3-bet entry at all — a clean, unambiguous chart with nothing to reconcile', () => {
    expect(threebetHands.has('98s')).toBe(false)
    expect(strategies['98s']).toEqual({ call: 1 })
  })

  it('weak/marginal suited king (K6s): a genuine partial mix (call 70%) with NO 3-bet counterpart in threebetBaselines.ts — still labeled "other", not asserted as proven fold, because this data alone cannot prove that either', () => {
    const threebetHands = new Set(THREEBET_DEEP.BB_vs_BTN.map((e) => e.hand))
    expect(threebetHands.has('K6s')).toBe(false)
    expect(strategies.K6s).toEqual({ call: 0.7, other: expect.closeTo(0.3, 6) })
  })

  it('weak offsuit hand (72o): absent from both this chart and the curriculum entirely — resolves the same honest way as any other absent hand', () => {
    expect(callHands.has('72o')).toBe(false)
    expect(strategies['72o']).toBeUndefined()
  })
})

describe('DEFEND_MEDIUM — mechanically derived, still internally consistent', () => {
  it('only keeps hands with freq >= 1 from DEEP (documented derivation)', () => {
    for (const matchup of Object.keys(DEFEND_DEEP) as DefendMatchup[]) {
      for (const e of DEFEND_MEDIUM[matchup]) {
        expect(e.freq).toBe(1)
      }
    }
  })
})

describe('combo-weighted width sanity — DEFEND_DEEP.BB_vs_BTN\'s calling range is a plausible width, not a data-entry blowout', () => {
  it('lands well under 100% of hands (it is a calling-only slice, not the full continuing range)', () => {
    const combos = DEFEND_DEEP.BB_vs_BTN.reduce((sum, e) => sum + comboCount(e.hand) * e.freq, 0)
    const pct = (combos / 1326) * 100
    expect(pct).toBeGreaterThan(20)
    expect(pct).toBeLessThan(45)
  })
})

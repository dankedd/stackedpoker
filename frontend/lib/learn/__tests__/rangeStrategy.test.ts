/**
 * Unit tests for the canonical hand-strategy model (rangeStrategy.ts) — the
 * single representation every range grid's mixed-frequency data normalizes
 * into. See PokerRangeGrid.tsx's 'strategy' mode for the renderer these feed.
 */
import { describe, it, expect } from 'vitest'
import {
  sumFreqs,
  isValidMix,
  pruneMix,
  fromActionFold,
  fromPureAction,
  rangeEntriesToStrategyMap,
  membershipToStrategyMap,
  fromActionDict,
  dominantAction,
  dominantFrequency,
  classifyMix,
  UNSPECIFIED_ACTION,
} from '../rangeStrategy'

describe('sumFreqs / isValidMix', () => {
  it('sums a mix\'s frequencies', () => {
    expect(sumFreqs({ call: 0.7, fold: 0.3 })).toBeCloseTo(1)
    expect(sumFreqs({ raise: 1 })).toBe(1)
  })

  it('accepts a mix that sums to ~100% within tolerance', () => {
    expect(isValidMix({ call: 0.7, fold: 0.3 })).toBe(true)
    expect(isValidMix({ raise: 0.2, call: 0.55, fold: 0.25 })).toBe(true)
    // Rounded-to-nearest-0.05 source data (mttRfiBaselines.ts's own convention)
    // can land a hair off 1.0 — tolerance must forgive that.
    expect(isValidMix({ raise: 0.65, fold: 0.34 })).toBe(true)
  })

  it('rejects a mix that does not sum to ~100%', () => {
    expect(isValidMix({ call: 0.5, fold: 0.2 })).toBe(false)
    expect(isValidMix({ call: 0.6, fold: 0.6 })).toBe(false)
  })

  it('rejects an empty mix', () => {
    expect(isValidMix({})).toBe(false)
  })
})

describe('pruneMix', () => {
  it('drops zero and undefined entries, keeps real ones', () => {
    expect(pruneMix({ raise: 0.7, limp: 0, jam: undefined as unknown as number, fold: 0.3 })).toEqual({
      raise: 0.7,
      fold: 0.3,
    })
  })
})

describe('fromActionFold — RangeEntry-style single action + implicit fold complement', () => {
  it('A5s: call 70% -> { call: 0.7, fold: 0.3 } (the literal spec example)', () => {
    expect(fromActionFold('call', 0.7, 'fold')).toEqual({ call: 0.7, fold: 0.3 })
  })

  it('a pure (freq=1) hand has no fold entry at all', () => {
    expect(fromActionFold('raise', 1, 'fold')).toEqual({ raise: 1 })
  })

  it('clamps out-of-range frequencies defensively', () => {
    expect(fromActionFold('raise', 1.4, 'fold')).toEqual({ raise: 1 })
    expect(fromActionFold('raise', -0.2, 'fold')).toEqual({ raise: 0, fold: 1 })
  })

  it('supports a non-fold complement action (e.g. jam vs a raise mix)', () => {
    expect(fromActionFold('raise', 0.6, 'jam')).toEqual({ raise: 0.6, jam: 0.4 })
  })
})

describe('fromPureAction', () => {
  it('is 100% one action', () => {
    expect(fromPureAction('raise')).toEqual({ raise: 1 })
  })
})

describe('rangeEntriesToStrategyMap — preflopBaselines.ts/threebetBaselines.ts/defendBaselines.ts adapter', () => {
  it('normalizes a list of RangeEntry into a full RangeStrategyMap', () => {
    const map = rangeEntriesToStrategyMap(
      [
        { hand: 'AA', freq: 1 },
        { hand: 'A5s', freq: 0.65 },
      ],
      { kind: 'binary', action: 'raise', complement: 'fold' },
    )
    expect(map.AA).toEqual({ raise: 1 })
    expect(map.A5s).toEqual({ raise: 0.65, fold: 0.35 })
  })
})

describe('rangeEntriesToStrategyMap — `action_slice` kind (defendBaselines.ts/threebetBaselines.ts adapter, the "AA renders as Fold" fix)', () => {
  it('routes the complement to the reserved UNSPECIFIED_ACTION, never a caller-supplied "fold"', () => {
    const map = rangeEntriesToStrategyMap(
      [{ hand: 'AA', freq: 0.2 }, { hand: 'QTs', freq: 1 }],
      { kind: 'action_slice', action: 'call' },
    )
    expect(map.AA).toEqual({ call: 0.2, [UNSPECIFIED_ACTION]: 0.8 })
    expect(map.AA.fold).toBeUndefined()
    expect(map.QTs).toEqual({ call: 1 }) // pure — no complement segment at all
  })

  it('a hand entirely absent from `entries` is left OUT of the map (sparse, same shape as `binary`) — the caller must forward `strategySemantics` so the grid resolves it to UNSPECIFIED_ACTION, never fold', () => {
    const map = rangeEntriesToStrategyMap([{ hand: 'AA', freq: 0.2 }], { kind: 'action_slice', action: 'call' })
    expect(map.A5s).toBeUndefined()
  })

  it('UNSPECIFIED_ACTION is the literal string "other" (stable, since it is used as a rendering key elsewhere)', () => {
    expect(UNSPECIFIED_ACTION).toBe('other')
  })
})

describe('rangeEntriesToStrategyMap — refuses to guess for shapes it cannot safely build from RangeEntry[]', () => {
  it('throws for `complete_strategy` (multi-action data needs fromActionDict instead)', () => {
    expect(() => rangeEntriesToStrategyMap([{ hand: 'AA', freq: 1 }], { kind: 'complete_strategy' })).toThrow()
  })

  it('throws for `membership` (no per-hand frequency — needs membershipToStrategyMap instead)', () => {
    expect(() => rangeEntriesToStrategyMap([{ hand: 'AA', freq: 1 }], { kind: 'membership', action: 'raise' })).toThrow()
  })
})

describe('membershipToStrategyMap — plain string[] range adapter (backwards compat)', () => {
  it('every hand in a plain membership list becomes a pure 100% mix', () => {
    const map = membershipToStrategyMap(['AA', 'AKs'], 'raise')
    expect(map.AA).toEqual({ raise: 1 })
    expect(map.AKs).toEqual({ raise: 1 })
  })
})

describe('fromActionDict — MttRfiActionFrequencies adapter (already the same shape)', () => {
  it('passes through a real sparse multi-action cell, three-way mix included', () => {
    // KQo: 4bet 20% / call 55% / fold 25% — the spec's own three-action example.
    expect(fromActionDict({ '4bet': 0.2, call: 0.55, fold: 0.25 })).toEqual({
      '4bet': 0.2,
      call: 0.55,
      fold: 0.25,
    })
  })

  it('strips undefined keys from a sparse dict', () => {
    expect(fromActionDict({ raise: 0.75, fold: 0.25, jam: undefined, limp: undefined })).toEqual({
      raise: 0.75,
      fold: 0.25,
    })
  })
})

describe('dominantAction / dominantFrequency', () => {
  it('picks the highest-frequency action', () => {
    expect(dominantAction({ call: 0.72, fold: 0.28 })).toBe('call')
    expect(dominantFrequency({ call: 0.72, fold: 0.28 })).toBeCloseTo(0.72)
  })

  it('three-way mix picks the actual max, not authoring order', () => {
    expect(dominantAction({ '4bet': 0.2, call: 0.55, fold: 0.25 })).toBe('call')
  })

  it('is undefined for an empty mix', () => {
    expect(dominantAction({})).toBeUndefined()
  })
})

describe('classifyMix — learner-facing mix vocabulary (spec #8)', () => {
  it('PURE for a >=98% dominant action', () => {
    expect(classifyMix({ raise: 1 }).label).toBe('PURE RAISE')
    expect(classifyMix({ raise: 1 }).tier).toBe('pure')
  })

  it('MOSTLY for a 65-97% dominant action — the literal "Call 72% / Fold 28%" example', () => {
    const d = classifyMix({ call: 0.72, fold: 0.28 })
    expect(d.tier).toBe('mostly')
    expect(d.label).toBe('MOSTLY CALL')
  })

  it('MIXED for no action reaching 65% — the three-way 20/55/25 example', () => {
    const d = classifyMix({ '4bet': 0.2, call: 0.55, fold: 0.25 })
    expect(d.tier).toBe('mixed')
  })

  it('a 50/50 split is MIXED, not MOSTLY either way', () => {
    expect(classifyMix({ call: 0.5, fold: 0.5 }).tier).toBe('mixed')
  })

  it('MOSTLY FOLD when fold itself is the dominant action', () => {
    const d = classifyMix({ raise: 0.35, fold: 0.65 })
    expect(d.label).toBe('MOSTLY FOLD')
  })
})

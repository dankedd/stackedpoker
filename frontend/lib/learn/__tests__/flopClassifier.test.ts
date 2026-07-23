import { describe, it, expect } from 'vitest'
import { classifyFlop, estimateVolatility, dimensionValue, equityBucket, turnImpact } from '../flopClassifier'

describe('classifyFlop — structure', () => {
  it('classifies trips (all three ranks equal)', () => {
    expect(classifyFlop(['8s', '8h', '8c']).structure).toBe('trips')
  })
  it('classifies paired (exactly two ranks equal)', () => {
    expect(classifyFlop(['8s', '8h', '3c']).structure).toBe('paired')
  })
  it('classifies unpaired (three distinct ranks)', () => {
    expect(classifyFlop(['Js', 'Th', '9c']).structure).toBe('unpaired')
  })
  it('throws on a duplicate physical card', () => {
    expect(() => classifyFlop(['As', 'As', 'Kd'])).toThrow()
  })
  it('throws on an invalid rank or suit', () => {
    expect(() => classifyFlop(['Xs', 'Kh', 'Qd'])).toThrow()
    expect(() => classifyFlop(['As', 'Kz', 'Qd'])).toThrow()
  })
})

describe('classifyFlop — texture', () => {
  it('classifies monotone (all three suits equal)', () => {
    expect(classifyFlop(['As', 'Ks', '2s']).texture).toBe('monotone')
  })
  it('classifies two_tone (exactly two suits equal)', () => {
    expect(classifyFlop(['As', 'Ks', '2d']).texture).toBe('two_tone')
  })
  it('classifies rainbow (three distinct suits)', () => {
    expect(classifyFlop(['As', 'Kh', '2d']).texture).toBe('rainbow')
  })
})

describe('classifyFlop — two-tone subtypes (unpaired only)', () => {
  it('high_mid: the off-suit card is the lowest rank', () => {
    // Kh 8h 3c — hearts are K,8 (top two); off card 3c is lowest.
    const c = classifyFlop(['Kh', '8h', '3c'])
    expect(c.texture).toBe('two_tone')
    expect(c.twoToneSubtype).toBe('high_mid')
  })
  it('mid_low: the off-suit card is the highest rank', () => {
    // Kc 8h 3h — hearts are 8,3 (bottom two); off card Kc is highest.
    const c = classifyFlop(['Kc', '8h', '3h'])
    expect(c.texture).toBe('two_tone')
    expect(c.twoToneSubtype).toBe('mid_low')
  })
  it('high_low: the off-suit card is the middle rank', () => {
    // Kh 8c 3h — hearts are K,3 (top and bottom); off card 8c is the middle.
    const c = classifyFlop(['Kh', '8c', '3h'])
    expect(c.texture).toBe('two_tone')
    expect(c.twoToneSubtype).toBe('high_low')
  })
  it('is undefined for monotone flops', () => {
    expect(classifyFlop(['As', 'Ks', '2s']).twoToneSubtype).toBeUndefined()
  })
  it('is undefined for rainbow flops', () => {
    expect(classifyFlop(['As', 'Kh', '2d']).twoToneSubtype).toBeUndefined()
  })
  it('is undefined for a paired two-tone flop (ambiguous by rank alone)', () => {
    // 8s 8h 3s — spades are 8,3; the pair itself is split across the suit boundary.
    const c = classifyFlop(['8s', '8h', '3s'])
    expect(c.texture).toBe('two_tone')
    expect(c.structure).toBe('paired')
    expect(c.twoToneSubtype).toBeUndefined()
  })
})

describe('classifyFlop — highest rank and rank families', () => {
  it('highestRank is the highest of the three cards, independent of suit', () => {
    expect(classifyFlop(['2s', 'Kh', '7d']).highestRank).toBe('K')
  })
  it('maps A / KQJT / 9876 / 5432 to families A / H / M / L', () => {
    expect(classifyFlop(['As', 'Kh', 'Qd']).family).toBe('AHH')
    expect(classifyFlop(['Ks', 'Th', '9d']).family).toBe('HHM')
    expect(classifyFlop(['9s', '8h', '6d']).family).toBe('MMM')
    expect(classifyFlop(['8s', '7h', '5d']).family).toBe('MML')
    expect(classifyFlop(['5s', '4h', '2d']).family).toBe('LLL')
  })
  it('rankFamilies has one letter per card in the same order as the input', () => {
    const c = classifyFlop(['2s', 'Ah', '9d'])
    expect(c.rankFamilies).toEqual(['L', 'A', 'M'])
  })
})

describe('classifyFlop — possible flopped straights (book examples)', () => {
  it('AQ7 → 0 possible straights (span too wide)', () => {
    expect(classifyFlop(['As', 'Qh', '7d']).possibleFloppedStraights.count).toBe(0)
  })
  it('KT9 → 1 possible straight (needs exactly Q,J)', () => {
    const r = classifyFlop(['Ks', 'Th', '9d']).possibleFloppedStraights
    expect(r.count).toBe(1)
    expect(r.combos).toEqual([['Q', 'J']])
  })
  it('875 → 2 possible straights (needs 4+6, or 6+9)', () => {
    const r = classifyFlop(['8s', '7h', '5d']).possibleFloppedStraights
    expect(r.count).toBe(2)
    const asSets = r.combos.map((p) => new Set(p))
    expect(asSets.some((s) => s.has('6') && s.has('4'))).toBe(true)
    expect(asSets.some((s) => s.has('6') && s.has('9'))).toBe(true)
  })
  it('JT9 → 3 possible straights', () => {
    const r = classifyFlop(['Js', 'Th', '9d']).possibleFloppedStraights
    expect(r.count).toBe(3)
  })

  it('wheel-adjacent: A23 → exactly the wheel straight (needs 4,5)', () => {
    const r = classifyFlop(['As', '2h', '3d']).possibleFloppedStraights
    expect(r.count).toBe(1)
    const [pair] = r.combos
    expect(new Set(pair)).toEqual(new Set(['4', '5']))
  })
  it('broadway-adjacent: QJT → 3 possible straights', () => {
    const r = classifyFlop(['Qs', 'Jh', 'Td']).possibleFloppedStraights
    expect(r.count).toBe(3)
  })
  it('A high with a low+mid card that cannot bridge to the ace → 0', () => {
    // A82: ace-high span is huge, ace-low span (treating A as 1) still can't
    // reach 8 within 5 consecutive values either way.
    expect(classifyFlop(['As', '8h', '2d']).possibleFloppedStraights.count).toBe(0)
  })
  it('paired flops never have a possible straight, even if ranks look "connected"', () => {
    // 6s6h5d: only 2 distinct ranks — max 4 distinct ranks total with 2 hole cards.
    expect(classifyFlop(['6s', '6h', '5d']).possibleFloppedStraights.count).toBe(0)
  })
  it('trips flops never have a possible straight', () => {
    expect(classifyFlop(['6s', '6h', '6d']).possibleFloppedStraights.count).toBe(0)
  })
  it('straight combos never include a board rank (that would double-count a card)', () => {
    const c = classifyFlop(['Js', 'Th', '9d'])
    const boardRanks = new Set(c.ranks)
    for (const [a, b] of c.possibleFloppedStraights.combos) {
      expect(boardRanks.has(a)).toBe(false)
      expect(boardRanks.has(b)).toBe(false)
    }
  })
})

describe('estimateVolatility — a labeled heuristic, not a fake-precise number', () => {
  it('rates a monotone, straight-rich low board as high volatility', () => {
    const v = estimateVolatility(['8h', '7h', '5d'])
    expect(v.level).toBe('high')
    expect(v.reasons.length).toBeGreaterThan(0)
  })
  it('rates a dry ace-high rainbow board as low volatility', () => {
    const v = estimateVolatility(['As', 'Kd', '4c'])
    expect(v.level).toBe('low')
  })
  it('rates a paired, disconnected board as low volatility', () => {
    const v = estimateVolatility(['Ks', 'Kh', '4c'])
    expect(v.level).toBe('low')
  })
  it('never returns a level outside the defined set', () => {
    const boards: [string, string, string][] = [
      ['As', 'Kh', 'Qd'], ['2s', '2h', '2d'], ['9s', '8h', '7d'], ['Ts', '5h', '2c'],
    ]
    for (const b of boards) expect(['low', 'medium', 'high']).toContain(estimateVolatility(b).level)
  })
})

describe('dimensionValue — derives ground truth for drills/autopsies from classifyFlop', () => {
  it('reads each dimension correctly off a real classification', () => {
    const c = classifyFlop(['Ks', 'Th', '9h'])
    expect(dimensionValue(c, 'structure')).toBe('unpaired')
    expect(dimensionValue(c, 'texture')).toBe('two_tone')
    expect(dimensionValue(c, 'highest_rank_family')).toBe('H')
    expect(dimensionValue(c, 'straight_count')).toBe('1')
  })
  it('two_tone_subtype is "n/a" when the flop has none (paired/monotone/rainbow)', () => {
    const c = classifyFlop(['As', 'Kh', '2d'])
    expect(dimensionValue(c, 'two_tone_subtype')).toBe('n/a')
  })
})

describe('equityBucket — exact source thresholds (Strong>=75, Good 50-75, Weak 33-50, Trash<33)', () => {
  it('boundaries are inclusive on the lower edge of each bucket', () => {
    expect(equityBucket(100)).toBe('strong')
    expect(equityBucket(75)).toBe('strong')
    expect(equityBucket(74.9)).toBe('good')
    expect(equityBucket(50)).toBe('good')
    expect(equityBucket(49.9)).toBe('weak')
    expect(equityBucket(33)).toBe('weak')
    expect(equityBucket(32.9)).toBe('trash')
    expect(equityBucket(0)).toBe('trash')
  })
})

describe('turnImpact — labeled heuristic for whether a turn card changes the board', () => {
  it('flags a card that pairs the board', () => {
    const r = turnImpact(['As', 'Kh', '9d'], '9s')
    expect(r.changesBoard).toBe(true)
    expect(r.reasons.some((s) => s.includes('Pairs the board'))).toBe(true)
  })
  it('flags a card completing the flush on a two-tone board', () => {
    const r = turnImpact(['As', 'Kh', '9h'], '2h')
    expect(r.changesBoard).toBe(true)
    expect(r.reasons.some((s) => s.includes('flush'))).toBe(true)
  })
  it('flags a card completing one of the board\'s possible straights', () => {
    const r = turnImpact(['Ks', 'Th', '9d'], 'Qc')
    expect(r.changesBoard).toBe(true)
    expect(r.reasons.some((s) => s.includes('straight'))).toBe(true)
  })
  it('does not flag an unrelated brick on a dry board', () => {
    const r = turnImpact(['As', 'Kd', '4c'], '9s')
    expect(r.changesBoard).toBe(false)
    expect(r.reasons).toEqual([])
  })
})

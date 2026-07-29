import { describe, it, expect } from 'vitest'
import {
  expandHandClass,
  expandRange,
  removeBlocked,
  canonicalCombo,
  allHandClasses,
  allPairClasses,
  allUnpairedClasses,
  handClassCombos,
  totalStartingCombos,
  expandGenericUnpaired,
  getBlockedCombos,
  getRemainingCombos,
  comboKey,
  comboContainsAny,
  flushTiers,
} from '../combos'

describe('combos.ts — combination engine invariants (Module 9 spec section 12)', () => {
  it('AA has exactly 6 combos', () => {
    expect(expandHandClass('AA').length).toBe(6)
  })

  it('generic AK (suited + offsuit) has exactly 16 combos', () => {
    expect(expandGenericUnpaired('A', 'K').length).toBe(16)
  })

  it('AKs has exactly 4 combos', () => {
    expect(expandHandClass('AKs').length).toBe(4)
  })

  it('AKo has exactly 12 combos', () => {
    expect(expandHandClass('AKo').length).toBe(12)
  })

  it('all 169 hand classes expand to 1,326 total combos', () => {
    const classes = allHandClasses()
    expect(classes.length).toBe(169)
    expect(totalStartingCombos()).toBe(1326)
  })

  it('13 pair classes, 78 suited classes, 78 offsuit classes', () => {
    expect(allPairClasses().length).toBe(13)
    const { suited, offsuit } = allUnpairedClasses()
    expect(suited.length).toBe(78)
    expect(offsuit.length).toBe(78)
  })

  it('pocket pairs total 78 combos, suited total 312, offsuit total 936', () => {
    const pairTotal = allPairClasses().reduce((s, h) => s + handClassCombos(h), 0)
    const { suited, offsuit } = allUnpairedClasses()
    const suitedTotal = suited.reduce((s, h) => s + handClassCombos(h), 0)
    const offsuitTotal = offsuit.reduce((s, h) => s + handClassCombos(h), 0)
    expect(pairTotal).toBe(78)
    expect(suitedTotal).toBe(312)
    expect(offsuitTotal).toBe(936)
    expect(pairTotal + suitedTotal + offsuitTotal).toBe(1326)
  })

  it('holding one ace leaves 3 AA combos', () => {
    const aa = expandHandClass('AA')
    const remaining = removeBlocked(aa, ['As'])
    expect(remaining.length).toBe(3)
    expect(remaining.every(([a, b]) => a !== 'As' && b !== 'As')).toBe(true)
  })

  it('holding one ace leaves 12 generic AK combos when no king is blocked', () => {
    const ak = expandGenericUnpaired('A', 'K')
    const remaining = removeBlocked(ak, ['As'])
    expect(remaining.length).toBe(12)
  })

  it('holding one ace and one king leaves 9 generic AK combos', () => {
    const ak = expandGenericUnpaired('A', 'K')
    const remaining = removeBlocked(ak, ['As', 'Kd'])
    expect(remaining.length).toBe(9)
  })

  it('no expanded combo ever contains the same physical card twice', () => {
    for (const hand of allHandClasses()) {
      for (const [a, b] of expandHandClass(hand)) {
        expect(a).not.toBe(b)
      }
    }
  })

  it('no expanded combo ever duplicates as an unordered pair within one hand class', () => {
    for (const hand of allHandClasses()) {
      const keys = expandHandClass(hand).map(comboKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('getBlockedCombos and getRemainingCombos partition the full set with no overlap', () => {
    const aa = expandHandClass('AA')
    const known = ['As', 'Ah']
    const blocked = getBlockedCombos(aa, known)
    const remaining = getRemainingCombos(aa, known)
    expect(blocked.length + remaining.length).toBe(aa.length)
    const blockedKeys = new Set(blocked.map(comboKey))
    const remainingKeys = new Set(remaining.map(comboKey))
    for (const k of blockedKeys) expect(remainingKeys.has(k)).toBe(false)
  })

  it('board removal: a paired flop removes the matching set combo down to the correct count', () => {
    // Board 8-3-3-2-2 style paired removal: holding one 3 leaves 33 with 3 combos (Acevedo AJ9 example: 33 -> 3 combos)
    const treys = expandHandClass('33')
    expect(removeBlocked(treys, ['3d']).length).toBe(3)
  })

  it('canonicalCombo never returns a self-collision', () => {
    for (const hand of allHandClasses()) {
      const [a, b] = canonicalCombo(hand)
      expect(a).not.toBe(b)
    }
  })

  it('comboContainsAny detects a card in either position', () => {
    expect(comboContainsAny(['As', 'Kd'], ['Kd'])).toBe(true)
    expect(comboContainsAny(['As', 'Kd'], ['Ks'])).toBe(false)
  })

  it('expandRange sums combo counts for a mixed range', () => {
    expect(expandRange(['AA', 'AKs', 'AKo']).length).toBe(6 + 4 + 12)
  })

  // ── Lesson 9.2 source checksum: K-blocked SB defense classes (MPT, Exploitative
  // 3-betting example) — the book states the SB's full 350-combo defending range
  // drops to 324 (Δ26) once Hero's K blocker is applied, and names (non-exhaustively,
  // "such as") AK, KK, K6s+ and KTo+ as the affected classes. This locks the exact,
  // independently computable reduction across only those named classes so a future
  // content edit can't silently drift from what the engine actually verifies.
  it('K-blocked classes named in the SB-defense example (AK, KK, K6s-KQs, KTo-KQo) reduce by a fixed, computed amount when Hero holds Kd', () => {
    const names = [
      ...expandGenericUnpaired('A', 'K'),
      ...expandHandClass('KK'),
      ...expandHandClass('K6s'), ...expandHandClass('K7s'), ...expandHandClass('K8s'),
      ...expandHandClass('K9s'), ...expandHandClass('KTs'), ...expandHandClass('KJs'), ...expandHandClass('KQs'),
      ...expandHandClass('KTo'), ...expandHandClass('KJo'), ...expandHandClass('KQo'),
    ]
    expect(names.length).toBe(86)
    const remaining = removeBlocked(names, ['Kd'])
    expect(names.length - remaining.length).toBe(23)
  })

  // ── Lesson 9.6 source checksum: Blocker Effects board (8h 3h 3c 2h 2d) —
  // the book states Villain's OOP range contains 45 flush combos not blocked
  // by the board, split into exactly 9 tiers of 9/8/7/6/5/4/3/2/1 (nut flush
  // down to 5-high flush, no 4-high or 8-high tier since 8h/3h/2h are dead
  // hearts). flushTiers derives this independently from card removal alone —
  // it is never told these numbers, only which hearts are already gone.
  it("flushTiers on the Blocker Effects board reproduces the book's 45-combo, 9-tier flush pyramid exactly", () => {
    const tiers = flushTiers('h', ['8', '3', '2'])
    const sizes = tiers.map((t) => t.combos.length)
    expect(sizes).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1])
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(45)
    expect(tiers[0].tierLabel).toBe('nut')
    expect(tiers.map((t) => t.tierLabel)).toEqual(['nut', 'K', 'Q', 'J', 'T', '9', '7', '6', '5'])
  })

  it('flushTiers never produces a combo with the same card twice, and every combo is the correct suit', () => {
    const tiers = flushTiers('h', ['8', '3', '2'])
    for (const tier of tiers) {
      for (const [a, b] of tier.combos) {
        expect(a).not.toBe(b)
        expect(a.endsWith('h')).toBe(true)
        expect(b.endsWith('h')).toBe(true)
      }
    }
  })

  it("Hero's nut blocker (Ah) removes only the 'nut' tier from the Villain pyramid — every other tier is untouched", () => {
    const tiers = flushTiers('h', ['8', '3', '2'])
    const known = ['Ah']
    for (const tier of tiers) {
      const blocked = getBlockedCombos(tier.combos, known)
      if (tier.tierLabel === 'nut') {
        expect(blocked.length).toBe(tier.combos.length) // all 9 gone
      } else {
        expect(blocked.length).toBe(0) // completely untouched
      }
    }
  })
})

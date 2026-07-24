/**
 * Data-integrity tests for the canonical MTT RFI chart data (`mttRfiBaselines.ts`),
 * independent of any curriculum wiring. See mttRfiBaselines.ts's header for provenance
 * (Michael Acevedo, "Modern Poker Theory", Ch. 7) and extraction methodology.
 */
import { describe, it, expect } from 'vitest'
import { MTT_RFI_CHARTS, MTT_RFI_CHART_KEYS, type MttAction } from '../mttRfiBaselines'
import { expandHandClass } from '../combos'

const POSITION_KEYS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB']
const STACKS = [15, 25, 40, 60]
const ALLOWED_ACTIONS: MttAction[] = ['raise', 'limp', 'jam', 'fold']

describe('MTT_RFI_CHARTS — all 32 charts present', () => {
  it('has exactly 32 charts', () => {
    expect(MTT_RFI_CHART_KEYS.length).toBe(32)
  })

  it('has every position x stack-depth combination', () => {
    for (const pos of POSITION_KEYS) {
      for (const stack of STACKS) {
        const key = `${pos}_RFI_${stack}BB`
        expect(MTT_RFI_CHARTS[key], `missing chart ${key}`).toBeDefined()
      }
    }
  })

  it('has no duplicate hands within a chart', () => {
    for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
      const seen = new Set<string>()
      for (const cell of chart.cells) {
        expect(seen.has(cell.hand), `${key}: duplicate hand ${cell.hand}`).toBe(false)
        seen.add(cell.hand)
      }
    }
  })
})

describe('MTT_RFI_CHARTS — every hand is a legal 13x13 starting-hand class', () => {
  for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
    it(`${key}: all hands expand to valid combos`, () => {
      for (const cell of chart.cells) {
        const combos = expandHandClass(cell.hand)
        const expected = cell.hand.length === 2 ? 6 : cell.hand.endsWith('s') ? 4 : 12
        expect(combos.length, `${key}: ${cell.hand} expanded to ${combos.length} combos`).toBe(expected)
      }
    })
  }
})

describe('MTT_RFI_CHARTS — action frequencies are valid', () => {
  for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
    it(`${key}: every cell's actions sum to 1.0 and use only allowed keys`, () => {
      for (const cell of chart.cells) {
        const entries = Object.entries(cell.actions)
        for (const [action, freq] of entries) {
          expect(ALLOWED_ACTIONS, `${key}: ${cell.hand} has invalid action '${action}'`).toContain(action)
          expect(freq, `${key}: ${cell.hand}.${action} out of [0,1]`).toBeGreaterThan(0)
          expect(freq).toBeLessThanOrEqual(1)
        }
        const sum = entries.reduce((s, [, f]) => s + f, 0)
        expect(sum, `${key}: ${cell.hand} actions sum to ${sum}, expected ~1.0`).toBeCloseTo(1.0, 2)
      }
    })
  }
})

describe('MTT_RFI_CHARTS — provenance', () => {
  for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
    it(`${key}: has a complete sourceRef`, () => {
      expect(chart.sourceRef.book).toBe('Modern Poker Theory')
      expect(chart.sourceRef.chapterNo).toBe(7)
      expect(typeof chart.sourceRef.handRangeNo).toBe('number')
      expect(chart.sourceRef.handRangeNo).toBeGreaterThan(0)
      expect(chart.key).toBe(key)
    })
  }

  it('every chart has a unique handRangeNo (no two canonical keys cite the same source chart)', () => {
    const seen = new Set<number>()
    for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
      expect(seen.has(chart.sourceRef.handRangeNo), `${key}: duplicate handRangeNo`).toBe(false)
      seen.add(chart.sourceRef.handRangeNo)
    }
  })
})

describe('MTT_RFI_CHARTS — cross-chart sanity invariants', () => {
  it('AA and KK are never folded (never absent, never carry a fold frequency) at any position/depth', () => {
    // NOTE: AA/KK are not always a pure raise/jam — SB legitimately limp-traps premium
    // pairs at 15bb (confirmed against the source chart directly, not just the caption
    // percentages: at SB_RFI_15BB, AA is 100% limp). The only universal invariant is
    // that the strongest starting hands are never folded outright.
    for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
      for (const hand of ['AA', 'KK']) {
        const cell = chart.cells.find((c) => c.hand === hand)
        expect(cell, `${key}: ${hand} missing (would imply fold)`).toBeDefined()
        expect(cell!.actions.fold ?? 0, `${key}: ${hand} carries a fold frequency`).toBe(0)
      }
    }
  })

  it('no chart has a "fold" frequency on a hand that is also 100% another action', () => {
    for (const [key, chart] of Object.entries(MTT_RFI_CHARTS)) {
      for (const cell of chart.cells) {
        const nonFold = Object.entries(cell.actions).filter(([a]) => a !== 'fold')
        const foldFreq = cell.actions.fold ?? 0
        if (foldFreq > 0.98) {
          expect(nonFold.length, `${key}: ${cell.hand} is ~pure fold but also lists another action`).toBe(0)
        }
      }
    }
  })
})

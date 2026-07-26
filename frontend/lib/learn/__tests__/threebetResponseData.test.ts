/**
 * Data-integrity tests for the 3-bet RESPONSE chart data (threebetResponseBaselines.ts),
 * independent of any curriculum wiring. See that file's header for the provenance and
 * "illustrative construction, calibrated to a book-stated aggregate %" methodology —
 * these tests verify the construction actually honors that methodology (real opening-range
 * universe, pure single-action cells, no duplicate hands, combo-weighted % close to the
 * stated aggregate), not that it matches a real solver output.
 */
import { describe, it, expect } from 'vitest'
import {
  THREEBET_RESPONSE_CHARTS,
  THREEBET_RESPONSE_FOUNDATIONS,
  THREEBET_RESPONSE_FLAWED_EXAMPLES,
  type ThreebetResponseAction,
} from '../threebetResponseBaselines'
import { RFI_DEEP, entriesToHandList } from '../preflopBaselines'
import { expandHandClass } from '../combos'

const ALLOWED_ACTIONS: ThreebetResponseAction[] = ['4bet', 'call', 'fold']
const COMBO_TOLERANCE_PCT = 3

function comboCount(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6
}

describe('THREEBET_RESPONSE_CHARTS — both matchups present', () => {
  it('has exactly the two matchups this lesson builds (BTN vs BB, HJ vs CO)', () => {
    expect(Object.keys(THREEBET_RESPONSE_CHARTS).sort()).toEqual(
      ['BTN_vs_BB_3bet_response', 'HJ_vs_CO_3bet_response'].sort(),
    )
  })

  it('has no duplicate hands within a chart', () => {
    for (const [key, chart] of Object.entries(THREEBET_RESPONSE_CHARTS)) {
      const seen = new Set<string>()
      for (const cell of chart.cells) {
        expect(seen.has(cell.hand), `${key}: duplicate hand ${cell.hand}`).toBe(false)
        seen.add(cell.hand)
      }
    }
  })
})

describe('THREEBET_RESPONSE_CHARTS — every hand is a legal 13x13 starting-hand class', () => {
  for (const [key, chart] of Object.entries(THREEBET_RESPONSE_CHARTS)) {
    it(`${key}: all hands expand to valid combos`, () => {
      for (const cell of chart.cells) {
        const combos = expandHandClass(cell.hand)
        const expected = cell.hand.length === 2 ? 6 : cell.hand.endsWith('s') ? 4 : 12
        expect(combos.length, `${key}: ${cell.hand} expanded to ${combos.length} combos`).toBe(expected)
      }
    })
  }
})

describe('THREEBET_RESPONSE_CHARTS — cells are PURE single-action (no fabricated mixed frequencies)', () => {
  for (const [key, chart] of Object.entries(THREEBET_RESPONSE_CHARTS)) {
    it(`${key}: every cell has exactly one action at frequency 1, using only allowed keys`, () => {
      for (const cell of chart.cells) {
        const entries = Object.entries(cell.actions)
        expect(entries.length, `${key}: ${cell.hand} should have exactly one action`).toBe(1)
        const [action, freq] = entries[0]
        expect(ALLOWED_ACTIONS, `${key}: ${cell.hand} has invalid action '${action}'`).toContain(action)
        expect(freq, `${key}: ${cell.hand}.${action} should be exactly 1`).toBe(1)
      }
    })
  }
})

describe('THREEBET_RESPONSE_CHARTS — universe is Hero\'s real opening range, never invented hands', () => {
  const UNIVERSE: Record<string, string> = {
    BTN_vs_BB_3bet_response: 'BTN',
    HJ_vs_CO_3bet_response: 'HJ',
  }

  for (const [key, chart] of Object.entries(THREEBET_RESPONSE_CHARTS)) {
    const rfiPosition = UNIVERSE[key]
    it(`${key}: every hand is in RFI_DEEP.${rfiPosition} (Hero would have actually opened it)`, () => {
      const openingRange = new Set(entriesToHandList(RFI_DEEP[rfiPosition]))
      for (const cell of chart.cells) {
        expect(openingRange.has(cell.hand), `${key}: ${cell.hand} is not in Hero's ${rfiPosition} opening range`).toBe(true)
      }
    })
  }
})

describe('THREEBET_RESPONSE_CHARTS — combo-weighted % is close to the book-stated aggregate', () => {
  for (const [key, chart] of Object.entries(THREEBET_RESPONSE_CHARTS)) {
    it(`${key}: 4-bet/call/fold combo shares land within ${COMBO_TOLERANCE_PCT}pp of chart.aggregate`, () => {
      const totals: Record<ThreebetResponseAction, number> = { '4bet': 0, call: 0, fold: 0 }
      let totalCombos = 0
      for (const cell of chart.cells) {
        const [action] = Object.keys(cell.actions) as ThreebetResponseAction[]
        const combos = comboCount(cell.hand)
        totals[action] += combos
        totalCombos += combos
      }
      for (const action of ALLOWED_ACTIONS) {
        if (action === 'fold') continue // fold combos also include every hand OUTSIDE the opening range (implicit) — only 4bet/call are exact-membership checks
        const pct = (totals[action] / totalCombos) * 100
        expect(
          Math.abs(pct - chart.aggregate[action]),
          `${key}: ${action} combo-weighted ${pct.toFixed(1)}% vs book-stated ${chart.aggregate[action]}%`,
        ).toBeLessThanOrEqual(COMBO_TOLERANCE_PCT)
      }
    })
  }
})

describe('THREEBET_RESPONSE_FLAWED_EXAMPLES — Range Repair exercise data', () => {
  const flawed = THREEBET_RESPONSE_FLAWED_EXAMPLES.BTN_vs_BB_3bet_response_flawed_example
  const real = THREEBET_RESPONSE_CHARTS.BTN_vs_BB_3bet_response

  it('exists and shares the exact same hand universe as the real BTN vs BB chart', () => {
    expect(flawed).toBeDefined()
    const flawedHands = new Set(flawed.cells.map((c) => c.hand))
    const realHands = new Set(real.cells.map((c) => c.hand))
    expect(flawedHands).toEqual(realHands)
  })

  it('differs from the real chart in EXACTLY the four documented leaks, nothing else', () => {
    const EXPECTED_DIFFERING_HANDS = new Set(['KQo', 'KJo', 'QJo', '87s', '76s', '65s', 'A5s', 'A4s', 'JJ', 'TT'])
    const realByHand = new Map(real.cells.map((c) => [c.hand, Object.keys(c.actions)[0]]))
    const flawedByHand = new Map(flawed.cells.map((c) => [c.hand, Object.keys(c.actions)[0]]))
    const actuallyDiffering = new Set<string>()
    for (const hand of realByHand.keys()) {
      if (realByHand.get(hand) !== flawedByHand.get(hand)) actuallyDiffering.add(hand)
    }
    expect(actuallyDiffering).toEqual(EXPECTED_DIFFERING_HANDS)
  })

  it('every documented leak\'s "repaired" action (i.e. the real chart\'s action) is a genuine change, not a no-op', () => {
    for (const hand of ['KQo', 'KJo', 'QJo', '87s', '76s', '65s', 'A5s', 'A4s', 'JJ', 'TT']) {
      const flawedAction = Object.keys(flawed.cells.find((c) => c.hand === hand)!.actions)[0]
      const realAction = Object.keys(real.cells.find((c) => c.hand === hand)!.actions)[0]
      expect(flawedAction, `${hand} should actually differ between flawed and real`).not.toBe(realAction)
    }
  })

  it('cells are still pure single-action (no fabricated mixed frequencies), same as every other chart', () => {
    for (const cell of flawed.cells) {
      expect(Object.entries(cell.actions).length).toBe(1)
    }
  })
})

describe('THREEBET_RESPONSE_FOUNDATIONS — every foundation hand matches its chart', () => {
  for (const [key, foundation] of Object.entries(THREEBET_RESPONSE_FOUNDATIONS)) {
    it(`${key}: chartKey resolves and every prefilled hand's action matches the chart`, () => {
      const chart = THREEBET_RESPONSE_CHARTS[foundation.chartKey]
      expect(chart, `${key}: chartKey ${foundation.chartKey} does not resolve`).toBeDefined()
      for (const [hand, action] of Object.entries(foundation.hands)) {
        const cell = chart.cells.find((c) => c.hand === hand)
        expect(cell, `${key}: foundation hand ${hand} is not in the chart`).toBeDefined()
        expect(Object.keys(cell!.actions)[0], `${key}: foundation says ${hand} is ${action}, chart disagrees`).toBe(action)
      }
    })
  }
})

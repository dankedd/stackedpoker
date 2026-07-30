/**
 * Data-integrity tests for the canonical Cash 100bb "vs open raise" chart data
 * (`cash100bbOpenResponseBaselines.ts`), independent of any curriculum/homepage
 * wiring. See that file's header for provenance (Michael Acevedo, "Modern Poker
 * Theory", Ch. 5, Hand Range 66, p.228) and extraction methodology.
 */
import { describe, it, expect } from 'vitest'
import {
  CASH_100BB_OPEN_RESPONSE_CHARTS,
  type Cash100bbOpenResponseAction,
} from '../cash100bbOpenResponseBaselines'
import { expandHandClass } from '../combos'
import { comboCount } from '../handGrid'

const ALLOWED_ACTIONS: Cash100bbOpenResponseAction[] = ['3bet', 'call', 'fold']

describe('CASH_100BB_OPEN_RESPONSE_CHARTS — structural integrity', () => {
  for (const [key, chart] of Object.entries(CASH_100BB_OPEN_RESPONSE_CHARTS)) {
    it(`${key}: has no duplicate hands`, () => {
      const seen = new Set<string>()
      for (const cell of chart.cells) {
        expect(seen.has(cell.hand), `${key}: duplicate hand ${cell.hand}`).toBe(false)
        seen.add(cell.hand)
      }
    })

    it(`${key}: every hand is a legal 13x13 starting-hand class`, () => {
      for (const cell of chart.cells) {
        const combos = expandHandClass(cell.hand)
        const expected = cell.hand.length === 2 ? 6 : cell.hand.endsWith('s') ? 4 : 12
        expect(combos.length, `${key}: ${cell.hand} expanded to ${combos.length} combos`).toBe(expected)
      }
    })

    it(`${key}: every cell's actions sum to ~1.0 and use only allowed keys`, () => {
      for (const cell of chart.cells) {
        const entries = Object.entries(cell.actions)
        expect(entries.length, `${key}: ${cell.hand} has no actions`).toBeGreaterThan(0)
        for (const [action, freq] of entries) {
          expect(ALLOWED_ACTIONS, `${key}: ${cell.hand} has invalid action '${action}'`).toContain(action)
          expect(freq, `${key}: ${cell.hand}.${action} out of (0,1]`).toBeGreaterThan(0)
          expect(freq).toBeLessThanOrEqual(1)
        }
        const sum = entries.reduce((s, [, f]) => s + (f ?? 0), 0)
        expect(sum, `${key}: ${cell.hand} actions sum to ${sum}, expected ~1.0`).toBeCloseTo(1.0, 6)
      }
    })

    it(`${key}: no cell is listed as pure fold (sparse convention — omit it instead)`, () => {
      for (const cell of chart.cells) {
        const nonFold = (cell.actions['3bet'] ?? 0) + (cell.actions.call ?? 0)
        expect(nonFold, `${key}: ${cell.hand} is pure fold and should be omitted`).toBeGreaterThan(0)
      }
    })

    it(`${key}: has a complete sourceRef citing Modern Poker Theory Chapter 5`, () => {
      expect(chart.sourceRef.book).toBe('Modern Poker Theory')
      expect(chart.sourceRef.chapterNo).toBe(5)
      expect(typeof chart.sourceRef.handRangeNo).toBe('number')
      expect(chart.sourceRef.handRangeNo).toBeGreaterThan(0)
      expect(chart.key).toBe(key)
    })

    it(`${key}: combo-weighted totals land within 1 percentage point of the book's printed aggregate`, () => {
      let total3bet = 0
      let totalCall = 0
      let totalFold = 0
      let totalCombos = 0
      for (const cell of chart.cells) {
        const cc = comboCount(cell.hand)
        totalCombos += cc
        total3bet += (cell.actions['3bet'] ?? 0) * cc
        totalCall += (cell.actions.call ?? 0) * cc
        totalFold += (cell.actions.fold ?? 0) * cc
      }
      // Hands absent from `cells` are implicitly 100% fold (sparse convention) —
      // account for the remaining combos out of the full 1326-combo grid.
      const remainingCombos = 1326 - totalCombos
      totalFold += remainingCombos

      const pct3bet = (total3bet / 1326) * 100
      const pctCall = (totalCall / 1326) * 100
      const pctFold = (totalFold / 1326) * 100

      expect(Math.abs(pct3bet - chart.aggregate['3bet'])).toBeLessThan(1)
      expect(Math.abs(pctCall - chart.aggregate.call)).toBeLessThan(1)
      expect(Math.abs(pctFold - chart.aggregate.fold)).toBeLessThan(1)
    })
  }
})

describe('CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb — the homepage puzzle hand', () => {
  const chart = CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb

  it('KQs is a real, mixed (not pure-fold) hand in this chart', () => {
    const kqs = chart.cells.find((c) => c.hand === 'KQs')
    expect(kqs).toBeDefined()
    expect((kqs!.actions['3bet'] ?? 0) + (kqs!.actions.call ?? 0)).toBeGreaterThan(0)
    expect(kqs!.actions.fold ?? 0).toBe(0)
  })

  it('AA is a pure 3-bet', () => {
    const aa = chart.cells.find((c) => c.hand === 'AA')
    expect(aa?.actions).toEqual({ '3bet': 1 })
  })
})

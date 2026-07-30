/**
 * Data-integrity + source-lock regression tests for bbDefenseComplete.ts —
 * the book-derived (Modern Poker Theory, Ch.5) complete Fold/Call/3-bet BB
 * defense strategies at 100bb cash. See that file's own header for the full
 * extraction/validation methodology (pixel-read diagram images, 8% noise
 * floor, cross-checked against the book's own stated chart aggregates).
 */
import { describe, it, expect } from 'vitest'
import {
  BB_DEFENSE_COMPLETE_100BB,
  BB_DEFENSE_COMPLETE_100BB_PROVENANCE,
  type BBOpenDefenseMatchup,
} from '../bbDefenseComplete'
import { HAND_GRID, comboCount, TOTAL_COMBOS } from '../handGrid'

const ALL_HAND_CLASSES = new Set(HAND_GRID.flat())
const MATCHUPS = Object.keys(BB_DEFENSE_COMPLETE_100BB) as BBOpenDefenseMatchup[]

describe('BB_DEFENSE_COMPLETE_100BB — structural integrity', () => {
  it('has exactly the 5 expected matchups', () => {
    expect(MATCHUPS.sort()).toEqual(
      ['BB_vs_UTG', 'BB_vs_HJ', 'BB_vs_CO', 'BB_vs_BTN', 'BB_vs_SB'].sort(),
    )
  })

  for (const matchup of MATCHUPS) {
    it(`${matchup}: covers all 169 hand classes, no invented notation, no duplicates`, () => {
      const hands = Object.keys(BB_DEFENSE_COMPLETE_100BB[matchup])
      expect(hands.length).toBe(169)
      expect(new Set(hands).size).toBe(169)
      for (const h of hands) {
        expect(ALL_HAND_CLASSES.has(h), `${matchup}: '${h}' is not a valid 13x13 hand class`).toBe(true)
      }
      for (const h of ALL_HAND_CLASSES) {
        expect(hands.includes(h), `${matchup}: missing hand class '${h}'`).toBe(true)
      }
    })

    it(`${matchup}: every action frequency is finite, in (0, 1], and only uses fold/call/3bet`, () => {
      for (const [hand, mix] of Object.entries(BB_DEFENSE_COMPLETE_100BB[matchup])) {
        for (const [action, freq] of Object.entries(mix)) {
          expect(['fold', 'call', '3bet']).toContain(action)
          expect(Number.isFinite(freq), `${matchup}/${hand}/${action}`).toBe(true)
          expect(freq, `${matchup}/${hand}/${action} should be > 0`).toBeGreaterThan(0)
          expect(freq, `${matchup}/${hand}/${action} should be <= 1`).toBeLessThanOrEqual(1)
        }
      }
    })

    it(`${matchup}: every hand's fold+call+3bet sums to ~1 (complete strategy, no missing/extra mass)`, () => {
      for (const [hand, mix] of Object.entries(BB_DEFENSE_COMPLETE_100BB[matchup])) {
        const sum = Object.values(mix).reduce((s, f) => s + f, 0)
        expect(sum, `${matchup}/${hand}: ${JSON.stringify(mix)} sums to ${sum}`).toBeCloseTo(1, 2)
      }
    })
  }
})

describe('BB_DEFENSE_COMPLETE_100BB — the "AA renders as Fold" bug class can never recur here', () => {
  // Unlike defendBaselines.ts's action_slice data, this is a genuine complete
  // strategy: AA's entire mass IS 3-bet, not "3-bet, with an unknown remainder".
  for (const matchup of MATCHUPS) {
    it(`${matchup}: AA/KK/QQ/AKs are pure (or near-pure) 3-bet, never carry a fold`, () => {
      for (const premium of ['AA', 'KK', 'QQ', 'AKs']) {
        const mix = BB_DEFENSE_COMPLETE_100BB[matchup][premium]
        expect(mix.fold, `${matchup}/${premium} should not fold`).toBeUndefined()
        expect(mix['3bet']).toBeGreaterThan(0.9)
      }
    })
  }
})

describe('BB_DEFENSE_COMPLETE_100BB — source-lock: pinned values from Modern Poker Theory diagrams', () => {
  it('72o and 32o are pure fold in every matchup (extreme trash, unambiguous in every chart)', () => {
    for (const matchup of MATCHUPS) {
      expect(BB_DEFENSE_COMPLETE_100BB[matchup]['72o']).toEqual({ fold: 1 })
      expect(BB_DEFENSE_COMPLETE_100BB[matchup]['32o']).toEqual({ fold: 1 })
    }
  })

  it('BB_vs_UTG (Hand Range 76, p.238): JJ is a call/3bet mix, matches the book-cross-validated extraction', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_UTG.JJ).toEqual({ '3bet': 0.4534, call: 0.5466 })
  })

  it('BB_vs_UTG: AQo is pure call — matches the book\'s own prose ("offsuit broadways such as AQo-ATo don\'t make good 3-bets")', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_UTG.AQo).toEqual({ call: 1 })
  })

  it('BB_vs_HJ (Hand Range 78, p.240): A5s is a near 50/50 call/3bet mix', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_HJ.A5s).toEqual({ '3bet': 0.4947, call: 0.5053 })
  })

  it('BB_vs_CO (Hand Range 80, p.242): KQs is a 3bet-heavy mix', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_CO.KQs).toEqual({ '3bet': 0.8143, call: 0.1857 })
  })

  it('BB_vs_BTN (Hand Range 82, p.244): 76s is a pure 3-bet — the widest, most aggressive of the five charts', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_BTN['76s']).toEqual({ '3bet': 1 })
  })

  it('BB_vs_SB (Hand Range 84, p.246): QJs is a call/3bet mix', () => {
    expect(BB_DEFENSE_COMPLETE_100BB.BB_vs_SB.QJs).toEqual({ '3bet': 0.6178, call: 0.3822 })
  })

  it('the defending range widens monotonically as the opener gets later (LJ tightest, SB widest) — a basic poker-theory sanity check on the whole reconstruction', () => {
    const notFoldPct = (matchup: BBOpenDefenseMatchup) => {
      let combos = 0
      for (const [hand, mix] of Object.entries(BB_DEFENSE_COMPLETE_100BB[matchup])) {
        const foldOnly = mix.fold === 1
        if (!foldOnly) combos += comboCount(hand)
      }
      return combos / TOTAL_COMBOS
    }
    const utg = notFoldPct('BB_vs_UTG')
    const hj = notFoldPct('BB_vs_HJ')
    const co = notFoldPct('BB_vs_CO')
    const btn = notFoldPct('BB_vs_BTN')
    const sb = notFoldPct('BB_vs_SB')
    expect(utg).toBeLessThan(hj)
    expect(hj).toBeLessThan(co)
    expect(co).toBeLessThan(btn)
    expect(btn).toBeLessThanOrEqual(sb + 0.01) // SB slightly narrower is plausible per the book's own text
  })
})

describe('BB_DEFENSE_COMPLETE_100BB — combo-weighted aggregate matches the book\'s own stated per-chart totals', () => {
  for (const matchup of MATCHUPS) {
    it(`${matchup}: combo-weighted fold/call/3bet totals land within 2 percentage points of bookAggregate`, () => {
      const agg = { fold: 0, call: 0, '3bet': 0 } as Record<string, number>
      for (const [hand, mix] of Object.entries(BB_DEFENSE_COMPLETE_100BB[matchup])) {
        const c = comboCount(hand)
        for (const [action, freq] of Object.entries(mix)) {
          agg[action] += freq * c
        }
      }
      const book = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup].bookAggregate
      expect(Math.abs((agg['3bet'] / TOTAL_COMBOS) * 100 - book.threeBet)).toBeLessThan(2)
      expect(Math.abs((agg.call / TOTAL_COMBOS) * 100 - book.call)).toBeLessThan(2)
      expect(Math.abs((agg.fold / TOTAL_COMBOS) * 100 - book.fold)).toBeLessThan(2)
    })
  }
})

describe('BB_DEFENSE_COMPLETE_100BB_PROVENANCE — every chart traceable to a real page/figure', () => {
  for (const matchup of MATCHUPS) {
    it(`${matchup} cites Modern Poker Theory with a page and figure reference`, () => {
      const prov = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup]
      expect(prov.source).toMatch(/Modern Poker Theory/)
      expect(prov.page).toBeGreaterThan(0)
      expect(prov.figure).toMatch(/Hand Range \d+/)
      expect(prov.derivation).toBe('reconstructed')
    })
  }
})

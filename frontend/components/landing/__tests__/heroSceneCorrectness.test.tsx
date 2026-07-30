import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'fs'
import path from 'path'
import { Hero } from '../Hero'
import { CASH_100BB_OPEN_RESPONSE_CHARTS } from '@/lib/learn/cash100bbOpenResponseBaselines'
import { RANGE_TARGETS } from '@/lib/learn/ranges'

/**
 * Regression coverage for the hero poker-example correction:
 *  1. Hero's BTN position label stays readable (never clipped by the
 *     dealer marker) — see PreflopTable's own "hero-is-BTN" tests for the
 *     shared-component geometry fix this relies on.
 *  2. The range panel shows Hero's real fold/call/3-bet STRATEGY vs the CO
 *     open (canonical `CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb`,
 *     Modern Poker Theory Chapter 5 / Hand Range 66, p.228) — not a CO
 *     opening range, not a plain membership chart, not an invented
 *     homepage array.
 */
describe('Hero — poker example is internally correct', () => {
  const html = renderToStaticMarkup(<Hero />)
  const chart = CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb

  it('identifies Hero as BTN, with the position readable independently of the "HERO ·" metadata prefix', () => {
    // Same anchor, same line — "HERO ·" prefix then the position text itself.
    expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
    expect(html).toMatch(/>BTN</)
  })

  it('no longer renders a "CO opening range" panel', () => {
    expect(html.toLowerCase()).not.toContain('co opening range')
  })

  it('renders the "BTN vs CO — full strategy" panel title', () => {
    expect(html).toContain('BTN vs CO')
    expect(html.toLowerCase()).toContain('full strategy')
  })

  it('highlights KQs (a real, non-fold member of the canonical chart) without altering its mix', () => {
    const kqs = chart.cells.find((c) => c.hand === 'KQs')
    expect(kqs).toBeDefined()
    expect((kqs!.actions['3bet'] ?? 0) + (kqs!.actions.call ?? 0)).toBeGreaterThan(0)
    expect(html).toMatch(/ring-2 ring-white ring-offset-1[\s\S]{0,300}?>KQs</)
  })

  it('the panel consumes the canonical book-sourced chart, not a locally-duplicated array', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../Hero.tsx'), 'utf-8')
    expect(source).toContain('CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb')
    expect(source).toMatch(/from ["']@\/lib\/learn\/cash100bbOpenResponseBaselines["']/)
  })

  it('renders in strategy mode (fold/call/3-bet), not the old membership-only chart', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../Hero.tsx'), 'utf-8')
    expect(source).toMatch(/mode="strategy"/)
    // Legend shows the real action set for this chart.
    expect(html).toContain('3-Bet')
    expect(html).toContain('Call')
    expect(html).toContain('Fold')
  })

  it("RANGE_TARGETS['BTN_call_vs_CO_100bb'] (used elsewhere, e.g. Module 8) stays derived from the same chart, never a parallel hand-picked list", () => {
    const derivedHands = new Set(
      chart.cells.filter((c) => (c.actions['3bet'] ?? 0) + (c.actions.call ?? 0) > 0).map((c) => c.hand),
    )
    expect(new Set(RANGE_TARGETS['BTN_call_vs_CO_100bb'])).toEqual(derivedHands)
  })
})

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'fs'
import path from 'path'
import { Hero } from '../Hero'
import { RANGE_TARGETS } from '@/lib/learn/ranges'

/**
 * Regression coverage for the hero poker-example correction:
 *  1. Hero's BTN position label stays readable (never clipped by the
 *     dealer marker) — see PreflopTable's own "hero-is-BTN" tests for the
 *     shared-component geometry fix this relies on.
 *  2. The range panel shows Hero's real BTN-continuing range vs the CO
 *     open (canonical `RANGE_TARGETS['BTN_call_vs_CO_100bb']`), not a CO
 *     opening range or an invented homepage array.
 */
describe('Hero — poker example is internally correct', () => {
  const html = renderToStaticMarkup(<Hero />)

  it('identifies Hero as BTN, with the position readable independently of the "HERO ·" metadata prefix', () => {
    // Same anchor, same line — "HERO ·" prefix then the position text itself.
    expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
    expect(html).toMatch(/>BTN</)
  })

  it('no longer renders a "CO opening range" panel', () => {
    expect(html.toLowerCase()).not.toContain('co opening range')
  })

  it('renders the canonical "BTN call vs CO" panel title', () => {
    expect(html).toContain('BTN call vs CO')
  })

  it('highlights KQs (a real member of the canonical range) without altering its membership', () => {
    expect(RANGE_TARGETS['BTN_call_vs_CO_100bb']).toContain('KQs')
    expect(html).toMatch(/ring-2 ring-white ring-offset-1[\s\S]{0,160}?>KQs</)
  })

  it('the range panel consumes the canonical repository data, not a locally-duplicated array', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../Hero.tsx'), 'utf-8')
    expect(source).toContain('RANGE_TARGETS["BTN_call_vs_CO_100bb"]')
    expect(source).toMatch(/from ["']@\/lib\/learn\/ranges["']/)
    // The old CO-opening-range data source must no longer be imported here.
    expect(source).not.toContain('ILLUSTRATIVE_OPENER_RANGE')
  })

  it('introduces no fabricated action frequencies for the panel (membership-only, matching the underlying data)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../Hero.tsx'), 'utf-8')
    // mode="strategy"/"three_action" would imply per-hand action frequencies —
    // RANGE_TARGETS['BTN_call_vs_CO_100bb'] is a flat membership list only.
    expect(source).toMatch(/mode="membership"/)
  })
})

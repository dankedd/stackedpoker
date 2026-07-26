/**
 * Regression tests for PokerRangeGrid's 'strategy' mode — the shared
 * mixed-frequency cell renderer every range grid in the app now shares (see
 * rangeStrategy.ts for the canonical model these strategies come from).
 *
 * Follows this codebase's existing convention (preflopTable.test.tsx,
 * multiActionRangeBuild.test.tsx): renderToStaticMarkup, no jsdom/interaction
 * simulation. Hover/tap detail is verified by asserting its content is present
 * in the static HTML (it's shown/hidden via CSS only, so it's always in the
 * DOM — exactly what makes it deterministically testable this way).
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PokerRangeGrid } from '../PokerRangeGrid'
import { MTT_RFI_CHARTS } from '@/lib/learn/mttRfiBaselines'
import { chartToStrategyMap } from '@/lib/learn/mttRfiRanges'
import type { RangeStrategyMap } from '@/lib/learn/rangeStrategy'

function cellHtmlFor(html: string, hand: string): string {
  // Grabs the innermost cell markup for one hand by its distinctive title attribute
  // (React's server renderer emits the title's embedded newline literally, not escaped).
  const marker = `title="${hand}\n`
  const idx = html.indexOf(marker)
  if (idx === -1) throw new Error(`Cell for "${hand}" not found in rendered HTML`)
  // The cell's own opening <div ...> starts a bounded distance before the title attr;
  // walk back to the nearest preceding '<div' and forward to the matching close is
  // overkill for a smoke test — instead just slice a generous window around the marker,
  // which is enough to inspect this cell's own style/content without bleeding into siblings.
  return html.slice(Math.max(0, idx - 400), idx + 600)
}

/** Returns just the comma-separated "color stop%" list, e.g.
 *  "#10b981 0%, #10b981 70%, rgba(148,163,184,0.35) 70%, rgba(148,163,184,0.35) 100%" —
 *  stripped of the "linear-gradient(to right, " wrapper and its closing paren. Colors
 *  themselves may contain parens (rgba(...)), so this cannot use a naive "up to the
 *  first )" match — it scans to the style attribute's closing quote instead. */
function gradientStopsFor(html: string, hand: string): string {
  const cell = cellHtmlFor(html, hand)
  const match = cell.match(/style="background:(.*?)"/)
  if (!match) throw new Error(`No background style found for "${hand}"`)
  const value = match[1]
  const prefix = 'linear-gradient(to right, '
  if (!value.startsWith(prefix) || !value.endsWith(')')) return value // flat color fallback (fully-fold, no stops)
  return value.slice(prefix.length, -1)
}

/** Each "color stop%" pair, e.g. ["#10b981 0%", "#10b981 70%", "rgba(148,163,184,0.35) 70%", ...].
 *  Colors themselves may contain commas (rgba), so this can't be a naive `.split(',')`. */
function parseStops(stops: string): string[] {
  const re = /(rgba?\([^)]*\)|#[0-9a-fA-F]+)\s+[\d.]+%/g
  return stops.match(re) ?? []
}

function distinctColors(stops: string): Set<string> {
  return new Set(parseStops(stops).map((s) => s.replace(/\s*[\d.]+%$/, '')))
}

describe('PokerRangeGrid — strategy mode: A. pure action', () => {
  it('100% Call renders a single solid Call-colored fill (no split)', () => {
    const strategies: RangeStrategyMap = { AA: { call: 1 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="strategy" strategies={strategies} />)
    const stops = gradientStopsFor(html, 'AA')
    // A single color from 0% to 100% — no second color/boundary.
    expect(stops).toContain('0%')
    expect(stops).toContain('100%')
    expect(distinctColors(stops).size).toBe(1)
  })
})

describe('PokerRangeGrid — strategy mode: B. two-way proportional mix', () => {
  it('Call 70% / Fold 30% renders two segments split at exactly 70%', () => {
    const strategies: RangeStrategyMap = { A5s: { call: 0.7, fold: 0.3 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['A5s']} mode="strategy" strategies={strategies} />)
    const stops = gradientStopsFor(html, 'A5s')
    expect(stops).toContain('0%')
    expect(stops).toContain('70%')
    expect(stops).toContain('100%')
  })
})

describe('PokerRangeGrid — strategy mode: C. 50/50 split', () => {
  it('splits exactly in half', () => {
    const strategies: RangeStrategyMap = { KQo: { call: 0.5, fold: 0.5 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['KQo']} mode="strategy" strategies={strategies} />)
    const stops = gradientStopsFor(html, 'KQo')
    expect(stops).toContain('50%')
  })
})

describe('PokerRangeGrid — strategy mode: D. three-way mix', () => {
  it('4-bet 20% / Call 55% / Fold 25% renders three proportional segments', () => {
    const strategies: RangeStrategyMap = { KQo: { '4bet': 0.2, call: 0.55, fold: 0.25 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['KQo']} mode="strategy" strategies={strategies} />)
    const stops = gradientStopsFor(html, 'KQo')
    // Cumulative boundaries: 0, 20, 75 (20+55), 100.
    expect(stops).toContain('0%')
    expect(stops).toContain('20%')
    expect(stops).toContain('75%')
    expect(stops).toContain('100%')
    expect(distinctColors(stops).size).toBe(3)
  })
})

describe('PokerRangeGrid — strategy mode: E. real canonical source data survives the full pipeline', () => {
  it('UTG_RFI_15BB A5s (raise 0.65 / fold 0.35, per mttRfiBaselines.ts) is not collapsed to pure raise', () => {
    const chart = MTT_RFI_CHARTS.UTG_RFI_15BB
    const strategies = chartToStrategyMap(chart)
    expect(strategies.A5s).toEqual({ raise: 0.65, fold: 0.35 })

    const html = renderToStaticMarkup(<PokerRangeGrid range={[chart.cells[0].hand]} mode="strategy" strategies={strategies} />)
    const stops = gradientStopsFor(html, 'A5s')
    expect(stops).toContain('65%')
    expect(distinctColors(stops).size).toBe(2) // raise + fold, never collapsed to one
  })
})

describe('PokerRangeGrid — strategy mode: F. hover reveals exact percentages', () => {
  it('title attribute carries the exact breakdown text', () => {
    const strategies: RangeStrategyMap = { A5s: { call: 0.72, fold: 0.28 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['A5s']} mode="strategy" strategies={strategies} />)
    expect(html).toContain('Call 72%')
    expect(html).toContain('Fold 28%')
  })
})

describe('PokerRangeGrid — strategy mode: G. tap/focus detail (mobile) exposes the same info', () => {
  it('the detail bubble (role="tooltip") is present in the DOM with the mix label + exact percentages', () => {
    const strategies: RangeStrategyMap = { KQo: { '4bet': 0.2, call: 0.55, fold: 0.25 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['KQo']} mode="strategy" strategies={strategies} />)
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('MIXED')
    expect(html).toContain('4-Bet 20%')
    expect(html).toContain('Call 55%')
    expect(html).toContain('Fold 25%')
  })

  it('cells are focusable (tabIndex) so keyboard/touch focus can trigger the same detail', () => {
    const strategies: RangeStrategyMap = { AA: { raise: 1 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="strategy" strategies={strategies} />)
    expect(html).toContain('tabindex="0"')
  })
})

describe('PokerRangeGrid — strategy mode: H. legend uses the centralized action styles', () => {
  it('lists every action present, using the shared label set', () => {
    const strategies: RangeStrategyMap = { A5s: { call: 0.7, fold: 0.3 } }
    const html = renderToStaticMarkup(<PokerRangeGrid range={['A5s']} mode="strategy" strategies={strategies} />)
    expect(html).toContain('>Call<')
    expect(html).toContain('>Fold<')
  })
})

describe('PokerRangeGrid — backwards compatibility: pure-action existing modes still render', () => {
  it('membership mode is unaffected by the strategy-mode addition', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA', 'AKs']} />)
    expect(html).toContain('AA')
    expect(html).toContain('AKs')
  })

  it('a hand missing from `strategies` renders as 100% fold (sparse-chart convention)', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={[]} mode="strategy" strategies={{}} />)
    // 22 (bottom-right pair) is absent from the map -> pure fold, single segment.
    const stops = gradientStopsFor(html, '22')
    expect(distinctColors(stops).size).toBe(1)
  })
})

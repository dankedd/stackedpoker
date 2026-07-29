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

// ── 'category' mode: range membership must never be erased by board interaction ──

function categoryCellHtmlFor(html: string, hand: string): string {
  const marker = `title="${hand} —`
  const idx = html.indexOf(marker)
  if (idx === -1) throw new Error(`Cell for "${hand}" not found in rendered HTML`)
  const cellStart = html.lastIndexOf('<div tabindex="0" role="group"', idx)
  const nextCellStart = html.indexOf('<div tabindex="0" role="group"', idx + marker.length)
  const cellEnd = nextCellStart === -1 ? html.length : nextCellStart
  return html.slice(cellStart === -1 ? Math.max(0, idx - 200) : cellStart, cellEnd)
}

describe('PokerRangeGrid — category mode: in-range-but-unconnected is visually distinct from out-of-range', () => {
  it('an in-range hand with no board interaction gets the base "in range" style, never the out-of-range style', () => {
    const html = renderToStaticMarkup(
      <PokerRangeGrid range={['AA', 'KK']} mode="category" categoryMap={{ AA: 'none' }} />,
    )
    const cell = categoryCellHtmlFor(html, 'AA')
    expect(cell).toContain('bg-slate-500/35') // base in-range tier
    expect(cell).not.toContain('bg-secondary/20') // out-of-range style must not appear
    expect(cell).toContain('Preflop: In range')
    expect(cell).toContain('Board: No significant interaction')
  })

  it('a hand absent from `range` gets the dark out-of-range style, never the base in-range style', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="category" categoryMap={{}} />)
    const cell = categoryCellHtmlFor(html, '72o')
    expect(cell).toContain('bg-secondary/20')
    expect(cell).not.toContain('bg-slate-500/35')
    expect(cell).toContain('Preflop: Not in range')
  })

  it('an in-range hand with a strong board interaction gets the strong tier style, distinct from base', () => {
    const html = renderToStaticMarkup(
      <PokerRangeGrid range={['77']} mode="category" categoryMap={{ '77': 'set' }} />,
    )
    const cell = categoryCellHtmlFor(html, '77')
    expect(cell).toContain('bg-emerald-500/80')
    expect(cell).toContain('Board: Set (Made hand)')
  })

  it('in-range membership is stable across two different categoryMaps (simulating a board change) — only the tier changes', () => {
    const htmlBoardA = renderToStaticMarkup(
      <PokerRangeGrid range={['AKs']} mode="category" categoryMap={{ AKs: 'overcards' }} />,
    )
    const htmlBoardB = renderToStaticMarkup(
      <PokerRangeGrid range={['AKs']} mode="category" categoryMap={{ AKs: 'top_pair' }} />,
    )
    // Same hand, same range, different board -> both renders agree it's in range...
    expect(categoryCellHtmlFor(htmlBoardA, 'AKs')).toContain('Preflop: In range')
    expect(categoryCellHtmlFor(htmlBoardB, 'AKs')).toContain('Preflop: In range')
    // ...but the interaction tier legitimately differs.
    expect(categoryCellHtmlFor(htmlBoardA, 'AKs')).toContain('bg-slate-500/35')
    expect(categoryCellHtmlFor(htmlBoardB, 'AKs')).toContain('bg-sky-500/60')
  })

  it('the legend always explains "Not in range" and "In range" regardless of which categories are present', () => {
    const html = renderToStaticMarkup(
      <PokerRangeGrid range={['AA']} mode="category" categoryMap={{ AA: 'overpair' }} />,
    )
    expect(html).toContain('Not in range')
    expect(html).toContain('>In range<')
  })

  it('the legend only lists interaction tiers actually present (or explicitly emphasized), never invents one', () => {
    const html = renderToStaticMarkup(
      <PokerRangeGrid range={['AA']} mode="category" categoryMap={{ AA: 'overpair' }} />,
    )
    expect(html).toContain('Made hand')
    expect(html).not.toContain('Marginal')
    expect(html).not.toContain('Connected')
  })

  it('never uses Equity Bucket vocabulary (Strong/Good/Weak/Trash) to describe board-interaction tiers', () => {
    const html = renderToStaticMarkup(
      <PokerRangeGrid
        range={['AA', 'KQo', '76s', '22']}
        mode="category"
        categoryMap={{ AA: 'overpair', KQo: 'top_pair', '76s': 'weak_pair', '22': 'underpair' }}
      />,
    )
    // The four tier labels rendered anywhere on the grid/legend must never equal an
    // Equity Bucket name — those words are reserved for verified equity-bucket data
    // (see handBoardInteraction.ts's HandBoardInteractionTier doc comment).
    expect(html).not.toContain('>Strong<')
    expect(html).not.toContain('>Good<')
    expect(html).not.toContain('>Weak<')
    expect(html).not.toContain('>Trash<')
    expect(html).not.toContain('Strong interaction')
    expect(html).not.toContain('Good interaction')
    expect(html).not.toContain('Weak interaction')
    expect(html).not.toContain('Trash interaction')
  })

  it('every cell (in-range or not) exposes a tooltip so "why is this dark?" always has an answer', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="category" categoryMap={{}} />)
    const outOfRangeCell = categoryCellHtmlFor(html, '72o')
    expect(outOfRangeCell).toContain('role="tooltip"')
  })
})

// ── The grid must never force horizontal scrolling ────────────────────────────
// Regression coverage for the overflow/cropping bug: the old `overflow-x-auto` +
// `inline-block min-w-full` wrapper let the grid's intrinsic (max-content) width
// dominate over its parent's actual width, forcing a scrollbar on any container
// narrower than ~13 cells' natural text width. The fix relies on the row/column
// containers being plain `w-full` (never intrinsically/shrink-to-fit sized) with
// every cell carrying `min-w-0` (overriding flexbox's default `min-width: auto`,
// which otherwise floors a flex item's shrink at its own content's min-content
// size) so cells genuinely shrink to whatever width the parent provides.
describe('PokerRangeGrid — never introduces horizontal scrolling', () => {
  it('renders no overflow-inducing wrapper (no overflow-x-auto, no inline-block, no min-w-full)', () => {
    const modes = ['membership', 'diff', 'category', 'strategy'] as const
    for (const mode of modes) {
      const html = renderToStaticMarkup(
        <PokerRangeGrid
          range={['AA', 'KQs']}
          mode={mode}
          categoryMap={{ AA: 'overpair' }}
          comparisonRange={['AA']}
          strategies={{ AA: { raise: 1 } }}
        />,
      )
      expect(html).not.toContain('overflow-x-auto')
      expect(html).not.toContain('inline-block')
      expect(html).not.toContain('min-w-full')
    }
  })

  it('every cell carries min-w-0 so it can shrink below its own text width', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="membership" />)
    // 169 cells total; every one must be shrinkable, not just some.
    const cellMatches = html.match(/class="[^"]*aspect-square[^"]*"/g) ?? []
    expect(cellMatches.length).toBe(169)
    for (const cell of cellMatches) expect(cell).toContain('min-w-0')
  })

  it('the outer grid wrapper is a plain w-full block, not a shrink-to-fit inline element', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="membership" />)
    expect(html).toContain('w-full min-w-0')
  })

  it('column headers and row labels use ascending (not inverted) responsive font sizes', () => {
    // A cell that's already tiny on mobile must not get EVEN SMALLER at a wider
    // breakpoint where it typically has more room, not less.
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} mode="membership" />)
    expect(html).toContain('text-[8px] sm:text-[10px]')
    expect(html).not.toContain('text-[10px] sm:text-[8px]')
    expect(html).not.toContain('text-[11px] sm:text-[9px]')
  })
})

describe('PokerRangeGrid — size prop: a self-owned max-width cap, independent of the ancestor container', () => {
  it('defaults to "standard" (520px) when size is omitted', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} />)
    expect(html).toContain('max-w-[520px]')
    expect(html).not.toContain('max-w-[480px]')
  })

  it('size="compact" caps at 480px instead — for one half of a two-grid comparison', () => {
    const html = renderToStaticMarkup(<PokerRangeGrid range={['AA']} size="compact" />)
    expect(html).toContain('max-w-[480px]')
    expect(html).not.toContain('max-w-[520px]')
  })

  it('the cap applies regardless of mode (strategy/category/diff all still get a cap)', () => {
    for (const mode of ['membership', 'strategy', 'category', 'diff'] as const) {
      const html = renderToStaticMarkup(
        <PokerRangeGrid
          range={['AA']}
          mode={mode}
          size="compact"
          categoryMap={{ AA: 'overpair' }}
          comparisonRange={['AA']}
          strategies={{ AA: { raise: 1 } }}
        />,
      )
      expect(html).toContain('max-w-[480px]')
    }
  })
})

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeCollisionViewer } from '../RangeCollisionViewer'

describe('RangeCollisionViewer — layout (no horizontal scrolling)', () => {
  it('uses the lg: side-by-side breakpoint, not the default sm: one', () => {
    const html = renderToStaticMarkup(
      <RangeCollisionViewer
        a={{ label: 'IP', range: ['AA', 'KK', 'AKs'] }}
        b={{ label: 'BB', range: ['22', '33', '76s'] }}
        board={['Ad', '7h', '6c']}
      />,
    )
    expect(html).toContain('lg:grid-cols-2')
    expect(html).not.toContain('sm:grid-cols-2')
  })

  it('renders no overflow-inducing wrapper anywhere in the comparison', () => {
    const html = renderToStaticMarkup(
      <RangeCollisionViewer
        a={{ label: 'IP', range: ['AA', 'KK', 'AKs'] }}
        b={{ label: 'BB', range: ['22', '33', '76s'] }}
        board={['Ad', '7h', '6c']}
      />,
    )
    expect(html).not.toContain('overflow-x-auto')
    expect(html).not.toContain('inline-block')
    expect(html).not.toContain('min-w-full')
  })

  it('each grid caps at PokerRangeGrid\'s own compact width (480px) so a stacked single grid never balloons to fill the widened lesson container', () => {
    const html = renderToStaticMarkup(
      <RangeCollisionViewer
        a={{ label: 'IP', range: ['AA'] }}
        b={{ label: 'BB', range: ['22'] }}
        board={['Ad', '7h', '6c']}
      />,
    )
    // Both grids are size="compact" — the cap is a max-width (never a fixed width), so it
    // only ever shrinks an oversized ancestor's offer, it can't force overflow into a
    // narrower one.
    expect((html.match(/max-w-\[480px\]/g) ?? []).length).toBe(2)
  })

  it('both grids render with identical structure (same number of cells) for a fair visual comparison', () => {
    const html = renderToStaticMarkup(
      <RangeCollisionViewer
        a={{ label: 'IP', range: ['AA', 'KK'] }}
        b={{ label: 'BB', range: ['22'] }}
        board={['Ad', '7h', '6c']}
      />,
    )
    const cellCount = (html.match(/aspect-square/g) ?? []).length
    // 169 cells x 2 grids — a single shared DOM tree that RangeComparisonLayout
    // reflows via CSS Grid (grid-cols-1 vs lg:grid-cols-2), never a separate
    // mobile/desktop duplicate.
    expect(cellCount).toBe(169 * 2)
  })
})

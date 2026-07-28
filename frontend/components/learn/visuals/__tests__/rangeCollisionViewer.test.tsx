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

  it('does not cap its own width with an inner max-width — only the outer lesson container decides', () => {
    const html = renderToStaticMarkup(
      <RangeCollisionViewer
        a={{ label: 'IP', range: ['AA'] }}
        b={{ label: 'BB', range: ['22'] }}
        board={['Ad', '7h', '6c']}
      />,
    )
    expect(html).not.toContain('max-w-3xl')
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

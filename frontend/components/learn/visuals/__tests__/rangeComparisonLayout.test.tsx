import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeComparisonLayout } from '../RangeComparisonLayout'

describe('RangeComparisonLayout — sideBySideFrom', () => {
  it('defaults to the original sm: breakpoint, unchanged for every existing consumer', () => {
    const html = renderToStaticMarkup(
      <RangeComparisonLayout>
        <div>A</div>
        <div>B</div>
      </RangeComparisonLayout>,
    )
    expect(html).toContain('sm:grid-cols-2')
    expect(html).not.toContain('lg:grid-cols-2')
  })

  it('opts into the lg: breakpoint when a caller needs real room for two full 13x13 grids', () => {
    const html = renderToStaticMarkup(
      <RangeComparisonLayout sideBySideFrom="lg">
        <div>A</div>
        <div>B</div>
      </RangeComparisonLayout>,
    )
    expect(html).toContain('lg:grid-cols-2')
    expect(html).not.toContain('sm:grid-cols-2')
  })

  it('always starts single-column (grid-cols-1) regardless of breakpoint choice — mobile always stacks', () => {
    const html = renderToStaticMarkup(
      <RangeComparisonLayout sideBySideFrom="lg">
        <div>A</div>
        <div>B</div>
      </RangeComparisonLayout>,
    )
    expect(html).toContain('grid-cols-1')
  })
})

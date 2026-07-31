import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScenarioMeta } from '../ScenarioMeta'

describe('ScenarioMeta — shared "POSITION · NNBB EFFECTIVE" line', () => {
  it('renders both position and effective stack depth when both are given', () => {
    const html = renderToStaticMarkup(<ScenarioMeta heroPosition="CO" effectiveStackBb={100} />)
    expect(html).toContain('>CO<')
    expect(html).toContain('100BB EFFECTIVE')
    expect(html).toContain('·')
  })

  it('renders only the stack depth, with no stray separator, when heroPosition is absent', () => {
    const html = renderToStaticMarkup(<ScenarioMeta effectiveStackBb={40} />)
    expect(html).toContain('40BB EFFECTIVE')
    expect(html).not.toContain('·')
  })

  it('renders only the position, with no stray separator, when effectiveStackBb is absent', () => {
    const html = renderToStaticMarkup(<ScenarioMeta heroPosition="BTN" />)
    expect(html).toContain('>BTN<')
    expect(html).not.toContain('EFFECTIVE')
    expect(html).not.toContain('·')
  })

  it('renders nothing at all when neither prop is given (never fabricated)', () => {
    const html = renderToStaticMarkup(<ScenarioMeta />)
    expect(html).toBe('')
  })

  it('formats non-integer stack sizes the same way PreflopTable does (formatBb)', () => {
    const html = renderToStaticMarkup(<ScenarioMeta effectiveStackBb={17.5} />)
    expect(html).toContain('17.5BB EFFECTIVE')
  })
})

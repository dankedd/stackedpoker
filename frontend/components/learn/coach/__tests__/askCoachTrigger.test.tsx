import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AskCoachTrigger } from '../AskCoachTrigger'

const noop = () => {}

describe('AskCoachTrigger', () => {
  it('standalone variant is a labeled, keyboard-accessible button', () => {
    const html = renderToStaticMarkup(<AskCoachTrigger onClick={noop} />)
    expect(html).toMatch(/<button/)
    expect(html).toMatch(/aria-label="Ask Coach for help with this question"/)
    expect(html).toMatch(/Ask Coach/)
  })

  it('inline variant renders a plain button with the given label, no icon chrome', () => {
    const html = renderToStaticMarkup(
      <AskCoachTrigger onClick={noop} variant="inline" label="Not sure why? Ask Coach" />,
    )
    expect(html).toMatch(/<button/)
    expect(html).toMatch(/Not sure why\? Ask Coach/)
  })
})

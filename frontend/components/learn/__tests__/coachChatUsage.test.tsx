import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoachChat } from '../CoachChat'
import type { CoachUsage } from '@/lib/learn/api'

/**
 * Regression tests for the daily AI Coach quota UI. `usage` is normally
 * populated by a mount-time fetch (getCoachUsage) which never runs under
 * renderToStaticMarkup (no effects fire during SSR) — `initialUsage` is the
 * seam that makes these states directly renderable without simulating a
 * real network round trip, following this codebase's existing
 * renderToStaticMarkup convention (no jsdom/interaction simulation).
 */

const noop = () => {}

function usage(overrides: Partial<CoachUsage> = {}): CoachUsage {
  return { limit: 10, used: 4, remaining: 6, resetAt: '2026-08-01T00:00:00+00:00', ...overrides }
}

describe('CoachChat — usage indicator', () => {
  it('shows nothing when usage is unknown (not yet fetched)', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" />)
    expect(html).not.toMatch(/questions used today/)
  })

  it('shows a muted "X of Y questions used today" line when usage is known', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 4, remaining: 6 })} />)
    expect(html).toMatch(/4 of 10 questions used today/)
  })

  it('does not render an alarming banner-style warning at any usage level', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 9, remaining: 1 })} />)
    expect(html).not.toMatch(/only have|hurry|last chance/i)
    expect(html).toMatch(/9 of 10 questions used today/)
  })
})

describe('CoachChat — limit-reached state', () => {
  it('replaces the input area with the limit-reached panel at remaining=0', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 10, remaining: 0 })} />)
    expect(html).toMatch(/Daily Coach limit reached/)
    expect(html).toMatch(/used your 10 Coach questions for today/)
    expect(html).not.toMatch(/<textarea/)
    expect(html).not.toMatch(/Ask your coach anything/)
  })

  it('never shows a subscription upsell in the limit-reached panel', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 10, remaining: 0 })} />)
    expect(html).not.toMatch(/upgrade/i)
    expect(html).not.toMatch(/pro/i)
    expect(html).not.toMatch(/subscription/i)
  })

  it('hides quick actions once the limit is reached, even with no messages sent yet', () => {
    const html = renderToStaticMarkup(
      <CoachChat
        token="t"
        initialUsage={usage({ used: 10, remaining: 0 })}
        quickActions={[{ id: 'hint', label: 'Give me a hint' }]}
      />,
    )
    expect(html).not.toMatch(/Give me a hint/)
  })

  it('shows a "Continue lesson" action only when onLimitReachedContinue is provided', () => {
    const withCallback = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ used: 10, remaining: 0 })} onLimitReachedContinue={noop} />,
    )
    expect(withCallback).toMatch(/Continue lesson/)

    const withoutCallback = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ used: 10, remaining: 0 })} />,
    )
    expect(withoutCallback).not.toMatch(/Continue lesson/)
  })

  it('still under limit at remaining=1 shows the normal input, not the limit panel', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 9, remaining: 1 })} />)
    expect(html).not.toMatch(/Daily Coach limit reached/)
    expect(html).toMatch(/<textarea/)
  })
})

describe('CoachChat — quick action buttons disable while loading', () => {
  it('quick action buttons carry the disabled attribute wiring (not loading here, so enabled)', () => {
    const html = renderToStaticMarkup(
      <CoachChat token="t" quickActions={[{ id: 'hint', label: 'Give me a hint' }]} />,
    )
    // Not loading in a static render — button renders without the disabled attribute.
    const buttonHtml = html.slice(html.indexOf('Give me a hint') - 400, html.indexOf('Give me a hint'))
    expect(buttonHtml).not.toMatch(/disabled=""/)
  })
})

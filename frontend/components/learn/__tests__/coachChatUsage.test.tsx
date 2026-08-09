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
 *
 * Default fixture is the REAL Free-tier limit (3/day, see
 * entitlements.ts's FREE_AI_COACH_DAILY_LIMIT) — deliberately not an
 * arbitrary round number like 10, so these tests can't drift back to
 * asserting a stale limit without anyone noticing.
 */

const noop = () => {}

function usage(overrides: Partial<CoachUsage> = {}): CoachUsage {
  return { limit: 3, used: 1, remaining: 2, resetAt: '2026-08-01T00:00:00+00:00', unlimited: false, ...overrides }
}

describe('CoachChat — usage indicator (Free tier)', () => {
  it('shows nothing when usage is unknown (not yet fetched)', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" />)
    expect(html).not.toMatch(/questions used today/)
  })

  it('shows a muted "X of Y questions used today" line reflecting the REAL limit from the API, never a hardcoded number', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 1, remaining: 2 })} />)
    expect(html).toMatch(/1 of 3 questions used today/)
  })

  it('reflects whatever limit the backend actually sends — not just 3 (proves the number is read from data, not hardcoded)', () => {
    const html = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ limit: 15, used: 4, remaining: 11 })} />,
    )
    expect(html).toMatch(/4 of 15 questions used today/)
  })

  it('does not render an alarming banner-style warning at any usage level', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 2, remaining: 1 })} />)
    expect(html).not.toMatch(/only have|hurry|last chance/i)
    expect(html).toMatch(/2 of 3 questions used today/)
  })
})

describe('CoachChat — usage indicator (Plus/Elite, unlimited)', () => {
  it('shows "Unlimited AI Coach" instead of a numeric counter when usage.unlimited is true', () => {
    const html = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ limit: 2_147_483_647, used: 40, remaining: 2_147_483_607, unlimited: true })} />,
    )
    expect(html).toMatch(/Unlimited AI Coach/)
    expect(html).not.toMatch(/questions used today/)
    // The raw sentinel number must never leak into the UI even if it's present in the data.
    expect(html).not.toMatch(/2147483647|2,147,483,647/)
  })

  it('never shows the limit-reached panel for an unlimited user, no matter what `remaining` says', () => {
    // A pathological/stale payload with remaining<=0 must still not lock out
    // a Plus/Elite user — `unlimited` is the only thing that may decide this.
    const html = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ limit: 2_147_483_647, used: 2_147_483_647, remaining: 0, unlimited: true })} />,
    )
    expect(html).not.toMatch(/Daily Coach limit reached/)
    expect(html).toMatch(/<textarea/)
  })
})

describe('CoachChat — limit-reached state (Free tier only)', () => {
  it('replaces the input area with the limit-reached panel once remaining=0', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 3, remaining: 0 })} />)
    expect(html).toMatch(/Daily Coach limit reached/)
    expect(html).toMatch(/used your 3 free Coach questions for today/)
    expect(html).not.toMatch(/<textarea/)
    expect(html).not.toMatch(/Ask your coach anything/)
  })

  it('shows a clear upgrade prompt — never a generic error, never a silent dead end', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 3, remaining: 0 })} />)
    expect(html).toMatch(/href="\/pricing"/)
    expect(html).toMatch(/upgrade/i)
  })

  it('hides quick actions once the limit is reached, even with no messages sent yet', () => {
    const html = renderToStaticMarkup(
      <CoachChat
        token="t"
        initialUsage={usage({ used: 3, remaining: 0 })}
        quickActions={[{ id: 'hint', label: 'Give me a hint' }]}
      />,
    )
    expect(html).not.toMatch(/Give me a hint/)
  })

  it('shows a "Continue lesson" action only when onLimitReachedContinue is provided', () => {
    const withCallback = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ used: 3, remaining: 0 })} onLimitReachedContinue={noop} />,
    )
    expect(withCallback).toMatch(/Continue lesson/)

    const withoutCallback = renderToStaticMarkup(
      <CoachChat token="t" initialUsage={usage({ used: 3, remaining: 0 })} />,
    )
    expect(withoutCallback).not.toMatch(/Continue lesson/)
  })

  it('still under limit at remaining=1 shows the normal input, not the limit panel', () => {
    const html = renderToStaticMarkup(<CoachChat token="t" initialUsage={usage({ used: 2, remaining: 1 })} />)
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

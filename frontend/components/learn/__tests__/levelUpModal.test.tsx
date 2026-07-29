/**
 * Static-render tests for LevelUpModal (this codebase's convention for
 * component tests — see stepFeedbackAnswerReveal.test.tsx — renderToStaticMarkup
 * in a Node vitest environment, no jsdom/testing-library dependency).
 *
 * RankPreviewSection is tested directly (see below) since it's pure
 * presentation split out from the async data-fetching hook — that's the
 * cleanest way to deterministically exercise "leaderboard succeeded" vs
 * "leaderboard failed/unavailable" without needing to await a live effect
 * inside a static render.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LevelUpModal, RankPreviewSection } from '../LevelUpModal'
import type { LevelUpEvent } from '@/lib/learn/levelUpDetection'
import { getLevelProgress } from '@/lib/learn/levelCurve'

const noop = () => {}

// Smallest total_xp at which the REAL canonical curve reports exactly `level`
// — fixtures are built from this rather than round numbers, so a mismatched
// totalXp/newLevel pair (which real detectLevelUp output could never
// produce) can't silently pass a test that's supposed to prove the
// component trusts the canonical curve.
function thresholdFor(level: number): number {
  let xp = 0
  while (getLevelProgress(xp).level < level) {
    xp = getLevelProgress(xp).nextLevelThreshold
  }
  return xp
}

function baseEvent(overrides: Partial<LevelUpEvent> = {}): LevelUpEvent {
  const newLevel = overrides.newLevel ?? 8
  // Always internally consistent — real detectLevelUp output could never
  // pair a totalXp with a mismatched newLevel, so fixtures shouldn't either.
  const totalXp = overrides.totalXp ?? thresholdFor(newLevel)
  return {
    previousLevel: 7,
    xpAwarded: 100,
    ...overrides,
    newLevel,
    totalXp,
  }
}

describe('LevelUpModal — dialog semantics and content', () => {
  it('renders the previous -> new level transition and total XP', () => {
    const event = baseEvent()
    const html = renderToStaticMarkup(
      <LevelUpModal event={event} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/Level Up/)
    expect(html).toMatch(/You reached/)
    expect(html).toMatch(/Level\s*8/)
    expect(html).toMatch(/\+100/)
    // toLocaleString()'s grouping separator is locale-dependent (this
    // codebase's existing convention elsewhere, e.g. app/learn/page.tsx,
    // doesn't pin a locale either) — match the digits with any/no separator
    // rather than assuming a comma specifically.
    const digits = String(event.totalXp)
    const flexibleSeparatorPattern = digits.replace(/(\d)(?=(\d{3})+$)/g, '$1[.,]?')
    expect(html).toMatch(new RegExp(flexibleSeparatorPattern))
  })

  it('shows a multi-level jump (4 -> 6) as one coherent transition, not an intermediate step', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent({ previousLevel: 4, newLevel: 6, xpAwarded: 1200 })} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/>4</)
    expect(html).toMatch(/>6</)
    expect(html).not.toMatch(/>5</) // no intermediate level rendered
  })

  it('has proper dialog semantics', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent()} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/role="dialog"/)
    expect(html).toMatch(/aria-modal="true"/)
    expect(html).toMatch(/aria-labelledby="level-up-heading"/)
    expect(html).toMatch(/id="level-up-heading"/)
    expect(html).toMatch(/aria-describedby="level-up-description"/)
    expect(html).toMatch(/id="level-up-description"/)
  })

  it('announces the level increase in plain text for screen readers, not via color/animation alone', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent({ newLevel: 8 })} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/role="status"/)
    expect(html).toMatch(/Level up! You reached Level 8\./)
  })

  it('renders the progress bar toward the next level using the canonical getLevelProgress, not a re-derived value', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent({ newLevel: 8 })} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/role="progressbar"/)
    expect(html).toMatch(/aria-valuemin="0"/)
    expect(html).toMatch(/aria-valuemax="100"/)
    expect(html).toMatch(/Progress toward Level 9/)
  })

  it('Continue Learning is the primary action, View Leaderboard the secondary action linking to /leaderboard', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent()} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/Continue Learning/)
    expect(html).toMatch(/View Leaderboard/)
    expect(html).toMatch(/href="\/leaderboard"/)
    // Primary action appears before the secondary one in document order.
    expect(html.indexOf('Continue Learning')).toBeLessThan(html.indexOf('View Leaderboard'))
  })

  it('with no token, never attempts a leaderboard fetch and falls back to the generic CTA — the modal itself still renders fully', () => {
    const html = renderToStaticMarkup(
      <LevelUpModal event={baseEvent()} onContinue={noop} onDismiss={noop} />,
    )
    expect(html).toMatch(/See how you rank on the leaderboard\./)
    // The rest of the modal is unaffected by the missing rank data.
    expect(html).toMatch(/Continue Learning/)
    expect(html).toMatch(/Level Up/)
  })
})

describe('RankPreviewSection — real data only, never estimated', () => {
  it('not yet loaded: shows the generic CTA, no numbers', () => {
    const html = renderToStaticMarkup(
      <RankPreviewSection allTimeRank={null} last24hRank={null} loaded={false} />,
    )
    expect(html).toMatch(/See how you rank on the leaderboard\./)
    expect(html).not.toMatch(/Your Rank/)
  })

  it('loaded successfully with both ranks: shows real numbers, never an estimate', () => {
    const html = renderToStaticMarkup(
      <RankPreviewSection allTimeRank={184} last24hRank={27} loaded={true} />,
    )
    expect(html).toMatch(/Your Rank/)
    expect(html).toMatch(/#184/)
    expect(html).toMatch(/#27/)
  })

  it('loaded but the user is unranked in both periods: falls back to the generic CTA, never fabricates a rank', () => {
    const html = renderToStaticMarkup(
      <RankPreviewSection allTimeRank={null} last24hRank={null} loaded={true} />,
    )
    expect(html).toMatch(/See how you rank on the leaderboard\./)
    expect(html).not.toMatch(/Your Rank/)
  })

  it('loaded with only one period ranked: shows that number, dash for the other — still real data only', () => {
    const html = renderToStaticMarkup(
      <RankPreviewSection allTimeRank={184} last24hRank={null} loaded={true} />,
    )
    expect(html).toMatch(/Your Rank/)
    expect(html).toMatch(/#184/)
  })
})

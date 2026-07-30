/**
 * Regression tests for StepFeedback's post-answer defend-range reveal
 * (RangeRevealCard, wired via result.range_reveal — see defendRangeReveal.ts).
 * Mirrors stepFeedbackAnswerReveal.test.tsx's fixture-based approach.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepFeedback } from '../StepFeedback'
import type { StepResult, DecisionSpotRangeReveal } from '@/lib/learn/types'
import type { RangeSemantics } from '@/lib/learn/rangeStrategy'

const ACTION_SLICE_CALL: RangeSemantics = { kind: 'action_slice', action: 'call' }
const COMPLETE_STRATEGY: RangeSemantics = { kind: 'complete_strategy' }

function baseResult(overrides: Partial<StepResult>): StepResult {
  return {
    score: 100,
    quality: 'perfect',
    ev_loss_bb: 0,
    feedback: "Correct — K9o is dominated by a large share of UTG's tight, strong range.",
    xp_earned: 6,
    level_before: 0,
    level_after: 0,
    leveled_up: false,
    evaluation_source: 'theory_engine',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
    ...overrides,
  }
}

function fixtureReveal(overrides: Partial<DecisionSpotRangeReveal> = {}): DecisionSpotRangeReveal {
  return {
    strategies: { AA: { call: 0.2, other: 0.8 }, QTs: { call: 1 } },
    strategySemantics: ACTION_SLICE_CALL,
    range: ['AA', 'QTs'],
    highlightHand: 'K9o',
    heroPosition: 'BB',
    villainPosition: 'UTG',
    label: 'BB CALLING RANGE vs UTG OPEN',
    subtitle: "See where K9o sits in Hero's calling frequency — raises and true folds aren't broken out separately here.",
    ...overrides,
  }
}

const noop = () => {}

describe('StepFeedback — range_reveal absent (most steps)', () => {
  it('renders no range grid and no defend-range label when range_reveal is undefined', () => {
    const result = baseResult({ range_reveal: undefined })
    const html = renderToStaticMarkup(
      <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).not.toMatch(/CALLING RANGE vs/)
    expect(html).not.toContain('role="tooltip"')
  })
})

describe('StepFeedback — range_reveal present (a defend decision_spot with canonical data)', () => {
  const result = baseResult({ range_reveal: fixtureReveal() })
  const html = renderToStaticMarkup(
    <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
  )

  it('renders the hero-strategy label and subtitle, positioned after the XP line', () => {
    expect(html).toContain('BB CALLING RANGE vs UTG OPEN')
    // renderToStaticMarkup HTML-escapes the apostrophe in "Hero's" as &#x27;
    expect(html).toContain('See where K9o sits in Hero')
    expect(html).toContain('calling frequency')
    const xpIdx = html.indexOf('+6')
    const labelIdx = html.indexOf('BB CALLING RANGE vs UTG OPEN')
    expect(xpIdx).toBeGreaterThanOrEqual(0)
    expect(xpIdx).toBeLessThan(labelIdx)
  })

  it('renders the full 13x13 grid (169 cells)', () => {
    // Each strategy-mode cell renders its hand text inside a truncate span — count distinct
    // rank-pair cell wrappers via the tooltip role, which PokerRangeGrid emits once per cell.
    expect((html.match(/role="tooltip"/g) || []).length).toBe(169)
  })

  it('highlights the just-asked hand (K9o) with the ring classes, not just any cell', () => {
    expect(html).toContain('ring-2 ring-white')
  })

  it('shows Previous/Continue navigation alongside the reveal', () => {
    expect(html).toContain('Continue')
  })
})

describe('StepFeedback — complete_strategy reveal shows Fold/Call/3-Bet, never "Other action"', () => {
  const result = baseResult({
    range_reveal: fixtureReveal({
      strategies: { AA: { '3bet': 1 }, JJ: { '3bet': 0.4534, call: 0.5466 }, K9o: { fold: 1 } },
      strategySemantics: COMPLETE_STRATEGY,
      label: 'BB DEFENSE vs UTG OPEN',
      subtitle: 'See where K9o sits inside your full defending strategy — fold, call, and 3-bet.',
    }),
  })
  const html = renderToStaticMarkup(
    <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
  )

  it('renders the "DEFENSE" label, not "CALLING RANGE"', () => {
    expect(html).toContain('BB DEFENSE vs UTG OPEN')
  })

  it('legend shows Fold, Call and 3-Bet', () => {
    expect(html).toContain('>Fold<')
    expect(html).toContain('>Call<')
    expect(html).toContain('>3-Bet<')
  })

  it('never shows "Other action" for a genuine complete strategy', () => {
    expect(html).not.toContain('Other action')
  })
})

describe('StepFeedback — action_slice reveal still shows "Other action", never a bare "Fold" legend entry', () => {
  const result = baseResult({ range_reveal: fixtureReveal() }) // default fixture is action_slice
  const html = renderToStaticMarkup(
    <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
  )

  it('legend shows Call and Other action', () => {
    expect(html).toContain('>Call<')
    expect(html).toContain('Other action')
  })

  it('shows the explanatory "not necessarily a fold" caption for action_slice data', () => {
    expect(html).toMatch(/not necessarily a fold/)
  })
})

describe('StepFeedback — range_reveal never changes XP rendering', () => {
  it('shows the identical XP text whether or not range_reveal is present', () => {
    const withReveal = renderToStaticMarkup(
      <StepFeedback result={baseResult({ range_reveal: fixtureReveal() })} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    const withoutReveal = renderToStaticMarkup(
      <StepFeedback result={baseResult({ range_reveal: undefined })} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    const xpMatch = (html: string) => html.match(/\+6[^\d]/)?.[0]
    expect(xpMatch(withReveal)).toBe(xpMatch(withoutReveal))
  })
})

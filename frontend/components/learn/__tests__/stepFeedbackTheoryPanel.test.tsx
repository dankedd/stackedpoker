/**
 * Regression tests for StepFeedback's post-answer THEORY panel (TheoryPanel,
 * wired via result.theory_panel — see TheoryPanelData in types.ts). Mirrors
 * stepFeedbackRangeReveal.test.tsx's fixture-based approach.
 *
 * The panel exists because Module 4 Lesson 7 was explaining a squeeze decision
 * with the OPENER's opening range — a chart for a question the learner wasn't
 * asked. These tests pin the two things that make it a valid replacement: it
 * renders the reasoning it promises, and it only ever renders AFTER the answer.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepFeedback } from '../StepFeedback'
import { evaluateStepLocally } from '@/lib/learn/evaluator'
import { LESSONS } from '@/lib/learn/curriculum'
import type { StepResult, TheoryPanelData } from '@/lib/learn/types'

const noop = () => {}

function baseResult(overrides: Partial<StepResult>): StepResult {
  return {
    score: 100,
    quality: 'perfect',
    ev_loss_bb: 0,
    feedback: 'Correct.',
    xp_earned: 8,
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

const FIXTURE: TheoryPanelData = {
  label: 'Squeeze strategy — SB vs CO open + BTN call',
  hand: 'KQo',
  verdict: 'Fold',
  verdict_note: 'Squeezing is the defensible boundary alternative.',
  factors: [
    { term: 'Dead money', weight: 'for', description: 'Two players have already invested.' },
    { term: 'Domination risk', weight: 'against', description: 'The flat is broadway-heavy.' },
    { term: 'Blockers', weight: 'context', description: 'KQo blocks AK, AQ, KK, QQ.' },
  ],
  takeaway: 'A raise plus a call is a signal to tighten, not to widen.',
  caption: 'Derived from the overcalling rules, not an invented squeeze range.',
}

function render(result: StepResult) {
  return renderToStaticMarkup(
    <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
  )
}

describe('StepFeedback — theory_panel absent (most steps)', () => {
  it('renders nothing panel-shaped when theory_panel is undefined', () => {
    const html = render(baseResult({ theory_panel: undefined }))
    expect(html).not.toContain('Key takeaway')
  })
})

describe('StepFeedback — theory_panel present', () => {
  const html = render(baseResult({ theory_panel: FIXTURE }))

  it('shows the hand and the verdict together, so the answer is unmissable', () => {
    expect(html).toContain('KQo')
    expect(html).toContain('Fold')
    expect(html).toContain('Squeezing is the defensible boundary alternative.')
  })

  it('renders every factor — both term and explanation', () => {
    for (const factor of FIXTURE.factors) {
      expect(html, `missing factor "${factor.term}"`).toContain(factor.term)
      expect(html, `missing description for "${factor.term}"`).toContain(factor.description)
    }
  })

  it('renders the labelled key takeaway and the sourcing caption', () => {
    expect(html).toContain('Key takeaway')
    expect(html).toContain(FIXTURE.takeaway)
    expect(html).toContain(FIXTURE.caption!)
  })

  it('renders the eyebrow describing the exact configuration, not a generic heading', () => {
    expect(html).toContain('SB vs CO open + BTN call')
  })
})

describe('StepFeedback — the real sqz-s5b step, end to end', () => {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'sqz-s5b')!

  it('shows the squeeze theory panel and NO opening-range chart, on a right answer and a wrong one alike', () => {
    for (const answer of ['fold', 'call']) {
      const html = render(evaluateStepLocally(step, answer, 0))
      expect(html, answer).toContain('KQo')
      expect(html, answer).toContain('Key takeaway')
      // The exact regression: the post-answer screen must not explain a squeeze
      // decision with a chart of what CO opens.
      expect(html, answer).not.toMatch(/OPENING RANGE/i)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepFeedback } from '../StepFeedback'
import type { StepResult } from '@/lib/learn/types'

/**
 * Regression tests for the contextual "Ask Coach" trigger inside post-answer
 * feedback (spec: "Not sure why? Ask Coach" after a wrong answer, "Ask Coach
 * why" after a correct one) — additive to the existing feedback hierarchy,
 * see stepFeedbackAnswerReveal.test.tsx for the rest of that rendering.
 */

function baseResult(overrides: Partial<StepResult>): StepResult {
  return {
    score: 35,
    quality: 'mistake',
    ev_loss_bb: 0,
    feedback: 'CALL is profitable, but RAISE beats it by a wide margin.',
    xp_earned: 2,
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

const noop = () => {}

describe('StepFeedback — Ask Coach trigger', () => {
  it('renders no trigger when onAskCoach is omitted (e.g. no signed-in session)', () => {
    const html = renderToStaticMarkup(
      <StepFeedback result={baseResult({ quality: 'mistake' })} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).not.toMatch(/Ask Coach/)
  })

  it.each(['acceptable', 'mistake', 'punt'] as const)(
    'shows "Not sure why? Ask Coach" for a %s (not-quite-right) result',
    (quality) => {
      const html = renderToStaticMarkup(
        <StepFeedback result={baseResult({ quality })} onContinue={noop} onRetry={noop} isLast={false} onAskCoach={noop} />,
      )
      expect(html).toMatch(/Not sure why\? Ask Coach/)
      expect(html).not.toMatch(/Ask Coach why/)
    },
  )

  it.each(['perfect', 'good'] as const)(
    'shows "Ask Coach why" for a %s result',
    (quality) => {
      const html = renderToStaticMarkup(
        <StepFeedback result={baseResult({ quality, score: 100 })} onContinue={noop} onRetry={noop} isLast={false} onAskCoach={noop} />,
      )
      expect(html).toMatch(/Ask Coach why/)
      expect(html).not.toMatch(/Not sure why\?/)
    },
  )

  it('never renders a trigger on the failed-evaluation state, even if onAskCoach is provided', () => {
    const html = renderToStaticMarkup(
      <StepFeedback
        result={baseResult({ evaluation_valid: false })}
        onContinue={noop}
        onRetry={noop}
        isLast={false}
        onAskCoach={noop}
      />,
    )
    expect(html).not.toMatch(/Ask Coach/)
  })
})

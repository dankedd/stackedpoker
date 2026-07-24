import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepFeedback } from '../StepFeedback'
import type { StepResult } from '@/lib/learn/types'

/**
 * Regression tests for the shared post-submission feedback hierarchy:
 * RESULT -> SCORE -> CORRECT ANSWER -> EXPLANATION. `answer_reveal` is the
 * only new surface here — everything else (score, XP, quality badge) is
 * unchanged and just needs to keep rendering around it.
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

describe('StepFeedback — answer_reveal rendering', () => {
  it('renders nothing extra when answer_reveal is absent (e.g. a perfect answer)', () => {
    const result = baseResult({ quality: 'perfect', score: 100, answer_reveal: undefined })
    const html = renderToStaticMarkup(
      <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).not.toMatch(/Your answer:/)
    expect(html).not.toMatch(/Correct play:|Correct answer:|Correct classification:/)
  })

  it('renders the term/correct pair for an incorrect answer, positioned after the score line', () => {
    const result = baseResult({
      answer_reveal: { term: 'Correct play', correct: 'RAISE', yours: 'CALL' },
    })
    const html = renderToStaticMarkup(
      <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).toContain('Your answer:')
    expect(html).toContain('CALL')
    expect(html).toContain('Correct play:')
    expect(html).toContain('RAISE')

    // Ordering: Score line must appear before the reveal block, which must appear before the feedback prose.
    const scoreIdx = html.indexOf('Score: 35/100')
    const revealIdx = html.indexOf('Correct play:')
    const feedbackIdx = html.indexOf('CALL is profitable')
    expect(scoreIdx).toBeGreaterThanOrEqual(0)
    expect(scoreIdx).toBeLessThan(revealIdx)
    expect(revealIdx).toBeLessThan(feedbackIdx)
  })

  it('renders "Also accepted" alternatives when the evaluator supplies them', () => {
    const result = baseResult({
      answer_reveal: { term: 'Optimal line', correct: 'Raise', alsoAccepted: ['3-Bet'] },
    })
    const html = renderToStaticMarkup(
      <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).toMatch(/Also accepted/)
    expect(html).toContain('3-Bet')
  })

  it('omits the "Your answer" line entirely when `yours` is not supplied', () => {
    const result = baseResult({ answer_reveal: { term: 'Correct answer', correct: '25%' } })
    const html = renderToStaticMarkup(
      <StepFeedback result={result} onContinue={noop} onRetry={noop} isLast={false} />,
    )
    expect(html).not.toMatch(/Your answer:/)
    expect(html).toContain('Correct answer:')
    expect(html).toContain('25%')
  })
})

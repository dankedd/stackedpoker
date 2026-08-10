import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepFeedback } from '../StepFeedback'
import { EvaluationFailed } from '../EvaluationFailed'
import { QUALITY_LABELS } from '@/lib/learn/types'
import type { StepResult, ActionQuality } from '@/lib/learn/types'

/**
 * Guards the mobile feedback-card layout.
 *
 * The card used to be one flex row at every width: a 48px icon plus a 16px gap
 * ate ~64px of a phone's ~295px content area, so the explanation wrapped inside
 * a ~187px column — 63% of the available width, 16 lines for a typical
 * explanation. It now re-flows below 480px: icon + badges keep row 1, and the
 * score/explanation block drops to a row that spans BOTH grid columns, so the
 * prose runs the full card width (~85%, 11 lines). At 480px and up the grid
 * collapses back to the original two-column layout, unchanged.
 *
 * These assert the structural classes rather than measured pixels — the suite
 * runs under `environment: "node"` with no browser (see
 * lessonPlayerLayoutRegression.test.tsx). The pixel proof was done with real
 * device emulation over CDP; these are the durable CI guard.
 */

const QUALITIES: ActionQuality[] = ['perfect', 'good', 'acceptable', 'mistake', 'punt']

function result(quality: ActionQuality, over: Partial<StepResult> = {}): StepResult {
  return {
    score: 100,
    quality,
    ev_loss_bb: 0,
    feedback: 'Folding preserves the stack for spots where you have position.',
    xp_earned: 20,
    level_before: 3,
    level_after: 3,
    leveled_up: false,
    evaluation_source: 'theory_engine',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
    ...over,
  } as StepResult
}

function render(quality: ActionQuality, over: Partial<StepResult> = {}) {
  return renderToStaticMarkup(
    <StepFeedback
      result={result(quality, over)}
      onContinue={() => {}}
      onRetry={() => {}}
      isLast={false}
      onPrevious={() => {}}
      onAskCoach={() => {}}
    />,
  )
}

describe.each(QUALITIES)('StepFeedback — %s card', (quality) => {
  const html = render(quality)

  it('still names the quality', () => {
    expect(html).toContain(QUALITY_LABELS[quality])
  })

  it('lays the card out as a two-column grid, not a flex row', () => {
    expect(html).toContain('grid grid-cols-[auto_1fr]')
  })

  it('spans the explanation across both columns below 480px', () => {
    expect(html).toContain('row-start-2 col-start-1 col-span-2')
  })

  it('restores the original right-hand column at 480px and up', () => {
    expect(html).toContain('min-[480px]:col-start-2 min-[480px]:col-span-1')
    expect(html).toContain('min-[480px]:row-span-2')
  })

  it('keeps the icon and badges together on row 1', () => {
    expect(html).toContain('col-start-2 row-start-1')
  })

  it('gives "Ask Coach" a 44px touch target on mobile only', () => {
    expect(html).toContain('min-h-[44px]')
    expect(html).toContain('min-[480px]:min-h-0')
  })
})

describe('StepFeedback — every quality shares one layout', () => {
  it('produces identical structural classes for all five qualities', () => {
    const STRUCTURE = [
      'grid grid-cols-[auto_1fr]',
      'col-start-1 row-start-1 min-[480px]:row-span-2',
      'row-start-2 col-start-1 col-span-2',
    ]
    for (const q of QUALITIES) {
      const html = render(q)
      for (const cls of STRUCTURE) expect(html, `quality ${q}`).toContain(cls)
    }
  })

  it('keeps each quality its own badge colour', () => {
    expect(render('perfect')).toContain('text-emerald-400')
    expect(render('good')).toContain('text-blue-400')
    expect(render('acceptable')).toContain('text-amber-400')
    expect(render('mistake')).toContain('text-orange-400')
    expect(render('punt')).toContain('text-red-400')
  })

  it('keeps the solver card its own treatment', () => {
    expect(render('perfect', { evaluation_source: 'solver' })).toContain('border-blue-500/40')
  })

  it('keeps the answer reveal and structured points inside the full-width block', () => {
    const html = render('mistake', {
      answer_reveal: { term: 'Correct action', correct: 'Fold', yours: 'Call' },
      structured_points: [{ term: 'Position', description: 'You realize less equity OOP.' }],
    } as Partial<StepResult>)
    const block = html.slice(html.indexOf('row-start-2 col-start-1 col-span-2'))
    expect(block).toContain('Correct action')
    expect(block).toContain('Position')
    expect(block).toContain('Ask Coach')
  })
})

describe('EvaluationFailed — same mobile layout as the graded cards', () => {
  const html = renderToStaticMarkup(
    <EvaluationFailed onRetry={() => {}} onContinue={() => {}} isLast={false} onPrevious={() => {}} />,
  )

  it('uses the shared grid', () => {
    expect(html).toContain('grid grid-cols-[auto_1fr]')
    expect(html).toContain('row-start-2 col-start-1 col-span-2')
    expect(html).toContain('min-[480px]:col-start-2 min-[480px]:col-span-1')
  })

  it('keeps its message', () => {
    expect(html).toContain('Analysis unavailable')
  })
})

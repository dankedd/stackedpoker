import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoardRankSort } from '../BoardRankSort'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

// csd-s3: order 4 boards bets-most -> bets-least; target ['ace_dry','king_dry','broadway_wet','low_connected']
const step = findStep('csd-s3')
const noop = () => {}

describe('BoardRankSort — pre-submission never leaks the correct order', () => {
  const html = renderToStaticMarkup(<BoardRankSort step={step} onAnswer={noop} />)

  it('shows "Check order", not the reveal panel', () => {
    expect(html).toContain('Check order')
    expect(html).not.toContain('Correct order — bets most to bets least')
    expect(html).not.toContain('Continue')
  })

  it('renders every board tile with a stable id, none pre-numbered', () => {
    for (const b of step.board_rank_sort_boards ?? []) {
      expect(html).toContain(`data-board-id="${b.id}"`)
    }
    // Position badges (1..N) only render once a board has been tapped
    expect(html).not.toMatch(/>1<\/span>/)
  })

  it('does not call onAnswer merely from rendering', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<BoardRankSort step={step} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe('BoardRankSort — reviewMode reveals the reviewed-phase UI', () => {
  // reviewMode forces the reviewed phase without a real tap-through, so `order`
  // is still empty here — this exercises the "reviewed phase renders at all"
  // path; the actual per-slot correct/incorrect comparison logic (the part
  // that matters for the "never leak, always compare" requirement) is
  // covered exhaustively by the pure `computeOrderReveal` unit tests in
  // lib/learn/__tests__/revealHelpers.test.ts.
  const html = renderToStaticMarkup(<BoardRankSort step={step} onAnswer={noop} reviewMode />)

  it('shows the Continue control instead of "Check order"', () => {
    expect(html).toContain('Continue')
    expect(html).not.toContain('Check order')
  })

  it('reviewMode output differs from the default (unanswered) output', () => {
    const before = renderToStaticMarkup(<BoardRankSort step={step} onAnswer={noop} />)
    expect(html).not.toBe(before)
  })
})

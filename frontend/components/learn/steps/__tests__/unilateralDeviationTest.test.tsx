import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { UnilateralDeviationTest } from '../UnilateralDeviationTest'
import { LESSONS_BY_SLUG } from '@/lib/learn/curriculum'
import { resolveDeviationPanel } from '@/lib/learn/unilateralDeviation'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Lesson 10.4's deviation test renders nothing of its own: every number on
 * screen comes out of `resolveDeviationPanel(step, sliderValue)`. These are the
 * markup-level guards for that — the value the slider is bound to, the side of
 * the candidate equilibrium a step actually tests, and the branch rows that
 * respond even when the total EV is flat.
 *
 * The live drag itself (touch and mouse, slider → state → recalculation → DOM)
 * is verified in a browser; this file only proves the markup is derived rather
 * than authored.
 */

const LESSON = LESSONS_BY_SLUG['when-neither-player-can-improve']
const step = (id: string): LessonStep => LESSON.steps.find((s) => s.id === id)!

const A_SIDE = step('npi-s2')
const B_SIDE_LIVE = step('npi-s7')

function render(s: LessonStep) {
  return renderToStaticMarkup(<UnilateralDeviationTest step={s} onAnswer={() => {}} />)
}

describe('UnilateralDeviationTest — the control is bound to the tested player', () => {
  it('renders a real range input covering the whole 0-100% frequency range', () => {
    const html = render(A_SIDE)
    expect(html).toContain('type="range"')
    expect(html).toContain('min="0"')
    expect(html).toContain('max="100"')
    expect(html).toContain('step="1"')
  })

  it("starts on the A-side player's own candidate frequency (0%), not the opponent's", () => {
    const html = render(A_SIDE)
    expect(html).toContain('value="0"')
    expect(html).toContain('Try a different Player A frequency')
  })

  it("starts on the B-side player's own candidate frequency (50%) — the mis-mapped case", () => {
    // The bug put Player A's 60% betting frequency on Player B's slider here.
    const html = render(B_SIDE_LIVE)
    expect(html).toContain('value="50"')
    expect(html).toContain('Try a different Player B frequency')
    expect(html).toContain('Held fixed — Player A bets')
  })
})

describe('UnilateralDeviationTest — every displayed number is derived, not authored', () => {
  it('shows the resolver’s baseline EV for the step, whatever it happens to be', () => {
    const aPanel = resolveDeviationPanel(A_SIDE, 0)
    const bPanel = resolveDeviationPanel(B_SIDE_LIVE, 50)
    expect(render(A_SIDE)).toContain(`$${aPanel.baselineEV.toFixed(2)}`)
    expect(render(B_SIDE_LIVE)).toContain(`$${bPanel.baselineEV.toFixed(2)}`)
    // ...and those two baselines are genuinely different numbers, so neither is a constant.
    expect(aPanel.baselineEV).not.toBe(bPanel.baselineEV)
  })

  it('renders one branch row per branch of the resolver’s breakdown', () => {
    const html = render(B_SIDE_LIVE)
    for (const branch of resolveDeviationPanel(B_SIDE_LIVE, 50).branches) {
      expect(html).toContain(branch.label)
    }
  })

  it('the "EV at this deviation" readout is the resolver’s number, not a constant', () => {
    const readout = (s: LessonStep) =>
      render(s).match(/EV at this deviation<\/span>[\s\S]*?>\$(-?[\d.]+)/)?.[1]
    expect(readout(B_SIDE_LIVE)).toBe(resolveDeviationPanel(B_SIDE_LIVE, 50).currentEV.toFixed(2))
    expect(readout(A_SIDE)).toBe(resolveDeviationPanel(A_SIDE, 0).currentEV.toFixed(2))
    expect(readout(A_SIDE)).not.toBe(readout(B_SIDE_LIVE))
  })

  it('shows no delta badge until the learner has actually moved the slider', () => {
    expect(render(B_SIDE_LIVE)).not.toContain('(no change)')
    expect(render(B_SIDE_LIVE)).not.toContain('frequencies tried')
  })

  it('does not leak the verdict before the learner answers', () => {
    const html = render(A_SIDE)
    expect(html).not.toMatch(/no profitable deviation exists/i)
    expect(html).not.toMatch(/indifferent/i)
    expect(html).toContain('Yes — Player A can improve alone')
    expect(html).toContain('No — no profitable deviation')
  })
})

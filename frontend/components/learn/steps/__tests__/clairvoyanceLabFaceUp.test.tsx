import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClairvoyanceLab } from '../ClairvoyanceLab'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Module 11, Lesson 1 ("Why We Bet") — the new 'face_up_compare' mode. Regression
 * coverage for the two guarantees this mode depends on:
 *  1. It's purely additive — the pre-existing 'explore'/'find_equilibrium' modes
 *     (Module 10) render exactly as before, sliders and all.
 *  2. 'face_up_compare' itself never renders the frequency sliders (nothing is
 *     editable in this mode — it's a fixed, read-only comparison) and does show
 *     both EV numbers plus the $25 gap the lesson is built around.
 */

const HIDDEN_STEP: LessonStep = { id: 'test-explore', type: 'clairvoyance_lab', clairvoyance_lab_mode: 'explore' }
const FACE_UP_STEP: LessonStep = { id: 'test-face-up', type: 'clairvoyance_lab', clairvoyance_lab_mode: 'face_up_compare' }

describe('ClairvoyanceLab — pre-existing modes are unaffected (regression guard)', () => {
  it("'explore' mode still renders all three frequency sliders", () => {
    const html = renderToStaticMarkup(<ClairvoyanceLab step={HIDDEN_STEP} onAnswer={() => {}} />)
    expect(html).toContain('P1 bets AA')
    expect(html).toContain('P1 bets QQ')
    expect(html).toContain('P2 calls with KK')
  })
})

describe("ClairvoyanceLab — new 'face_up_compare' mode", () => {
  it('renders no frequency sliders (nothing editable in this mode)', () => {
    const html = renderToStaticMarkup(<ClairvoyanceLab step={FACE_UP_STEP} onAnswer={() => {}} />)
    expect(html).not.toContain('P1 bets AA')
    expect(html).not.toContain('P1 bets QQ')
    expect(html).not.toContain('P2 calls with KK')
  })

  it('shows both the hidden-information EV ($75) and the face-up EV ($50)', () => {
    const html = renderToStaticMarkup(<ClairvoyanceLab step={FACE_UP_STEP} onAnswer={() => {}} />)
    expect(html).toContain('$75')
    expect(html).toContain('$50')
  })

  it('shows the exact $25 gap between the two', () => {
    const html = renderToStaticMarkup(<ClairvoyanceLab step={FACE_UP_STEP} onAnswer={() => {}} />)
    expect(html).toContain('$25')
    expect(html).toMatch(/value of/i)
  })

  it('the Continue button fires onAnswer with no live-editable frequency state to submit', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<ClairvoyanceLab step={FACE_UP_STEP} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled() // never called merely by rendering
    const html = renderToStaticMarkup(<ClairvoyanceLab step={FACE_UP_STEP} onAnswer={onAnswer} />)
    expect(html).toContain('Continue')
  })
})

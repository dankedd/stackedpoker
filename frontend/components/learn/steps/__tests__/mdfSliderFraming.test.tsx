import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MdfSlider } from '../MdfSlider'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Module 11, Lesson 4 ("Bluffs Have a Job") — `mdf_slider_framing`. Purely a caption/visual
 * variant; the underlying MDF/alpha formula is identical in both framings. Regression
 * coverage: omitting the field (every pre-existing Module 10 use of this step type) must
 * render with zero trace of the new copy.
 */

const BASE_STEP: LessonStep = { id: 'test-mdf', type: 'mdf_slider', mdf_slider_initial_bet_pct: 100 }

describe('MdfSlider — mdf_slider_framing is additive and opt-in', () => {
  it('omitting the field (every existing Module 10 lesson) renders no flop/river framing copy', () => {
    const html = renderToStaticMarkup(<MdfSlider step={BASE_STEP} onAnswer={() => {}} />)
    expect(html).not.toMatch(/estimate, not a hard/i)
  })

  it("framing 'river' renders no estimate caption (the exact, hard-target framing)", () => {
    const step: LessonStep = { ...BASE_STEP, mdf_slider_framing: 'river' }
    const html = renderToStaticMarkup(<MdfSlider step={step} onAnswer={() => {}} />)
    expect(html).not.toMatch(/estimate, not a hard/i)
  })

  it("framing 'flop' renders the estimate caption explaining why the number is approximate", () => {
    const step: LessonStep = { ...BASE_STEP, mdf_slider_framing: 'flop' }
    const html = renderToStaticMarkup(<MdfSlider step={step} onAnswer={() => {}} />)
    expect(html).toMatch(/estimate, not a hard/i)
    expect(html).toMatch(/backdoor equity/i)
  })

  it("the underlying MDF/alpha formula is unaffected by framing (same numbers either way)", () => {
    const river: LessonStep = { ...BASE_STEP, mdf_slider_framing: 'river' }
    const flop: LessonStep = { ...BASE_STEP, mdf_slider_framing: 'flop' }
    const htmlRiver = renderToStaticMarkup(<MdfSlider step={river} onAnswer={() => {}} />)
    const htmlFlop = renderToStaticMarkup(<MdfSlider step={flop} onAnswer={() => {}} />)
    // 100% pot bet -> MDF = 100/(100+100) = 50.0%
    expect(htmlRiver).toContain('50.0%')
    expect(htmlFlop).toContain('50.0%')
  })
})

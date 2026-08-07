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

/**
 * Module 12, Lessons 1-2 ("A Bet Size Is a Sentence" / "What a Size Buys You") —
 * `mdf_slider_variant`. Additive, opt-in, default `'standard'` — regression coverage
 * that every pre-existing Module 10/11 lesson (which never authors this field) renders
 * with zero trace of the new Pot Odds / Value:Bluff Ratio tiles, matching the Module 12
 * architecture's Section 14 "default-path regression test" requirement.
 */
describe('MdfSlider — mdf_slider_variant is additive and opt-in', () => {
  it("omitting the field (every existing Module 10/11 lesson) renders no Pot Odds / Value:Bluff Ratio tiles", () => {
    const html = renderToStaticMarkup(<MdfSlider step={BASE_STEP} onAnswer={() => {}} />)
    expect(html).not.toMatch(/Pot Odds Offered/)
    expect(html).not.toMatch(/Value:Bluff Ratio/)
  })

  it("variant 'standard' explicitly renders identically to omitting the field", () => {
    const implicit = renderToStaticMarkup(<MdfSlider step={BASE_STEP} onAnswer={() => {}} />)
    const explicit = renderToStaticMarkup(<MdfSlider step={{ ...BASE_STEP, mdf_slider_variant: 'standard' }} onAnswer={() => {}} />)
    expect(explicit).toBe(implicit)
  })

  it("variant 'full_cascade' renders both new readout tiles with correct values at a half-pot bet", () => {
    const step: LessonStep = { ...BASE_STEP, mdf_slider_variant: 'full_cascade', mdf_slider_initial_bet_pct: 50 }
    const html = renderToStaticMarkup(<MdfSlider step={step} onAnswer={() => {}} />)
    expect(html).toMatch(/Pot Odds Offered/)
    expect(html).toMatch(/Value:Bluff Ratio/)
    // Half-pot: pot odds = 0.5/(1+2*0.5) = 25.0%, Alpha = 33.3% -> ratio 2:1 (66.7 value / 33.3 bluff)
    expect(html).toContain('25.0%')
    expect(html).toMatch(/2 : 1/)
  })

  it("full_cascade's new tiles do not alter the existing MDF/Alpha gauge values (same underlying formula)", () => {
    const standard = renderToStaticMarkup(<MdfSlider step={{ ...BASE_STEP, mdf_slider_initial_bet_pct: 50 }} onAnswer={() => {}} />)
    const cascade = renderToStaticMarkup(<MdfSlider step={{ ...BASE_STEP, mdf_slider_initial_bet_pct: 50, mdf_slider_variant: 'full_cascade' }} onAnswer={() => {}} />)
    // Both must contain the same MDF (66.7%) and Alpha (33.3%) gauge values.
    expect(standard).toContain('66.7%')
    expect(cascade).toContain('66.7%')
    expect(standard).toContain('33.3%')
    expect(cascade).toContain('33.3%')
  })
})

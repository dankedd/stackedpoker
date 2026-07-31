/**
 * Regression tests for RangeBuild's scenario-meta line (hero_position +
 * effective_stack_bb) — added so a range-building exercise never asks the
 * learner to build an opening range without telling them the stack depth
 * that range is supposed to hold for. Generic to any `range_build` step:
 * driven entirely by `step.hero_position`/`step.effective_stack_bb`, never
 * fabricated when either is absent.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeBuild } from '../RangeBuild'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

const baseStep: LessonStep = {
  id: 'test-meta',
  type: 'range_build',
  range_target: 'BTN_open_100bb',
}

describe('RangeBuild — scenario meta (position + effective stack depth)', () => {
  it('shows both position and effective stack depth when the step authors both', () => {
    const step: LessonStep = { ...baseStep, hero_position: 'BTN', effective_stack_bb: 100 }
    const html = renderToStaticMarkup(<RangeBuild step={step} onAnswer={noop} />)
    expect(html).toContain('>BTN<')
    expect(html).toContain('100BB EFFECTIVE')
  })

  it('shows only the stack depth, with no stray separator, when hero_position is absent', () => {
    const step: LessonStep = { ...baseStep, effective_stack_bb: 40 }
    const html = renderToStaticMarkup(<RangeBuild step={step} onAnswer={noop} />)
    expect(html).toContain('40BB EFFECTIVE')
    expect(html).not.toContain('·')
  })

  it('shows only the position, with no stray separator, when effective_stack_bb is absent', () => {
    const step: LessonStep = { ...baseStep, hero_position: 'CO' }
    const html = renderToStaticMarkup(<RangeBuild step={step} onAnswer={noop} />)
    expect(html).toContain('>CO<')
    expect(html).not.toContain('·')
    expect(html).not.toContain('EFFECTIVE')
  })

  it('never fabricates a scenario meta line when neither field is authored', () => {
    const html = renderToStaticMarkup(<RangeBuild step={baseStep} onAnswer={noop} />)
    expect(html).not.toContain('EFFECTIVE')
    expect(html).not.toContain('·')
  })

  it('the real fi-s7 curriculum step ("First In") now displays BTN — 100BB Effective', () => {
    const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'fi-s7')
    expect(step).toBeTruthy()
    expect(step!.hero_position).toBe('BTN')
    expect(step!.effective_stack_bb).toBe(100)
    const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
    expect(html).toContain('>BTN<')
    expect(html).toContain('100BB EFFECTIVE')
  })

  it('mtc-s9 ("What Makes a Hand Playable?") now displays CO — 100BB Effective', () => {
    const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'mtc-s9')
    expect(step).toBeTruthy()
    expect(step!.hero_position).toBe('CO')
    expect(step!.effective_stack_bb).toBe(100)
    const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
    expect(html).toContain('>CO<')
    expect(html).toContain('100BB EFFECTIVE')
  })
})

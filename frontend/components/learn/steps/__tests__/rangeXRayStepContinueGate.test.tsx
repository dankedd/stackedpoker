/**
 * Regression coverage for the "X-Ray the Range" dead-end (Module 8, Lesson 4,
 * step xr-s3): a `range_xray` step authored with no `options` never called
 * `onAnswer` from anywhere in RangeXRayStep, so `phase` never left 'step' and
 * no Continue affordance ever appeared — the lesson looked stuck. Fixed by
 * gating a real, in-step Continue button on actually tapping bucket segments
 * (RangeXRay's new `onBucketInspected` callback), instead of leaving the
 * learner with a bare prompt and no way to act on it.
 *
 * Steps authored WITH `options` (e.g. srtf-s3) are untouched — they already
 * had a working answer -> onAnswer path and must keep rendering exactly as
 * before.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeXRayStep } from '../RangeXRayStep'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

const noop = () => {}

describe('RangeXRayStep — exploration step (no options authored)', () => {
  const step = findStep('xr-s3') // "X-Ray the Range" — Tap STRONG on both bars
  const html = renderToStaticMarkup(<RangeXRayStep step={step} onAnswer={noop} />)

  it('never gets stuck with no way forward — a Continue button is always present', () => {
    expect(html).toContain('Continue')
  })

  it('Continue starts disabled until the learner has actually inspected something', () => {
    expect(html).toMatch(/disabled=""[^>]*>[\s\S]*?Continue|Continue[\s\S]*?disabled=""/)
    expect(html).toContain('Tap 2 more segments above to continue.')
  })

  it('does not render an options grid (none authored on this step)', () => {
    expect(step.options ?? []).toHaveLength(0)
  })

  it('shows the authored prompt instructing what to tap', () => {
    expect(html).toContain(step.range_xray_prompt)
  })
})

describe('RangeXRayStep — quiz step (options authored) is unaffected by the fix', () => {
  const step = findStep('srtf-s3')
  const html = renderToStaticMarkup(<RangeXRayStep step={step} onAnswer={noop} />)

  it('still renders its real answer options, not the inspect-gate UI', () => {
    expect(step.options?.length).toBeGreaterThan(0)
    for (const opt of step.options ?? []) {
      // Apostrophes are HTML-entity-encoded in SSR output — compare a stretch
      // of the label without one rather than decoding the whole document.
      const chunk = opt.label.split("'")[0].trim()
      expect(html).toContain(chunk)
    }
    expect(html).not.toContain('ready to continue')
    expect(html).not.toContain('Tap 2 more segments')
  })
})

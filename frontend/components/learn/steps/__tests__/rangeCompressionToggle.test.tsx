import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeCompressionToggle } from '../RangeCompressionToggle'
import { LESSONS_BY_ID } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Module 12, Lessons 3-4 ("One Size Rarely Fits All" / "The Small Cost of Simplifying") —
 * the one wholly new step component this module introduces. Renders against the REAL
 * authored `osrfa-s3`/`tscos-s3` steps (never a fabricated fixture), matching this
 * project's established `renderToStaticMarkup` component-test convention
 * (scenarioComparison.test.tsx).
 */

function getStep(lessonId: string, stepId: string): LessonStep {
  const step = LESSONS_BY_ID[lessonId]?.steps.find((s) => s.id === stepId)
  if (!step) throw new Error(`${lessonId}/${stepId} not found`)
  return step
}

/** renderToStaticMarkup HTML-escapes apostrophes as `&#x27;` — normalize before substring checks. */
function normalizeHtml(html: string): string {
  return html.replace(/&#x27;/g, "'")
}

describe('RangeCompressionToggle — renders the real Lesson 3/4 authored steps', () => {
  it('Lesson 3 (osrfa-s3, 3 states A-C): renders the pool grid, all 3 toggle tabs, and the default EV readout', () => {
    const step = getStep('one-size-rarely-fits-all', 'osrfa-s3')
    const html = renderToStaticMarkup(<RangeCompressionToggle step={step} onAnswer={() => {}} />)
    expect(html).toContain('role="tablist"')
    // All 3 state labels appear as tabs, even though only the first is initially active.
    for (const state of step.range_compression_toggle_states ?? []) {
      expect(html).toContain(state.label)
    }
    // Defaults to state 0 (Example A) — its EV label is the one shown.
    expect(html).toContain(step.range_compression_toggle_states?.[0].evLabel)
    // Every prediction option renders as a real, clickable choice.
    const normalized = normalizeHtml(html)
    for (const opt of step.options ?? []) {
      expect(normalized).toContain(opt.label)
    }
  })

  it('Lesson 3: every non-default tab is locked (aria-disabled) before the learner has predicted', () => {
    const step = getStep('one-size-rarely-fits-all', 'osrfa-s3')
    const html = renderToStaticMarkup(<RangeCompressionToggle step={step} onAnswer={() => {}} />)
    const disabledCount = (html.match(/aria-disabled="true"/g) ?? []).length
    // 3 states, 1 unlocked (index 0) by default -> 2 locked.
    expect(disabledCount).toBe((step.range_compression_toggle_states?.length ?? 0) - 1)
  })

  it('Lesson 4 (tscos-s3, 4 states A-D): renders all 4 toggle tabs including the Example D all-in state', () => {
    const step = getStep('the-small-cost-of-simplifying', 'tscos-s3')
    const html = renderToStaticMarkup(<RangeCompressionToggle step={step} onAnswer={() => {}} />)
    expect(step.range_compression_toggle_states?.length).toBe(4)
    for (const state of step.range_compression_toggle_states ?? []) {
      expect(html).toContain(state.label)
    }
  })

  it('renders a graceful empty state when pool/states are missing, rather than throwing', () => {
    const step: LessonStep = { id: 'test-empty', type: 'range_compression_toggle' }
    expect(() => renderToStaticMarkup(<RangeCompressionToggle step={step} onAnswer={() => {}} />)).not.toThrow()
    const html = renderToStaticMarkup(<RangeCompressionToggle step={step} onAnswer={() => {}} />)
    expect(html).toMatch(/data missing/i)
  })
})

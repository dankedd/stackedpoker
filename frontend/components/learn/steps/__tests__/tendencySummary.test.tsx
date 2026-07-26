/**
 * Tests for the reusable "tendency_summary" capstone pattern: a step that reads
 * THIS PLAYTHROUGH'S real StepResult.quality for a named list of earlier steps
 * and synthesizes a personalized message — never a canned/simulated readout.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TendencySummary } from '../TendencySummary'
import { LESSONS } from '@/lib/learn/curriculum'
import { makeFailedResult } from '@/lib/learn/types'
import type { LessonStep, StepResult } from '@/lib/learn/types'

const noop = () => {}

function perfectResult(): StepResult {
  return { ...makeFailedResult(), quality: 'perfect', score: 100, xp_earned: 10, evaluation_valid: true, unscored: false }
}
function mistakeResult(): StepResult {
  return { ...makeFailedResult(), quality: 'mistake', score: 30, xp_earned: 2, evaluation_valid: true, unscored: false }
}

const SOURCE_STEPS: LessonStep[] = [
  { id: 'a', type: 'decision_spot', tendency_tag: 'x', tendency_tag_label: 'the X hands', tendency_tag_leak_hint: 'X leak hint' },
  { id: 'b', type: 'decision_spot', tendency_tag: 'y', tendency_tag_label: 'the Y hands', tendency_tag_leak_hint: 'Y leak hint' },
  { id: 'c', type: 'decision_spot', tendency_tag: 'z', tendency_tag_label: 'the Z hands', tendency_tag_leak_hint: 'Z leak hint' },
]

const SUMMARY_STEP: LessonStep = {
  id: 'summary',
  type: 'tendency_summary',
  tendency_summary_intro: 'Intro text',
  summary_source_step_ids: ['a', 'b', 'c'],
}

describe('TendencySummary — reads real per-playthrough results, not a canned message', () => {
  it('shows correct/total and the positive message when everything was right', () => {
    const results = new Map<string, StepResult>([
      ['a', perfectResult()], ['b', perfectResult()], ['c', perfectResult()],
    ])
    const html = renderToStaticMarkup(
      <TendencySummary step={SUMMARY_STEP} steps={SOURCE_STEPS} resultsByStepId={results} onComplete={noop} />,
    )
    expect(html).toContain('3')
    expect(html).toContain('Strong overall.')
    expect(html).not.toContain('the X hands')
    expect(html).toContain('correctly read every category')
  })

  it('names exactly the wrong tags, with their leak hints, when some were missed', () => {
    const results = new Map<string, StepResult>([
      ['a', perfectResult()], ['b', mistakeResult()], ['c', mistakeResult()],
    ])
    const html = renderToStaticMarkup(
      <TendencySummary step={SUMMARY_STEP} steps={SOURCE_STEPS} resultsByStepId={results} onComplete={noop} />,
    )
    expect(html).not.toContain('the X hands') // 'a' was correct — not named as a leak
    expect(html).toContain('the Y hands')
    expect(html).toContain('Y leak hint')
    expect(html).toContain('the Z hands')
    expect(html).toContain('Z leak hint')
  })

  it('never fabricates a result for a source id that was never actually answered', () => {
    const results = new Map<string, StepResult>([['a', perfectResult()]]) // b, c never answered
    const html = renderToStaticMarkup(
      <TendencySummary step={SUMMARY_STEP} steps={SOURCE_STEPS} resultsByStepId={results} onComplete={noop} />,
    )
    // The fraction is rendered as `<p>1<span>/1</span></p>` — assert that exact
    // shape rather than a bare substring check (CSS classes like `border-border/30`
    // spuriously contain "/3" as a substring).
    expect(html).toMatch(/>1<span[^>]*>\/1</)
    expect(html).not.toMatch(/>1<span[^>]*>\/3</)
  })
})

describe('tendency_summary curriculum wiring — every source id resolves within its own lesson', () => {
  for (const lesson of LESSONS) {
    const summarySteps = lesson.steps.filter((s) => s.type === 'tendency_summary')
    for (const step of summarySteps) {
      it(`${lesson.id}/${step.id}: every summary_source_step_ids entry exists in the same lesson with a tendency_tag_label`, () => {
        const idsInLesson = new Set(lesson.steps.map((s) => s.id))
        const sourceIds = step.summary_source_step_ids ?? []
        expect(sourceIds.length).toBeGreaterThan(0)
        for (const id of sourceIds) {
          expect(idsInLesson.has(id), `${id} is not a real step in ${lesson.id}`).toBe(true)
          const srcStep = lesson.steps.find((s) => s.id === id)!
          expect(srcStep.tendency_tag_label, `${id} has no tendency_tag_label`).toBeTruthy()
        }
      })
    }
  }
}
)

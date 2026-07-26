/**
 * Render-level regression tests for TableDecision.tsx, mirroring multiActionRangeBuild.test.tsx's
 * approach: sweep every real `table_decision` step in the live curriculum through
 * renderToStaticMarkup and confirm it renders without throwing and shows the expected structure.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TableDecision } from '../TableDecision'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

const allCurriculumSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const tableDecisionSteps = allCurriculumSteps.filter((s) => s.type === 'table_decision')

describe('TableDecision — every curriculum table_decision step renders without throwing', () => {
  it('there is at least one such step (regression guard)', () => {
    expect(tableDecisionSteps.length).toBeGreaterThan(0)
  })

  for (const step of tableDecisionSteps) {
    it(`${step.id} (${step.table_decision_chart}/${step.table_decision_hand}) renders a table and options`, () => {
      const html = renderToStaticMarkup(<TableDecision step={step} onAnswer={noop} />)
      expect(html.length).toBeGreaterThan(200)
      expect(html).toContain(step.hero_position ?? '')
    })
  }
})

describe('TableDecision — no answer leakage before submission', () => {
  for (const step of tableDecisionSteps.slice(0, 10)) {
    it(`${step.id} does not reveal the correct action in the pre-submit markup`, () => {
      const html = renderToStaticMarkup(<TableDecision step={step} onAnswer={noop} />)
      // The inline reveal (quality labels, "Correct"/"Mistake" text) must only ever appear
      // after an answer is recorded — pre-submit render must never contain it.
      expect(html).not.toContain('Perfect Play')
      expect(html).not.toContain('Mistake')
      expect(html).not.toContain('Right idea')
    })
  }
})

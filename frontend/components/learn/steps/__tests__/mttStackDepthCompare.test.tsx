/**
 * Render-level regression tests for MttStackDepthCompare.tsx — sweeps every real
 * `mtt_stack_depth_compare` step in the live curriculum.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MttStackDepthCompare } from '../MttStackDepthCompare'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

const allCurriculumSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const compareSteps = allCurriculumSteps.filter((s) => s.type === 'mtt_stack_depth_compare')

describe('MttStackDepthCompare — every curriculum step renders without throwing', () => {
  it('there is at least one such step (regression guard)', () => {
    expect(compareSteps.length).toBeGreaterThan(0)
  })

  for (const step of compareSteps) {
    it(`${step.id} (${step.mtt_stack_depth_compare_position}) renders a 4-stop slider and grid`, () => {
      const html = renderToStaticMarkup(<MttStackDepthCompare step={step} onAnswer={noop} />)
      expect(html).toContain('15bb')
      expect(html).toContain('25bb')
      expect(html).toContain('40bb')
      expect(html).toContain('60bb')
      expect(countOccurrences(html, 'aspect-square')).toBe(169)
    })
  }
})

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1
}

/**
 * Render-level regression tests for MultiActionRangeBuild.tsx, mirroring
 * rangeBuildPrefill.test.tsx's approach (renderToStaticMarkup, no jsdom) for the
 * new multi-action (raise/limp/jam/fold) range builder introduced for the Module 3
 * MTT RFI upgrade.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MultiActionRangeBuild } from '../MultiActionRangeBuild'
import { LESSONS } from '@/lib/learn/curriculum'
import { MTT_LAB_POOL } from '@/lib/learn/mttRfiLabPool'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1
}

const allCurriculumSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const multiSteps = allCurriculumSteps.filter((s) => s.type === 'range_build_multi')

describe('MultiActionRangeBuild — every curriculum range_build_multi step renders without throwing', () => {
  it('there is at least one such step (regression guard)', () => {
    expect(multiSteps.length).toBeGreaterThan(0)
  })

  for (const step of multiSteps) {
    it(`${step.id} (${step.range_build_multi_chart}) renders a full 169-cell grid`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(countOccurrences(html, 'aspect-square')).toBe(169)
    })
  }
})

describe('MultiActionRangeBuild — prefilled foundation is visible on first paint', () => {
  const withPrefill = multiSteps.find((s) => s.range_build_multi_prefilled_key)
  it('has at least one real curriculum step with a prefilled foundation', () => {
    expect(withPrefill).toBeTruthy()
  })

  it('shows the "Reset to foundation" action and a non-zero starting Hands count', () => {
    const html = renderToStaticMarkup(<MultiActionRangeBuild step={withPrefill!} onAnswer={noop} />)
    expect(html).toContain('Reset to foundation')
    const match = html.match(/>(\d+)<\/span><span[^>]*>Hands</)
    expect(match).toBeTruthy()
    expect(Number(match![1])).toBeGreaterThan(0)
  })
})

describe('MultiActionRangeBuild — action toolbar matches the target chart\'s real action set', () => {
  for (const step of multiSteps.slice(0, 6)) {
    it(`${step.id} offers at least Raise and Fold chips`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(html).toContain('>Raise<')
      expect(html).toContain('>Fold<')
    })
  }
})

describe('MultiActionRangeBuild — Lab pool reconstruction questions render too', () => {
  const reconQuestions = MTT_LAB_POOL.filter((q) => q.category === 'reconstruction')

  it('has reconstruction questions to test', () => {
    expect(reconQuestions.length).toBeGreaterThan(0)
  })

  for (const q of reconQuestions) {
    it(`${q.id} renders without a prefilled foundation (true no-assist mastery check)`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={q.stepTemplate} onAnswer={noop} />)
      expect(countOccurrences(html, 'aspect-square')).toBe(169)
      expect(html).not.toContain('Reset to foundation')
    })
  }
})

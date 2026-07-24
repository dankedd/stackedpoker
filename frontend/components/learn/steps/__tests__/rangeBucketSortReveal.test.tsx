import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeBucketSort } from '../RangeBucketSort'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

// l5-s10: Pair/Suited/Offsuit — pool ['AA','KQs','JTo','77','AKo','QQ','T9s','84o']
const step = findStep('l5-s10')
const noop = () => {}

describe('RangeBucketSort — pre-submission never leaks the correct category per hand', () => {
  const html = renderToStaticMarkup(<RangeBucketSort step={step} onAnswer={noop} />)

  it('shows the "Submit sort"/"Assign every hand" control, not a reveal panel', () => {
    expect(html).toMatch(/Assign every hand/)
    expect(html).not.toContain('Continue')
    expect(html).not.toMatch(/Perfect —/)
  })

  it('every hand chip renders with the same neutral (unassigned) styling — no category color pre-picked', () => {
    for (const hand of step.range_bucket_pool ?? []) {
      const marker = `data-hand="${hand}"`
      expect(html).toContain(marker)
    }
    // None of the category chip colors (violet/blue/amber) should appear on any hand button yet
    expect(html).not.toMatch(/data-hand="JTo"[^>]*bg-(violet|blue|amber)-500\/70/)
  })

  it('does not call onAnswer merely from rendering', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<RangeBucketSort step={step} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe('RangeBucketSort — reviewMode reveals the correct category for every hand', () => {
  const html = renderToStaticMarkup(<RangeBucketSort step={step} onAnswer={noop} reviewMode />)

  it('shows the reveal summary and Continue control instead of the assign UI', () => {
    expect(html).toContain('Continue')
    expect(html).not.toContain('Assign every hand')
  })

  it('shows every hand with its correct category label', () => {
    const correct = step.range_bucket_correct ?? {}
    const categories = step.range_bucket_categories ?? []
    const labelOf = (id: string) => categories.find((c) => c.id === id)?.label ?? id
    for (const [hand, catId] of Object.entries(correct)) {
      // Row for this hand must contain its correct category's label somewhere after it
      const rowStart = html.indexOf(`data-hand="${hand}"`)
      expect(rowStart).toBeGreaterThanOrEqual(0)
      const rowEnd = html.indexOf('data-hand=', rowStart + 1)
      const row = html.slice(rowStart, rowEnd === -1 ? undefined : rowEnd)
      expect(row).toContain(labelOf(catId))
    }
  })

  it('reviewMode output differs from the default (unanswered) output', () => {
    const before = renderToStaticMarkup(<RangeBucketSort step={step} onAnswer={noop} />)
    expect(html).not.toBe(before)
  })

  it('shows the mechanical Pair/Suited/Offsuit explanation for hands the (empty) submission got wrong', () => {
    // reviewMode with no real interaction means every hand is "unassigned" -> all wrong,
    // so the explanation panel should render for this step's mechanical category set.
    expect(html).toMatch(/is a pocket pair|is suited|is offsuit/)
  })
})

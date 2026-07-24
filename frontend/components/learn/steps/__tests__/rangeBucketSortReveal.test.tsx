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

// Regression test for a reported bug: selecting SQUEEZE for every hand in
// "The Squeeze" (sqz-s5) rendered KQo's badge as "CALL" and marked it correct
// with no indication the learner had actually picked SQUEEZE — because the
// review row displayed the canonical best category instead of what was
// submitted. KQo is correct here (squeeze is an authored acceptable
// alternate for it), but the DOM must show what the learner picked, not a
// silently substituted answer.
describe('RangeBucketSort — reveal always displays what was actually submitted, never a substituted answer', () => {
  const sqzStep = findStep('sqz-s5')
  const allSqueeze = Object.fromEntries((sqzStep.range_bucket_pool ?? []).map((h) => [h, 'squeeze']))
  const html = renderToStaticMarkup(
    <RangeBucketSort step={sqzStep} onAnswer={noop} reviewMode initialAssignments={allSqueeze} />,
  )

  function rowFor(hand: string): string {
    const start = html.indexOf(`data-hand="${hand}"`)
    expect(start).toBeGreaterThanOrEqual(0)
    const end = html.indexOf('data-hand=', start + 1)
    return html.slice(start, end === -1 ? undefined : end)
  }

  it('reports 4 of 6 correct — AA, AKo, A5s exact matches plus KQo via its acceptable alternate — not 3 and not 6', () => {
    expect(html).toContain('4 of 6 correct')
  })

  it('KQo: badge shows SQUEEZE (what the learner picked), marked correct, with no "Correct:" caption', () => {
    const row = rowFor('KQo')
    expect(row).toContain('data-correct="true"')
    expect(row).toMatch(/SQUEEZE/i)
    expect(row).not.toMatch(/>CALL</i)
    expect(row).not.toContain('Correct:')
  })

  it('76s: badge shows SQUEEZE (what the learner picked), marked incorrect, with a "Correct: Fold" caption', () => {
    const row = rowFor('76s')
    expect(row).toContain('data-correct="false"')
    expect(row).toMatch(/SQUEEZE/i)
    expect(row).toContain('Correct:')
    expect(row).toMatch(/Fold/i)
  })

  it('92o: badge shows SQUEEZE (what the learner picked), marked incorrect, with a "Correct: Fold" caption', () => {
    const row = rowFor('92o')
    expect(row).toContain('data-correct="false"')
    expect(row).toMatch(/SQUEEZE/i)
    expect(row).toContain('Correct:')
    expect(row).toMatch(/Fold/i)
  })

  it('AA/AKo/A5s: badge shows SQUEEZE, marked correct, no "Correct:" caption', () => {
    for (const hand of ['AA', 'AKo', 'A5s']) {
      const row = rowFor(hand)
      expect(row).toContain('data-correct="true"')
      expect(row).toMatch(/SQUEEZE/i)
      expect(row).not.toContain('Correct:')
    }
  })
})

describe('RangeBucketSort — submission is frozen at "Submit sort" time, not re-derived from render state', () => {
  it('onAnswer receives exactly the assignments injected at submit time, unchanged by review rendering', () => {
    const sqzStep = findStep('sqz-s5')
    const submitted = { AA: 'squeeze', AKo: 'squeeze', A5s: 'squeeze', KQo: 'squeeze', '76s': 'squeeze', '92o': 'squeeze' }
    const onAnswer = vi.fn()
    // Render the reveal (which reads `submitted` to compute the on-screen breakdown) —
    // this must never mutate what a subsequent onAnswer(submitted, ...) call would see.
    renderToStaticMarkup(
      <RangeBucketSort step={sqzStep} onAnswer={onAnswer} reviewMode initialAssignments={submitted} />,
    )
    expect(submitted).toEqual({ AA: 'squeeze', AKo: 'squeeze', A5s: 'squeeze', KQo: 'squeeze', '76s': 'squeeze', '92o': 'squeeze' })
  })
})

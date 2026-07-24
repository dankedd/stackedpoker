/**
 * Render-level regression tests for the prefilled-foundation UI in
 * RangeBuild.tsx. Uses `renderToStaticMarkup` (no jsdom/RTL) the same way
 * module2AnswerLeakage.test.tsx does — this captures exactly what a learner
 * sees on first paint, before any effects run, which is exactly the moment
 * the foundation must already be visible and clearly marked as prefilled.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RangeBuild } from '../RangeBuild'
import { resolvePrefilledHands } from '@/lib/learn/rangePrefill'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

const stepWithFoundation: LessonStep = {
  id: 'test-btn-open',
  type: 'range_build',
  range_target: 'BTN_open_100bb',
  range_prefilled_key: 'BTN_open_foundation',
  range_prefilled_note: 'We’ve filled in the obvious opens. Now you decide how wide the Button should go.',
}

const stepWithoutFoundation: LessonStep = {
  id: 'test-co-open',
  type: 'range_build',
  range_target: 'CO_open_100bb',
}

describe('RangeBuild — prefilled foundation is visible on first paint', () => {
  it('shows the explanatory note when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('We’ve filled in the obvious opens')
  })

  it('shows a "Prefilled foundation" legend entry when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('Prefilled foundation')
  })

  it('shows a "Reset to foundation" action when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('Reset to foundation')
  })

  it('marks exactly the foundation hands as prefilled cells (dashed-border styling)', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    const foundation = resolvePrefilledHands(stepWithFoundation)
    const dashedCellCount = (html.match(/border-dashed border-amber-400\/60/g) ?? []).length
    // +1 because the legend swatch also carries the same dashed class.
    expect(dashedCellCount).toBe(foundation.length + 1)
  })

  it('starts with the stats bar already reflecting the foundation size, not zero', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    const foundation = resolvePrefilledHands(stepWithFoundation)
    expect(html).toContain(`>${foundation.length} <`)
  })
})

describe('RangeBuild — no foundation configured means no prefill UI at all (reusability guard)', () => {
  it('does not show the explanatory note, legend entry, or reset action', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithoutFoundation} onAnswer={noop} />)
    expect(html).not.toContain('Prefilled foundation')
    expect(html).not.toContain('Reset to foundation')
    expect(html).not.toContain('filled in')
  })

  it('starts with an empty grid (stats bar at zero), exactly as before this feature existed', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithoutFoundation} onAnswer={noop} />)
    expect(html).toContain('>0 <')
  })
})

describe('RangeBuild — the real fi-s7 curriculum step is wired to a foundation', () => {
  it('renders fi-s7 with its configured foundation visible up front', () => {
    const fi7 = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'fi-s7')
    expect(fi7).toBeTruthy()
    const html = renderToStaticMarkup(<RangeBuild step={fi7!} onAnswer={noop} />)
    expect(html).toContain('Prefilled foundation')
    expect(html).toContain('Reset to foundation')
  })
})

describe('RangeBuild — full curriculum sweep: every range_build step renders with the right starting hand count', () => {
  // Every step known to have a foundation wired up must render >0 hands
  // selected on first paint — this is the direct fix/regression-guard for the
  // reported bug: the CO opening-range exercise (mtc-s9, "Step 9 of 9") was
  // rendering "0 hands / 0 combos / 0.0% of range" despite the reusable
  // prefill system already existing, because no step referenced it yet.
  const stepsExpectedToStartNonEmpty = [
    'fi-s7', 'mtc-s9', 'bos-s4', 'bos-s5', 'bos-s6', 'bos-s7', 'lab-r3', 'lab-r12', 'bar-s7',
  ]
  // Documented exceptions — see INTENTIONALLY_UNPREFILLED in
  // rangePrefilledFoundation.test.ts for the reasoning behind each.
  const stepsExpectedToStartEmpty = ['bos-s3', 'sqz-s7a']

  const allCurriculumSteps = LESSONS.flatMap((l) => l.steps)

  for (const id of stepsExpectedToStartNonEmpty) {
    it(`${id} renders with hands already selected (not "0 hands / 0 combos / 0.0% of range")`, () => {
      const step = allCurriculumSteps.find((s) => s.id === id)
      expect(step, `curriculum step "${id}" not found — did it get renamed or removed?`).toBeTruthy()
      const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
      expect(html).not.toContain('>0 <')
      expect(html).not.toMatch(/>0 <[\s\S]*?hands/)
    })
  }

  for (const id of stepsExpectedToStartEmpty) {
    it(`${id} intentionally still starts empty (documented, not accidental)`, () => {
      const step = allCurriculumSteps.find((s) => s.id === id)
      expect(step, `curriculum step "${id}" not found — did it get renamed or removed?`).toBeTruthy()
      const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
      expect(html).toContain('>0 <')
    })
  }

  it('every range_build step in the curriculum is accounted for in exactly one of the two lists above', () => {
    const allRangeBuildIds = allCurriculumSteps.filter((s) => s.type === 'range_build').map((s) => s.id)
    const accountedFor = new Set([...stepsExpectedToStartNonEmpty, ...stepsExpectedToStartEmpty])
    const missing = allRangeBuildIds.filter((id) => !accountedFor.has(id))
    expect(missing, 'new range_build step(s) added without a prefill decision reflected in this test').toEqual([])
  })
})

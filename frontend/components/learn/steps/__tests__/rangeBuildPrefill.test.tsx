/**
 * Render-level regression tests for RangeBuild.tsx — both the prefilled-
 * foundation UI and the redesigned 13x13 matrix itself. Uses
 * `renderToStaticMarkup` (no jsdom/RTL) the same way module2AnswerLeakage.test.tsx
 * does — this captures exactly what a learner sees on first paint, before any
 * effects run, which is exactly the moment the foundation must already be
 * visible and the grid must already be a complete, uniform 13x13 matrix.
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

// Cell-state markers — exact class substrings unique to each cell state
// (verified to not collide with the legend swatches, which use a different
// class-token order). Used to count how many of the 169 cells are in each
// visual state without depending on a real browser/layout engine.
const PREFILLED_CELL_MARK = 'bg-violet-500/20 border-violet-400/30 text-violet-100'
const SELECTED_CELL_MARK = 'bg-blue-500 border-blue-400/40 text-white font-bold'
const GRID_TEMPLATE_MARK = 'grid-cols-[1.75rem_repeat(13,minmax(2rem,1fr))]'

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1
}

/** Reads a RangeStat tile's value by structural adjacency (value span
 *  immediately followed by its label span), independent of exact class names. */
function readStat(html: string, label: string): string {
  const match = html.match(new RegExp(`>([^<]*)</span><span[^>]*>${label}<`))
  if (!match) throw new Error(`Stat "${label}" not found in rendered HTML`)
  return match[1]
}

describe('RangeBuild — the 13x13 matrix is one mathematically consistent grid', () => {
  it('renders exactly 169 data cells, all sharing the aspect-square class', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(countOccurrences(html, 'aspect-square')).toBe(169)
  })

  it('uses exactly one shared grid-template-columns definition for the whole matrix', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(countOccurrences(html, GRID_TEMPLATE_MARK)).toBe(1)
  })

  it('renders exactly 13 column-header labels and 13 row labels (A K Q J T 9 8 7 6 5 4 3 2)', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    const labelClass = 'flex items-center justify-center text-[10px] font-semibold text-muted-foreground/45'
    // 13 column headers + 13 row labels = 26 label cells total.
    expect(countOccurrences(html, `class="${labelClass}"`)).toBe(26)
  })

  it('every data cell is a real <button> (keyboard/focus accessible), not a bare <div>', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    // 169 cells + 1 submit + 2 toolbar actions (foundation present, so both show).
    expect(countOccurrences(html, '<button')).toBe(172)
  })
})

describe('RangeBuild — prefilled foundation is visible on first paint', () => {
  it('shows the explanatory note when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('We’ve filled in the obvious opens')
  })

  it('shows a "Foundation" legend entry when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('Foundation')
    expect(html).toContain('Your selection')
    expect(html).toContain('Not selected')
  })

  it('shows a "Reset to foundation" action when a foundation is configured', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('Reset to foundation')
  })

  it('marks exactly the foundation hands as prefilled cells, and none as user-selected yet', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    const foundation = resolvePrefilledHands(stepWithFoundation)
    expect(countOccurrences(html, PREFILLED_CELL_MARK)).toBe(foundation.length)
    expect(countOccurrences(html, SELECTED_CELL_MARK)).toBe(0)
  })

  it('starts with the stats bar already reflecting the foundation size, not zero', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    const foundation = resolvePrefilledHands(stepWithFoundation)
    expect(readStat(html, 'Hands')).toBe(String(foundation.length))
  })
})

describe('RangeBuild — no foundation configured means no prefill UI at all (reusability guard)', () => {
  it('does not show the explanatory note, "Foundation" legend entry, or reset action', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithoutFoundation} onAnswer={noop} />)
    expect(html).not.toContain('Foundation')
    expect(html).not.toContain('Reset to foundation')
    expect(html).not.toContain('filled in')
    expect(countOccurrences(html, PREFILLED_CELL_MARK)).toBe(0)
  })

  it('starts with an empty grid (Hands stat at zero), exactly as before this feature existed', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithoutFoundation} onAnswer={noop} />)
    expect(readStat(html, 'Hands')).toBe('0')
  })
})

describe('RangeBuild — the real fi-s7 curriculum step is wired to a foundation', () => {
  it('renders fi-s7 with its configured foundation visible up front', () => {
    const fi7 = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'fi-s7')
    expect(fi7).toBeTruthy()
    const html = renderToStaticMarkup(<RangeBuild step={fi7!} onAnswer={noop} />)
    expect(html).toContain('Foundation')
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
    it(`${id} renders with hands already selected (not "0 hands / 0 combos / 0.0%")`, () => {
      const step = allCurriculumSteps.find((s) => s.id === id)
      expect(step, `curriculum step "${id}" not found — did it get renamed or removed?`).toBeTruthy()
      const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
      expect(Number(readStat(html, 'Hands'))).toBeGreaterThan(0)
    })
  }

  for (const id of stepsExpectedToStartEmpty) {
    it(`${id} intentionally still starts empty (documented, not accidental)`, () => {
      const step = allCurriculumSteps.find((s) => s.id === id)
      expect(step, `curriculum step "${id}" not found — did it get renamed or removed?`).toBeTruthy()
      const html = renderToStaticMarkup(<RangeBuild step={step!} onAnswer={noop} />)
      expect(readStat(html, 'Hands')).toBe('0')
    })
  }

  it('every range_build step in the curriculum is accounted for in exactly one of the two lists above', () => {
    const allRangeBuildIds = allCurriculumSteps.filter((s) => s.type === 'range_build').map((s) => s.id)
    const accountedFor = new Set([...stepsExpectedToStartNonEmpty, ...stepsExpectedToStartEmpty])
    const missing = allRangeBuildIds.filter((id) => !accountedFor.has(id))
    expect(missing, 'new range_build step(s) added without a prefill decision reflected in this test').toEqual([])
  })
})

describe('RangeBuild — stat wording is not misleading (requirement: audit the % label)', () => {
  it('labels the combo-mass percentage "Range width", not something implying "% of the correct answer"', () => {
    const html = renderToStaticMarkup(<RangeBuild step={stepWithFoundation} onAnswer={noop} />)
    expect(html).toContain('Range width')
    expect(html).not.toContain('% of range')
  })
})

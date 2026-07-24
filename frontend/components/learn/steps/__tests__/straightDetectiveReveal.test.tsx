import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StraightDetective } from '../StraightDetective'
import { classifyFlop } from '@/lib/learn/flopClassifier'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

// fl4-s7: board K-T-9, one real straight-completing pair (Q-J), decoys J-8 and A-J
const step = findStep('fl4-s7')
const noop = () => {}

describe('fl4-s7 fixture sanity', () => {
  it('has exactly one real possible-straight combo on this board', () => {
    const real = classifyFlop(['Ks', 'Th', '9d']).possibleFloppedStraights.combos
    expect(real).toHaveLength(1)
    expect(real[0].sort()).toEqual(['J', 'Q'])
  })
})

describe('StraightDetective — pre-submission never leaks which pair is correct', () => {
  const html = renderToStaticMarkup(<StraightDetective step={step} onAnswer={noop} />)

  it('shows "Submit", not the reveal panel', () => {
    expect(html).toContain('Submit')
    expect(html).not.toContain('Continue')
    expect(html).not.toMatch(/Missed|Shouldn't be flagged/)
  })

  it('every candidate button shares identical unselected styling', () => {
    const classAttrs = [...html.matchAll(/data-candidate-id="[^"]*"[^>]*class="([^"]*)"/g)].map((m) => m[1])
    expect(classAttrs.length).toBeGreaterThan(1)
    expect(new Set(classAttrs).size).toBe(1)
  })

  it('does not call onAnswer merely from rendering', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<StraightDetective step={step} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe('StraightDetective — reviewMode reveals correctness per candidate', () => {
  const html = renderToStaticMarkup(<StraightDetective step={step} onAnswer={noop} reviewMode />)

  it('shows the Continue control instead of Submit', () => {
    expect(html).toContain('Continue')
    expect(html).not.toContain('>Submit<')
  })

  it('flags the real straight-completing pair (Q-J) as "missed" when nothing was selected', () => {
    // reviewMode with no interaction means the frozen selection is empty, so
    // the one real answer should render as a missed true item.
    expect(html).toMatch(/Missed — completes a straight/)
  })

  it('reviewMode output differs from the default (unanswered) output', () => {
    const before = renderToStaticMarkup(<StraightDetective step={step} onAnswer={noop} />)
    expect(html).not.toBe(before)
  })
})

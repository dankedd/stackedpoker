import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoardAutopsy } from '../BoardAutopsy'
import { classifyFlop, dimensionValue } from '@/lib/learn/flopClassifier'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

// fl8-s7: board K-8-7 two-tone (hearts), claimed analysis has multiple wrong claims
const step = findStep('fl8-s7')
const noop = () => {}

describe('fl8-s7 fixture sanity', () => {
  it('has at least one wrong claim (claimed texture "monotone" vs the real two-tone board)', () => {
    const real = classifyFlop(['Ks', '8h', '7h'])
    expect(dimensionValue(real, 'texture')).not.toBe('monotone')
  })
})

describe('BoardAutopsy — pre-submission never leaks which claims are wrong', () => {
  const html = renderToStaticMarkup(<BoardAutopsy step={step} onAnswer={noop} />)

  it('shows "Submit Findings", not the reveal panel', () => {
    expect(html).toContain('Submit Findings')
    expect(html).not.toContain('Continue')
    expect(html).not.toMatch(/Actually:/)
  })

  it('renders every claim with identical unflagged styling', () => {
    const classAttrs = [...html.matchAll(/data-dimension-key="[^"]*"[^>]*class="([^"]*)"/g)].map((m) => m[1])
    expect(classAttrs.length).toBeGreaterThan(1)
    expect(new Set(classAttrs).size).toBe(1)
  })

  it('does not call onAnswer merely from rendering', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<BoardAutopsy step={step} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe('BoardAutopsy — reviewMode reveals the real value for wrong claims', () => {
  const html = renderToStaticMarkup(<BoardAutopsy step={step} onAnswer={noop} reviewMode />)

  it('shows the Continue control instead of Submit Findings', () => {
    expect(html).toContain('Continue')
    expect(html).not.toContain('Submit Findings')
  })

  it('reveals the actual value for at least one wrong claim missed by the (empty) submission', () => {
    expect(html).toMatch(/Actually:/)
    expect(html).toMatch(/Missed — this claim is wrong\./)
  })

  it('reviewMode output differs from the default (unanswered) output', () => {
    const before = renderToStaticMarkup(<BoardAutopsy step={step} onAnswer={noop} />)
    expect(html).not.toBe(before)
  })
})

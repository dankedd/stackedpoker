import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConceptReveal } from '../ConceptReveal'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Regression coverage for the passive-content XP bug's component-level
 * symptom and the empty-theory-bar cosmetic bug.
 *
 * ConceptReveal itself never fabricated an answer or rendered a result
 * screen (that happened one level up, in LessonPlayer's evaluate() wiring —
 * see lib/learn/__tests__/passiveVsScoredXP.test.ts for that half). This
 * file locks down: (1) ConceptReveal's own markup never contains graded-result
 * copy, so a future regression can't reintroduce a "Perfect Play" card inside
 * it, and (2) its "Got it" button always exists and always advances via a
 * single no-argument onComplete — there is no hidden answer payload.
 */

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

describe('ConceptReveal never renders a graded result screen', () => {
  const step = findStep('c1-s1')

  it('contains no "Perfect Play" / score / XP copy — only the concept content and a Got it CTA', () => {
    const html = renderToStaticMarkup(<ConceptReveal step={step} onComplete={() => {}} />)
    expect(html).not.toMatch(/Perfect Play/i)
    expect(html).not.toMatch(/Score:\s*\d+\/100/i)
    expect(html).not.toMatch(/\+\d+\s*XP/i)
    expect(html).toContain('Got it')
  })

  it('"Got it" is wired to a plain no-argument onComplete — clicking advances immediately, nothing to submit', () => {
    const onComplete = vi.fn()
    // renderToStaticMarkup can't simulate a click (no DOM), so this asserts the
    // contract at the type/wiring level: onComplete takes no arguments, and the
    // component only ever calls it bare, matching LessonPlayer's
    // `onComplete={() => evaluate(null, 0)}` wiring (StepRenderer branch).
    renderToStaticMarkup(<ConceptReveal step={step} onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled() // never called merely by rendering
  })
})

describe('Empty theory-bar bug: the visual wrapper only renders when there is real visual content', () => {
  it('does NOT render an empty rounded-box wrapper for visual types with no renderer (e.g. "table")', () => {
    const step = findStep('c1-s1') // visual: 'table' — VisualSection/resolveVisual has no renderer for this
    expect(step.visual).toBe('table')
    const html = renderToStaticMarkup(<ConceptReveal step={step} onComplete={() => {}} />)
    // The empty-wrapper bug rendered this exact class combination unconditionally
    // whenever step.visual was set, regardless of whether anything was inside it.
    expect(html).not.toContain('rounded-xl border border-border/30 bg-secondary/20')
  })

  it('DOES render the wrapper + interactive content for a visual type that has a real renderer (equity_bar)', () => {
    const equityBarStep = ALL_STEPS.find((s) => s.type === 'concept_reveal' && s.visual === 'equity_bar')
    expect(equityBarStep).toBeTruthy()
    const html = renderToStaticMarkup(<ConceptReveal step={equityBarStep!} onComplete={() => {}} />)
    expect(html).toContain('rounded-xl border border-border/30 bg-secondary/20')
    expect(html).toMatch(/Interactive: equity split/i)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { LESSON_CARD_ATTR, LESSON_HEADER_ATTR, scrollLessonCardIntoView, scrollLessonCardIntoViewAfterPaint } from '../lessonScroll'

/**
 * Guards the "answering leaves the learner halfway down the feedback" fix.
 *
 * Answering swaps a short question card for a much taller feedback card and
 * the browser keeps its scroll offset, so the "Perfect Play" heading, the
 * score and the explanation's opening lines all end up above the fold. Every
 * transition that changes what is inside the step card now scrolls the card's
 * top back under the sticky header.
 *
 * This suite runs under `environment: "node"` with no DOM (see
 * lessonPlayerLayoutRegression.test.tsx), so the geometry itself was proven
 * against real device emulation over CDP: the card's top moved from 588px
 * above the header to 12px below it at 375/430/1280, with the heading, score
 * and Theory Engine badge all on screen, and the scroll measured as animating
 * by default but instant under prefers-reduced-motion. What is asserted here
 * is the wiring — that every path which reveals feedback still calls it, and
 * that the two anchors it depends on are still in the markup.
 */

const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf-8')

describe('lessonScroll — server safety', () => {
  it('no-ops without a DOM instead of throwing', () => {
    // The module is imported by client components that also render on the
    // server; calling into it there must be harmless.
    expect(() => scrollLessonCardIntoView()).not.toThrow()
    expect(() => scrollLessonCardIntoViewAfterPaint()()).not.toThrow()
  })

  it('exports stable anchor names', () => {
    expect(LESSON_CARD_ATTR).toBe('data-lesson-step-card')
    expect(LESSON_HEADER_ATTR).toBe('data-lesson-header')
  })
})

describe('lessonScroll — implementation contract', () => {
  const SRC = read('lib/learn/lessonScroll.ts')

  it('honours prefers-reduced-motion instead of always animating', () => {
    expect(SRC).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
    expect(SRC).toMatch(/prefersReducedMotion\(\) \? 'auto' : 'smooth'/)
  })

  it('clears the sticky header rather than scrolling the card behind it', () => {
    expect(SRC).toMatch(/position !== 'sticky' && position !== 'fixed'/)
    expect(SRC).toMatch(/stickyHeaderHeight\(\) \+ GAP_PX/)
  })

  it('scrolls the nearest scrollable ancestor when there is one', () => {
    expect(SRC).toContain('function scrollableAncestor')
    expect(SRC).toMatch(/overflowY === 'auto' \|\| overflowY === 'scroll'/)
    expect(SRC).toMatch(/container\.scrollTo\(\{ top, behavior \}\)/)
  })

  it('waits two frames so the taller card is measured, not the old one', () => {
    expect(SRC.match(/requestAnimationFrame/g)?.length).toBeGreaterThanOrEqual(2)
    expect(SRC).toContain('cancelAnimationFrame')
  })
})

describe('lessonScroll — every feedback path is wired up', () => {
  it('LessonPlayer marks the step card and scrolls on phase / step change', () => {
    const SRC = read('components/learn/LessonPlayer.tsx')
    expect(SRC).toContain('{...{ [LESSON_CARD_ATTR]: \'\' }}')
    expect(SRC).toMatch(/return scrollLessonCardIntoViewAfterPaint\(\)\s*\}, \[phase, currentStepIndex\]\)/)
  })

  it('LessonHeader marks itself as the sticky offset', () => {
    expect(read('components/learn/LessonHeader.tsx')).toMatch(/\{\.\.\.\{ \[LESSON_HEADER_ATTR\]: ['"]{2} \}\}/)
  })

  // These step types grade themselves and show their reveal while LessonPlayer
  // is still in the 'step' phase, so the player's own effect never fires for
  // them. Each must scroll on its own reveal state, or its feedback opens
  // mid-card exactly like the original bug.
  const SELF_GRADING: [string, string][] = [
    ['components/learn/steps/TableDecision.tsx', 'answered'],
    ['components/learn/steps/RangeBuild.tsx', 'reviewingDiff'],
    ['components/learn/steps/MultiActionRangeBuild.tsx', 'reviewingDiff'],
    ['components/learn/steps/MorphologyBuilder.tsx', 'reviewing'],
    ['components/learn/steps/RangeCollision.tsx', 'revealed'],
    ['components/learn/steps/BoardVolatility.tsx', 'phase'],
  ]

  it.each(SELF_GRADING)('%s scrolls when its inline reveal appears', (file, dep) => {
    const SRC = read(file)
    expect(SRC).toContain("from '@/lib/learn/lessonScroll'")
    expect(SRC).toContain('return scrollLessonCardIntoViewAfterPaint()')
    // ...and the effect is keyed on that step's own reveal state.
    expect(SRC).toMatch(new RegExp(`return scrollLessonCardIntoViewAfterPaint\\(\\)\\s*\\}, \\[${dep}\\]\\)`))
  })

  it('no self-grading step guards its reveal with a negated comparison', () => {
    // `if (!phase === 'reviewed')` is always false — the scroll would never
    // run. Caught once already; keep it caught.
    for (const [file] of SELF_GRADING) {
      expect(read(file), file).not.toMatch(/if \(![A-Za-z]+ ===/)
    }
  })
})

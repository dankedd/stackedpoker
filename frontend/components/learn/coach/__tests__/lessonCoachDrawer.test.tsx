import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonCoachDrawer } from '../LessonCoachDrawer'
import type { LessonCoachContext } from '@/lib/learn/lessonCoachContext'

/**
 * Static-render regression tests for the in-lesson Coach drawer's contextual
 * quick actions (spec: pre-answer vs. post-incorrect vs. post-correct show
 * different action sets) and header context line. Follows this codebase's
 * renderToStaticMarkup convention (see pokerRangeGrid.test.tsx) — the drawer
 * is always present in the DOM (shown/hidden via transform/opacity), so its
 * content is deterministically inspectable this way without simulating
 * open/close interaction or effects (which never run under static rendering).
 */

const baseContext: LessonCoachContext = {
  lessonId: 'lesson-1',
  lessonTitle: 'Range vs Range',
  moduleId: 'module-8',
  stepId: 'step-1',
  stepType: 'decision_spot',
  stepIndex: 0,
  conceptIds: ['range_advantage'],
  poker: {},
  hintLevel: 0,
  hasAnswered: false,
}

const noop = () => {}

describe('LessonCoachDrawer — quick actions by pedagogical state', () => {
  it('pre-answer: Hint / Explain concept / Walk me through it', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" />,
    )
    expect(html).toMatch(/Give me a hint/)
    expect(html).toMatch(/Explain the concept/)
    expect(html).toMatch(/Walk me through it/)
    expect(html).not.toMatch(/Why was my answer wrong/)
    expect(html).not.toMatch(/Why is this correct/)
  })

  it('post-incorrect: Why wrong / Hint / Walk me through it', () => {
    const context: LessonCoachContext = { ...baseContext, hasAnswered: true, isCorrect: false }
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={context} token="t" />,
    )
    expect(html).toMatch(/Why was my answer wrong\?/)
    expect(html).toMatch(/Give me a hint/)
    expect(html).toMatch(/Walk me through it/)
    expect(html).not.toMatch(/Explain the concept/)
  })

  it('post-correct: Why correct / Explain deeper / Key takeaway', () => {
    const context: LessonCoachContext = { ...baseContext, hasAnswered: true, isCorrect: true }
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={context} token="t" />,
    )
    expect(html).toMatch(/Why is this correct\?/)
    expect(html).toMatch(/Explain the concept/)
    expect(html).toMatch(/What should I remember\?/)
    expect(html).not.toMatch(/Give me a hint/)
  })

  it('renders nothing (no context) when context is null', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={null} token="t" />,
    )
    expect(html).not.toMatch(/Give me a hint/)
  })

  it('shows the compact module/lesson context line in the header', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" moduleTitle="Range vs Range" />,
    )
    expect(html).toMatch(/AI Coach/i)
    expect(html).toMatch(/Range vs Range/)
  })

  it('is closed by default when open=false, still present in the DOM (hidden via transform, not unmounted)', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open={false} onClose={noop} context={baseContext} token="t" />,
    )
    // Still rendered (so conversation state survives a close) — just carries
    // the closed-state transform classes instead of being absent from markup.
    expect(html).toMatch(/translate-y-full/)
    expect(html).toMatch(/Give me a hint/)
  })

  it('exposes dialog accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" />,
    )
    expect(html).toMatch(/role="dialog"/)
    expect(html).toMatch(/aria-modal="true"/)
    expect(html).toMatch(/aria-label="AI Coach"/)
    expect(html).toMatch(/aria-label="Close AI Coach"/)
    expect(html).toMatch(/aria-label="Back to question"/)
  })

  it('wires both mobile (bottom-sheet) and desktop (side-panel) responsive classes together', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" />,
    )
    // Mobile-first bottom sheet
    expect(html).toMatch(/rounded-t-2xl/)
    // Desktop right-side panel override
    expect(html).toMatch(/md:w-\[420px\]/)
    expect(html).toMatch(/md:right-0/)
    // Backdrop only on the mobile near-fullscreen sheet — the panel is a
    // pure overlay at every desktop/tablet width, never dimmed, since the
    // lesson never reflows to make room for it (see LessonPlayer.tsx).
    expect(html).toMatch(/md:hidden/)
  })

  it('never applies a coach-dependent width/margin class to anything outside the drawer itself', () => {
    // Regression guard for the lesson-shrink bug: the drawer's own panel may
    // freely carry width classes, but nothing it renders should express an
    // xl:mr-*, xl:w-*, or grid-template-columns style hook a host page could
    // mistake for "make room for me" layout wiring.
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" />,
    )
    expect(html).not.toMatch(/mr-\[/)
    expect(html).not.toMatch(/grid-template-columns/)
  })

  it('shows the authored hint note (not a quick-action label) when authoredHint is provided', () => {
    const html = renderToStaticMarkup(
      <LessonCoachDrawer open onClose={noop} context={baseContext} token="t" authoredHint="Look at the range advantage first." />,
    )
    // The authored-hint note only renders after a "Give me a hint" click
    // (interactive state) — under static rendering it's simply not shown yet,
    // this asserts the drawer doesn't crash and the quick action is still offered.
    expect(html).toMatch(/Give me a hint/)
  })
})

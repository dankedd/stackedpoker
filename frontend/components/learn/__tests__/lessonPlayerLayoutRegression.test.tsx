import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Regression guard for the "opening the AI Coach shrinks the lesson" bug.
 *
 * Root cause was `coachOpen && 'xl:mr-[420px]'` on the lesson content
 * wrapper in LessonPlayer.tsx — a margin-right applied to the whole lesson
 * whenever the drawer was open, reflowing the question card/answer grid.
 * The fix makes the drawer a pure overlay at every width, so the wrapper's
 * class list must never again depend on `coachOpen`.
 *
 * This is a source-level check rather than a rendered/measured-layout test:
 * LessonPlayer pulls in ~70 step-type components and renders no differently
 * for `coachOpen` (it's internal presentation state, not a prop), so there
 * is no way to render both the open and closed variant side-by-side and
 * diff real computed CSS widths without a live browser — this project's
 * test suite runs under Node (renderToStaticMarkup / vitest `environment:
 * "node"`), with no jsdom or Playwright wired into `npm run test`. The
 * actual pixel-width proof for this fix was done manually with Playwright
 * against a real dev server (see the implementation report); this test is
 * the fast, durable, CI-friendly guard against the bug quietly coming back.
 */

const SOURCE = readFileSync(
  path.resolve(__dirname, '../LessonPlayer.tsx'),
  'utf-8',
)

describe('LessonPlayer — lesson layout never depends on coachOpen', () => {
  it('does not reintroduce the exact removed margin-push class', () => {
    expect(SOURCE).not.toMatch(/xl:mr-\[420px\]/)
  })

  it('coachOpen is never combined with a width/margin/grid-affecting class', () => {
    // Catches the bug pattern in general, not just the one literal string
    // above — any `coachOpen && '...'` (or `coachOpen ? '...' : '...'`)
    // expression containing a margin/width/grid-template class would shrink
    // or reflow the lesson exactly the way the original bug did.
    const dangerousPattern = /coachOpen\s*(&&|\?)[^\n]{0,120}\b(mr-|ml-|w-\[|max-w-|grid-template-columns)/
    expect(SOURCE).not.toMatch(dangerousPattern)
  })

  it('the lesson content wrapper is a static class list, not conditioned on coachOpen', () => {
    // The specific div this bug lived on — asserts it's back to a plain,
    // unconditional className (no cn(...) call mixing in coachOpen at all).
    expect(SOURCE).toMatch(/<div className="flex flex-col gap-5">/)
  })
})

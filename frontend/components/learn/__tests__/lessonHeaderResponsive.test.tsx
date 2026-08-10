import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'fs'
import path from 'path'
import { LessonHeader, LessonStatusHeader } from '../LessonHeader'

/**
 * Guards the mobile lesson-header redesign.
 *
 * The old header was one 3-column desktop row squeezed into a phone: the back
 * label clipped, the title fought the step dots for the middle column, and the
 * dot row was too small to read. The redesign renders two distinct layouts —
 * a mobile stack (nav row / centered title / "Step n of N" + full-width bar)
 * and the untouched desktop grid — swapped with `sm:hidden` / `hidden sm:grid`.
 *
 * These are markup/class assertions rather than measured layout: this suite
 * runs under `environment: "node"` with renderToStaticMarkup and no jsdom or
 * browser, so computed widths cannot be read here (same constraint documented
 * in lessonPlayerLayoutRegression.test.tsx). What they *can* prove is that the
 * two branches exist, that neither leaks into the other's breakpoint, and that
 * the touch-target and progress-bar contracts survive future edits.
 */

const html = renderToStaticMarkup(
  <LessonHeader
    backHref="/learn/module/preflop-fundamentals"
    backLabel="Preflop Fundamentals"
    title="Defending as CO"
    currentStep={4}
    totalSteps={14}
    xpReward={220}
  />,
)

/** The `sm:hidden` block — everything a phone sees. */
function mobileBranch(markup: string): string {
  const start = markup.indexOf('sm:hidden')
  const end = markup.indexOf('hidden sm:grid')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return markup.slice(start, end)
}

/** The `hidden sm:grid` block — everything a desktop sees. */
function desktopBranch(markup: string): string {
  const start = markup.indexOf('hidden sm:grid')
  expect(start).toBeGreaterThan(-1)
  return markup.slice(start)
}

describe('LessonHeader — mobile layout', () => {
  const mobile = mobileBranch(html)

  it('states the step position as words, not a row of dots', () => {
    expect(mobile).toContain('Step 5 of 14')
  })

  it('shows completion as a percentage that counts the step on screen', () => {
    // 5/14 = 35.7% -> 36%. A completed-steps-only ratio would read 29% here,
    // which contradicts the "Step 5 of 14" sitting next to it.
    expect(mobile).toContain('36% Complete')
  })

  it('renders exactly one progress bar, driven by that same percentage', () => {
    expect(mobile).toContain('role="progressbar"')
    expect(mobile).toContain('aria-valuenow="36"')
    expect(mobile.match(/role="progressbar"/g)).toHaveLength(1)
    expect(mobile).toContain('width:36%')
  })

  it('never renders the per-step dot row', () => {
    // The dots' signature classes — the current-step dot's glow ring and the
    // completed-step pill. Neither may appear in the mobile branch.
    expect(mobile).not.toContain('ring-violet-400/30')
    expect(mobile).not.toContain('h-1.5 w-4 bg-violet-500')
    // ...and the desktop branch must still have them.
    expect(desktopBranch(html)).toContain('ring-violet-400/30')
  })

  it('gives the back control a >=44px touch target and a label that always fits', () => {
    expect(mobile).toContain('min-h-[44px]')
    expect(mobile).toContain('min-w-[44px]')
    expect(mobile).toContain('>Back<')
    // The module title is the one label with no width guarantee at 320px, so
    // it must not be what the mobile back control tries to print.
    expect(mobile).not.toContain('Preflop Fundamentals')
  })

  it('shows the XP award on the nav row', () => {
    expect(mobile).toContain('220 XP')
  })

  it('lets a long title wrap to two lines instead of truncating to one', () => {
    expect(mobile).toContain('line-clamp-2')
    expect(mobile).not.toContain('truncate')
  })
})

describe('LessonHeader — desktop layout is untouched', () => {
  const desktop = desktopBranch(html)

  it('keeps the 3-column grid that centers the title', () => {
    expect(desktop).toContain('grid-cols-[1fr_auto_1fr]')
  })

  it('keeps the module title as the back label, truncated', () => {
    expect(desktop).toContain('Preflop Fundamentals')
    expect(desktop).toContain('truncate')
  })

  it('keeps the dots and their "5 / 14" counter', () => {
    expect(desktop).toContain('ring-violet-400/30')
    expect(desktop).toContain('5 / 14')
  })

  it('never renders the mobile bar or its wording', () => {
    expect(desktop).not.toContain('role="progressbar"')
    expect(desktop).not.toContain('Step 5 of 14')
  })
})

describe('LessonHeader — edge cases that must not break the bar', () => {
  it('clamps an injected step index past the authored count', () => {
    const over = renderToStaticMarkup(
      <LessonHeader
        backHref="/learn"
        backLabel="Modules"
        title="Adaptive lesson"
        currentStep={17}
        totalSteps={14}
        xpReward={80}
      />,
    )
    const mobile = mobileBranch(over)
    expect(mobile).toContain('Step 14 of 14')
    expect(mobile).toContain('100% Complete')
    expect(mobile).toContain('width:100%')
  })

  it('does not divide by zero on a lesson with no steps', () => {
    const empty = renderToStaticMarkup(
      <LessonHeader
        backHref="/learn"
        backLabel="Modules"
        title="Empty"
        currentStep={0}
        totalSteps={0}
        xpReward={0}
      />,
    )
    expect(empty).toContain('0% Complete')
    expect(empty).not.toContain('NaN')
  })
})

describe('LessonStatusHeader — completion screen', () => {
  const status = renderToStaticMarkup(
    <LessonStatusHeader backHref="/learn/module/x" backLabel="Preflop Fundamentals" status="Complete" />,
  )

  it('uses the same 44px mobile back target as the lesson header', () => {
    expect(status).toContain('min-h-[44px]')
  })

  it('keeps the module title on desktop only', () => {
    const [mobileHalf, desktopHalf] = status.split('hidden min-w-0 sm:block')
    expect(mobileHalf).toContain('>Back<')
    expect(mobileHalf).not.toContain('Preflop Fundamentals')
    expect(desktopHalf).toContain('Preflop Fundamentals')
  })

  it('still shows the status word', () => {
    expect(status).toContain('Complete')
  })
})

describe('LessonPlayer — no duplicate progress readout on mobile', () => {
  const SOURCE = readFileSync(path.resolve(__dirname, '../LessonPlayer.tsx'), 'utf-8')

  it("hides the in-lesson progress bar below `sm:`, where the header's bar already says the same thing", () => {
    expect(SOURCE).toMatch(/<ProgressBar[\s\S]{0,200}className="hidden sm:block flex-1"/)
  })
})

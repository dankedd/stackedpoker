import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'fs'
import path from 'path'
import { ConceptPopover, CONCEPT_DATA } from '../ConceptPopover'

/**
 * Guards the mobile concept-tooltip interaction.
 *
 * The tag used to open one thing at every width: a 288px popover absolutely
 * positioned at the badge's bottom-left. On a phone that panel is wider than
 * the space to the right of most tags, lives inside lesson cards that clip and
 * scroll, and pulls the eye away from the tapped concept. Below 640px it is now
 * a centred modal dialog portalled to <body>.
 *
 * The open state cannot be rendered here — it needs a click, matchMedia and a
 * DOM portal, and this suite runs under `environment: "node"` with no jsdom
 * (see lessonPlayerLayoutRegression.test.tsx). So: the closed trigger is
 * asserted by rendering, and the modal contract by reading the source. The
 * behavioural proof (centring, 89-91% width, focus in/out, Escape, scroll
 * containment) was done against real device emulation over CDP.
 */

const SOURCE = readFileSync(path.resolve(__dirname, '../ConceptPopover.tsx'), 'utf-8')

describe('ConceptPopover — trigger', () => {
  const html = renderToStaticMarkup(<ConceptPopover conceptId="mdf" />)

  it('announces that it opens a dialog', () => {
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('renders the concept name', () => {
    expect(html).toContain(CONCEPT_DATA.mdf.title)
  })

  it('renders nothing at all for an unknown concept id', () => {
    expect(renderToStaticMarkup(<ConceptPopover conceptId="not_a_real_concept" />)).toBe('')
  })

  it('ships no panel markup until it is opened', () => {
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain(CONCEPT_DATA.mdf.summary)
  })
})

describe('ConceptPopover — mobile modal contract', () => {
  it('chooses the presentation from the 640px breakpoint', () => {
    expect(SOURCE).toContain("const MOBILE_QUERY = '(max-width: 639px)'")
    expect(SOURCE).toMatch(/window\.matchMedia\(MOBILE_QUERY\)/)
    // ...and keeps following it while open, so a rotation swaps the variant.
    expect(SOURCE).toMatch(/mql\.addEventListener\('change'/)
  })

  it('portals the modal out of the clipping lesson card', () => {
    expect(SOURCE).toMatch(/createPortal\([\s\S]*document\.body/)
  })

  it('is a labelled, modal dialog', () => {
    expect(SOURCE).toContain('role="dialog"')
    expect(SOURCE).toContain('aria-modal="true"')
    expect(SOURCE).toContain('aria-labelledby={titleId}')
    expect(SOURCE).toContain('aria-describedby={descId}')
  })

  it('centres the card and caps it to the safe viewport', () => {
    expect(SOURCE).toContain('fixed inset-0 z-[100] flex items-center justify-center')
    expect(SOURCE).toContain('w-full max-w-sm max-h-full')
    expect(SOURCE).toContain('env(safe-area-inset-top)')
    expect(SOURCE).toContain('env(safe-area-inset-bottom)')
  })

  it('scrolls only the explanation, never the title or the Close button', () => {
    expect(SOURCE).toContain('min-h-0 flex-1 overflow-y-auto')
    // Header and footer are explicitly non-shrinking siblings.
    expect(SOURCE).toMatch(/flex shrink-0 items-center gap-3/)
    expect(SOURCE).toMatch(/shrink-0 p-3/)
  })

  it('animates in with fade + scale', () => {
    expect(SOURCE).toContain('animate-in fade-in zoom-in-95')
  })

  it('dismisses on Escape, on Close, and on a tap outside', () => {
    expect(SOURCE).toMatch(/e\.key === 'Escape'/)
    expect(SOURCE).toMatch(/if \(e\.target === e\.currentTarget\) close\(\)/)
    expect(SOURCE).toMatch(/onClick=\{close\}/)
  })

  it('gives Close a 44px touch target', () => {
    expect(SOURCE).toMatch(/min-h-\[44px\] w-full/)
  })

  it('traps focus while open and restores it to the tapped concept', () => {
    expect(SOURCE).toMatch(/e\.key !== 'Tab' \|\| !isMobile/)
    expect(SOURCE).toMatch(/restoreTo\?\.focus\?\.\(\)/)
  })

  it('highlights the tapped concept while its modal is up', () => {
    expect(SOURCE).toMatch(/showModal && 'ring-2/)
  })

  it('locks the page behind the modal and restores the previous value', () => {
    expect(SOURCE).toMatch(/document\.body\.style\.overflow = 'hidden'/)
    expect(SOURCE).toMatch(/document\.body\.style\.overflow = overflow/)
  })
})

describe('ConceptPopover — desktop popover is untouched', () => {
  it('keeps the anchored 288px panel for >=640px', () => {
    expect(SOURCE).toContain("'absolute z-50 left-0 top-full mt-2 w-72 rounded-2xl border border-border/60'")
    expect(SOURCE).toContain('{open && !isMobile && (')
  })

  it('never traps focus or locks scroll for the popover', () => {
    // Both guards are gated on isMobile.
    expect(SOURCE).toMatch(/if \(!open \|\| !isMobile\) return/)
  })

  it('leaves the outside-click dismissal to the popover only', () => {
    expect(SOURCE).toMatch(/function onOutside[\s\S]{0,120}if \(isMobile\) return/)
  })
})

describe('ConceptPopover — one body, two sizes', () => {
  it('shares summary/formula/example/related between both variants', () => {
    // A single ConceptBody, rendered at two type scales — the modal can never
    // silently drop a field the popover shows.
    expect(SOURCE).toMatch(/<ConceptBody entry=\{entry\} size="comfortable" \/>/)
    expect(SOURCE).toMatch(/<ConceptBody entry=\{entry\} size="compact" \/>/)
    expect(SOURCE.match(/function ConceptBody/g)).toHaveLength(1)
  })
})

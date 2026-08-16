import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Structural performance budget for the marketing homepage.
 *
 * These are deliberately STRUCTURAL assertions, not millisecond thresholds —
 * wall-clock numbers in a unit test are flaky and would get muted within a
 * week. The runtime measurement lives separately in
 * `scripts/perf/measure-homepage.mjs`, which drives real Chrome under
 * Lighthouse's mobile throttling profile.
 *
 * What this locks down is the shape of the fixes from the mobile LCP sprint,
 * each of which is easy to undo by accident:
 *
 *  1. The hero's above-the-fold text must not be opacity-gated behind a mount
 *     animation. `animate-reveal-up` starts at `opacity: 0`, and LCP/FCP do not
 *     count a paint at zero opacity, so putting it on the hero heading made the
 *     browser report LCP only after animation-delay + duration had elapsed.
 *     Measured cost on a throttled mobile profile: ~1.75s of pure LCP delay
 *     (the FCP→LCP gap went from 1750ms to 0ms when this was fixed).
 *  2. The below-the-fold sections must keep `content-visibility: auto` so the
 *     browser can skip laying out ~1,850 offscreen DOM nodes on every layout
 *     pass before first paint (a full-page layout measured ~1.2s on a
 *     4x-throttled CPU; several run before FCP).
 *  3. The mono font must stay out of the preload set — it is used only for
 *     incidental micro-labels and otherwise competes with the LCP text for
 *     critical-path bandwidth.
 *  4. Any image that ever lands above the fold must not be lazy-loaded, and
 *     must carry explicit dimensions.
 */

const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8')

const heroSrc = read('components/landing/Hero.tsx')
const fadeInUpSrc = read('components/landing/shared/FadeInUp.tsx')
const globalsCss = read('app/globals.css')
const pageSrc = read('app/page.tsx')
const layoutSrc = read('app/layout.tsx')

describe('homepage performance budget — LCP element is paintable immediately', () => {
  it('every above-the-fold FadeInUp in the hero opts into the non-opacity-gated entrance', () => {
    // The hero's centred text block (eyebrow → h1 → subhead → CTAs → trust row)
    // is everything before <HeroComposition/>; those are the wrappers that can
    // contain the LCP element on a 412px viewport.
    const textBlock = heroSrc.slice(heroSrc.indexOf('<div className="text-center'), heroSrc.indexOf('<HeroComposition'))
    expect(textBlock.length).toBeGreaterThan(200)

    const wrappers = textBlock.match(/<FadeInUp[^>]*>/g) ?? []
    expect(wrappers.length).toBeGreaterThanOrEqual(4)
    for (const w of wrappers) {
      expect(w, `above-the-fold wrapper is opacity-gated and will delay LCP: ${w}`).toMatch(/\bcritical\b/)
    }
  })

  it('the critical entrance animation never animates opacity', () => {
    const block = globalsCss.slice(globalsCss.indexOf('@keyframes reveal-up-critical'))
    const decl = block.slice(0, block.indexOf('}', block.indexOf('.animate-reveal-up-critical')) + 1)
    expect(decl).toContain('transform')
    // An `opacity` anywhere in these rules re-introduces exactly the bug that
    // cost 1.75s of LCP.
    expect(decl).not.toMatch(/opacity\s*:/)
  })

  it('FadeInUp still gates opacity by DEFAULT, so below-the-fold reveals are unchanged', () => {
    // The fix is opt-in; it must not silently strip the entrance animation from
    // the rest of the landing page.
    expect(fadeInUpSrc).toContain('animate-reveal-up-critical')
    expect(fadeInUpSrc).toMatch(/critical\s*\?/)
    const revealUp = globalsCss.slice(globalsCss.indexOf('.animate-reveal-up {'))
    expect(revealUp.slice(0, revealUp.indexOf('}'))).toContain('opacity: 0')
  })

  it('the reduced-motion block covers the critical animation too', () => {
    // globals.css has several prefers-reduced-motion blocks; the relevant one is
    // whichever disables the landing page's own entrance animations.
    const blocks = globalsCss.split('@media (prefers-reduced-motion: reduce)').slice(1)
    const entrance = blocks.find((b) => b.slice(0, b.indexOf('}')).includes('.animate-reveal-up'))
    expect(entrance, 'no reduced-motion block covers the entrance animations').toBeDefined()
    expect(entrance!.slice(0, entrance!.indexOf('}'))).toContain('.animate-reveal-up-critical')
  })
})

describe('homepage performance budget — offscreen sections skip layout', () => {
  it('the landing <main> opts into the offscreen-layout skip', () => {
    expect(pageSrc).toMatch(/<main className="[^"]*sp-landing-main/)
  })

  it('the rule uses content-visibility with an intrinsic size so it cannot cause layout shift', () => {
    const rule = globalsCss.slice(globalsCss.indexOf('.sp-landing-main > *:not(:first-child)'))
    const body = rule.slice(0, rule.indexOf('}') + 1)
    expect(body).toContain('content-visibility: auto')
    // Without contain-intrinsic-size the page height collapses and CLS spikes.
    expect(body).toMatch(/contain-intrinsic-size:\s*auto\s+\d+px/)
  })

  it('the hero itself is never deferred — it holds the LCP element', () => {
    const rule = globalsCss.slice(globalsCss.indexOf('.sp-landing-main > *:not(:first-child)'))
    expect(rule.slice(0, 80)).toContain(':not(:first-child)')
  })
})

describe('homepage performance budget — fonts', () => {
  it('neither face disables preload — doing so drops the preload for BOTH, including the LCP font', () => {
    // Measured during the mobile LCP sprint: adding `preload: false` to the
    // mono face made Next.js emit zero `<link rel="preload" as="font">` tags,
    // losing the sans preload too. The sans face renders the LCP text, so that
    // trade is strictly bad. Guard both declarations.
    const call = (open: string) => {
      const start = layoutSrc.indexOf(open)
      expect(start, `${open} not found in layout.tsx`).toBeGreaterThan(-1)
      return layoutSrc.slice(start, layoutSrc.indexOf('});', start) + 3)
    }
    expect(call('= Geist({'), 'the sans face renders the LCP text and must stay preloaded').not.toMatch(/preload:\s*false/)
    expect(call('Geist_Mono({'), 'disabling preload here silently removes the sans preload as well').not.toMatch(/preload:\s*false/)
  })

  it('only the two known families are loaded — a third would add critical-path competition', () => {
    const families = layoutSrc.match(/=\s*(Geist|Geist_Mono|Inter|Roboto|Open_Sans|Lato|Poppins|Montserrat)\(/g) ?? []
    expect(families.length).toBe(2)
  })
})

describe('homepage performance budget — images', () => {
  // The homepage currently ships zero raster assets (the hero is text + CSS),
  // which is why LCP is a text node. If that ever changes, these rules are the
  // ones that keep a hero image from re-creating the 5s LCP.
  const landingFiles = ['Hero', 'ProofStrip', 'HowDecisionsWork', 'DecisionShowcase', 'RangeThinking', 'LearningPath', 'CoachSection', 'ProgressionSection', 'LeaderboardPreview', 'CtaSection']
    .map((n) => ({ name: n, src: read(`components/landing/${n}.tsx`) }))

  it('no image above the fold is lazy-loaded (a lazy LCP image is the classic 5s-LCP bug)', () => {
    const hero = landingFiles.find((f) => f.name === 'Hero')!.src
    const imgs = hero.match(/<(img|Image)\b[^>]*>/g) ?? []
    for (const tag of imgs) {
      expect(tag, `hero image must not be lazy-loaded: ${tag}`).not.toMatch(/loading=["{]?['"]?lazy/)
    }
  })

  it('every image on the landing page declares dimensions', () => {
    for (const { name, src } of landingFiles) {
      for (const tag of src.match(/<img\b[^>]*>/g) ?? []) {
        expect(tag, `${name}: raw <img> needs width+height to avoid layout shift`).toMatch(/width=/)
        expect(tag, `${name}: raw <img> needs width+height to avoid layout shift`).toMatch(/height=/)
      }
    }
  })
})

describe('homepage performance budget — critical path stays lean', () => {
  it('the homepage route renders its sections server-side from one module', () => {
    // A default-exported async component or a "use client" at the top of the
    // route would push the whole page into the client graph.
    expect(pageSrc.trimStart().startsWith('"use client"')).toBe(false)
    expect(pageSrc.trimStart().startsWith("'use client'")).toBe(false)
  })

  it('the hero does not import the full interactive curriculum', () => {
    // curriculum.ts embeds every lesson's step content; the generated metadata
    // module is the light one. Importing the former would balloon the payload.
    expect(heroSrc).not.toMatch(/from ["']@\/lib\/learn\/curriculum["']/)
    expect(heroSrc).toContain('curriculumPublic.generated')
  })
})

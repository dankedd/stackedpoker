import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

/**
 * Structural performance and motion budget for the homepage (components/home).
 * Not millisecond thresholds — those are flaky in unit tests and live in
 * Lighthouse runs — but the shape of what keeps LCP and CLS low and the motion
 * honest, each easy to undo by accident:
 *
 *  1. The H1 (the LCP element) is never opacity-animated: LCP does not count a
 *     paint at opacity 0, so a fade-in on the headline delays LCP by its full
 *     duration.
 *  2. Sections below the fold keep `content-visibility: auto` with an
 *     intrinsic size (skips offscreen layout, no layout shift).
 *  3. Only the two existing font families load.
 *  4. The 400 KB range data never reaches the browser: no client component
 *     imports lib/ranges/data or the server-side chart helpers.
 *  5. Motion animates transform/opacity only, and reduced motion turns it off.
 */

const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8')
const heroSrc = read('components/home/Hero.tsx')
const pageSrc = read('app/page.tsx')
const layoutSrc = read('app/layout.tsx')
const css = read('app/globals.css')
const homeCss = css.slice(css.indexOf('Homepage (components/home) — motion system'))

describe('LCP', () => {
  it('there is exactly one h1, in the hero, with no animation class', () => {
    const h1s = heroSrc.match(/<h1\b[^>]*>/g) ?? []
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).not.toMatch(/hp-|animate-|opacity-0/)
    const others = readdirSync(path.join(root, 'components/home')).filter((f) => f !== 'Hero.tsx')
    for (const f of others) expect(read(`components/home/${f}`), f).not.toMatch(/<h1\b/)
  })

  it('the landing <main> skips offscreen layout, but never for the hero', () => {
    expect(pageSrc).toMatch(/<main className="[^"]*sp-landing-main/)
    const rule = css.slice(css.indexOf('.sp-landing-main > *:not(:first-child)'))
    const body = rule.slice(0, rule.indexOf('}') + 1)
    expect(body).toContain('content-visibility: auto')
    expect(body).toMatch(/contain-intrinsic-size:\s*auto\s+\d+px/)
    expect(pageSrc.indexOf('<Hero')).toBeLessThan(pageSrc.indexOf('<Loop'))
  })

  it('only the two known font families are loaded', () => {
    const families = layoutSrc.match(/=\s*(Geist|Geist_Mono|Inter|Roboto|Open_Sans|Lato|Poppins|Montserrat)\(/g) ?? []
    expect(families.length).toBe(2)
  })
})

describe('bundle', () => {
  it('no client component imports the range data or the server-side chart helpers', () => {
    for (const f of readdirSync(path.join(root, 'components/home'))) {
      const src = read(`components/home/${f}`)
      if (!src.startsWith('"use client"')) continue
      // Type-only imports are erased at build time and carry no data.
      const values = src.replace(/import type [^;]+;/g, '')
      expect(values, f).not.toMatch(/@\/lib\/ranges\/data|@\/lib\/home\/(demoSpots|charts)["']|data\/ranges\//)
    }
  })
})

describe('motion', () => {
  it('keyframes animate transform and opacity only', () => {
    const frames = [...homeCss.matchAll(/@keyframes hp-[\w-]+\s*\{([^@]*?)\}\s*\n/g)].map((m) => m[1])
    expect(frames.length).toBeGreaterThan(5)
    for (const f of frames) {
      const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      for (const p of props) expect(['opacity', 'transform']).toContain(p)
    }
  })

  it('reduced motion shows final states and stops loops', () => {
    const rm = homeCss.slice(homeCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const cls of ['.hp-reveal', '.hp-deal', '.hp-grow-x', '.hp-loop-flicker', '.hp-loop-float', '.hp-draw']) expect(rm).toContain(cls)
  })
})

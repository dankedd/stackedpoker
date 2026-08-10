/**
 * Platform-wide guard: every continuous-value control in Learn goes through
 * LessonSlider.
 *
 * Sliders had drifted into four separate implementations before this was
 * consolidated (bare `accent-violet-500`, two hand-rolled webkit/moz thumb
 * variants, and a +/- stepper pair). Each drift was individually reasonable
 * and collectively meant learners had to re-learn the control per lesson, and
 * that the "+/- buttons" variant read as a number field rather than something
 * draggable. This test fails the build if a raw range input reappears, so the
 * consolidation cannot silently rot.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

const LEARN_ROOTS = [
  path.resolve(__dirname, '../../../learn'),
  path.resolve(__dirname, '../../../../app/learn'),
]

/** The one file allowed to own a native range input. */
const SLIDER_IMPL = 'LessonSlider.tsx'

function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out = out.concat(walk(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function learnFiles(): string[] {
  return LEARN_ROOTS.flatMap((r) => {
    try {
      return walk(r)
    } catch {
      return []
    }
  })
}

describe('Learn platform — one slider implementation', () => {
  it('finds the Learn source tree (guards against this test silently scanning nothing)', () => {
    expect(learnFiles().length).toBeGreaterThan(50)
  })

  it('no file except LessonSlider renders a raw <input type="range">', () => {
    const offenders = learnFiles().filter((f) => {
      if (path.basename(f) === SLIDER_IMPL) return false
      return /type=["']range["']/.test(readFileSync(f, 'utf-8'))
    })
    expect(offenders.map((f) => path.basename(f))).toEqual([])
  })

  it('no file styles a slider with the browser-default `accent-*` shorthand', () => {
    const offenders = learnFiles().filter((f) => {
      if (path.basename(f) === SLIDER_IMPL) return false
      return /accent-(violet|blue|amber|emerald|\[)/.test(readFileSync(f, 'utf-8'))
    })
    expect(offenders.map((f) => path.basename(f))).toEqual([])
  })

  it('no slider is flanked by +/- stepper buttons', () => {
    const offenders = learnFiles().filter((f) => {
      const src = readFileSync(f, 'utf-8')
      return /aria-label={?[`'"]?(Decrease|Increase) /.test(src)
    })
    expect(offenders.map((f) => path.basename(f))).toEqual([])
  })

  it('no file hand-rolls slider thumb styling — that lives in globals.css', () => {
    const offenders = learnFiles().filter((f) => {
      if (path.basename(f) === SLIDER_IMPL) return false
      return /slider-thumb|range-thumb/.test(readFileSync(f, 'utf-8'))
    })
    expect(offenders.map((f) => path.basename(f))).toEqual([])
  })
})

describe('LessonSlider CSS contract', () => {
  const css = readFileSync(path.resolve(__dirname, '../../../../app/globals.css'), 'utf-8')

  it('defines the shared .sp-slider thumb for both engines', () => {
    expect(css).toMatch(/\.sp-slider::-webkit-slider-thumb/)
    expect(css).toMatch(/\.sp-slider::-moz-range-thumb/)
  })

  it('gives the thumb a visible focus ring for keyboard users', () => {
    expect(css).toMatch(/\.sp-slider:focus-visible::-webkit-slider-thumb/)
    expect(css).toMatch(/\.sp-slider:focus-visible::-moz-range-thumb/)
  })

  it('disables the nudge animation and hover scaling under prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('.sp-slider {'))
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('sp-slider-nudge')
    expect(reduced).toMatch(/animation:\s*none/)
    expect(reduced).toMatch(/transform:\s*none/)
  })
})

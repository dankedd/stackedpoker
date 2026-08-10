import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { answerGridClass, stackedAnswerClass, STACK_FROM } from '../answerLayout'
import { LESSONS } from '../curriculum'

/**
 * Guards the mobile answer-stacking rule.
 *
 * Three choices side by side on a phone gave each answer about a third of
 * ~295px, so a label like "QJs has excellent playability across many board
 * textures" wrapped to five or six lines in a column narrower than its own
 * words. From three options up, phones now get one option per row.
 *
 * Verified against real device emulation before landing: at 320/375/430 a
 * 3-, 4- and 5-option question renders 1 column with each button at 99% of the
 * card's content width and a 56px minimum height, while 640/1280 keep their
 * original 3- and 2-column rows. These tests hold that behaviour in place.
 */

const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf-8')

describe('answerGridClass', () => {
  it('keeps two options side by side at every width', () => {
    expect(answerGridClass(2)).toBe('grid-cols-2')
    expect(answerGridClass(1)).toBe('grid-cols-2')
  })

  it('stacks from three options up on mobile', () => {
    for (const n of [3, 4, 5, 8]) {
      expect(answerGridClass(n), `${n} options`).toContain('grid-cols-1')
    }
  })

  it('keeps whatever desktop layout the caller already had', () => {
    expect(answerGridClass(3, 3)).toBe('grid-cols-1 sm:grid-cols-3')
    expect(answerGridClass(4, 2)).toBe('grid-cols-1 sm:grid-cols-2')
    expect(answerGridClass(4, 4)).toBe('grid-cols-1 sm:grid-cols-4')
    expect(answerGridClass(5, 5)).toBe('grid-cols-1 sm:grid-cols-5')
  })

  it('falls back to two desktop columns for an unmapped count', () => {
    expect(answerGridClass(3, 7)).toBe('grid-cols-1 sm:grid-cols-2')
  })

  it('never emits an interpolated class Tailwind could not generate', () => {
    // A column class built by interpolation is invisible to Tailwind's
    // scanner. Comments are stripped first — the module explains this hazard
    // in prose, and the prose must not trip its own guard.
    const code = read('lib/learn/answerLayout.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/grid-cols-\$\{/)
  })
})

describe('stackedAnswerClass', () => {
  it('leaves a two-option row untouched', () => {
    expect(stackedAnswerClass(2)).toBeUndefined()
  })

  it('gives stacked options a consistent minimum height, reverted on desktop', () => {
    const cls = stackedAnswerClass(3)!
    expect(cls).toContain('min-h-[3.5rem]')
    expect(cls).toContain('sm:min-h-0')
    expect(cls).toContain('sm:block')
  })

  it('centres a single label but keeps stacked content flowing', () => {
    expect(stackedAnswerClass(3, 'label')).toContain('items-center')
    expect(stackedAnswerClass(3, 'block')).toContain('flex-col justify-center')
  })

  it('agrees with the documented threshold', () => {
    expect(STACK_FROM).toBe(3)
    expect(stackedAnswerClass(STACK_FROM - 1)).toBeUndefined()
    expect(stackedAnswerClass(STACK_FROM)).toBeDefined()
  })
})

describe('tailwind sees the helper', () => {
  it('scans lib/ for class names', () => {
    // answerLayout.ts is the only source of `min-h-[3.5rem]`; without lib/ in
    // the content globs the utility is never generated and stacked options
    // silently lose their minimum height (measured: 54px instead of 56px).
    expect(read('tailwind.config.ts')).toMatch(/"\.\/lib\/\*\*\/\*\.\{js,ts,jsx,tsx,mdx\}"/)
  })
})

describe('every multi-option answer grid uses the helper', () => {
  const WIRED = [
    'components/learn/steps/DecisionSpot.tsx',
    'components/learn/steps/BetSizeSlider.tsx',
    'components/learn/steps/EquityBalance.tsx',
    'components/learn/steps/EquityBucket.tsx',
    'components/learn/steps/FlopClassifyDrill.tsx',
    'components/learn/steps/FrequencySizeLab.tsx',
    'components/learn/steps/MorphologyBuilder.tsx',
    'components/learn/steps/RangeCollision.tsx',
  ]

  it.each(WIRED)('%s routes its option grid through answerGridClass', (file) => {
    const src = read(file)
    expect(src).toContain("from '@/lib/learn/answerLayout'")
    expect(src).toContain('answerGridClass(')
    expect(src).toContain('stackedAnswerClass(')
  })

  it('no wired component still hard-codes a multi-column mobile answer grid', () => {
    for (const file of WIRED) {
      const src = read(file)
      // A bare `grid-cols-2/3/4/5` (no sm: prefix) on the same line as the
      // options container is what this change removed.
      const offenders = src
        .split('\n')
        .filter((l) => /answerGridClass|options\.map|BUCKETS\.map|sizingOptions\.map/.test(l))
        .filter((l) => /(?<!:)\bgrid-cols-[2-9]\b/.test(l))
      expect(offenders, file).toEqual([])
    }
  })
})

describe('curriculum coverage', () => {
  const counts = LESSONS.flatMap((l) => l.steps)
    .map((s) => (s as { options?: unknown[] }).options?.length ?? 0)
    .filter((n) => n > 0)

  it('the rule actually applies to a large share of the curriculum', () => {
    const stacked = counts.filter((n) => n >= STACK_FROM).length
    // Measured at implementation time: 298 of 613 option steps (49%).
    expect(counts.length).toBeGreaterThan(500)
    expect(stacked / counts.length).toBeGreaterThan(0.4)
  })

  it('two-option questions remain the other large half, untouched', () => {
    expect(counts.filter((n) => n === 2).length).toBeGreaterThan(200)
  })
})

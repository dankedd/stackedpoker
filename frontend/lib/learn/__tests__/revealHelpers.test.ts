/**
 * Regression tests for the shared "submit -> reveal correct answer" helpers
 * used by every multi-item classify/sort/match step component (RangeBucketSort,
 * BoardRankSort, StraightDetective, BoardAutopsy). These are pure functions —
 * scoring itself (evaluator.ts) never reads them, so a bug here can never
 * change XP/quality, only what the review UI paints. Correctness must always
 * be judged from the ORIGINAL submitted response, never from any post-submit
 * UI state, and these functions are a pure read of that response.
 */
import { describe, it, expect } from 'vitest'
import {
  computeBucketReveal,
  computeFlagReveal,
  computeOrderReveal,
  explainHandNotation,
  isPairSuitedOffsuit,
} from '../revealHelpers'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

describe('computeBucketReveal — Pair/Suited/Offsuit (l5-s10)', () => {
  const step = findStep('l5-s10')

  it('is authored as the Pair/Suited/Offsuit categories the reveal explainer expects', () => {
    expect(isPairSuitedOffsuit(step.range_bucket_categories ?? [])).toBe(true)
  })

  it('marks every hand correct when assignments match range_bucket_correct exactly', () => {
    const correct = step.range_bucket_correct ?? {}
    const reveal = computeBucketReveal(step, correct)
    expect(reveal.every((r) => r.correct)).toBe(true)
    expect(reveal).toHaveLength((step.range_bucket_pool ?? []).length)
  })

  it('flags a misplaced hand (JTo under Suited instead of Offsuit) as incorrect, with the correct category still exposed', () => {
    const wrongAssignments = { ...(step.range_bucket_correct ?? {}), JTo: 'suited' }
    const reveal = computeBucketReveal(step, wrongAssignments)
    const jto = reveal.find((r) => r.hand === 'JTo')
    expect(jto).toBeDefined()
    expect(jto!.correct).toBe(false)
    expect(jto!.yourCategoryId).toBe('suited')
    expect(jto!.correctCategoryId).toBe('offsuit')
  })

  it('treats an unassigned hand as incorrect, not as silently correct', () => {
    const partial = { ...(step.range_bucket_correct ?? {}) }
    delete partial.QQ
    const reveal = computeBucketReveal(step, partial)
    const qq = reveal.find((r) => r.hand === 'QQ')
    expect(qq!.correct).toBe(false)
    expect(qq!.yourCategoryId).toBeUndefined()
    expect(qq!.correctCategoryId).toBe('pair')
  })
})

describe('computeBucketReveal — acceptable alternates (e.g. bar-s4 style steps)', () => {
  const step: LessonStep = {
    id: 'fixture-bucket',
    type: 'range_bucket',
    range_bucket_pool: ['AA', 'AQs', 'AJo'],
    range_bucket_categories: [
      { id: 'clear_aggression', label: 'Clear Aggression' },
      { id: 'possible_call', label: 'Possible Call' },
      { id: 'likely_fold', label: 'Likely Fold' },
    ],
    range_bucket_correct: { AA: 'clear_aggression', AQs: 'clear_aggression', AJo: 'likely_fold' },
    range_bucket_acceptable: { AQs: ['possible_call'], AJo: ['possible_call'] },
  } as LessonStep

  it('is NOT detected as the pair/suited/offsuit case (no mechanical explanation should be generated)', () => {
    expect(isPairSuitedOffsuit(step.range_bucket_categories ?? [])).toBe(false)
  })

  it('counts an acceptable alternate as correct even though it differs from the single best category', () => {
    const reveal = computeBucketReveal(step, { AA: 'clear_aggression', AQs: 'possible_call', AJo: 'possible_call' })
    const aqs = reveal.find((r) => r.hand === 'AQs')
    const ajo = reveal.find((r) => r.hand === 'AJo')
    expect(aqs!.correct).toBe(true)
    expect(ajo!.correct).toBe(true)
  })

  it('still fails a genuinely wrong category', () => {
    const reveal = computeBucketReveal(step, { AA: 'likely_fold', AQs: 'clear_aggression', AJo: 'likely_fold' })
    expect(reveal.find((r) => r.hand === 'AA')!.correct).toBe(false)
  })
})

describe('explainHandNotation', () => {
  it('explains pocket pairs', () => {
    expect(explainHandNotation('QQ')).toMatch(/pocket pair/i)
  })
  it('explains suited hands', () => {
    expect(explainHandNotation('KQs')).toMatch(/suited/i)
  })
  it('explains offsuit hands', () => {
    expect(explainHandNotation('JTo')).toMatch(/offsuit/i)
  })
})

describe('computeOrderReveal', () => {
  const correctOrder = ['a', 'b', 'c', 'd']

  it('marks every slot correct for an exact match', () => {
    const reveal = computeOrderReveal(['a', 'b', 'c', 'd'], correctOrder)
    expect(reveal.every((r) => r.correct)).toBe(true)
  })

  it('flags only the swapped slots as incorrect', () => {
    const reveal = computeOrderReveal(['a', 'c', 'b', 'd'], correctOrder)
    expect(reveal.find((r) => r.id === 'a')!.correct).toBe(true)
    expect(reveal.find((r) => r.id === 'd')!.correct).toBe(true)
    expect(reveal[1].correct).toBe(false) // 'c' in slot 1, correct is 'b'
    expect(reveal[2].correct).toBe(false) // 'b' in slot 2, correct is 'c'
  })

  it('preserves submitted order and position for rendering (not the correct order)', () => {
    const reveal = computeOrderReveal(['d', 'c', 'b', 'a'], correctOrder)
    expect(reveal.map((r) => r.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(reveal.map((r) => r.position)).toEqual([0, 1, 2, 3])
  })
})

describe('computeFlagReveal', () => {
  const candidates = ['x', 'y', 'z']

  it('true positive: selected and should be selected -> correct', () => {
    const reveal = computeFlagReveal(candidates, new Set(['x']), new Set(['x']))
    expect(reveal.find((r) => r.id === 'x')).toMatchObject({ selected: true, shouldBeSelected: true, correct: true })
  })

  it('true negative: not selected and should not be selected -> correct', () => {
    const reveal = computeFlagReveal(candidates, new Set(['x']), new Set(['x']))
    expect(reveal.find((r) => r.id === 'y')).toMatchObject({ selected: false, shouldBeSelected: false, correct: true })
  })

  it('false positive: selected but should not be -> incorrect', () => {
    const reveal = computeFlagReveal(candidates, new Set(['y']), new Set(['x']))
    expect(reveal.find((r) => r.id === 'y')).toMatchObject({ selected: true, shouldBeSelected: false, correct: false })
  })

  it('false negative (missed): not selected but should be -> incorrect', () => {
    const reveal = computeFlagReveal(candidates, new Set([]), new Set(['x']))
    expect(reveal.find((r) => r.id === 'x')).toMatchObject({ selected: false, shouldBeSelected: true, correct: false })
  })
})

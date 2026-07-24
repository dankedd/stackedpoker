/**
 * Tests for the reusable "prefilled foundation" system for range_build steps
 * (frontend/lib/learn/rangePrefill.ts). Covers the state-transition logic
 * that RangeBuild.tsx wires into the grid, plus the scoring-independence
 * guarantee: prefilling must never grant credit the learner didn't submit.
 */
import { describe, it, expect } from 'vitest'
import {
  resolvePrefilledHands,
  resolveTargetHands,
  createInitialRangeSelection,
  toggleRangeHand,
  clearRangeSelection,
  resetRangeToFoundation,
  isPrefilledCell,
} from '../rangePrefill'
import { RANGE_FOUNDATIONS, RANGE_TARGETS } from '../ranges'
import { evaluateStepLocally } from '../evaluator'
import type { LessonStep } from '../types'

const BASE_STEP: LessonStep = {
  id: 'test-range-build',
  type: 'range_build',
  range_target: 'BTN_open_100bb',
  range_prefilled_key: 'BTN_open_foundation',
}

describe('resolvePrefilledHands / resolveTargetHands', () => {
  it('resolves a named foundation key to its hand list', () => {
    expect(resolvePrefilledHands(BASE_STEP)).toEqual(RANGE_FOUNDATIONS.BTN_open_foundation)
  })

  it('inline range_prefilled wins over range_prefilled_key', () => {
    const step: LessonStep = { ...BASE_STEP, range_prefilled: ['AA', 'KK'] }
    expect(resolvePrefilledHands(step)).toEqual(['AA', 'KK'])
  })

  it('returns an empty array when a step defines no foundation', () => {
    const step: LessonStep = { id: 'x', type: 'range_build', range_target: 'CO_open_100bb' }
    expect(resolvePrefilledHands(step)).toEqual([])
  })

  it('resolves the graded target the same way range_combos/range_target always have', () => {
    expect(resolveTargetHands(BASE_STEP)).toEqual(RANGE_TARGETS.BTN_open_100bb)
  })
})

describe('foundation loads correctly', () => {
  it('createInitialRangeSelection pre-selects every foundation hand and marks nothing as touched', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const state = createInitialRangeSelection(foundation)
    for (const h of foundation) expect(state.selected.has(h)).toBe(true)
    expect(state.selected.size).toBe(foundation.length)
    expect(state.touched.size).toBe(0)
  })

  it('every prefilled hand renders as a prefilled cell immediately after load', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const foundationSet = new Set(foundation)
    const state = createInitialRangeSelection(foundation)
    for (const h of foundation) expect(isPrefilledCell(state, foundationSet, h)).toBe(true)
  })

  it('a step with no foundation loads with an empty selection', () => {
    const state = createInitialRangeSelection([])
    expect(state.selected.size).toBe(0)
  })
})

describe('learner can deselect a prefilled hand', () => {
  it('removing a foundation hand clears it from selected and marks it touched', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const foundationSet = new Set(foundation)
    let state = createInitialRangeSelection(foundation)
    const hand = foundation[0]
    state = toggleRangeHand(state, hand, 'remove')
    expect(state.selected.has(hand)).toBe(false)
    expect(state.touched.has(hand)).toBe(true)
    expect(isPrefilledCell(state, foundationSet, hand)).toBe(false)
  })

  it('re-adding a removed foundation hand makes it a learner decision, not a prefilled cell', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const foundationSet = new Set(foundation)
    let state = createInitialRangeSelection(foundation)
    const hand = foundation[0]
    state = toggleRangeHand(state, hand, 'remove')
    state = toggleRangeHand(state, hand, 'add')
    expect(state.selected.has(hand)).toBe(true)
    expect(isPrefilledCell(state, foundationSet, hand)).toBe(false)
  })
})

describe('learner can add new hands', () => {
  it('adding a boundary hand not in the foundation selects it as a learner decision', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const foundationSet = new Set(foundation)
    let state = createInitialRangeSelection(foundation)
    const boundaryHand = 'A9o' // in BTN_open_100bb target but not in the foundation
    expect(foundationSet.has(boundaryHand)).toBe(false)
    state = toggleRangeHand(state, boundaryHand, 'add')
    expect(state.selected.has(boundaryHand)).toBe(true)
    expect(isPrefilledCell(state, foundationSet, boundaryHand)).toBe(false)
  })
})

describe('Clear all', () => {
  it('empties selected and touched regardless of prior foundation/learner state', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    let state = createInitialRangeSelection(foundation)
    state = toggleRangeHand(state, 'A9o', 'add')
    state = clearRangeSelection()
    expect(state.selected.size).toBe(0)
    expect(state.touched.size).toBe(0)
  })
})

describe('Reset to foundation', () => {
  it('restores exactly the foundation set and clears all touched markers', () => {
    const foundation = resolvePrefilledHands(BASE_STEP)
    const foundationSet = new Set(foundation)
    let state = createInitialRangeSelection(foundation)
    // Learner removes one foundation hand and adds a boundary hand.
    state = toggleRangeHand(state, foundation[0], 'remove')
    state = toggleRangeHand(state, 'A9o', 'add')
    expect(state.selected.has(foundation[0])).toBe(false)
    expect(state.selected.has('A9o')).toBe(true)

    state = resetRangeToFoundation(foundation)
    expect(state.selected).toEqual(new Set(foundation))
    expect(state.touched.size).toBe(0)
    for (const h of foundation) expect(isPrefilledCell(state, foundationSet, h)).toBe(true)
  })
})

describe('Submitted/scored range reflects the final learner state, not the initial prefill', () => {
  it('scores purely off the response array — evaluateStepLocally has no notion of prefill at all', () => {
    // Learner accepts the full foundation but adds nothing else: partial credit only,
    // never "free" credit for hands the system (not the learner) selected.
    const foundationOnlyResponse = Array.from(resolvePrefilledHands(BASE_STEP))
    const partial = evaluateStepLocally(BASE_STEP, foundationOnlyResponse, 0)
    expect(partial.quality).not.toBe('perfect')

    // Learner clears everything the system prefilled and submits nothing: scores as
    // if there had been no prefill at all.
    const cleared = evaluateStepLocally(BASE_STEP, [], 0)
    expect(cleared.score).toBeLessThan(partial.score)

    // Learner builds the full correct target themselves (including every boundary
    // hand beyond the foundation): full credit, exactly as if there were no prefill.
    const fullTarget = resolveTargetHands(BASE_STEP)
    const perfect = evaluateStepLocally(BASE_STEP, fullTarget, 0)
    expect(perfect.quality).toBe('perfect')

    // A step with an identical target but NO foundation scores an identical response
    // identically — proving prefilling doesn't change the grading function itself.
    const noPrefillStep: LessonStep = { ...BASE_STEP, range_prefilled_key: undefined }
    const withoutPrefill = evaluateStepLocally(noPrefillStep, foundationOnlyResponse, 0)
    expect(withoutPrefill.score).toBe(partial.score)
    expect(withoutPrefill.quality).toBe(partial.quality)
  })
})

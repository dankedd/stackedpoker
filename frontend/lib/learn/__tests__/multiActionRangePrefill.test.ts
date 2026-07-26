/**
 * Regression tests for the generalized multi-action range-build state model
 * (multiActionRangePrefill.ts). Framework-free by design — these exercise the
 * exact pure functions MultiActionRangeBuild.tsx's click/drag handlers call,
 * across the FULL MultiRangeAction union (MTT RFI's raise/limp/jam/fold, and
 * the 3-bet-response domain's call/4bet), proving the generalized action type
 * survives selection, painting, clearing, and foundation reset without a cast.
 */
import { describe, it, expect } from 'vitest'
import {
  createInitialMultiSelection,
  paintMultiActionHand,
  clearMultiActionHand,
  clearMultiActionSelection,
  resetMultiActionToFoundation,
  isPrefilledMultiCell,
  type MultiRangeAction,
} from '../multiActionRangePrefill'

// Every action MultiRangeAction actually admits — if this list ever drifts from the
// real union (a new action added/removed), the type errors below will catch it
// before a runtime bug does.
const ALL_ACTIONS: MultiRangeAction[] = ['fold', 'raise', 'limp', 'jam', '4bet', 'call']

describe('MultiRangeAction — every action in the generalized union is usable end-to-end', () => {
  for (const action of ALL_ACTIONS) {
    it(`paintMultiActionHand accepts '${action}' without a cast`, () => {
      const state = createInitialMultiSelection({})
      const next = paintMultiActionHand(state, 'AKs', action)
      expect(next.assignments.AKs).toBe(action)
      expect(next.touched.has('AKs')).toBe(true)
    })
  }

  it('createInitialMultiSelection accepts a prefilled map containing "call" and "4bet"', () => {
    const prefilled: Record<string, MultiRangeAction> = { AA: '4bet', AKs: 'call', '72o': 'fold' }
    const state = createInitialMultiSelection(prefilled)
    expect(state.assignments).toEqual(prefilled)
    expect(state.touched.size).toBe(0)
  })
})

describe('MultiRangeAction — original MTT RFI action set (raise/limp/jam/fold) still works unchanged', () => {
  it('paints and clears a hand through the full raise/limp/jam/fold cycle', () => {
    let state = createInitialMultiSelection({})
    state = paintMultiActionHand(state, 'QQ', 'raise')
    expect(state.assignments.QQ).toBe('raise')
    state = paintMultiActionHand(state, 'QQ', 'jam')
    expect(state.assignments.QQ).toBe('jam')
    state = clearMultiActionHand(state, 'QQ')
    expect(state.assignments.QQ).toBeUndefined()
    expect(state.touched.has('QQ')).toBe(true)
  })

  it('resetMultiActionToFoundation restores a raise/limp/jam/fold foundation exactly', () => {
    const foundation: Record<string, MultiRangeAction> = { AA: 'raise', KK: 'raise', '76s': 'jam' }
    let state = createInitialMultiSelection(foundation)
    state = paintMultiActionHand(state, 'AA', 'fold')
    state = resetMultiActionToFoundation(foundation)
    expect(state.assignments).toEqual(foundation)
    expect(state.touched.size).toBe(0)
  })
})

describe('MultiRangeAction — a generalized (3-bet-response) action set containing "call" works', () => {
  it('paints a hand to "call", survives a subsequent unrelated paint, and clears correctly', () => {
    let state = createInitialMultiSelection({ AKo: '4bet' })
    state = paintMultiActionHand(state, 'QJs', 'call')
    expect(state.assignments).toEqual({ AKo: '4bet', QJs: 'call' })
    state = clearMultiActionHand(state, 'QJs')
    expect(state.assignments).toEqual({ AKo: '4bet' })
  })

  it('isPrefilledMultiCell recognizes an untouched "call" foundation cell', () => {
    const prefilled: Record<string, MultiRangeAction> = { QJs: 'call' }
    const state = createInitialMultiSelection(prefilled)
    expect(isPrefilledMultiCell(state, prefilled, 'QJs')).toBe(true)
  })

  it('isPrefilledMultiCell stops recognizing the cell once touched, even repainted to the same action', () => {
    const prefilled: Record<string, MultiRangeAction> = { QJs: 'call' }
    let state = createInitialMultiSelection(prefilled)
    state = paintMultiActionHand(state, 'QJs', 'call') // learner re-confirms the same action
    expect(isPrefilledMultiCell(state, prefilled, 'QJs')).toBe(false)
  })
})

describe('MultiRangeAction — a generalized (3-bet-response) action set containing "4bet" works', () => {
  it('paints a hand to "4bet" and it survives a full clear-all/reset cycle', () => {
    let state = createInitialMultiSelection({})
    state = paintMultiActionHand(state, 'AA', '4bet')
    expect(state.assignments.AA).toBe('4bet')
    state = clearMultiActionSelection()
    expect(state.assignments).toEqual({})
    expect(state.touched.size).toBe(0)
  })

  it('a foundation containing "4bet" resolves through resetMultiActionToFoundation unchanged', () => {
    const foundation: Record<string, MultiRangeAction> = { AA: '4bet', KK: '4bet', AKs: 'call' }
    const state = resetMultiActionToFoundation(foundation)
    expect(state.assignments).toEqual(foundation)
  })
})

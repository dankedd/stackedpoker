/**
 * Reusable "prefilled foundation" logic for range_build steps — lets a step
 * pre-select the obvious core of a range so the learner spends their clicks
 * on the boundary/marginal hands, not on re-clicking every premium pair.
 *
 * Kept framework-free (no React) so the selection transitions are unit
 * testable without rendering RangeBuild.tsx. See RangeBuild.tsx for the
 * component that wires this up, and ranges.ts for RANGE_FOUNDATIONS.
 */
import { RANGE_TARGETS, RANGE_FOUNDATIONS } from './ranges'
import type { LessonStep } from './types'

export const DEFAULT_PREFILL_NOTE =
  "We've filled in the obvious foundation hands. Now decide how wide to build from here."

/** Resolves a step's graded target range — inline combos win over a named key. */
export function resolveTargetHands(step: LessonStep): string[] {
  return step.range_combos ?? RANGE_TARGETS[step.range_target ?? ''] ?? []
}

/** Resolves a step's prefilled foundation range — inline hands win over a named key. */
export function resolvePrefilledHands(step: LessonStep): string[] {
  return step.range_prefilled ?? RANGE_FOUNDATIONS[step.range_prefilled_key ?? ''] ?? []
}

export interface RangeSelectionState {
  /** Hands currently selected (in the range), whether prefilled or learner-added. */
  selected: Set<string>
  /** Hands the learner has explicitly toggled at least once since the last
   *  foundation load/reset. A touched hand is always rendered as a learner
   *  decision, even if it happens to still be selected and part of the
   *  foundation (e.g. removed then re-added). */
  touched: Set<string>
}

export function createInitialRangeSelection(foundation: string[]): RangeSelectionState {
  return { selected: new Set(foundation), touched: new Set() }
}

export function toggleRangeHand(
  state: RangeSelectionState,
  hand: string,
  mode?: 'add' | 'remove',
): RangeSelectionState {
  const selected = new Set(state.selected)
  const touched = new Set(state.touched)
  const effectiveMode = mode ?? (selected.has(hand) ? 'remove' : 'add')
  if (effectiveMode === 'add') selected.add(hand)
  else selected.delete(hand)
  touched.add(hand)
  return { selected, touched }
}

export function clearRangeSelection(): RangeSelectionState {
  return { selected: new Set(), touched: new Set() }
}

export function resetRangeToFoundation(foundation: string[]): RangeSelectionState {
  return createInitialRangeSelection(foundation)
}

/** A cell renders as "prefilled" only while it's still selected, part of the
 *  foundation, AND untouched by the learner — the instant they interact with
 *  it, it becomes their own decision regardless of its selected state. */
export function isPrefilledCell(state: RangeSelectionState, foundationSet: Set<string>, hand: string): boolean {
  return state.selected.has(hand) && foundationSet.has(hand) && !state.touched.has(hand)
}

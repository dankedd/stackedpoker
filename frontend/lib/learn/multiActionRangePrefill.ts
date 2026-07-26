/**
 * Reusable "prefilled foundation" + selection-state logic for range_build_multi steps —
 * a 1:1 mirror of rangePrefill.ts's framework-free API, generalized from a single
 * Set<string> membership to a per-hand action assignment (raise/limp/jam/fold).
 *
 * Kept framework-free (no React) so transitions are unit-testable without rendering
 * MultiActionRangeBuild.tsx.
 */
import { MTT_RFI_CHARTS, type MttAction, type MttRfiChart } from './mttRfiBaselines'
import { MTT_RFI_FOUNDATIONS, chartToDominantActionMap } from './mttRfiRanges'
import {
  THREEBET_RESPONSE_CHARTS,
  type ThreebetResponseAction,
  type ThreebetResponseChart,
} from './threebetResponseBaselines'
import { resolveThreebetResponsePrefilled } from './threebetResponseRanges'
import type { LessonStep } from './types'

export const DEFAULT_MULTI_PREFILL_NOTE =
  "We've filled in the obvious core decisions. Now work out the rest of the strategy."

/** Any action identifier this generalized paint UI supports, across every domain
 *  `range_build_multi_domain` can select — kept a plain string union of the two
 *  domains' concrete actions rather than a fully generic `string` so authoring
 *  (curriculum.ts) and grading keep compile-time checking. */
export type MultiRangeAction = MttAction | ThreebetResponseAction

/** The minimal shape MultiActionRangeBuild/Reveal actually need — both
 *  `MttRfiChart` and `ThreebetResponseChart` are sparse action-frequency-dict
 *  charts of this shape (verified by the two casts below at this one resolution
 *  seam, rather than adding an index signature to either concrete interface —
 *  that would widen `Object.values`/`Object.entries` typing on those interfaces
 *  everywhere, not just here). */
export interface MultiActionChartLike {
  cells: { hand: string; actions: Record<string, number> }[]
}

/** Resolves a step's graded target chart — the single source of truth for scoring.
 *  Branches on `range_build_multi_domain` ('mtt_rfi' default, or 'threebet_response'). */
export function resolveMultiActionTargetChart(step: LessonStep): MultiActionChartLike | undefined {
  if (step.range_build_multi_domain === 'threebet_response') {
    return THREEBET_RESPONSE_CHARTS[step.range_build_multi_chart ?? ''] as unknown as MultiActionChartLike | undefined
  }
  return MTT_RFI_CHARTS[step.range_build_multi_chart ?? ''] as unknown as MultiActionChartLike | undefined
}

/** Resolves a step's prefilled foundation assignments. Precedence: a Transformation Challenge's
 *  source chart (full dominant-action seed) wins over an inline foundation, which wins over a
 *  named foundation key. Grading is unaffected by any of these — evalMultiActionRange always
 *  grades the final submission against `range_build_multi_chart` (the target), never the seed. */
export function resolveMultiPrefilledAssignments(step: LessonStep): Record<string, MultiRangeAction> {
  if (step.range_build_multi_domain === 'threebet_response') {
    return resolveThreebetResponsePrefilled(step)
  }
  if (step.range_build_multi_transform_from_chart) {
    const source = MTT_RFI_CHARTS[step.range_build_multi_transform_from_chart]
    if (source) return chartToDominantActionMap(source)
  }
  return (
    step.range_build_multi_prefilled ??
    MTT_RFI_FOUNDATIONS[step.range_build_multi_prefilled_key ?? '']?.hands ??
    {}
  )
}

export interface MultiActionSelectionState {
  /** Hand -> the action currently assigned to it, whether prefilled or learner-chosen. */
  assignments: Record<string, MultiRangeAction>
  /** Hands the learner has explicitly painted at least once since the last foundation
   *  load/reset — same "becomes the learner's own decision the instant they touch it"
   *  semantics as rangePrefill.ts's `touched`. */
  touched: Set<string>
}

export function createInitialMultiSelection(prefilled: Record<string, MultiRangeAction>): MultiActionSelectionState {
  return { assignments: { ...prefilled }, touched: new Set() }
}

export function paintMultiActionHand(
  state: MultiActionSelectionState,
  hand: string,
  action: MultiRangeAction,
): MultiActionSelectionState {
  const assignments = { ...state.assignments }
  const touched = new Set(state.touched)
  assignments[hand] = action
  touched.add(hand)
  return { assignments, touched }
}

/** Removes any assignment for `hand` (back to "unassigned" — implicit fold). */
export function clearMultiActionHand(state: MultiActionSelectionState, hand: string): MultiActionSelectionState {
  const assignments = { ...state.assignments }
  delete assignments[hand]
  const touched = new Set(state.touched)
  touched.add(hand)
  return { assignments, touched }
}

export function clearMultiActionSelection(): MultiActionSelectionState {
  return { assignments: {}, touched: new Set() }
}

export function resetMultiActionToFoundation(prefilled: Record<string, MultiRangeAction>): MultiActionSelectionState {
  return createInitialMultiSelection(prefilled)
}

/** A cell renders as "prefilled" only while its assignment still matches the foundation's
 *  AND it hasn't been touched by the learner — identical semantics to isPrefilledCell. */
export function isPrefilledMultiCell(
  state: MultiActionSelectionState,
  prefilled: Record<string, MultiRangeAction>,
  hand: string,
): boolean {
  return hand in prefilled && state.assignments[hand] === prefilled[hand] && !state.touched.has(hand)
}

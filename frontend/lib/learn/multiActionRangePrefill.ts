/**
 * Reusable "prefilled foundation" + selection-state logic for range_build_multi steps —
 * a 1:1 mirror of rangePrefill.ts's framework-free API, generalized from a single
 * Set<string> membership to a per-hand action assignment (raise/limp/jam/fold).
 *
 * Kept framework-free (no React) so transitions are unit-testable without rendering
 * MultiActionRangeBuild.tsx.
 */
import { MTT_RFI_CHARTS, type MttAction, type MttRfiChart } from './mttRfiBaselines'
import { MTT_RFI_FOUNDATIONS } from './mttRfiRanges'
import type { LessonStep } from './types'

export const DEFAULT_MULTI_PREFILL_NOTE =
  "We've filled in the obvious core decisions. Now work out the rest of the strategy."

/** Resolves a step's graded target chart — the single source of truth for scoring. */
export function resolveMttTargetChart(step: LessonStep): MttRfiChart | undefined {
  return MTT_RFI_CHARTS[step.range_build_multi_chart ?? '']
}

/** Resolves a step's prefilled foundation assignments — inline hands win over a named key. */
export function resolveMultiPrefilledAssignments(step: LessonStep): Record<string, MttAction> {
  return (
    step.range_build_multi_prefilled ??
    MTT_RFI_FOUNDATIONS[step.range_build_multi_prefilled_key ?? '']?.hands ??
    {}
  )
}

export interface MultiActionSelectionState {
  /** Hand -> the action currently assigned to it, whether prefilled or learner-chosen. */
  assignments: Record<string, MttAction>
  /** Hands the learner has explicitly painted at least once since the last foundation
   *  load/reset — same "becomes the learner's own decision the instant they touch it"
   *  semantics as rangePrefill.ts's `touched`. */
  touched: Set<string>
}

export function createInitialMultiSelection(prefilled: Record<string, MttAction>): MultiActionSelectionState {
  return { assignments: { ...prefilled }, touched: new Set() }
}

export function paintMultiActionHand(
  state: MultiActionSelectionState,
  hand: string,
  action: MttAction,
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

export function resetMultiActionToFoundation(prefilled: Record<string, MttAction>): MultiActionSelectionState {
  return createInitialMultiSelection(prefilled)
}

/** A cell renders as "prefilled" only while its assignment still matches the foundation's
 *  AND it hasn't been touched by the learner — identical semantics to isPrefilledCell. */
export function isPrefilledMultiCell(
  state: MultiActionSelectionState,
  prefilled: Record<string, MttAction>,
  hand: string,
): boolean {
  return hand in prefilled && state.assignments[hand] === prefilled[hand] && !state.touched.has(hand)
}

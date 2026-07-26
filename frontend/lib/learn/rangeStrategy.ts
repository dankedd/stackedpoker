/**
 * ONE canonical per-hand strategy representation for every range grid in the app:
 * an action -> frequency map. Every existing range-data shape already in the
 * codebase normalizes into this without re-authoring any content:
 *
 *   - `MttRfiActionFrequencies` (mttRfiBaselines.ts) — sparse multi-action dict
 *     (raise/limp/jam/fold), already exactly this shape.
 *   - `RangeEntry` (preflopBaselines.ts / threebetBaselines.ts / defendBaselines.ts)
 *     — a single action at `freq`, with the fold complement implicit.
 *   - Plain membership lists (`string[]`) — a hand that's "in" a range at 100%
 *     one action (e.g. a pure open-raise range).
 *
 * Nothing upstream needs to change shape; these are read-only adapters. The
 * point of centralizing here is so exactly one renderer (`PokerRangeGrid`'s
 * `strategy` mode) can turn ANY of the above into a proportional segmented
 * cell, instead of each grid consumer inventing its own mixed-frequency display.
 */

/** Action identifiers are open-ended strings (not a fixed union) so the model
 *  supports an arbitrary action set per spot: raise/fold, 4bet/call/fold,
 *  limp/raise/jam/fold, squeeze/call/fold, etc. */
export type ActionId = string

/** Sparse action -> frequency (0-1) map for one hand. Missing keys are 0. */
export type StrategyMix = Record<ActionId, number>

/** Hand -> StrategyMix, for a full 13x13 grid (sparse — an absent hand is
 *  conventionally 100% fold, matching MTT_RFI_CHARTS's existing convention). */
export type RangeStrategyMap = Record<string, StrategyMix>

const DEFAULT_EPSILON = 0.02

/** Sum of all action frequencies for one hand — should land at ~1.0. */
export function sumFreqs(freqs: StrategyMix): number {
  return Object.values(freqs).reduce((sum, f) => sum + (f ?? 0), 0)
}

/** Whether a mix's frequencies sum to ~100%, within floating-point tolerance. */
export function isValidMix(freqs: StrategyMix, epsilon = DEFAULT_EPSILON): boolean {
  if (Object.keys(freqs).length === 0) return false
  return Math.abs(sumFreqs(freqs) - 1) <= epsilon
}

/** Drops zero/undefined entries so a mix only lists actions that actually occur. */
export function pruneMix(freqs: StrategyMix): StrategyMix {
  const out: StrategyMix = {}
  for (const [action, freq] of Object.entries(freqs)) {
    if (freq != null && freq > 1e-9) out[action] = freq
  }
  return out
}

// ── Adapters from existing source shapes ─────────────────────────────────────

/** A `RangeEntry`-style single-action-vs-fold entry (e.g. 'A5s: raise 0.65') ->
 *  a full mix, with the fold complement made explicit. */
export function fromActionFold(action: ActionId, freq: number, foldAction: ActionId = 'fold'): StrategyMix {
  const clamped = Math.max(0, Math.min(1, freq))
  const mix: StrategyMix = { [action]: clamped }
  // Rounded to avoid binary floating-point noise (e.g. 1 - 0.7 = 0.30000000000000004)
  // leaking into displayed percentages or equality checks.
  const rest = Math.round((1 - clamped) * 1e6) / 1e6
  if (rest > 1e-9) mix[foldAction] = (mix[foldAction] ?? 0) + rest
  return mix
}

/** A pure 100%-one-action hand (e.g. plain membership ranges). */
export function fromPureAction(action: ActionId): StrategyMix {
  return { [action]: 1 }
}

/** `RangeEntry[]` (preflopBaselines.ts/threebetBaselines.ts/defendBaselines.ts) -> a full RangeStrategyMap. */
export function rangeEntriesToStrategyMap(
  entries: { hand: string; freq: number }[],
  action: ActionId,
  foldAction: ActionId = 'fold',
): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  for (const e of entries) map[e.hand] = fromActionFold(action, e.freq, foldAction)
  return map
}

/** Plain membership hand list -> a full RangeStrategyMap (each hand 100% `action`). */
export function membershipToStrategyMap(hands: string[], action: ActionId): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  for (const h of hands) map[h] = fromPureAction(action)
  return map
}

/** A sparse multi-action dict (e.g. `MttRfiCell.actions`) -> a pruned mix. Already
 *  the same shape — this only strips zero/undefined entries for safe rendering. */
export function fromActionDict(actions: Partial<Record<string, number>>): StrategyMix {
  return pruneMix(actions as StrategyMix)
}

// ── Reading a mix back out ────────────────────────────────────────────────────

/** The single highest-frequency action, or undefined for an empty mix. Ties
 *  break toward whichever action was inserted first (stable `Object.entries` order). */
export function dominantAction(freqs: StrategyMix): ActionId | undefined {
  let best: ActionId | undefined
  let bestFreq = -1
  for (const [action, freq] of Object.entries(freqs)) {
    if ((freq ?? 0) > bestFreq) {
      best = action
      bestFreq = freq ?? 0
    }
  }
  return best
}

/** The dominant action's own frequency (0 for an empty mix). */
export function dominantFrequency(freqs: StrategyMix): number {
  const action = dominantAction(freqs)
  return action ? freqs[action] ?? 0 : 0
}

/** Thresholds for the learner-facing mix vocabulary (spec #8) — deliberately
 *  coarse (three tiers) so beginners get a qualitative read, with exact
 *  percentages always available via hover/tap. */
export const PURE_THRESHOLD = 0.98
export const MOSTLY_THRESHOLD = 0.65

export type MixTier = 'pure' | 'mostly' | 'mixed'

export interface MixDescription {
  tier: MixTier
  /** The action the label refers to — the dominant action for 'pure'/'mostly', undefined for 'mixed'. */
  action?: ActionId
  /** Learner-facing label, e.g. "PURE CALL", "MOSTLY CALL", "MIXED". */
  label: string
}

/** Formats an action id into a display label (title case, keeps existing
 *  short-hand like "3bet" readable) — used only for the vocabulary label,
 *  never for grading. Prefer `actionStyle(action).label` for a curated label
 *  when the action is a known one; this is the generic fallback. */
function titleCase(action: ActionId): string {
  return action
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Learner-facing qualitative description of a mix — "PURE CALL" / "MOSTLY CALL" /
 *  "MIXED" / "MOSTLY FOLD" etc. Exact percentages remain available separately
 *  (hover/tap) — this is intentionally coarse, see spec #8. */
export function classifyMix(freqs: StrategyMix, actionLabel: (action: ActionId) => string = titleCase): MixDescription {
  const action = dominantAction(freqs)
  if (!action) return { tier: 'mixed', label: 'MIXED' }
  const freq = freqs[action] ?? 0
  if (freq >= PURE_THRESHOLD) return { tier: 'pure', action, label: `PURE ${actionLabel(action).toUpperCase()}` }
  if (freq >= MOSTLY_THRESHOLD) return { tier: 'mostly', action, label: `MOSTLY ${actionLabel(action).toUpperCase()}` }
  return { tier: 'mixed', action, label: 'MIXED' }
}

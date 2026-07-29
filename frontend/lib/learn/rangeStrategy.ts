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

/**
 * What a range dataset's per-hand frequency actually PROVES — there is no
 * safe universal default, so every adapter that turns raw source data into a
 * `RangeStrategyMap` must be told this explicitly (see `rangeEntriesToStrategyMap`
 * below). This is the fix for the "AA call 20% -> AA fold 80%" bug: that bug
 * was exactly a `binary` assumption silently applied to what was actually an
 * `action_slice` source (defendBaselines.ts's BB-calling-only data, ported
 * from a backend file whose own docstring says "these ranges represent BB
 * CALLING ranges — not BB's full defend range").
 *
 *  - `complete_strategy` — every action is known; frequencies for one hand
 *    already sum to ~1 (e.g. MTT_RFI_CHARTS's raise/limp/jam/fold cells).
 *  - `binary`             — exactly two actions exist and the source proves
 *    it (e.g. RFI: a position either raises or folds — nothing else is on
 *    the table at that decision point). The complement IS the true fold rate.
 *  - `action_slice`       — the source tracks ONE real action's frequency in
 *    isolation; the remainder is genuinely UNKNOWN (could be fold, could be
 *    another action tracked in a separate, independently-authored source, or
 *    a mix of both) and must never be presented as fold.
 *  - `membership`         — a plain hand list, no frequency data at all; a
 *    listed hand is 100% one action, nothing is claimed about hands absent
 *    from the list.
 */
export type RangeSemantics =
  | { kind: 'complete_strategy' }
  | { kind: 'binary'; action: ActionId; complement: ActionId }
  | { kind: 'action_slice'; action: ActionId }
  | { kind: 'membership'; action: ActionId }

/** Reserved action id for an `action_slice`'s remainder. Deliberately NOT a
 *  caller-supplied parameter (unlike `binary`'s `complement`) — that's what
 *  makes it structurally impossible to accidentally relabel an action
 *  slice's unknown remainder as "fold" (or anything else) at a call site.
 *  Renders with its own distinct, non-fold style — see actionStyles.ts. */
export const UNSPECIFIED_ACTION = 'other' as const

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

/** A single action's frequency -> a full mix, with an explicit complement
 *  action carrying the remainder. Low-level primitive: it makes no claim
 *  about what the complement action MEANS — that judgment call belongs to
 *  the caller (see `rangeEntriesToStrategyMap`, which is the actual guarded
 *  entry point every real data source should go through instead of calling
 *  this directly with a hand-picked complement). */
export function fromActionFold(action: ActionId, freq: number, complementAction: ActionId): StrategyMix {
  const clamped = Math.max(0, Math.min(1, freq))
  const mix: StrategyMix = { [action]: clamped }
  // Rounded to avoid binary floating-point noise (e.g. 1 - 0.7 = 0.30000000000000004)
  // leaking into displayed percentages or equality checks.
  const rest = Math.round((1 - clamped) * 1e6) / 1e6
  if (rest > 1e-9) mix[complementAction] = (mix[complementAction] ?? 0) + rest
  return mix
}

/** A pure 100%-one-action hand (e.g. plain membership ranges). */
export function fromPureAction(action: ActionId): StrategyMix {
  return { [action]: 1 }
}

/**
 * `RangeEntry[]` (preflopBaselines.ts/threebetBaselines.ts/defendBaselines.ts) ->
 * a full RangeStrategyMap — THE guarded entry point for that shape. `semantics`
 * is mandatory (no default) precisely because the historical bug here was a
 * silent default: treating every source's `1 - freq` as "fold" regardless of
 * whether the source actually proved that. Only `binary` sources may name
 * their own complement action (because they can prove it IS the true
 * remainder); `action_slice` sources are routed to the reserved
 * `UNSPECIFIED_ACTION` unconditionally — there is no parameter that could
 * accidentally relabel an unknown remainder as fold.
 */
export function rangeEntriesToStrategyMap(
  entries: { hand: string; freq: number }[],
  semantics: RangeSemantics,
): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  if (semantics.kind === 'binary') {
    // Sparse on purpose: a `binary` source PROVES the complement is fold for
    // every hand, including ones absent from `entries` — so leaving them out
    // of the map and letting the grid's own `{ fold: 1 }` sparse-chart default
    // handle them is correct, not a shortcut (matches MTT_RFI_CHARTS' existing,
    // deliberately-sparse convention).
    for (const e of entries) map[e.hand] = fromActionFold(semantics.action, e.freq, semantics.complement)
  } else if (semantics.kind === 'action_slice') {
    // Sparse, deliberately — same shape as `binary` above. A hand missing from
    // `entries` is left OUT of the map on purpose; `PokerRangeGrid` reads
    // `strategySemantics` itself (see `strategyAbsentMix` there) and resolves
    // any hand absent from this map to the reserved `UNSPECIFIED_ACTION`
    // bucket, never fold. That is what fixes the "A5s bug": an action slice's
    // absence proves 0% of `action`, never proves fold, so the ONE place that
    // decides what an absent hand renders as must know `semantics` — which is
    // exactly why `strategySemantics` is a mandatory, forwarded field on
    // `DecisionSpotRangeReveal` and a prop on `PokerRangeGrid`, not something
    // baked into this map at build time.
    for (const e of entries) map[e.hand] = fromActionFold(semantics.action, e.freq, UNSPECIFIED_ACTION)
  } else {
    // 'complete_strategy' has multiple actions per hand — RangeEntry[] (one
    // action + one freq per hand) can't express that; use fromActionDict
    // instead. 'membership' has no per-hand frequency at all — use
    // membershipToStrategyMap. Both are programmer errors if hit here, not
    // a possible real-data shape, so this fails loudly rather than silently
    // guessing a fold complement.
    throw new Error(
      `rangeEntriesToStrategyMap: semantics.kind "${semantics.kind}" cannot be built from RangeEntry[] (one action + one frequency per hand) — use fromActionDict for a complete multi-action strategy, or membershipToStrategyMap for a plain hand list.`,
    )
  }
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

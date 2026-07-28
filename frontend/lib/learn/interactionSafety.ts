/**
 * Answer-leakage safeguards for interactive lesson steps.
 *
 * Shared by every numeric-slider / multiple-choice step component so that no
 * UI default or display order can hint at — or hand the learner — the
 * correct answer before they submit. See the Module 2 answer-leakage audit
 * for the class of bug this exists to prevent.
 */

import type { StepOption } from './types'

// ── Deterministic seeded RNG ──────────────────────────────────────────────────
// Never Math.random(): these values must be stable across server render and
// client hydration (and reproducible in tests), or they'd cause hydration
// mismatches / flaky assertions.

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Slider defaults ────────────────────────────────────────────────────────────

/**
 * A neutral slider starting point guaranteed not to equal — or sit
 * suspiciously close to — `correctAnswer`. Deterministic: the same
 * (correctAnswer, min, max) always returns the same value, so it never
 * causes a hydration mismatch and stays reproducible in tests.
 *
 * Defaults to the midpoint of the range, which reveals nothing about
 * whether the true answer is above or below it. Only nudges away from the
 * midpoint (by a small, fixed offset) when the correct answer itself sits
 * too close to the midpoint to use as-is.
 */
export function getNeutralSliderStart(correctAnswer: number, min = 0, max = 100): number {
  const range = max - min
  if (range <= 0) return min
  const mid = min + range / 2
  const minGap = range * 0.08

  if (Math.abs(mid - correctAnswer) >= minGap) {
    return mid
  }

  const offset = minGap * 1.5
  const candidate = correctAnswer <= mid ? mid + offset : mid - offset
  return Math.min(max, Math.max(min, candidate))
}

// ── Option ordering ───────────────────────────────────────────────────────────

/**
 * Deterministically shuffles `items` using `seed` (typically a step id) so a
 * given step always renders its options in the same order on every load —
 * but no particular option (e.g. the correct one) is systematically favoured
 * into a fixed visual position across different steps.
 */
export function shuffleBySeed<T>(items: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed))
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Visual ↔ answer binding ────────────────────────────────────────────────────
// Global rule (see the Module "visual comparison" UX audit): whenever a question
// shows two or more visual alternatives — hole cards, 13x13 ranges, boards, bet
// sizes, etc. — side by side, the selection control for each one must be
// physically attached to the visual it represents. `shuffleBySeed` alone is not
// enough for this: shuffling `options` independently of the visuals it describes
// is exactly how a visual and its answer can end up swapped. Callers that render
// a fixed set of visuals next to a separately-shuffled option list MUST route
// through `bindVisualOptions` instead of shuffling `options` directly whenever
// each visual has a specific, single option that identifies it.

export interface VisualOptionUnit<V> {
  visual: V
  option: StepOption
}

/**
 * Pairs each visual with the `StepOption` its `option_id` points to, then
 * shuffles those `{ visual, option }` units as single, atomic pairs — never
 * `options` alone — so the anti-position-bias shuffle can't separate an answer
 * button from the visual object it describes.
 *
 * Returns `null` (never a partial pairing) when any visual lacks an `option_id`
 * or its match can't be found, so callers can fall back to legacy unbound
 * rendering for conceptual questions where the options aren't a 1:1 pick of
 * "which visual is X" (e.g. a multi-sentence rationale spanning both visuals).
 */
export function bindVisualOptions<V extends { option_id?: string }>(
  visuals: readonly V[],
  options: readonly StepOption[],
  seed: string,
): VisualOptionUnit<V>[] | null {
  if (visuals.length === 0 || options.length === 0) return null
  const units: VisualOptionUnit<V>[] = []
  for (const visual of visuals) {
    if (!visual.option_id) return null
    const option = options.find((o) => o.id === visual.option_id)
    if (!option) return null
    units.push({ visual, option })
  }
  return shuffleBySeed(units, seed)
}

// ── Question-heading alignment ────────────────────────────────────────────────
// See LEARN_QUESTION_QA.md "QUESTION–INTERACTION ALIGNMENT": a generic
// action-oriented heading ("What is your action?") is only honest when every
// option IS a poker action (Fold/Check/Call/Bet/Raise/All-in, optionally with
// a sizing suffix). It must never be shown above Yes/No, IP/OOP, classification,
// or comparison-style options — those need their own authored question text.

const POKER_ACTION_LABEL_RE =
  /^(fold|check|call|bet|raise|all-?in|shove|jam|limp|check-raise|donk bet|min-?raise|[2-5]-?bet|3bet|squeeze)(\s*\(.*\))?(\s+(to|for)?\s*[~\d.]+%?(bb|x)?\.?)?$/i

/** True only if every option label is (up to a sizing/annotation suffix) an actual poker action. */
export function isPokerActionSet(labels: readonly string[]): boolean {
  return labels.length > 0 && labels.every((l) => POKER_ACTION_LABEL_RE.test(l.trim()))
}

// ── Canonical poker-action ordering ───────────────────────────────────────────
// Global rule: Fold -> Check -> Call -> Raise -> All-in must appear in that exact
// left-to-right / top-to-bottom order in every decision spot across every module
// and lesson, so learners build spatial muscle memory for button position ("Fold
// is always leftmost"). This is intentionally narrower than `isPokerActionSet`
// above (which also matches shove/jam/limp/3bet/check-raise/etc. purely to decide
// a heading) — only labels that ARE exactly fold/check/call/raise/all-in (up to a
// sizing/annotation suffix) participate in the fixed order. Any other option set —
// full-sentence conceptual answers, or action vocabulary outside this list (jam,
// limp, shove, 3bet, squeeze, bet-size buckets, ...) — keeps its existing seeded
// shuffle untouched, so authored/randomized behavior for theory questions never
// changes. `orderStepOptions` is the single call site every decision-style step
// component should use instead of calling `shuffleBySeed` on `options` directly.

export const POKER_ACTION_ORDER = ['fold', 'check', 'call', 'raise', 'all_in'] as const
export type CanonicalPokerAction = (typeof POKER_ACTION_ORDER)[number]

const CANONICAL_ACTION_LABEL_RE =
  /^(fold|check|call|raise|all[\s-]?in)(\s*\(.*\))?(\s+(to|for)?\s*[~\d.]+%?(bb|x)?\.?)?$/i

/** Maps a label to its canonical bucket, or null if it isn't a clean canonical
 *  action (up to an optional sizing/annotation suffix, e.g. "Raise to 3x"). */
export function canonicalPokerAction(label: string): CanonicalPokerAction | null {
  const match = CANONICAL_ACTION_LABEL_RE.exec(label.trim())
  if (!match) return null
  const root = match[1].toLowerCase().replace(/[\s-]/g, '')
  return root === 'allin' ? 'all_in' : (root as CanonicalPokerAction)
}

/** True only if every label is a clean canonical action — never a sentence that merely mentions one. */
export function isCanonicalActionSet(labels: readonly string[]): boolean {
  return labels.length > 0 && labels.every((l) => canonicalPokerAction(l) !== null)
}

/**
 * Orders `options` for display. When they form a clean canonical poker-action
 * set, always returns them Fold -> Check -> Call -> Raise -> All-in, regardless
 * of authoring order or seed — ties (e.g. two differently-sized raises) keep
 * their relative input order. Otherwise falls back to the existing per-step
 * seeded shuffle so conceptual/theory option sets keep their current randomized
 * behavior. Never mutates `options`; never changes correctness, ids, or feedback.
 */
export function orderStepOptions<T extends { label: string }>(options: readonly T[], seed: string): T[] {
  const labels = options.map((o) => o.label)
  if (!isCanonicalActionSet(labels)) return shuffleBySeed(options, seed)
  return options
    .map((item, index) => ({ item, index, rank: POKER_ACTION_ORDER.indexOf(canonicalPokerAction(item.label)!) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
}

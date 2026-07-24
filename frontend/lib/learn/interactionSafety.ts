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

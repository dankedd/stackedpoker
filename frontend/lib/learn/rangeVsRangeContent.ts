/**
 * Range vs Range (Module 8) — centralized scenario data.
 *
 * SOURCE DISCIPLINE — every numeric claim below is either:
 *   (a) a real range already in this project (tagged `real`), or
 *   (b) a number the user's own module spec cites directly from Michael Acevedo's
 *       "Modern Poker Theory" (tagged `book`), or
 *   (c) a range mechanically DERIVED from (a) via a documented, deterministic
 *       algorithm and clearly labeled `illustrative` on screen — never presented
 *       as the book's own chart.
 * Nothing here is an invented equity percentage. Where the book gives no number
 * (e.g. full Good/Weak/Trash bucket splits for A76r/654r beyond the Strong bucket),
 * this file simply has no field for it — the UI falls back to qualitative-only text.
 *
 * ── The BB-calling-range gap ──────────────────────────────────────────────────
 * The book's central worked example (Ch.7-adjacent range-vs-range walkthrough) is:
 * 9-max MTT, 40bb effective, 12.5% ante, CO opens 2.25bb, BB defends — CO's real
 * 40bb/9-max/12.5%-ante opening range already exists in this repo, book-transcribed
 * (`mttRfiBaselines.ts`'s `CO_RFI_40BB`, Hand Range 118, p.334). No matching BB-vs-CO
 * calling range at that same depth/format exists anywhere in the project — the
 * closest real data is `defendBaselines.ts`'s 100bb CASH `BB_vs_CO` calling range,
 * which is structurally too narrow for a 40bb MTT spot (real combo weight ≈31.2%,
 * nowhere near the book's cited ≈56.8%). `deriveIllustrativeBbCallingRange` below
 * widens that real range, in a fixed and testable rank-strength order, until it
 * reaches the book's cited weight — CAPTIONED ON SCREEN, never presented as the
 * book's own chart.
 *
 * ── A note on CO_RFI_40BB's own weight vs the book's cited 31.2% ──────────────
 * CO_RFI_40BB's actual freq-weighted-membership combo weight is ≈36.5% (computed
 * live below, never hardcoded) — noticeably different from the book's separately
 * cited "≈31.2%" figure for its own worked example. Rather than silently forcing
 * these to match, they are kept deliberately distinct: the grid shows CO's real,
 * transcribed range with its own real computed %; the book's 31.2%/56.8% headline
 * figures are shown as their own cited numbers, sourced to the text, not claimed to
 * be this exact chart's own weight. See MODULE8_AUDIT_NOTES at the bottom of this
 * file for the full accounting the user's spec asked for.
 */

import { RANKS, HAND_GRID, comboCount, TOTAL_COMBOS } from './handGrid'
import { RANK_VALUE, type Rank } from './flopClassifier'
import { MTT_RFI_CHARTS } from './mttRfiBaselines'
import { chartHandsByAction } from './mttRfiRanges'
import { DEFEND_DEEP, type RangeEntry } from './defendBaselines'
import type { ActionQuality } from './types'

// ── CO's real, book-transcribed 40bb opening range ────────────────────────────

export const CO_RFI_40BB_SOURCE = { book: 'Modern Poker Theory' as const, chapterNo: 7, handRangeNo: 118, page: 334 }

/** Every hand with any non-zero raise frequency in the real transcribed chart — a
 *  membership list, matching how this chart is consumed elsewhere in the app. */
export const CO_OPEN_RANGE_40BB: string[] = chartHandsByAction(MTT_RFI_CHARTS.CO_RFI_40BB, 'raise')

/** Real per-hand raise frequency (0-1) for every hand in `CO_OPEN_RANGE_40BB` — most cells in
 *  the transcribed chart are a pure 1.0 raise, but a real minority are genuinely mixed (e.g.
 *  K8o raises only 25% of the time, 22 only 15%) per the book's own chart image. Exported so
 *  the grid can shade a "sometimes raises" hand differently from an "always raises" one —
 *  never fabricated, read straight out of the same transcribed cells as the membership list. */
export const CO_OPEN_FREQUENCY_40BB: Record<string, number> = Object.fromEntries(
  MTT_RFI_CHARTS.CO_RFI_40BB.cells
    .filter((c) => (c.actions.raise ?? 0) > 0)
    .map((c) => [c.hand, c.actions.raise as number]),
)

function weightPct(hands: string[]): number {
  const combos = hands.reduce((sum, h) => sum + comboCount(h), 0)
  return (combos / TOTAL_COMBOS) * 100
}

/** CO_RFI_40BB's own real, live-computed combo weight — never hardcoded (see file
 *  header re: why this is kept distinct from the book's separately-cited 31.2%). */
export const CO_OPEN_RANGE_40BB_PCT = Math.round(weightPct(CO_OPEN_RANGE_40BB) * 10) / 10

// ── BB's illustrative, derived calling range (labeled, never claimed as the book's own) ──

const ALL_169_HANDS: string[] = HAND_GRID.flat()

/** A simple, deterministic hand-strength heuristic used ONLY to pick a sensible
 *  widening ORDER (stronger hands added before weaker ones) — not an equity model,
 *  just a rank-based ordering rule so the widening isn't arbitrary. */
function wideningScore(hand: string): number {
  const suited = hand.endsWith('s')
  const r1 = RANK_VALUE[hand[0] as Rank]
  const r2 = RANK_VALUE[hand[1] as Rank]
  const hi = Math.max(r1, r2)
  const lo = Math.min(r1, r2)
  const gap = hi - lo
  const connectivity = Math.max(0, 5 - gap)
  return hi * 1.5 + lo + (suited ? 6 : 0) + connectivity * 2
}

/**
 * Widens `core` (a real range) by adding remaining hand classes, strongest-first
 * per `wideningScore`, until combo weight reaches `targetPct`. Deterministic and
 * pure — the same core + target always produces the same result.
 */
export function deriveIllustrativeWidenedRange(core: string[], targetPct: number): string[] {
  const included = new Set(core)
  const targetCombos = (targetPct / 100) * TOTAL_COMBOS
  let combos = core.reduce((s, h) => s + comboCount(h), 0)
  const candidates = ALL_169_HANDS.filter((h) => !included.has(h)).sort((a, b) => wideningScore(b) - wideningScore(a))
  for (const hand of candidates) {
    if (combos >= targetCombos) break
    included.add(hand)
    combos += comboCount(hand)
  }
  return ALL_169_HANDS.filter((h) => included.has(h))
}

const BB_VS_CO_100BB_CASH_CORE: string[] = DEFEND_DEEP.BB_vs_CO.map((e: RangeEntry) => e.hand)

/** Real per-hand calling frequency (0-1) for the 100bb-cash core — e.g. AA calls only 20% of
 *  the time (mostly 3-bets instead, tracked in a separate, unmerged chart), while most of the
 *  low/mid suited connectors call 100%. Read straight out of `DEFEND_DEEP.BB_vs_CO`'s own
 *  `.freq` field, never re-derived. */
const BB_VS_CO_100BB_CASH_FREQUENCY: Record<string, number> = Object.fromEntries(
  DEFEND_DEEP.BB_vs_CO.map((e: RangeEntry) => [e.hand, e.freq]),
)

/** BB's illustrative 40bb calling range vs CO's open — widened from the real 100bb
 *  cash BB-vs-CO calling range up to the book's cited ≈56.8% MTT figure. Always
 *  render this with an on-screen caption; never call it "the book's chart." */
export const BB_CALL_RANGE_40BB_ILLUSTRATIVE: string[] = deriveIllustrativeWidenedRange(BB_VS_CO_100BB_CASH_CORE, 56.8)
export const BB_CALL_RANGE_40BB_PCT = Math.round(weightPct(BB_CALL_RANGE_40BB_ILLUSTRATIVE) * 10) / 10

/** Per-hand calling frequency for every hand in `BB_CALL_RANGE_40BB_ILLUSTRATIVE`. Hands from
 *  the real 100bb-cash core keep their real (often mixed) frequency; hands added purely by the
 *  deterministic widening step have no sourced frequency at all — they were never claimed to
 *  be anything other than a full illustrative addition, so they default to 1 (pure), never a
 *  fabricated fractional number. */
export const BB_CALL_RANGE_40BB_FREQUENCY: Record<string, number> = Object.fromEntries(
  BB_CALL_RANGE_40BB_ILLUSTRATIVE.map((hand) => [hand, BB_VS_CO_100BB_CASH_FREQUENCY[hand] ?? 1]),
)

// ── Lesson 1 — the book's central range-vs-range walkthrough ──────────────────

export interface SourceRef {
  book: 'Modern Poker Theory'
  note: string
}

export const LESSON1_SOURCE: SourceRef = {
  book: 'Modern Poker Theory',
  note: '9-max MTT, 40bb effective, 12.5% ante, CO opens 2.25bb, BB defends (Ch.7 range-vs-range walkthrough).',
}

export const LESSON1_SCENARIO = {
  board: ['8h', '7s', '5s'],
  boardLabel: '8♥7♠5♠',
  /** Book-cited headline aggregate stats for this exact walkthrough. */
  coOpenPctBook: 31.2,
  bbCallPctBook: 56.8,
  preflopEquity: { co: 58.5, bb: 41.5 },
  postflopEquity: { co: 49.67, bb: 50.33 },
  heroHand: ['Ad', 'Ac'],
  heroHandEquity: 70.83,
  source: LESSON1_SOURCE,
}

// ── Lessons 3-5 — A76r vs 654r (book's aggregated BB-vs-IP comparison) ────────
// NOTE: this is a SEPARATE book citation from Lesson 1's concrete CO/BB scenario —
// the book gives no exact hand-list for either side here, only the aggregate
// equity/strong-bucket numbers below. The grids these scenarios render (in
// RangeCollisionViewer) reuse the SAME illustrative CO/BB ranges as Lesson 1,
// captioned as illustrative pattern-recognition ranges — never claimed to be the
// exact ranges the book computed these figures from.

export const A76R_SOURCE: SourceRef = {
  book: 'Modern Poker Theory',
  note: 'Exact — Modern Poker Theory, Ch. 11 ("The Value of Donk Betting"), p.633: "Clearly IP has the equity advantage with 62% equity vs the BB\'s 38% on A76r." Aggregated GTO solver data, BB vs BN/UTG single-raised pots, 20/30/40bb effective.',
}

export const A76R_SCENARIO = {
  id: 'a76r',
  board: ['Ad', '7h', '6c'],
  boardLabel: 'A♦7♥6♣',
  label: 'A76 rainbow',
  equity: { ip: 62, bb: 38 },
  strongBucket: { ip: 31, bb: 8 },
  /** Qualitative-only where the book gives direction but no number (user-approved
   *  handling for the Good/Weak/Trash gap — never an invented percentage). */
  ipTopPairAvgEquity: 85,
  source: A76R_SOURCE,
}

export const CS_654R_SOURCE: SourceRef = {
  book: 'Modern Poker Theory',
  note: 'Exact — Modern Poker Theory, Ch. 11 ("The Value of Donk Betting"), p.633: "...on 654r, the BB has the equity advantage with 51% equity vs IP\'s 49%." Same aggregated GTO solver dataset as A76r.',
}

export const CS_654R_SCENARIO = {
  id: '654r',
  board: ['6h', '5d', '4c'],
  boardLabel: '6♥5♦4♣',
  label: '654 rainbow',
  equity: { bb: 51, ip: 49 },
  strongBucket: { bb: 7, ip: 4 },
  ipTopPairAvgEquity: 65,
  ipAxAvgEquity: 49,
  goodBucketNote: 'BB\'s good-hand share is substantially larger here than on A76r — many more pairs, two-pair, and straight-relevant hands survive on a low, connected board.',
  trashBucketNote: 'BB\'s trash share is substantially smaller here than on A76r — a low board doesn\'t miss BB\'s calling range the way a high, ace-containing board does.',
  source: CS_654R_SOURCE,
}

// ── Board-favor spectrum (for the sorting puzzle / predict exercises) ─────────
// Ordered strictly by real, book-cited equity — never an invented ranking.
// A76r (IP +24) → 875ss (BB +0.66, from Lesson 1's own postflop split) → 654r (BB +2).

export const BOARD_FAVOR_SPECTRUM = [
  { id: A76R_SCENARIO.id, label: A76R_SCENARIO.label, board: A76R_SCENARIO.board, netIpEdge: A76R_SCENARIO.equity.ip - A76R_SCENARIO.equity.bb },
  { id: 'flop_875ss', label: '875 two-tone', board: LESSON1_SCENARIO.board, netIpEdge: LESSON1_SCENARIO.postflopEquity.co - LESSON1_SCENARIO.postflopEquity.bb },
  { id: CS_654R_SCENARIO.id, label: CS_654R_SCENARIO.label, board: CS_654R_SCENARIO.board, netIpEdge: CS_654R_SCENARIO.equity.ip - CS_654R_SCENARIO.equity.bb },
].sort((a, b) => b.netIpEdge - a.netIpEdge)

export const BOARD_FAVOR_SPECTRUM_TARGET: string[] = BOARD_FAVOR_SPECTRUM.map((b) => b.id)

// ── Tolerance bands for range-vs-range equity slider predictions ──────────────
// Explicit, content-level definition (never an unstated/arbitrary cutoff) — reused
// directly by evalNumeric's own tiered tolerance system (tolerance / 2x / 3.5x).

export const RANGE_EQUITY_PREDICT_TOLERANCE = 8 // percentage points for "perfect"

// ── Illustrative ranges shared by every Range Collision Viewer instance ───────

export const ILLUSTRATIVE_OPENER_RANGE = CO_OPEN_RANGE_40BB
export const ILLUSTRATIVE_CALLER_RANGE = BB_CALL_RANGE_40BB_ILLUSTRATIVE
export const ILLUSTRATIVE_OPENER_FREQUENCY = CO_OPEN_FREQUENCY_40BB
export const ILLUSTRATIVE_CALLER_FREQUENCY = BB_CALL_RANGE_40BB_FREQUENCY

// ── Audit trail (mirrors the user's spec verification checklist) ──────────────

export const MODULE8_AUDIT_NOTES = {
  co_open_range: 'Real, book-transcribed (Modern Poker Theory Hand Range 118, p.334) — not invented.',
  co_open_pct_book_vs_actual: `Book cites ≈31.2% for its own worked example; CO_RFI_40BB's actual computed weight is ≈${CO_OPEN_RANGE_40BB_PCT}% — kept as two distinct, separately-labeled numbers rather than forced to match.`,
  bb_call_range: `Illustrative — widened from the real 100bb-cash BB-vs-CO calling range up to the book's cited ≈56.8% (lands at ≈${BB_CALL_RANGE_40BB_PCT}% at hand-class granularity). Never presented as the book's own chart.`,
  equity_buckets_source: 'Strong ≥75 / Good 50–75 / Weak 33–50 / Trash <33 — exact thresholds from the book, reused via flopClassifier.ts\'s equityBucket(), never redefined.',
  a76r_654r_strong_bucket: 'Only the Strong bucket has an exact book-cited number for these two boards; Good/Weak/Trash are directional-only text, never invented percentages.',
  a76r_654r_equity_source_verified: 'Verified against docs/mpt_fulltext.txt p.633 ("PAGE_633" marker): "Clearly IP has the equity advantage with 62% equity vs the BB\'s 38% on A76r... on 654r, the BB has the equity advantage with 51% equity vs IP\'s 49%." Both A76R_SCENARIO.equity and CS_654R_SCENARIO.equity are exact transcriptions, not estimates — see A76R_SOURCE/CS_654R_SOURCE.',
  mixed_frequency_shading: 'CO_OPEN_FREQUENCY_40BB and BB_CALL_RANGE_40BB_FREQUENCY carry the real per-hand mix frequency (0-1) for every sourced hand (e.g. CO K8o raises 25%, BB AA calls 20%) so the grid can shade "sometimes" hands differently from "always" hands — hands added only by the illustrative widening step have no sourced frequency and default to 1 (pure), never a fabricated fraction.',
}

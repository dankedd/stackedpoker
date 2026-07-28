/**
 * Deterministic hand-class × board interaction classifier — Module 8 (Range vs Range).
 *
 * Answers a factual, verifiable question — "on this exact board, what kind of made hand
 * or draw does this hand-CLASS represent?" — using pure rank-based card logic. This is
 * NOT an equity engine: it never outputs a percentage, and it deliberately excludes
 * flush-relevant categories, because a hand-class notation like "97s" spans 4 concrete
 * combos that don't all share the same suit — claiming the whole class "has a flush draw"
 * would misrepresent 3 of those 4 combos. Made-straight detection reuses `classifyFlop`'s
 * already-vetted straight-window math (`flopClassifier.ts`) rather than re-deriving it;
 * only made-pair/two-pair/set/overpair classification and straight-DRAW detection are new.
 *
 * Drives the Range Collision Viewer's per-cell highlighting (`PokerRangeGrid`'s 'category'
 * mode) — illustrating WHERE a range's connection to a board concentrates, never claiming
 * a specific equity number for any cell.
 */

import { classifyFlop, RANK_VALUE, type Rank } from './flopClassifier'

export type HandBoardCategory =
  | 'set'
  | 'two_pair'
  | 'overpair'
  | 'top_pair'
  | 'weak_pair'
  | 'underpair'
  | 'straight'
  | 'straight_draw'
  | 'overcards'
  | 'none'

/** Display metadata shared by every consumer (grid legend, X-Ray highlight mapping). */
export const HAND_BOARD_CATEGORY_LABEL: Record<HandBoardCategory, string> = {
  set: 'Set',
  two_pair: 'Two pair',
  overpair: 'Overpair',
  top_pair: 'Top pair',
  weak_pair: 'Weak pair',
  underpair: 'Underpair',
  straight: 'Straight',
  straight_draw: 'Straight draw',
  overcards: 'Overcards',
  none: 'No significant interaction',
}

/**
 * The canonical 4-tier grouping of every `HandBoardCategory`, used everywhere Module 8
 * needs to visually distinguish "how much does this in-range hand actually connect with
 * the board" without inventing a new taxonomy per component.
 *
 * DELIBERATELY NAMED TO AVOID ANY OVERLAP with Modern Poker Theory's Equity Buckets
 * (Strong >=75% / Good 50-<75% / Weak 33-<50% / Trash <33%, see `flopClassifier.ts`'s
 * `equityBucket()`). These are two different measurement systems: Equity Buckets classify
 * a VERIFIED hand-vs-range equity PERCENTAGE; this tiering classifies a hand-CLASS's
 * qualitative card-logic relationship to a board (does it pair, does it complete a
 * straight, etc) with no percentage behind it at all. Earlier naming ('strong'/'medium'/
 * 'weak'/'base', labeled "Strong interaction"/"Weak interaction") accidentally reused
 * Equity Bucket vocabulary and risked implying "strong interaction" meant ">=75% equity" —
 * it never did. Renamed to 'made'/'connected'/'marginal'/'unconnected' so the two concepts
 * can never be confused on screen, in a tooltip, or in code.
 *
 * 'unconnected' explicitly means "in the preflop range, but no meaningful board
 * interaction" — NOT "out of range" (a separate, prior question `PokerRangeGrid` answers
 * via plain range membership) and NOT a claim about equity.
 */
export type HandBoardInteractionTier = 'made' | 'connected' | 'marginal' | 'unconnected'

export const HAND_BOARD_INTERACTION_TIER: Record<HandBoardCategory, HandBoardInteractionTier> = {
  set: 'made',
  straight: 'made',
  two_pair: 'made',
  overpair: 'made',
  top_pair: 'connected',
  straight_draw: 'connected',
  weak_pair: 'marginal',
  underpair: 'marginal',
  overcards: 'unconnected',
  none: 'unconnected',
}

/** UI-facing labels — never "Strong"/"Good"/"Weak"/"Trash" (those exact words are reserved
 *  for verified Equity Bucket data; see the type doc comment above). */
export const HAND_BOARD_INTERACTION_TIER_LABEL: Record<HandBoardInteractionTier, string> = {
  made: 'Made hand',
  connected: 'Connected',
  marginal: 'Marginal',
  unconnected: 'In range',
}

/** Every category belonging to a given tier — e.g. `categoriesInTier('made')` ->
 *  `['set', 'straight', 'two_pair', 'overpair']`. Derived, not hand-duplicated, so the
 *  tier assignment above stays the single source of truth. */
export function categoriesInTier(tier: HandBoardInteractionTier): HandBoardCategory[] {
  return (Object.keys(HAND_BOARD_INTERACTION_TIER) as HandBoardCategory[]).filter(
    (c) => HAND_BOARD_INTERACTION_TIER[c] === tier,
  )
}

/** Categories that read as genuinely made hands on the flop — the illustrative cell set
 *  used when a Range X-Ray's STRONG equity-bucket segment is tapped (see RangeXRay.tsx).
 *  Explicitly NOT a claim these hands hit any specific % of the time, and NOT itself an
 *  Equity Bucket — see the type doc comment above for why the naming here is deliberately
 *  distinct from that vocabulary. Derived from `HAND_BOARD_INTERACTION_TIER` so the two can
 *  never drift apart. */
export const MADE_HAND_CATEGORIES: HandBoardCategory[] = categoriesInTier('made')

function parseHandClass(hand: string): { r1: Rank; r2: Rank; isPair: boolean } {
  const r1 = hand[0] as Rank
  const r2 = hand[1] as Rank
  // Pair-ness is determined by rank equality, not by the absence of an 's'/'o' suffix —
  // this keeps the classifier correct even for a bare 2-char non-pair notation like '96'
  // (no suffix), not just the canonical '96s'/'96o' forms.
  return { r1, r2, isPair: r1 === r2 }
}

/** The 10 possible straight windows, mirroring flopClassifier.ts's own (unexported) list —
 *  duplicated rather than imported since that array isn't part of its public API and this
 *  is a small, easily-tested 11-line table. */
const STRAIGHT_WINDOWS: { values: number[]; isWheel: boolean }[] = []
for (let top = 14; top >= 6; top--) {
  STRAIGHT_WINDOWS.push({ values: [top, top - 1, top - 2, top - 3, top - 4], isWheel: false })
}
STRAIGHT_WINDOWS.push({ values: [5, 4, 3, 2, 1], isWheel: true })

function valueOf(rank: Rank, isWheel: boolean): number {
  return rank === 'A' && isWheel ? 1 : RANK_VALUE[rank]
}

/** Classifies one hand-class (e.g. '77', '97s', 'AJo' — suit letter, if present, is
 *  ignored) against a 3-card flop's ranks (suits ignored). Deterministic and pure. */
export function classifyHandVsBoard(hand: string, board: string[]): HandBoardCategory {
  if (!hand || board.length < 3) return 'none'
  const boardRanks = board.slice(0, 3).map((c) => c[0].toUpperCase()) as Rank[]
  const boardValues = boardRanks.map((r) => RANK_VALUE[r])
  const boardValueSet = new Set(boardValues)
  const maxBoard = Math.max(...boardValues)

  const { r1, r2, isPair } = parseHandClass(hand)
  const v1 = RANK_VALUE[r1]

  if (isPair) {
    if (boardValueSet.has(v1)) return 'set'
    return v1 > maxBoard ? 'overpair' : 'underpair'
  }

  const v2 = RANK_VALUE[r2]
  const hi = Math.max(v1, v2)
  const lo = Math.min(v1, v2)
  const hiHits = boardValueSet.has(hi)
  const loHits = boardValueSet.has(lo)

  if (hiHits && loHits) return 'two_pair'
  if (hiHits) return hi === maxBoard ? 'top_pair' : 'weak_pair'
  if (loHits) return lo === maxBoard ? 'top_pair' : 'weak_pair'

  // No rank match — check straight potential. Made straights reuse classifyFlop's
  // already-vetted possibleFloppedStraights (rank-only, order-agnostic pair match).
  try {
    const flop = classifyFlop(board.slice(0, 3) as [string, string, string])
    const madeStraight = flop.possibleFloppedStraights.combos.some(
      ([a, b]) => (a === r1 && b === r2) || (a === r2 && b === r1),
    )
    if (madeStraight) return 'straight'
  } catch {
    // Malformed/duplicate board — fall through to the remaining, still-safe checks.
  }

  // Straight draw: any 5-card window where board + this hand cover exactly 4 of the 5
  // required values, with the hand genuinely contributing (not already fully on board).
  for (const window of STRAIGHT_WINDOWS) {
    const windowSet = new Set(window.values)
    if (!boardValues.every((v) => windowSet.has(v))) continue // board isn't part of this window at all
    const handWindowValues = [valueOf(r1, window.isWheel), valueOf(r2, window.isWheel)].filter((v) => windowSet.has(v))
    if (handWindowValues.length === 0) continue
    const covered = new Set([...boardValues, ...handWindowValues])
    if (covered.size === 4) return 'straight_draw'
  }

  if (lo > maxBoard) return 'overcards'
  return 'none'
}

/** Classifies every hand-class in `range` against `board`, keyed by hand notation. */
export function classifyRangeVsBoard(range: string[], board: string[]): Record<string, HandBoardCategory> {
  const out: Record<string, HandBoardCategory> = {}
  for (const hand of range) out[hand] = classifyHandVsBoard(hand, board)
  return out
}

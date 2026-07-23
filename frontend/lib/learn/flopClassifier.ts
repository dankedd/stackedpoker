/**
 * Deterministic flop classification (Module 6, "Understanding the Flop") —
 * the factual, book-derived (Modern Poker Theory, Ch. 11) engine every
 * Module 6 lesson/step is built on. Two separate exports on purpose:
 *
 *   - `classifyFlop` is pure fact: structure, texture, rank families, and the
 *     number/identity of possible flopped straights. Nothing here is a
 *     strategic judgment — it's the same answer regardless of who's in the
 *     hand.
 *   - `estimateVolatility` is an explicit, clearly-labeled PEDAGOGICAL MODEL
 *     (same discipline as `preflopBaselines.ts`'s `resistanceRisk`) for
 *     static/dynamic intuition-building. It is NOT solver output and must
 *     never be presented as mathematically exact — real volatility depends
 *     on the ranges in play, which this function does not see.
 *
 * Card notation: 'As', 'Kh', 'Td', '7c' — rank (uppercase) + suit (lowercase),
 * matching `combos.ts` / `PlayingCardMini.tsx`.
 */

export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2'
export type Suit = 's' | 'h' | 'd' | 'c'
export type FlopStructure = 'trips' | 'paired' | 'unpaired'
export type FlopTexture = 'monotone' | 'two_tone' | 'rainbow'
export type TwoToneSubtype = 'high_mid' | 'mid_low' | 'high_low'
export type RankFamily = 'A' | 'H' | 'M' | 'L'
export type VolatilityLevel = 'low' | 'medium' | 'high'

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS: Suit[] = ['s', 'h', 'd', 'c']

/** A=14 down to 2=2. Used for structure/family/rank comparisons and for the
 *  "ace-high" straight-window pass below. */
const RANK_VALUE: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
}

/** Exact groups from the source material: A / H = KQJT / M = 9876 / L = 5432. */
function rankFamilyOf(rank: Rank): RankFamily {
  if (rank === 'A') return 'A'
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === 'T') return 'H'
  if (rank === '9' || rank === '8' || rank === '7' || rank === '6') return 'M'
  return 'L'
}

export interface ParsedCard {
  card: string
  rank: Rank
  suit: Suit
}

function parseCard(card: string): ParsedCard {
  if (card.length !== 2) throw new Error(`Invalid card "${card}": expected rank+suit, e.g. "As"`)
  const rank = card[0].toUpperCase() as Rank
  const suit = card[1].toLowerCase() as Suit
  if (!RANKS.includes(rank)) throw new Error(`Invalid card "${card}": unknown rank "${card[0]}"`)
  if (!SUITS.includes(suit)) throw new Error(`Invalid card "${card}": unknown suit "${card[1]}"`)
  return { card: `${rank}${suit}`, rank, suit }
}

export interface StraightPossibility {
  /** How many distinct 5-consecutive-rank straights this flop's ranks could
   *  complete with two hole cards. Always 0 for paired/trips flops — a
   *  straight needs 5 distinct ranks, and a paired/trips board contributes
   *  at most 2 distinct ranks, leaving at most 4 with two hole cards. */
  count: 0 | 1 | 2 | 3
  /** The actual hole-card rank pairs that complete each possible straight,
   *  one pair per possible straight, each sorted high-to-low. */
  combos: [Rank, Rank][]
}

export interface FlopClassification {
  cards: [string, string, string]
  ranks: [Rank, Rank, Rank]
  suits: [Suit, Suit, Suit]
  structure: FlopStructure
  texture: FlopTexture
  /** Only defined for unpaired two-tone flops — see comment at call site for why. */
  twoToneSubtype?: TwoToneSubtype
  highestRank: Rank
  /** One family letter per card, in the same order as `ranks`. */
  rankFamilies: RankFamily[]
  /** `rankFamilies` joined into a single string, e.g. "AHM", "HHM", "MML". */
  family: string
  possibleFloppedStraights: StraightPossibility
}

function valueToRank(value: number): Rank {
  if (value === 14 || value === 1) return 'A'
  if (value === 13) return 'K'
  if (value === 12) return 'Q'
  if (value === 11) return 'J'
  if (value === 10) return 'T'
  return String(value) as Rank
}

/** The 10 possible straights in a standard deck: TJQKA down through the wheel A2345. */
const STRAIGHT_WINDOWS: { values: number[]; isWheel: boolean }[] = []
for (let top = 14; top >= 6; top--) {
  STRAIGHT_WINDOWS.push({ values: [top, top - 1, top - 2, top - 3, top - 4], isWheel: false })
}
STRAIGHT_WINDOWS.push({ values: [5, 4, 3, 2, 1], isWheel: true })

function computePossibleFloppedStraights(ranks: Rank[], structure: FlopStructure): StraightPossibility {
  // A straight needs 5 distinct ranks; a paired/trips flop supplies at most 2
  // distinct ranks, and two hole cards can supply at most 2 more (max 4) —
  // so straights are only possible off an unpaired (3-distinct-rank) flop.
  if (structure !== 'unpaired') return { count: 0, combos: [] }

  const combos: [Rank, Rank][] = []
  for (const window of STRAIGHT_WINDOWS) {
    const windowSet = new Set(window.values)
    const boardValues = ranks.map((r) => (r === 'A' ? (window.isWheel ? 1 : 14) : RANK_VALUE[r]))
    if (!boardValues.every((v) => windowSet.has(v))) continue
    const missing = window.values.filter((v) => !boardValues.includes(v))
    // Exactly 2 values remain: 5 window slots minus the 3 distinct board ranks.
    const [hi, lo] = [Math.max(...missing), Math.min(...missing)]
    combos.push([valueToRank(hi), valueToRank(lo)])
  }
  return { count: combos.length as 0 | 1 | 2 | 3, combos }
}

/**
 * Classifies a flop per Modern Poker Theory Ch. 11's framework. Pure and
 * factual — no strategic interpretation, no range awareness. Throws on
 * malformed or duplicate cards (an impossible flop) rather than silently
 * producing a nonsense classification.
 */
export function classifyFlop(cards: [string, string, string]): FlopClassification {
  const parsed = cards.map(parseCard)
  const seen = new Set(parsed.map((c) => c.card))
  if (seen.size !== 3) throw new Error(`Duplicate card in flop: ${cards.join(', ')}`)

  const ranks = parsed.map((c) => c.rank) as [Rank, Rank, Rank]
  const suits = parsed.map((c) => c.suit) as [Suit, Suit, Suit]

  const distinctRanks = new Set(ranks).size
  const structure: FlopStructure = distinctRanks === 1 ? 'trips' : distinctRanks === 2 ? 'paired' : 'unpaired'

  const distinctSuits = new Set(suits).size
  const texture: FlopTexture = distinctSuits === 1 ? 'monotone' : distinctSuits === 2 ? 'two_tone' : 'rainbow'

  let twoToneSubtype: TwoToneSubtype | undefined
  if (texture === 'two_tone' && structure === 'unpaired') {
    // Exactly one suit appears once ("the off card"); the other two share a suit.
    const suitCounts = new Map<Suit, number>()
    for (const s of suits) suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1)
    const offSuit = [...suitCounts.entries()].find(([, n]) => n === 1)![0]
    const offIndex = suits.indexOf(offSuit)
    const offValue = RANK_VALUE[ranks[offIndex]]
    const suitedValues = ranks.filter((_, i) => i !== offIndex).map((r) => RANK_VALUE[r])
    const [suitedHi, suitedLo] = [Math.max(...suitedValues), Math.min(...suitedValues)]
    if (offValue < suitedLo) twoToneSubtype = 'high_mid'
    else if (offValue > suitedHi) twoToneSubtype = 'mid_low'
    else twoToneSubtype = 'high_low'
  }

  const highestRank = ranks.reduce((a, b) => (RANK_VALUE[a] >= RANK_VALUE[b] ? a : b))
  const rankFamilies = ranks.map(rankFamilyOf)
  const family = rankFamilies.join('')

  const possibleFloppedStraights = computePossibleFloppedStraights(ranks, structure)

  return {
    cards,
    ranks,
    suits,
    structure,
    texture,
    twoToneSubtype,
    highestRank,
    rankFamilies,
    family,
    possibleFloppedStraights,
  }
}

export interface VolatilityEstimate {
  level: VolatilityLevel
  /** Plain-language factors that drove the score — always shown alongside
   *  the level so the estimate never looks like an unexplained black box. */
  reasons: string[]
  /** The raw heuristic score, exposed only for tests/debugging — never
   *  rendered to learners as if it were a precise, solver-derived number. */
  score: number
}

/**
 * A clearly-labeled PEDAGOGICAL heuristic for how likely a flop's relative
 * hand values are to flip as more cards come — not a solver computation,
 * and not aware of the actual ranges in play (real volatility depends on
 * that too; see Module 6 Lesson 6). Mirrors the `resistanceRisk` precedent
 * in `preflopBaselines.ts`: a named, inspectable model, not a fabricated
 * precise number.
 */
export function estimateVolatility(cards: [string, string, string]): VolatilityEstimate {
  const c = classifyFlop(cards)
  let score = 0
  const reasons: string[] = []

  if (c.texture === 'monotone') {
    score += 3
    reasons.push('Monotone board — any two-card runout can complete a flush.')
  } else if (c.texture === 'two_tone') {
    score += 1.5
    reasons.push('Two-tone board — a flush is live for one suit.')
  }

  if (c.possibleFloppedStraights.count > 0) {
    score += c.possibleFloppedStraights.count
    reasons.push(
      `${c.possibleFloppedStraights.count} possible flopped straight${c.possibleFloppedStraights.count > 1 ? 's' : ''} — hands can already be made, and more cards keep coordinating.`,
    )
  }

  if (c.structure === 'trips') {
    score -= 2
    reasons.push('Trips board — only one rank is live, sharply limiting what future cards can change.')
  } else if (c.structure === 'paired') {
    score -= 1
    reasons.push('Paired board — no straight is possible, which removes one whole axis of change.')
  }

  if (c.highestRank === 'A' && c.structure === 'unpaired' && c.texture === 'rainbow' && c.possibleFloppedStraights.count === 0) {
    score -= 1
    reasons.push('High, disconnected, rainbow — the driest shape: few runouts change who is ahead.')
  } else if (c.rankFamilies.every((f) => f === 'M' || f === 'L')) {
    score += 1
    reasons.push('All low/middle ranks — runouts in this range tend to keep adding straight and pairing possibilities.')
  }

  const level: VolatilityLevel = score >= 4.5 ? 'high' : score >= 2 ? 'medium' : 'low'
  return { level, reasons, score }
}

// ── Dimension-value lookup — shared by drill/autopsy step grading ──────────

/** The classification axes a learner can be quizzed on, one string id each —
 *  used so drills/autopsies can derive ground truth from `classifyFlop`
 *  itself instead of a hand-authored (and therefore error-prone) answer key. */
export type FlopDimensionKey = 'structure' | 'texture' | 'two_tone_subtype' | 'highest_rank_family' | 'straight_count'

export function dimensionValue(c: FlopClassification, key: FlopDimensionKey): string {
  switch (key) {
    case 'structure':
      return c.structure
    case 'texture':
      return c.texture
    case 'two_tone_subtype':
      return c.twoToneSubtype ?? 'n/a'
    case 'highest_rank_family':
      return rankFamilyOf(c.highestRank)
    case 'straight_count':
      return String(c.possibleFloppedStraights.count)
  }
}

// ── Equity buckets — exact thresholds from the source material ─────────────
// Strong >=75, Good >=50 & <75, Weak >=33 & <50, Trash <33 (hand-vs-range equity).

export type EquityBucketId = 'strong' | 'good' | 'weak' | 'trash'

export function equityBucket(pct: number): EquityBucketId {
  if (pct >= 75) return 'strong'
  if (pct >= 50) return 'good'
  if (pct >= 33) return 'weak'
  return 'trash'
}

// ── Turn impact — a labeled heuristic for "does this turn card meaningfully
// change the board", used by the Runout Storm interaction. Same discipline as
// `estimateVolatility`: explicit rules, never presented as solver-exact.

export interface TurnImpact {
  changesBoard: boolean
  reasons: string[]
}

export function turnImpact(flop: [string, string, string], turnCard: string): TurnImpact {
  const board = classifyFlop(flop)
  const turn = parseCard(turnCard)
  const reasons: string[] = []

  if (board.ranks.includes(turn.rank)) {
    reasons.push(`Pairs the board (${turn.rank}) — opens up trips/full-house possibilities that were not there before.`)
  }

  if (board.texture === 'two_tone') {
    const suitCounts = new Map<Suit, number>()
    for (const s of board.suits) suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1)
    const majoritySuit = [...suitCounts.entries()].find(([, n]) => n === 2)![0]
    if (turn.suit === majoritySuit) {
      reasons.push(`Completes a three-flush in ${turn.suit === 's' ? 'spades' : turn.suit === 'h' ? 'hearts' : turn.suit === 'd' ? 'diamonds' : 'clubs'} — a flush is now live.`)
    }
  }

  if (board.structure === 'unpaired' && board.possibleFloppedStraights.count > 0) {
    const neededRanks = new Set(board.possibleFloppedStraights.combos.flat())
    if (neededRanks.has(turn.rank)) {
      reasons.push(`${turn.rank} completes one of the board's possible straights outright.`)
    }
  }

  return { changesBoard: reasons.length > 0, reasons }
}

export { RANKS, SUITS, RANK_VALUE, rankFamilyOf }

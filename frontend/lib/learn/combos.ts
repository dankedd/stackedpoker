/**
 * Card-level combo enumeration and removal — the one piece of genuinely new
 * combinatorics math for Module 4's Blocker Lab. Elsewhere in the app,
 * "combos" means hand-*class* weighting only (pair=6, suited=4, offsuit=12,
 * see evaluator.ts's `handCombos()`); this module goes one level deeper and
 * enumerates the actual 2-card combos so a specific holding (e.g. exactly
 * A♠5♠) can be checked against them for card removal.
 *
 * Hand notation in: 'AA' (pair), 'AKs' (suited), 'AKo' (offsuit).
 * Card notation out: 'As', 'Kh', etc. (rank + suit, lowercase suit letter).
 */

export type Card = string

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const SUITS = ['s', 'h', 'd', 'c']

function parseHandNotation(hand: string): { r1: string; r2: string; shape: 'pair' | 's' | 'o' } {
  if (hand.length === 2) return { r1: hand[0], r2: hand[1], shape: 'pair' }
  return { r1: hand[0], r2: hand[1], shape: hand[2] === 's' ? 's' : 'o' }
}

/** All concrete 2-card combos for a hand-class notation (6 for a pair, 4 suited, 12 offsuit). */
export function expandHandClass(hand: string): [Card, Card][] {
  const { r1, r2, shape } = parseHandNotation(hand)
  const combos: [Card, Card][] = []

  if (shape === 'pair') {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([`${r1}${SUITS[i]}`, `${r1}${SUITS[j]}`])
      }
    }
  } else if (shape === 's') {
    for (const s of SUITS) combos.push([`${r1}${s}`, `${r2}${s}`])
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue
        combos.push([`${r1}${s1}`, `${r2}${s2}`])
      }
    }
  }
  return combos
}

/** Expand an entire range (list of hand-class notations) into all its concrete combos. */
export function expandRange(hands: string[]): [Card, Card][] {
  return hands.flatMap(expandHandClass)
}

/** Drop any combo that shares a card with `blockedCards`. */
export function removeBlocked(combos: [Card, Card][], blockedCards: string[]): [Card, Card][] {
  if (blockedCards.length === 0) return combos
  const blocked = new Set(blockedCards)
  return combos.filter(([a, b]) => !blocked.has(a) && !blocked.has(b))
}

/**
 * A canonical concrete 2-card combo for a hand-class notation — used when the
 * learner "holds" a hand and we need its exact cards to compute removal.
 * Suit choice is arbitrary but consistent (spades first, hearts second);
 * only the fact that it's one specific combo out of the class matters.
 */
export function canonicalCombo(hand: string): [Card, Card] {
  const { r1, r2, shape } = parseHandNotation(hand)
  if (shape === 'pair') return [`${r1}s`, `${r1}h`]
  if (shape === 's') return [`${r1}s`, `${r2}s`]
  return [`${r1}s`, `${r2}h`]
}

export interface BlockerBreakdown {
  hand: string
  totalCombos: number
  remainingCombos: number
  blockedCombos: number
}

/** Per hand-class in `range`, how many combos survive once `blockedCards` are removed. */
export function rangeBlockerBreakdown(range: string[], blockedCards: string[]): BlockerBreakdown[] {
  return range.map((hand) => {
    const all = expandHandClass(hand)
    const remaining = removeBlocked(all, blockedCards)
    return {
      hand,
      totalCombos: all.length,
      remainingCombos: remaining.length,
      blockedCombos: all.length - remaining.length,
    }
  })
}

/** Aggregate combo counts across a whole range, before/after removing `blockedCards`. */
export function totalBlockedCombos(
  range: string[],
  blockedCards: string[],
): { total: number; remaining: number; blocked: number } {
  const rows = rangeBlockerBreakdown(range, blockedCards)
  const total = rows.reduce((sum, r) => sum + r.totalCombos, 0)
  const remaining = rows.reduce((sum, r) => sum + r.remainingCombos, 0)
  return { total, remaining, blocked: total - remaining }
}

// ── Module 9 additions: full 169-class engine + explicit removal helpers ─────
// Everything below builds on the six functions above (which Module 4 already
// proved out) rather than replacing them — see LEARN_QUESTION_QA.md's
// data-authenticity rules: centralize combinatorics in one file, derive
// counts, never hard-code a total separately from the cards that produce it.

/** All 13 pocket-pair class notations, e.g. 'AA', 'KK', ... '22'. */
export function allPairClasses(): string[] {
  return RANKS.map((r) => `${r}${r}`)
}

/** All 78 suited-class notations ('AKs' down to '32s') and 78 offsuit-class
 *  notations ('AKo' down to '32o') — every unordered pair of distinct ranks,
 *  higher rank first (matches book/curriculum notation). */
export function allUnpairedClasses(): { suited: string[]; offsuit: string[] } {
  const suited: string[] = []
  const offsuit: string[] = []
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) {
      suited.push(`${RANKS[i]}${RANKS[j]}s`)
      offsuit.push(`${RANKS[i]}${RANKS[j]}o`)
    }
  }
  return { suited, offsuit }
}

/** All 169 starting-hand class notations (13 pairs + 78 suited + 78 offsuit). */
export function allHandClasses(): string[] {
  const { suited, offsuit } = allUnpairedClasses()
  return [...allPairClasses(), ...suited, ...offsuit]
}

/** Combo count for a single hand-class notation, derived (not hard-coded) —
 *  6 for a pair, 4 suited, 12 offsuit. */
export function handClassCombos(hand: string): number {
  return expandHandClass(hand).length
}

/** Sum of combo counts across every one of the 169 hand classes — always 1,326
 *  (78 pair + 312 suited + 936 offsuit), computed rather than asserted. */
export function totalStartingCombos(): number {
  return allHandClasses().reduce((sum, h) => sum + handClassCombos(h), 0)
}

/** All concrete combos for a "generic" unpaired two-rank hand (suited AND
 *  offsuit combined) — e.g. `expandGenericUnpaired('A','K')` returns all 16
 *  AK combos, the class a learner means when they say "AK" without a suit
 *  qualifier. Ranks may be given in either order. */
export function expandGenericUnpaired(rank1: string, rank2: string): [Card, Card][] {
  const hi = RANKS.indexOf(rank1) <= RANKS.indexOf(rank2) ? rank1 : rank2
  const lo = hi === rank1 ? rank2 : rank1
  return [...expandHandClass(`${hi}${lo}s`), ...expandHandClass(`${hi}${lo}o`)]
}

/** The combos in `combos` that ARE eliminated by `knownCards` — the complement
 *  of `removeBlocked`. Used to render "impossible" tiles (board or Hero cards). */
export function getBlockedCombos(combos: [Card, Card][], knownCards: string[]): [Card, Card][] {
  if (knownCards.length === 0) return []
  const known = new Set(knownCards)
  return combos.filter(([a, b]) => known.has(a) || known.has(b))
}

/** The combos in `combos` that survive `knownCards` — alias of `removeBlocked`
 *  under the naming this module's spec asked for; identical behavior. */
export function getRemainingCombos(combos: [Card, Card][], knownCards: string[]): [Card, Card][] {
  return removeBlocked(combos, knownCards)
}

/** Canonical, order-independent string key for a concrete 2-card combo —
 *  e.g. ['Ah','As'] and ['As','Ah'] both key to 'Ah-As'. Used to identify a
 *  specific combo tile (selection state, correct/incorrect comparison) without
 *  scattering ad-hoc string concatenation across components. */
export function comboKey(combo: [Card, Card]): string {
  return [...combo].sort().join('-')
}

/** True if either card of `combo` is in `cards`. */
export function comboContainsAny(combo: [Card, Card], cards: string[]): boolean {
  const set = new Set(cards)
  return set.has(combo[0]) || set.has(combo[1])
}

// ── Flush tiers (Lesson 9.6 — "The Nut Blocker") ──────────────────────────────
// A monotone-heavy board (e.g. Modern Poker Theory's Blocker Effects board,
// three hearts among five cards) makes a flush the dominant nut hand — combos
// naturally split into tiers by their high card. This is pure card removal:
// which ranks of one suit remain in the deck, grouped into tiers, no
// authored numbers. Verified independently against the book's own 9/8/7/6/
// 5/4/3/2/1 = 45 combo breakdown in combos.test.ts, not copied from it.

export interface FlushTier {
  /** 'nut' for the tier containing the highest remaining rank, otherwise the rank itself. */
  tierLabel: string
  combos: [Card, Card][]
}

/** Every 2-card combo of `suit`, grouped into tiers by high card, after
 *  removing any rank in `deadRanks` (cards of that suit already on the board
 *  or otherwise accounted for). A tier only exists if at least one lower
 *  remaining rank exists to pair with it — the lowest remaining rank forms no
 *  tier of its own, matching the book's example exactly (no "4-high" tier
 *  when only 10 heart ranks remain, since 4 is the lowest of them). */
export function flushTiers(suit: string, deadRanks: string[]): FlushTier[] {
  const dead = new Set(deadRanks)
  const remaining = RANKS.filter((r) => !dead.has(r))
  const tiers: FlushTier[] = []
  for (let i = 0; i < remaining.length; i++) {
    const hi = remaining[i]
    const combos: [Card, Card][] = []
    for (let j = i + 1; j < remaining.length; j++) {
      combos.push([`${hi}${suit}`, `${remaining[j]}${suit}`])
    }
    if (combos.length > 0) tiers.push({ tierLabel: i === 0 ? 'nut' : hi, combos })
  }
  return tiers
}

export { RANKS, SUITS }

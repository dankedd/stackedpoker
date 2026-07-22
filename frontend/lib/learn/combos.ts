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

export { RANKS, SUITS }

/**
 * Pure "submit -> reveal correct answer" helpers shared by every multi-item
 * classify/sort/match step component (RangeBucketSort, BoardRankSort,
 * StraightDetective, BoardAutopsy, ...).
 *
 * These functions only ever compute a correctness breakdown FROM an already
 * -submitted response — they never mutate or re-derive that response — so a
 * component can safely freeze the learner's answer at submit time, hand it to
 * `onAnswer` unchanged, and separately use these helpers purely to decide what
 * to paint on screen during the review phase.
 */

import type { LessonStep } from './types'

// ── Range bucket (Pair/Suited/Offsuit, VALUE/BLUFF/CALL/FOLD, etc.) ──────────

export interface BucketRevealItem {
  hand: string
  /** Category id the learner assigned this hand to, or undefined if unassigned. */
  yourCategoryId: string | undefined
  /** The single best/canonical category id for this hand. */
  correctCategoryId: string
  /** True if the learner's pick is the best category OR a listed acceptable alternate. */
  correct: boolean
}

export function computeBucketReveal(step: LessonStep, assignments: Record<string, string>): BucketRevealItem[] {
  const pool = step.range_bucket_pool ?? []
  const correct = step.range_bucket_correct ?? {}
  const acceptable = step.range_bucket_acceptable ?? {}

  return pool.map((hand) => {
    const yourCategoryId = assignments[hand]
    const correctCategoryId = correct[hand] ?? ''
    const accepted = acceptable[hand] ?? []
    const isCorrect = !!yourCategoryId && (yourCategoryId === correctCategoryId || accepted.includes(yourCategoryId))
    return { hand, yourCategoryId, correctCategoryId, correct: isCorrect }
  })
}

/** True only when this bucket step is exactly the mechanical Pair/Suited/Offsuit
 *  classification — the one case where a correct-or-not explanation can be
 *  generated purely from hand notation, with no curriculum authoring needed. */
export function isPairSuitedOffsuit(categories: { id: string }[]): boolean {
  const ids = [...categories.map((c) => c.id)].sort().join(',')
  return ids === 'offsuit,pair,suited'
}

/** e.g. "JTo is offsuit — the 'o' means the two cards are different suits." */
export function explainHandNotation(hand: string): string {
  if (hand.length === 2 && hand[0] === hand[1]) {
    return `${hand} is a pocket pair — both cards share the same rank.`
  }
  if (hand.endsWith('s')) {
    return `${hand} is suited — the 's' means both cards share a suit.`
  }
  if (hand.endsWith('o')) {
    return `${hand} is offsuit — the 'o' means the cards are different suits.`
  }
  return `${hand} is a specific hand combination.`
}

// ── Ordering (BoardRankSort, HandRankingOrder-style) ─────────────────────────

export interface OrderRevealItem {
  id: string
  position: number
  correct: boolean
}

export function computeOrderReveal(submittedOrder: string[], correctOrder: string[]): OrderRevealItem[] {
  return submittedOrder.map((id, position) => ({ id, position, correct: id === correctOrder[position] }))
}

// ── Flag / select-the-matching-items (StraightDetective, BoardAutopsy) ───────

export interface FlagRevealItem {
  id: string
  selected: boolean
  shouldBeSelected: boolean
  /** True when the learner's selection state for this item matches the correct one. */
  correct: boolean
}

export function computeFlagReveal(
  candidateIds: string[],
  selectedIds: ReadonlySet<string>,
  correctIds: ReadonlySet<string>,
): FlagRevealItem[] {
  return candidateIds.map((id) => {
    const selected = selectedIds.has(id)
    const shouldBeSelected = correctIds.has(id)
    return { id, selected, shouldBeSelected, correct: selected === shouldBeSelected }
  })
}

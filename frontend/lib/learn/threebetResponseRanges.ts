/**
 * Resolution/diagnostic layer over threebetResponseBaselines.ts — mirrors how
 * mttRfiRanges.ts sits atop mttRfiBaselines.ts. Two responsibilities:
 *
 *   1. Chart/foundation lookup (resolveThreebetResponseChart, prefill helpers),
 *      the same shape as the MTT RFI resolvers so `multiActionRangePrefill.ts`
 *      can branch on `range_build_multi_domain` between the two.
 *   2. SHAPE diagnostics for the Range Lab's post-submit feedback (spec: "Do NOT
 *      grade only by percentage of exact cells correct... analyze the SHAPE").
 *      `diagnoseRangeShape` classifies every hand into a strategic category
 *      (pocket pair / suited Ax / suited broadway / suited connector / offsuit Ax
 *      / offsuit broadway / other) and compares the learner's category-level
 *      composition against the baseline's, deriving 1-3 targeted messages from
 *      whichever mismatches actually occurred — never one hardcoded string.
 */

import { RANKS } from './handGrid'
import {
  THREEBET_RESPONSE_CHARTS,
  THREEBET_RESPONSE_FOUNDATIONS,
  THREEBET_RESPONSE_FLAWED_EXAMPLES,
  type ThreebetResponseAction,
  type ThreebetResponseChart,
} from './threebetResponseBaselines'
import { fromActionDict, type RangeStrategyMap } from './rangeStrategy'
import type { LessonStep } from './types'

export function resolveThreebetResponseChart(key: string): ThreebetResponseChart | undefined {
  return THREEBET_RESPONSE_CHARTS[key]
}

/** hand -> full RangeStrategyMap for this domain's (always-pure) charts — for any
 *  reveal/compare visual that wants the shared 'strategy' PokerRangeGrid mode. */
export function chartToStrategyMap(chart: ThreebetResponseChart): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  for (const cell of chart.cells) map[cell.hand] = fromActionDict(cell.actions as Record<string, number>)
  return map
}

export function chartHandList(chart: ThreebetResponseChart): string[] {
  return chart.cells.map((c) => c.hand)
}

/** Resolves a step's prefilled foundation assignments. Precedence mirrors the MTT
 *  resolver: a Transformation Challenge's source chart (here, a deliberately flawed
 *  example for the Range Repair exercise) wins over an inline foundation, which
 *  wins over a named foundation key. Grading is unaffected — evalThreebetResponseRange
 *  always grades the final submission against `range_build_multi_chart` (the real
 *  chart), never this seed. */
export function resolveThreebetResponsePrefilled(step: LessonStep): Record<string, ThreebetResponseAction> {
  if (step.range_build_multi_transform_from_chart) {
    const source =
      THREEBET_RESPONSE_FLAWED_EXAMPLES[step.range_build_multi_transform_from_chart] ??
      THREEBET_RESPONSE_CHARTS[step.range_build_multi_transform_from_chart]
    if (source) {
      const map: Record<string, ThreebetResponseAction> = {}
      for (const cell of source.cells) map[cell.hand] = chartHandAction(source, cell.hand)
      return map
    }
  }
  return (
    (step.range_build_multi_prefilled as Record<string, ThreebetResponseAction> | undefined) ??
    THREEBET_RESPONSE_FOUNDATIONS[step.range_build_multi_prefilled_key ?? '']?.hands ??
    {}
  )
}

/** A hand's single graded action in this domain's pure (never-mixed) charts. */
export function chartHandAction(chart: ThreebetResponseChart, hand: string): ThreebetResponseAction {
  const cell = chart.cells.find((c) => c.hand === hand)
  if (!cell) return 'fold'
  const [action] = Object.keys(cell.actions) as ThreebetResponseAction[]
  return action ?? 'fold'
}

// ── Hand categorization — the vocabulary the book's own qualitative rules use ──

export type HandCategory =
  | 'pocket_pair'
  | 'suited_ax'
  | 'offsuit_ax'
  | 'suited_broadway'
  | 'offsuit_broadway'
  | 'suited_connector'
  | 'other'

const BROADWAY_RANKS = new Set(['K', 'Q', 'J', 'T'])
const RANK_INDEX: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]))

export function classifyHandForResponse(hand: string): HandCategory {
  if (hand.length === 2) return 'pocket_pair'
  const r1 = hand[0]
  const r2 = hand[1]
  const suited = hand.endsWith('s')
  if (r1 === 'A') return suited ? 'suited_ax' : 'offsuit_ax'
  if (BROADWAY_RANKS.has(r1) && BROADWAY_RANKS.has(r2)) return suited ? 'suited_broadway' : 'offsuit_broadway'
  if (suited) {
    const gap = Math.abs(RANK_INDEX[r1] - RANK_INDEX[r2])
    if (gap <= 2) return 'suited_connector'
  }
  return 'other'
}

const CATEGORY_LABEL: Record<HandCategory, string> = {
  pocket_pair: 'pocket pairs',
  suited_ax: 'suited Ax hands',
  offsuit_ax: 'offsuit Ax hands',
  suited_broadway: 'suited broadways',
  offsuit_broadway: 'offsuit broadways',
  suited_connector: 'suited connectors',
  other: 'other hands',
}

/** "Playable" categories the book expects to call/continue well — folding a lot
 *  of these vs. the baseline is the #1 leak this lesson is built to catch. */
const PLAYABLE_CATEGORIES = new Set<HandCategory>(['pocket_pair', 'suited_ax', 'suited_broadway', 'suited_connector'])

/** Categories that suffer domination/reverse implied odds — calling too many
 *  of these vs. the baseline is the #2 leak. */
const REVERSE_IMPLIED_ODDS_CATEGORIES = new Set<HandCategory>(['offsuit_broadway', 'offsuit_ax'])

function handCombos(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6
}

export interface RangeShapeDiagnosis {
  /** Combo-weighted accuracy 0-1 (same metric evalMultiActionRange uses), for context. */
  accuracy: number
  /** 1-3 targeted, category-derived observations, most important first. */
  messages: string[]
}

/**
 * Compares a learner's assignments against a threebet-response chart at the
 * CATEGORY level (not cell-by-cell) and returns targeted feedback. Every
 * candidate below only fires when the underlying combo count crosses a real
 * threshold — nothing here is a fallback platitude unless truly nothing else
 * fired.
 */
export function diagnoseRangeShape(
  chart: ThreebetResponseChart,
  assignments: Record<string, ThreebetResponseAction>,
): RangeShapeDiagnosis {
  const allHands = new Set<string>([...chart.cells.map((c) => c.hand), ...Object.keys(assignments)])

  let totalCombos = 0
  let earnedCombos = 0
  // combos, by category, where book=call/continue-friendly but learner folded
  const foldedPlayable = new Map<HandCategory, number>()
  // combos, by category, where book=fold (reverse-implied-odds-prone) but learner called
  const calledDominated = new Map<HandCategory, number>()
  // book 4-bet hands the learner also 4-bet, split into "value-shaped" (pair/AK) vs blocker-shaped
  let bookFourBetBlockerCombos = 0
  let learnerMatchedBlockerCombos = 0
  // combos where book=4bet/learner=call, or book=call/learner=4bet (blurring the two aggressive tiers)
  let blurredAggressionCombos = 0
  let continueCombos = 0 // book says 4bet or call (i.e. the "should defend" pool)
  let learnerContinueCombos = 0

  for (const hand of allHands) {
    const combos = handCombos(hand)
    totalCombos += combos
    const book = chartHandAction(chart, hand)
    const yours = assignments[hand] ?? 'fold'
    const category = classifyHandForResponse(hand)

    if (book === yours) earnedCombos += combos

    if (book !== 'fold') continueCombos += combos
    if (yours !== 'fold') learnerContinueCombos += combos

    if (book !== 'fold' && yours === 'fold' && PLAYABLE_CATEGORIES.has(category)) {
      foldedPlayable.set(category, (foldedPlayable.get(category) ?? 0) + combos)
    }
    if (book === 'fold' && yours !== 'fold' && REVERSE_IMPLIED_ODDS_CATEGORIES.has(category)) {
      calledDominated.set(category, (calledDominated.get(category) ?? 0) + combos)
    }
    if (book === '4bet' && (category === 'suited_ax' || category === 'suited_connector')) {
      bookFourBetBlockerCombos += combos
      if (yours === '4bet') learnerMatchedBlockerCombos += combos
    }
    if ((book === '4bet' && yours === 'call') || (book === 'call' && yours === '4bet')) {
      blurredAggressionCombos += combos
    }
  }

  const accuracy = totalCombos > 0 ? earnedCombos / totalCombos : 0
  const messages: string[] = []

  const topFoldedCategory = [...foldedPlayable.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topFoldedCategory && topFoldedCategory[1] >= 16) {
    messages.push(`You're folding too many playable ${CATEGORY_LABEL[topFoldedCategory[0]]} — these have enough equity and playability to continue here.`)
  }

  const topCalledCategory = [...calledDominated.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topCalledCategory && topCalledCategory[1] >= 24) {
    messages.push(`Your calling range has too many ${CATEGORY_LABEL[topCalledCategory[0]]} — these suffer from domination and reverse implied odds instead of realizing their apparent strength.`)
  }

  if (bookFourBetBlockerCombos > 0 && learnerMatchedBlockerCombos === 0) {
    messages.push("You found the value region, but your 4-bet range has no blocker-driven hands alongside the pairs and AK — it's leaving fold equity and card removal on the table.")
  }

  if (messages.length < 2 && blurredAggressionCombos >= 20) {
    messages.push("You're treating calls and 4-bets as the same bucket in several spots — separate clear value/blockers (4-bet) from playable-but-not-that-strong hands (call).")
  }

  if (messages.length === 0) {
    const widthDiff = learnerContinueCombos - continueCombos
    if (Math.abs(widthDiff) >= 40) {
      messages.push(
        widthDiff > 0
          ? "You're defending noticeably wider than the baseline overall — some of these extra continues are probably better off as folds."
          : "You're defending noticeably tighter than the baseline overall — folding this much leaves the opening range too easy to attack.",
      )
    } else {
      messages.push("You're defending a sound total width — the composition of your 4-bet/call/fold split closely matches the baseline's shape.")
    }
  }

  return { accuracy, messages: messages.slice(0, 3) }
}

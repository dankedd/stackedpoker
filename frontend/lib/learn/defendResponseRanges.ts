/**
 * Resolution/diagnostic layer over defendResponseBaselines.ts — mirrors
 * threebetResponseRanges.ts (which sits atop threebetResponseBaselines.ts) for
 * Module 5's HJ/CO/BTN/SB/BB defending-an-open charts.
 *
 *   1. Chart lookup (resolveDefendResponseChart), the same shape as the
 *      3-bet-response resolver so `multiActionRangePrefill.ts` can branch on
 *      `range_build_multi_domain` between all three domains.
 *   2. SHAPE diagnostics for the Build steps' post-submit feedback, reusing
 *      the exact same hand-category vocabulary `threebetResponseRanges.ts`
 *      already defines (pocket pair / suited Ax / suited broadway / suited
 *      connector / offsuit Ax / offsuit broadway / other) rather than
 *      duplicating it — the categories the book's own qualitative rules use
 *      don't change between "facing a 3-bet" and "facing an open".
 */

import {
  DEFEND_RESPONSE_CHARTS,
  type DefendResponseAction,
  type DefendResponseChart,
} from './defendResponseBaselines'
import { classifyHandForResponse, type HandCategory } from './threebetResponseRanges'
import { fromActionDict, type RangeStrategyMap } from './rangeStrategy'

export function resolveDefendResponseChart(key: string): DefendResponseChart | undefined {
  return DEFEND_RESPONSE_CHARTS[key]
}

/** hand -> full RangeStrategyMap for this domain's (always-pure) charts — for any
 *  reveal/compare visual that wants the shared 'strategy' PokerRangeGrid mode. */
export function chartToStrategyMap(chart: DefendResponseChart): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  for (const cell of chart.cells) map[cell.hand] = fromActionDict(cell.actions as Record<string, number>)
  return map
}

export function chartHandList(chart: DefendResponseChart): string[] {
  return chart.cells.map((c) => c.hand)
}

/** Just the hands assigned a specific single action — e.g. the 3-bet-only
 *  subset, for a range_compare step contrasting two matchups' AGGRESSION
 *  width specifically (not their whole continuing range). */
export function chartActionHandList(chart: DefendResponseChart, action: DefendResponseAction): string[] {
  return chart.cells.filter((c) => action in c.actions).map((c) => c.hand)
}

/** A hand's single graded action in this domain's pure (never-mixed) charts. */
export function chartHandAction(chart: DefendResponseChart, hand: string): DefendResponseAction {
  const cell = chart.cells.find((c) => c.hand === hand)
  if (!cell) return 'fold'
  const [action] = Object.keys(cell.actions) as DefendResponseAction[]
  return action ?? 'fold'
}

// ── Prefilled foundations — the obvious top-of-range core, same convention as
//    MTT_RFI_FOUNDATIONS (mttRfiRanges.ts) / THREEBET_RESPONSE_FOUNDATIONS
//    (threebetResponseBaselines.ts), except each hand's ACTION is read straight
//    off the chart via chartHandAction above rather than re-typed as a literal —
//    so a future chart correction can never leave a foundation silently stale
//    (the exact AJo/76s class of bug rangeAnswerValidator.ts exists to catch).
//    `obviousHands` is only the SET of which hands are obvious enough to hand a
//    learner for free — a pedagogical judgment call authored here — never the
//    action itself.

export interface DefendResponseFoundation {
  chartKey: string
  hands: Record<string, DefendResponseAction>
}

function buildDefendPrefillFromChart(
  chart: DefendResponseChart,
  obviousHands: string[],
): Record<string, DefendResponseAction> {
  const hands: Record<string, DefendResponseAction> = {}
  for (const hand of obviousHands) hands[hand] = chartHandAction(chart, hand)
  return hands
}

export const DEFEND_RESPONSE_FOUNDATIONS: Record<string, DefendResponseFoundation> = {
  // 114 of HJ_vs_UTG_60BB's 194 continuing-range combos (~59%) — the value
  // pairs/AK/KQs 3-bet core (56 combos), every pocket pair's mandatory call (42
  // combos), and the least-controversial suited-broadway calls (KJs/KTs/QJs/QTs,
  // 16 combos). Deliberately excludes the suited wheel-Ax 3-bet bluffs (A5s-A3s),
  // JTs, every suited-Ax/connector call, and AQo — those are exactly what
  // hj-s2/hj-s3/hj-s4 just taught (domination, blockers, suitedness), so they're
  // left for the learner to place here (the remaining ~41%) rather than handed
  // over for free.
  HJ_vs_UTG_60BB_foundation: {
    chartKey: 'HJ_vs_UTG_60BB',
    hands: buildDefendPrefillFromChart(DEFEND_RESPONSE_CHARTS.HJ_vs_UTG_60BB, [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AKo', 'KQs',
      '88', '77', '66', '55', '44', '33', '22',
      'KJs', 'KTs', 'QJs', 'QTs',
    ]),
  },
}

function handCombos(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6
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

/** "Playable" categories the book expects to continue well against most single
 *  opens — folding a lot of these vs. the baseline is the #1 leak this
 *  exercise is built to catch. */
const PLAYABLE_CATEGORIES = new Set<HandCategory>(['pocket_pair', 'suited_ax', 'suited_broadway', 'suited_connector'])

/** Categories that suffer domination/reverse implied odds — continuing with too
 *  many of these vs. the baseline is the #2 leak. */
const REVERSE_IMPLIED_ODDS_CATEGORIES = new Set<HandCategory>(['offsuit_broadway', 'offsuit_ax'])

const AGGRESSIVE_ACTIONS = new Set<DefendResponseAction>(['3bet', 'jam'])

export interface RangeShapeDiagnosis {
  /** Combo-weighted accuracy 0-1 (same metric evalMultiActionRange uses), for context. */
  accuracy: number
  /** 1-3 targeted, category-derived observations, most important first. */
  messages: string[]
}

/**
 * Compares a learner's assignments against a defend-response chart at the
 * CATEGORY level (not cell-by-cell) and returns targeted feedback — same
 * approach as threebetResponseRanges.ts's diagnoseRangeShape, generalized to
 * this domain's 3bet/jam/call/fold action set.
 *
 * `prefilled`, when passed, is a "pre-answered for free" foundation (see
 * DEFEND_RESPONSE_FOUNDATIONS above): any hand whose final assignment still
 * exactly matches its prefilled value is excluded from BOTH the numerator and
 * the denominator entirely — not auto-credited, genuinely not assessed — so a
 * large foundation (e.g. ~60% of the range) can never pad the score with combos
 * the learner never actually decided on. A hand the learner changed away from
 * its prefilled value no longer matches `prefilled[hand]`, so it's graded
 * normally like any other hand.
 */
export function diagnoseDefendRangeShape(
  chart: DefendResponseChart,
  assignments: Record<string, DefendResponseAction>,
  prefilled: Record<string, DefendResponseAction> = {},
): RangeShapeDiagnosis {
  const allHands = new Set<string>([...chart.cells.map((c) => c.hand), ...Object.keys(assignments)])

  let totalCombos = 0
  let earnedCombos = 0
  const foldedPlayable = new Map<HandCategory, number>()
  const calledDominated = new Map<HandCategory, number>()
  let blurredAggressionCombos = 0
  let continueCombos = 0
  let learnerContinueCombos = 0

  for (const hand of allHands) {
    const yoursRaw = assignments[hand]
    if (hand in prefilled && yoursRaw === prefilled[hand]) continue // untouched free hand — not assessed

    const combos = handCombos(hand)
    totalCombos += combos
    const book = chartHandAction(chart, hand)
    const yours = yoursRaw ?? 'fold'
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
    if (
      (AGGRESSIVE_ACTIONS.has(book) && yours === 'call') ||
      (book === 'call' && AGGRESSIVE_ACTIONS.has(yours))
    ) {
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
    messages.push(`Your continuing range has too many ${CATEGORY_LABEL[topCalledCategory[0]]} — these suffer from domination and reverse implied odds instead of realizing their apparent strength.`)
  }

  if (messages.length < 2 && blurredAggressionCombos >= 20) {
    messages.push("You're treating calls and 3-bets/jams as the same bucket in several spots — separate clear value/blockers (3-bet or jam) from playable-but-not-that-strong hands (call).")
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
      messages.push("You're defending a sound total width — the composition of your 3-bet/jam/call/fold split closely matches the baseline's shape.")
    }
  }

  return { accuracy, messages: messages.slice(0, 3) }
}

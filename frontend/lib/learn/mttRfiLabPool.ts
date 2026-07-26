/**
 * Validated question pool for the Preflop Foundation Lab + Opening Range Drill.
 *
 * CRITICAL invariant (per the module's design constraints): the AI never decides whether
 * an answer is correct. Every "hand decision" and "boundary comparison" question below is
 * GENERATED from MTT_RFI_CHARTS itself (mttRfiBaselines.ts) — the generator functions read
 * the real book-sourced frequency for a (position, stack, hand) tuple and derive the
 * quality/feedback of each option directly from that number. This makes it structurally
 * impossible for a pool question to disagree with the canonical chart data: there is only
 * ever one source of truth, and lessons/drill/Lab all read through it.
 *
 * Only two categories are hand-authored rather than generated: `fundamentals` (pure context/
 * recognition questions with no chart dependency) and `reconstruction` (range_build_multi
 * steps, which are graded by evalMultiActionRange directly against the chart — nothing to
 * "generate" since the grading already reads the canonical data at answer time).
 */
import type { LessonStep, StepOption } from './types'
import { MTT_RFI_CHARTS, POSITION_KEY_TO_LABEL, type MttAction, type MttRfiActionFrequencies, type MttRfiChart } from './mttRfiBaselines'
import { shuffleBySeed } from './interactionSafety'
import { recordCoverage } from './mttRfiCoverage'

export type LabPoolCategory =
  | 'fundamentals'
  | 'early_position'
  | 'middle_position'
  | 'co_btn'
  | 'small_blind'
  | 'stack_comparison'
  | 'reconstruction'

export interface LabPoolQuestion {
  id: string
  category: LabPoolCategory
  stepTemplate: LessonStep
  /** MTT_RFI_CHARTS keys this question's correctness derives from — validated by tests. */
  chartKeys: string[]
}

const ACTION_LABEL: Record<MttAction, string> = { raise: 'Raise', jam: 'Jam', limp: 'Limp', fold: 'Fold' }
// Book's stated environment is a fixed 12.5%-of-big-blind ante (9-max, cEV) at
// every stack depth studied — the ante does NOT scale with the effective stack.
export const FIXED_ANTE_BB = 0.125

function positionLabel(chart: MttRfiChart): string {
  return chart.position
}

/**
 * Builds a fully-contexted `table_decision` LessonStep for a single (chart, hand) pair —
 * the shared building block for every position lesson's Drill phase and the Lab's
 * table-decision questions. Context fields mirror genHandDecision's derivation exactly, so
 * a drill step and a Lab pool question over the same chart/hand look and behave identically.
 */
export function buildTableDecisionStep(id: string, chartKey: string, hand: string): LessonStep {
  const chart = MTT_RFI_CHARTS[chartKey]
  return {
    id,
    type: 'table_decision',
    concept_ids: [conceptForPosition(chart.positionKey), conceptForStack(chart.stackBB)],
    table_decision_chart: chartKey,
    table_decision_hand: hand,
    hero_position: POSITION_KEY_TO_LABEL[chart.positionKey],
    effective_stack_bb: chart.stackBB,
    table_size: 9,
    ante_bb: FIXED_ANTE_BB,
    action_before_hero: ['Everyone folds'],
    xp: 8,
  }
}

/** Every action offered by a chart (so a decision_spot's options match what's actually possible). */
export function chartActionSet(chart: MttRfiChart): MttAction[] {
  const set = new Set<MttAction>(['fold'])
  for (const cell of chart.cells) for (const a of Object.keys(cell.actions)) set.add(a as MttAction)
  return (['raise', 'jam', 'limp', 'fold'] as MttAction[]).filter((a) => set.has(a))
}

export function cellActionsFor(chart: MttRfiChart, hand: string): MttRfiActionFrequencies {
  const cell = chart.cells.find((c) => c.hand === hand)
  return cell ? cell.actions : { fold: 1 }
}

/**
 * Builds the graded options for a "given this spot, what does Hero do?" question over a
 * single (chart, hand) pair. Quality is assigned purely from the real frequency: the action
 * with the highest frequency is 'perfect'; any other action actually present at >=15% is
 * 'acceptable' (a real, legitimate part of a mixed strategy — not simply "wrong"); anything
 * at 0% is 'mistake'. Shared by genHandDecision (Lab pool) and TableDecision.tsx (position
 * lesson drills) so the two can never disagree about what "correct" means for a hand.
 */
export function buildHandDecisionOptions(chart: MttRfiChart, hand: string, seed: string): StepOption[] {
  const actions = cellActionsFor(chart, hand)
  const offered = chartActionSet(chart)
  const bestAction = (Object.entries(actions) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0] as MttAction
  const bestFreq = actions[bestAction] ?? 0
  const isMixed = bestFreq < 0.9 && Object.keys(actions).length > 1

  const options = offered.map((action) => {
    const freq = actions[action] ?? 0
    if (action === bestAction) {
      return {
        id: action,
        label: ACTION_LABEL[action],
        quality: 'perfect' as const,
        feedback: isMixed
          ? `Correct — ${hand} is a mixed hand here: ${ACTION_LABEL[action]} ${Math.round(freq * 100)}% is the majority action in the baseline strategy.`
          : `Correct — ${hand} is a clean ${ACTION_LABEL[action].toLowerCase()} in the baseline strategy at ${positionLabel(chart)}/${chart.stackBB}bb.`,
      }
    }
    if (freq >= 0.15) {
      return {
        id: action,
        label: ACTION_LABEL[action],
        quality: 'acceptable' as const,
        feedback: `${ACTION_LABEL[action]} is a real minority action here (${Math.round(freq * 100)}%), but ${ACTION_LABEL[bestAction]} (${Math.round(bestFreq * 100)}%) is the baseline's majority action for ${hand}.`,
      }
    }
    return {
      id: action,
      label: ACTION_LABEL[action],
      quality: 'mistake' as const,
      feedback: `The baseline strategy never takes this action with ${hand} here — it's ${ACTION_LABEL[bestAction]} (${Math.round(bestFreq * 100)}%) instead.`,
    }
  })
  return shuffleBySeed(options, seed)
}

/**
 * Generates a "given this spot, what does Hero do?" table decision for a single (chart, hand)
 * pair, fully assembled as a Lab-pool step. Uses the same visual poker-table format as every
 * position lesson's Drill phase (buildTableDecisionStep) — per the structural redesign, table
 * decisions are the DOMINANT format in the Lab, not a secondary multiple-choice card.
 */
function genHandDecision(
  id: string,
  chartKey: string,
  hand: string,
  category: LabPoolCategory,
): LabPoolQuestion {
  return {
    id,
    category,
    chartKeys: [chartKey],
    stepTemplate: buildTableDecisionStep(id, chartKey, hand),
  }
}

/** "From which of these two positions does this hand enter the baseline strategy — one, both,
 *  or neither?" — the "range ladder" question type, auto-derived from real non-fold weight at
 *  a fixed stack depth (>=50% non-fold counts as "enters the strategy"). */
function genPositionComparison(
  id: string,
  positionA: string,
  positionB: string,
  stackBB: number,
  hand: string,
  category: LabPoolCategory,
): LabPoolQuestion {
  const chartKeyA = `${positionA}_RFI_${stackBB}BB`
  const chartKeyB = `${positionB}_RFI_${stackBB}BB`
  const chartA = MTT_RFI_CHARTS[chartKeyA]
  const chartB = MTT_RFI_CHARTS[chartKeyB]
  const nonFoldA = 1 - (cellActionsFor(chartA, hand).fold ?? 0)
  const nonFoldB = 1 - (cellActionsFor(chartB, hand).fold ?? 0)
  const inA = nonFoldA >= 0.5
  const inB = nonFoldB >= 0.5
  const labelA = POSITION_KEY_TO_LABEL[chartA.positionKey]
  const labelB = POSITION_KEY_TO_LABEL[chartB.positionKey]

  const correctId = inA && inB ? 'both' : inA ? 'a_only' : inB ? 'b_only' : 'neither'
  const detail = `${labelA}: ${Math.round(nonFoldA * 100)}% non-fold. ${labelB}: ${Math.round(nonFoldB * 100)}% non-fold.`

  const allOptions = [
    { id: 'a_only', label: `Only ${labelA}` },
    { id: 'b_only', label: `Only ${labelB}` },
    { id: 'both', label: `Both ${labelA} and ${labelB}` },
    { id: 'neither', label: 'Neither' },
  ]

  return {
    id,
    category,
    chartKeys: [chartKeyA, chartKeyB],
    stepTemplate: {
      id,
      type: 'decision_spot',
      concept_ids: [conceptForPosition(chartA.positionKey), conceptForPosition(chartB.positionKey)],
      narrative: `${stackBB}bb effective at both tables. Hero holds ${hand}.`,
      effective_stack_bb: stackBB,
      table_size: 9,
      decision_spot_question: `From which of these does ${hand} enter the baseline opening strategy — ${labelA}, ${labelB}, both, or neither?`,
      options: shuffleBySeed(
        allOptions.map((o) => ({
          id: o.id,
          label: o.label,
          quality: o.id === correctId ? ('perfect' as const) : ('mistake' as const),
          feedback: o.id === correctId ? `Correct. ${detail}` : `Not quite. ${detail}`,
        })),
        id,
      ),
      xp: 10,
    },
  }
}

/** "Which of these two hands remains a real part of the opening strategy?" — auto-derived
 *  from whichever hand has the higher non-fold frequency in the chart. */
function genBoundaryComparison(
  id: string,
  chartKey: string,
  handA: string,
  handB: string,
  category: LabPoolCategory,
): LabPoolQuestion {
  const chart = MTT_RFI_CHARTS[chartKey]
  const nonFold = (hand: string) => {
    const actions = cellActionsFor(chart, hand)
    return 1 - (actions.fold ?? 0)
  }
  const scoreA = nonFold(handA)
  const scoreB = nonFold(handB)
  const winner = scoreA >= scoreB ? handA : handB
  const loser = scoreA >= scoreB ? handB : handA
  const winnerScore = Math.max(scoreA, scoreB)
  const loserScore = Math.min(scoreA, scoreB)

  return {
    id,
    category,
    chartKeys: [chartKey],
    stepTemplate: {
      id,
      type: 'decision_spot',
      concept_ids: [conceptForPosition(chart.positionKey), conceptForStack(chart.stackBB)],
      narrative: `${positionLabel(chart)}, ${chart.stackBB}bb effective. Compare ${handA} and ${handB}.`,
      hero_position: chart.positionKey === 'UTG1' ? 'UTG+1' : chart.positionKey === 'UTG2' ? 'UTG+2' : chart.positionKey,
      effective_stack_bb: chart.stackBB,
      table_size: 9,
      decision_spot_question: 'Which one remains a real part of the baseline opening strategy?',
      options: shuffleBySeed(
        [
          {
            id: winner,
            label: winner,
            quality: 'perfect' as const,
            feedback: `Correct — ${winner} is in the baseline strategy ${Math.round(winnerScore * 100)}% of the time here, versus just ${Math.round(loserScore * 100)}% for ${loser}.`,
          },
          {
            id: loser,
            label: loser,
            quality: 'mistake' as const,
            feedback: `The other way around — ${winner} (${Math.round(winnerScore * 100)}%) survives far more often than ${loser} (${Math.round(loserScore * 100)}%) here.`,
          },
        ],
        id,
      ),
      xp: 10,
    },
  }
}

/** Compares the SAME hand/position across two stack depths and asks the learner to
 *  characterize the change — auto-classified from the real numbers on both charts. */
function genStackComparison(
  id: string,
  chartKeyA: string,
  chartKeyB: string,
  hand: string,
  category: LabPoolCategory,
): LabPoolQuestion {
  const chartA = MTT_RFI_CHARTS[chartKeyA]
  const chartB = MTT_RFI_CHARTS[chartKeyB]
  const actionsA = cellActionsFor(chartA, hand)
  const actionsB = cellActionsFor(chartB, hand)
  const bestA = (Object.entries(actionsA) as [MttAction, number][]).sort((a, b) => b[1] - a[1])[0]
  const bestB = (Object.entries(actionsB) as [MttAction, number][]).sort((a, b) => b[1] - a[1])[0]
  const nonFoldA = 1 - (actionsA.fold ?? 0)
  const nonFoldB = 1 - (actionsB.fold ?? 0)

  let correctLabel: string
  let correctId: string
  if (bestA[0] !== bestB[0] && nonFoldA > 0.05 && nonFoldB > 0.05) {
    correctId = 'action_changes'
    correctLabel = `The action itself changes (${ACTION_LABEL[bestA[0]]} at ${chartA.stackBB}bb -> ${ACTION_LABEL[bestB[0]]} at ${chartB.stackBB}bb), not just the width`
  } else if (nonFoldB - nonFoldA > 0.15) {
    correctId = 'widens'
    correctLabel = `Hero plays ${hand} more often at ${chartB.stackBB}bb than at ${chartA.stackBB}bb`
  } else if (nonFoldA - nonFoldB > 0.15) {
    correctId = 'narrows'
    correctLabel = `Hero plays ${hand} less often at ${chartB.stackBB}bb than at ${chartA.stackBB}bb`
  } else {
    correctId = 'stable'
    correctLabel = `Hero's strategy with ${hand} barely changes between these two depths`
  }

  const distractors = [
    { id: 'action_changes', label: `The action itself changes, not just the width` },
    { id: 'widens', label: `Hero plays ${hand} more often at the deeper stack` },
    { id: 'narrows', label: `Hero plays ${hand} less often at the deeper stack` },
    { id: 'stable', label: `Hero's strategy with ${hand} barely changes` },
  ].filter((d) => d.id !== correctId)

  return {
    id,
    category,
    chartKeys: [chartKeyA, chartKeyB],
    stepTemplate: {
      id,
      type: 'decision_spot',
      concept_ids: ['stack_depth_preflop'],
      narrative: `${positionLabel(chartA)}, comparing ${chartA.stackBB}bb effective versus ${chartB.stackBB}bb effective. Hero holds ${hand}.`,
      decision_spot_question: `How does Hero's strategy with ${hand} change from ${chartA.stackBB}bb to ${chartB.stackBB}bb?`,
      options: shuffleBySeed(
        [
          { id: correctId, label: correctLabel, quality: 'perfect' as const, feedback: `Correct. At ${chartA.stackBB}bb: ${Math.round(nonFoldA * 100)}% non-fold (best: ${ACTION_LABEL[bestA[0]]}). At ${chartB.stackBB}bb: ${Math.round(nonFoldB * 100)}% non-fold (best: ${ACTION_LABEL[bestB[0]]}).` },
          ...distractors.slice(0, 2).map((d) => ({
            id: d.id,
            label: d.label,
            quality: 'mistake' as const,
            feedback: `Not quite — at ${chartA.stackBB}bb: ${Math.round(nonFoldA * 100)}% non-fold (best: ${ACTION_LABEL[bestA[0]]}); at ${chartB.stackBB}bb: ${Math.round(nonFoldB * 100)}% non-fold (best: ${ACTION_LABEL[bestB[0]]}).`,
          })),
        ],
        id,
      ),
      xp: 12,
    },
  }
}

function genReconstruction(id: string, chartKey: string, effectiveBB: number): LabPoolQuestion {
  const chart = MTT_RFI_CHARTS[chartKey]
  return {
    id,
    category: 'reconstruction',
    chartKeys: [chartKey],
    stepTemplate: {
      id,
      type: 'range_build_multi',
      concept_ids: ['range_construction', conceptForPosition(chart.positionKey)],
      narrative: `Build ${positionLabel(chart)}'s complete ${chart.stackBB}bb first-in strategy from scratch. No prefill — this is a full mastery reconstruction.`,
      hero_position: chart.positionKey === 'UTG1' ? 'UTG+1' : chart.positionKey === 'UTG2' ? 'UTG+2' : chart.positionKey,
      effective_stack_bb: effectiveBB,
      table_size: 9,
      ante_bb: FIXED_ANTE_BB,
      range_build_multi_chart: chartKey,
      range_build_multi_show_diff: true,
      xp: 26,
    },
  }
}

/** Granular per-position mastery/leak dimension — one per canonical position, so a learner's
 *  performance can distinguish "good at BTN, weak at UTG+1" rather than lumping early-position
 *  seats into one aggregate. `co_rfi`/`btn_rfi`/`sb_first_in` predate this granularity and are
 *  reused as-is (already position-specific); `utg_rfi`/`utg1_rfi`/`utg2_rfi`/`lj_rfi`/`hj_rfi`
 *  are new. The old `early_position_rfi`/`middle_position_rfi` aggregates stay registered in the
 *  backend (harmless) but are no longer written by new content. */
export function conceptForPosition(positionKey: string): string {
  switch (positionKey) {
    case 'UTG': return 'utg_rfi'
    case 'UTG1': return 'utg1_rfi'
    case 'UTG2': return 'utg2_rfi'
    case 'LJ': return 'lj_rfi'
    case 'HJ': return 'hj_rfi'
    case 'CO': return 'co_rfi'
    case 'BTN': return 'btn_rfi'
    default: return 'sb_first_in'
  }
}

function conceptForStack(stackBB: number): string {
  if (stackBB <= 15) return 'shallow_stack_rfi'
  if (stackBB <= 25) return 'mid_stack_rfi'
  return 'deep_stack_rfi'
}

// ── Fundamentals (hand-authored, no chart dependency) ─────────────────────────

const FUNDAMENTALS: LabPoolQuestion[] = [
  {
    id: 'pool-fund-1', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-1', type: 'decision_spot', concept_ids: ['first_in'],
      narrative: 'UTG folds. Hijack folds. Action is now on the Cutoff, who has not yet acted.',
      decision_spot_question: 'Is this a first-in (RFI) spot for the Cutoff?',
      options: [
        { id: 'yes', label: 'Yes — no one has voluntarily entered the pot yet', quality: 'perfect', feedback: 'Correct — folds are not voluntary entries. The pot is still unopened, so this is a first-in decision.' },
        { id: 'no', label: 'No — two players have already acted', quality: 'mistake', feedback: 'Folding is not entering the pot. Since no one has called or raised yet, this is still a first-in (RFI) spot.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-2', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-2', type: 'decision_spot', concept_ids: ['first_in'],
      narrative: 'UTG raises. Action folds to Hero in the Hijack.',
      decision_spot_question: 'Is this a first-in (RFI) spot for Hero?',
      options: [
        { id: 'no', label: 'No — Hero is now facing an open raise, not entering first', quality: 'perfect', feedback: 'Correct. Once UTG raises, this becomes a "facing an open" decision for everyone after — a different, later-module skill from RFI.' },
        { id: 'yes', label: 'Yes — no one has called yet', quality: 'mistake', feedback: 'A raise already happened. Hero is now responding to that raise, not opening the pot — this is not an RFI spot.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-3', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-3', type: 'decision_spot', concept_ids: ['players_behind'],
      narrative: 'Compare two RFI spots with the identical hand: one with 7 players left to act, one with 1 player left to act.',
      decision_spot_question: 'Which spot carries more resistance risk for Hero?',
      options: [
        { id: 'seven', label: 'The spot with 7 players left to act', quality: 'perfect', feedback: 'Correct — every extra player behind Hero is another independent chance someone wakes up with a hand that can re-raise or dominate.' },
        { id: 'one', label: 'The spot with 1 player left to act', quality: 'mistake', feedback: 'More players behind means more resistance, not less — the 7-player spot is riskier.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-4', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-4', type: 'decision_spot', concept_ids: ['preflop_hand_selection'],
      narrative: 'Two hands: J9s (suited, connected) and J9o (offsuit, connected).',
      decision_spot_question: 'Which property most directly explains why the suited version survives in tighter ranges where the offsuit version folds?',
      options: [
        { id: 'suitedness', label: 'Suitedness — flush potential and better equity realization', quality: 'perfect', feedback: 'Correct — the shared suit adds flush outs and generally improves how well the hand realizes its equity, which is exactly what tight, high-resistance spots reward.' },
        { id: 'connectedness', label: 'Connectedness — both hands are equally connected', quality: 'mistake', feedback: 'Connectedness is identical between J9s and J9o — the difference maker is specifically the shared suit.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-5', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-5', type: 'decision_spot', concept_ids: ['stack_depth_preflop'],
      effective_stack_bb: 15,
      narrative: 'At 15bb, many strong hands take a JAM action instead of a plain RAISE that exists at deeper stacks.',
      decision_spot_question: 'What is the main strategic reason jamming replaces raising at shallow depths?',
      options: [
        { id: 'deny_rejam', label: 'A small raise gives opponents a good price to rejam; jamming denies that option and realizes equity immediately', quality: 'perfect', feedback: 'Correct — with little stack left behind a raise, opponents can profitably rejam. Jamming skips that awkward spot entirely.' },
        { id: 'weak_hands', label: 'Jamming hands are actually weaker than raising hands', quality: 'mistake', feedback: 'Many hands that jam at 15bb are pure, profitable raises at deeper stacks — jamming is about stack dynamics, not hand weakness.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-6', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-6', type: 'decision_spot', concept_ids: ['first_in'],
      narrative: 'The Small Blind posts 0.5bb, the Big Blind posts 1bb. No one has raised or called.',
      decision_spot_question: 'When action reaches the Small Blind, is this an RFI spot?',
      options: [
        { id: 'yes', label: 'Yes — posting a blind is not a voluntary entry', quality: 'perfect', feedback: 'Correct. Blinds are forced, not voluntary — SB acting here is still a genuine first-in decision.' },
        { id: 'no', label: 'No — SB already has money in the pot', quality: 'mistake', feedback: 'Having a blind posted doesn’t count as entering the pot voluntarily — this is still first-in.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-7', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-7', type: 'decision_spot', concept_ids: ['preflop_hand_selection'],
      narrative: 'A9o and A9s share the same high-card value and the same connectedness.',
      decision_spot_question: 'Why might a tight, high-resistance range include A9s but exclude A9o?',
      options: [
        { id: 'blocker_playability', label: 'A9s keeps the same Ace blocker but adds flush potential and better equity realization', quality: 'perfect', feedback: 'Correct — the suit is the only real difference, and it adds enough playability/realized equity to justify opening where the offsuit version can’t.' },
        { id: 'no_diff', label: 'There is no meaningful difference — they should be treated identically', quality: 'mistake', feedback: 'The shared suit is a meaningful, measurable difference — it’s exactly why solvers routinely split suited and offsuit versions of the same hand.' },
      ],
      xp: 6,
    },
  },
  {
    id: 'pool-fund-8', category: 'fundamentals', chartKeys: [],
    stepTemplate: {
      id: 'pool-fund-8', type: 'decision_spot', concept_ids: ['stack_depth_preflop'],
      narrative: 'A hand is a pure raise at 25bb, 40bb and 60bb, but a pure jam at 15bb.',
      decision_spot_question: 'Does this mean the hand is only playable at 15bb?',
      options: [
        { id: 'no_still_played', label: 'No — it’s played at every one of these depths, just with a different action at 15bb', quality: 'perfect', feedback: 'Correct. The hand is a real part of the strategy at all four depths — stack depth changes the ACTION (jam vs. raise), not just whether the hand is in or out.' },
        { id: 'only_shallow', label: 'Yes — it must be a marginal hand that only works shoved', quality: 'mistake', feedback: 'It’s a clean, profitable open at every deeper tier too — the jam at 15bb is about denying a cheap rejam, not about the hand being marginal.' },
      ],
      xp: 6,
    },
  },
]

// ── Boundary Comparison pairs (auto-graded from real data) ────────────────────
// (chartKey, handA, handB) — winner is derived automatically, not asserted here.

const EARLY_POSITION_PAIRS: [string, string, string][] = [
  ['UTG_RFI_25BB', '98s', '87s'],
  ['UTG_RFI_25BB', 'KJo', 'KTo'],
  ['UTG2_RFI_25BB', 'KTo', 'QTo'],
  ['UTG1_RFI_25BB', 'K7s', 'K6s'],
]
const MIDDLE_POSITION_PAIRS: [string, string, string][] = [
  ['HJ_RFI_25BB', 'Q9o', 'J9o'],
  ['HJ_RFI_25BB', 'K4s', 'K7o'],
  ['LJ_RFI_25BB', 'K5s', 'K4s'],
]
const CO_BTN_PAIRS: [string, string, string][] = [
  ['CO_RFI_25BB', 'J6s', 'T6s'],
  ['CO_RFI_25BB', 'Q9o', 'J9o'],
  ['BTN_RFI_25BB', 'J8o', 'K6o'],
  ['BTN_RFI_25BB', '85s', '95s'],
]

const EARLY_POSITION_HANDS: [string, string][] = [
  ['UTG_RFI_15BB', 'A5s'], ['UTG_RFI_25BB', 'K7s'], ['UTG_RFI_40BB', 'A3s'], ['UTG_RFI_60BB', 'J9s'],
  ['UTG1_RFI_15BB', 'AKo'], ['UTG1_RFI_25BB', 'Q8s'], ['UTG1_RFI_40BB', 'K7s'],
  ['UTG2_RFI_15BB', 'KTs'], ['UTG2_RFI_25BB', 'A9o'], ['UTG2_RFI_60BB', 'K6s'],
  ['UTG_RFI_25BB', 'QJo'], ['UTG_RFI_60BB', 'A3s'], ['UTG1_RFI_60BB', 'J9s'],
  ['UTG1_RFI_40BB', '55'], ['UTG2_RFI_40BB', 'J8s'], ['UTG2_RFI_15BB', 'AQo'],
  ['UTG_RFI_15BB', 'JJ'], ['UTG_RFI_40BB', 'K8s'],
]
const MIDDLE_POSITION_HANDS: [string, string][] = [
  ['HJ_RFI_15BB', 'A5s'], ['HJ_RFI_15BB', 'QJs'], ['HJ_RFI_25BB', 'K4s'], ['HJ_RFI_40BB', 'J7s'],
  ['LJ_RFI_15BB', 'KJs'], ['LJ_RFI_25BB', 'K5s'], ['LJ_RFI_40BB', 'J6s'], ['LJ_RFI_60BB', 'Q4s'],
  ['HJ_RFI_60BB', 'A7o'], ['HJ_RFI_25BB', 'J7s'], ['LJ_RFI_15BB', 'A9s'], ['LJ_RFI_40BB', '44'],
  ['HJ_RFI_15BB', 'AQo'], ['LJ_RFI_25BB', 'JTo'],
]
const CO_BTN_HANDS: [string, string][] = [
  ['CO_RFI_15BB', 'KTs'], ['CO_RFI_15BB', 'Q9s'], ['CO_RFI_25BB', 'Q4s'], ['CO_RFI_40BB', 'K5s'],
  ['BTN_RFI_15BB', 'K9s'], ['BTN_RFI_15BB', 'A5s'], ['BTN_RFI_25BB', 'Q2s'], ['BTN_RFI_40BB', 'K6o'],
  ['BTN_RFI_60BB', '33'],
  ['CO_RFI_60BB', 'J6s'], ['CO_RFI_15BB', 'AJo'], ['CO_RFI_40BB', 'Q9o'],
  ['BTN_RFI_25BB', 'J8o'], ['BTN_RFI_15BB', 'QTo'], ['BTN_RFI_60BB', '95s'],
]
const SMALL_BLIND_HANDS: [string, string][] = [
  ['SB_RFI_15BB', 'AA'], ['SB_RFI_15BB', '76s'], ['SB_RFI_15BB', 'A2s'], ['SB_RFI_25BB', 'KTo'],
  ['SB_RFI_40BB', 'AKs'], ['SB_RFI_40BB', 'KK'], ['SB_RFI_60BB', 'Q9o'],
  ['SB_RFI_15BB', '72o'], ['SB_RFI_25BB', '33'], ['SB_RFI_60BB', 'A5o'],
]

const STACK_COMPARISONS: [string, string, string][] = [
  ['UTG_RFI_15BB', 'UTG_RFI_25BB', 'K8s'],
  ['UTG_RFI_25BB', 'UTG_RFI_60BB', 'K8s'],
  ['CO_RFI_15BB', 'CO_RFI_25BB', 'KTs'],
  ['BTN_RFI_15BB', 'BTN_RFI_25BB', 'K9s'],
  ['SB_RFI_15BB', 'SB_RFI_40BB', 'AKs'],
  ['UTG_RFI_15BB', 'UTG_RFI_40BB', 'KJo'],
  ['HJ_RFI_15BB', 'HJ_RFI_25BB', 'KJs'],
  ['SB_RFI_15BB', 'SB_RFI_25BB', 'A2s'],
]

// "From which of these does HAND enter the baseline strategy — one, both, or neither?" —
// the "range ladder" question type, spread across categories rather than a standalone bucket.
const POSITION_COMPARISONS: { positionA: string; positionB: string; stackBB: number; hand: string; category: LabPoolCategory }[] = [
  { positionA: 'UTG', positionB: 'BTN', stackBB: 25, hand: 'K7o', category: 'early_position' }, // UTG folds (0%), BTN raises (100%)
  { positionA: 'UTG', positionB: 'UTG1', stackBB: 25, hand: 'A5o', category: 'early_position' }, // folds at both — even adjacent early seats agree
  { positionA: 'HJ', positionB: 'CO', stackBB: 25, hand: 'A8o', category: 'middle_position' }, // pure raise at both
  { positionA: 'LJ', positionB: 'HJ', stackBB: 15, hand: 'A8o', category: 'middle_position' }, // LJ mixes it 45%, HJ raises it clean — a genuine boundary hand
  { positionA: 'CO', positionB: 'BTN', stackBB: 60, hand: 'K4s', category: 'co_btn' }, // pure raise at both
]

const RECONSTRUCTIONS: [string, number][] = [
  ['UTG_RFI_60BB', 60],
  ['HJ_RFI_40BB', 40],
  ['CO_RFI_60BB', 60],
  ['BTN_RFI_40BB', 40],
  ['SB_RFI_25BB', 25],
  ['LJ_RFI_60BB', 60],
]

function buildPool(): LabPoolQuestion[] {
  const pool: LabPoolQuestion[] = [...FUNDAMENTALS]

  EARLY_POSITION_PAIRS.forEach(([chartKey, a, b], i) => pool.push(genBoundaryComparison(`pool-ep-cmp-${i}`, chartKey, a, b, 'early_position')))
  EARLY_POSITION_HANDS.forEach(([chartKey, hand], i) => pool.push(genHandDecision(`pool-ep-hd-${i}`, chartKey, hand, 'early_position')))

  MIDDLE_POSITION_PAIRS.forEach(([chartKey, a, b], i) => pool.push(genBoundaryComparison(`pool-mp-cmp-${i}`, chartKey, a, b, 'middle_position')))
  MIDDLE_POSITION_HANDS.forEach(([chartKey, hand], i) => pool.push(genHandDecision(`pool-mp-hd-${i}`, chartKey, hand, 'middle_position')))

  CO_BTN_PAIRS.forEach(([chartKey, a, b], i) => pool.push(genBoundaryComparison(`pool-cb-cmp-${i}`, chartKey, a, b, 'co_btn')))
  CO_BTN_HANDS.forEach(([chartKey, hand], i) => pool.push(genHandDecision(`pool-cb-hd-${i}`, chartKey, hand, 'co_btn')))

  SMALL_BLIND_HANDS.forEach(([chartKey, hand], i) => pool.push(genHandDecision(`pool-sb-hd-${i}`, chartKey, hand, 'small_blind')))

  STACK_COMPARISONS.forEach(([chartA, chartB, hand], i) => pool.push(genStackComparison(`pool-stack-${i}`, chartA, chartB, hand, 'stack_comparison')))

  RECONSTRUCTIONS.forEach(([chartKey, bb], i) => pool.push(genReconstruction(`pool-recon-${i}`, chartKey, bb)))

  POSITION_COMPARISONS.forEach(({ positionA, positionB, stackBB, hand, category }, i) =>
    pool.push(genPositionComparison(`pool-poscmp-${i}`, positionA, positionB, stackBB, hand, category)),
  )

  for (const q of pool) {
    for (const chartKey of q.chartKeys) {
      recordCoverage(chartKey, { labPoolQuestionId: q.id })
    }
  }

  return pool
}

export const MTT_LAB_POOL: LabPoolQuestion[] = buildPool()

export const LAB_POOL_TARGET_COUNTS: Record<LabPoolCategory, number> = {
  fundamentals: 5,
  early_position: 7,
  middle_position: 6,
  co_btn: 7,
  small_blind: 5,
  stack_comparison: 5,
  reconstruction: 5,
}

export const DRILL_POOL_TARGET_COUNTS: Partial<Record<LabPoolCategory, number>> = {
  early_position: 4,
  middle_position: 3,
  co_btn: 4,
  small_blind: 3,
  stack_comparison: 2,
}

function draw(seed: string, targetCounts: Partial<Record<LabPoolCategory, number>>): LessonStep[] {
  const steps: LessonStep[] = []
  for (const [category, count] of Object.entries(targetCounts) as [LabPoolCategory, number][]) {
    const candidates = MTT_LAB_POOL.filter((q) => q.category === category)
    const shuffled = shuffleBySeed(candidates, `${seed}:${category}`)
    steps.push(...shuffled.slice(0, count).map((q) => q.stepTemplate))
  }
  return steps
}

/** Selects a full ~40-question stratified Lab attempt. Category order is fixed
 *  (fundamentals -> ... -> reconstruction); questions within each category are
 *  shuffled by `seed` so retries (a fresh seed) draw a different combination. */
export function selectLabAttempt(seed: string): LessonStep[] {
  return draw(seed, LAB_POOL_TARGET_COUNTS)
}

/** Smaller retrieval-practice draw for the Opening Range Drill lesson — reuses the
 *  same validated pool, no reconstruction category (that's Lab-only mastery testing). */
export function selectDrillAttempt(seed: string): LessonStep[] {
  return draw(seed, DRILL_POOL_TARGET_COUNTS)
}

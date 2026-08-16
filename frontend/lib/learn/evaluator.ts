/**
 * Local deterministic puzzle evaluator.
 *
 * Every puzzle step carries its full evaluation metadata (options with quality +
 * feedback, correct_answer, equity_actual, mdf_slider_target, etc.).  This
 * module reads that embedded data and produces a StepResult instantly — no
 * network call, no AI, no variability.
 *
 * The same action on the same step always produces the same result.
 */

import type { LessonStep, StepResult, ActionQuality, AnswerReveal, ScenarioOutcome, ReasoningStageResult, DecisionSpotRangeReveal } from './types'
import { levelForXP } from './types'
import { expandHandClass, expandGenericUnpaired, getRemainingCombos, getBlockedCombos, comboKey, flushTiers } from './combos'
import { RANGE_TARGETS } from './ranges'
import { MTT_RFI_CHARTS, type MttAction, type MttRfiChart } from './mttRfiBaselines'
import { THREEBET_RESPONSE_CHARTS, type ThreebetResponseAction, type ThreebetResponseChart } from './threebetResponseBaselines'
import { diagnoseRangeShape } from './threebetResponseRanges'
import { DEFEND_RESPONSE_CHARTS, type DefendResponseAction, type DefendResponseChart } from './defendResponseBaselines'
import { diagnoseDefendRangeShape } from './defendResponseRanges'
import { resolveMultiPrefilledAssignments } from './multiActionRangePrefill'
import { BB_DEFENSE_COMPLETE_100BB, type BBOpenDefenseMatchup } from './bbDefenseComplete'
import { evaluateTableDecision } from './tableDecisionEngine'
import { resolveDefendRangeReveal } from './defendRangeReveal'
import { resolveThreebetRangeReveal } from './threebetRangeReveal'
import { resolveOpenerRangePanel, resolveOpenerRangeReveal } from './openerRangeReveal'
import { resolveFacingThreebetRangeReveal } from './facingThreebetRangeReveal'
import {
  evOfBetting, evOfChecking, bestResponse, isIndifferent,
  clairvoyanceEV, clairvoyanceEquilibrium, geometricBetSizing, minimumBetToDenyEquity, type ActionEV,
} from './gameTheoryEngine'
import { deviationSides, deviationVerdict, resolveDeviationPanel } from './unilateralDeviation'
import { PRESSURE_GAME_DEFAULT } from './gameTheoryContent'
import {
  classifyFlop, dimensionValue, equityBucket, estimateVolatility, turnImpact,
  type FlopClassification, type VolatilityLevel,
} from './flopClassifier'

// ── Scoring tables ────────────────────────────────────────────────────────────

/** Canonical score for each quality tier */
const QUALITY_SCORES: Record<ActionQuality, number> = {
  perfect:    100,
  good:        82,
  acceptable:  62,
  mistake:     35,
  punt:        10,
}

/** Fraction of step.xp awarded per quality tier */
const QUALITY_XP_MULT: Record<ActionQuality, number> = {
  perfect:    1.00,
  good:       0.80,
  acceptable: 0.50,
  mistake:    0.20,
  punt:       0.00,
}

// ── Internal evaluation core (no level / XP math) ────────────────────────────

interface EvalCore {
  quality: ActionQuality
  score: number
  feedback: string
  ev_loss_bb: number
  concept_triggered?: string
  concept_explanation?: string
  structured_points?: { term: string; description: string }[]
  /** True when this step had nothing to grade (passive/informational content or an
   *  exploration-mode visualizer). See `isScoredStep` for the classification rule. */
  unscored?: boolean
  /** "What was the correct answer" reveal — see `AnswerReveal` in types.ts. Only
   *  set when the response wasn't fully correct; left undefined for step types
   *  whose own component already renders a richer item-by-item reveal. */
  answer_reveal?: AnswerReveal
  /** Optional multi-stage reasoning breakdown — see `ReasoningStageResult` in types.ts. */
  reasoning_stages?: ReasoningStageResult[]
}

/** The single, shared "unscored" sentinel — same shape everywhere so the router
 *  below never repeats a fabricated quality/score for a step nothing was graded on. */
const UNSCORED_CORE: EvalCore = {
  quality: 'perfect',
  score: 0,
  feedback: 'Reviewed.',
  ev_loss_bb: 0,
  unscored: true,
}

/**
 * Classifies a step as scored (has an actual question/decision to grade) or
 * passive/unscored (pure content, or an exploration-mode visualizer with no
 * quiz attached) — WITHOUT needing a user response. This is the single source
 * of truth `resolveCore` below consults, and is also exported so UI code can
 * ask the same question before evaluation happens (e.g. to decide whether a
 * step's "Continue" should skip straight to the next step).
 */
export function isScoredStep(step: LessonStep): boolean {
  switch (step.type) {
    case 'concept_reveal':
    case 'defense_lens':
    case 'flop_scanner':
    case 'pot_win_intro':
    case 'tendency_summary':
      return false

    // ── Understanding the Flop (Module 6) — mode-gated ──
    case 'suit_isomorphism':
      return step.suit_isomorphism_mode === 'sort'
    case 'range_board_collision':
      return !!step.options?.length
    case 'equity_bucket':
      return step.equity_bucket_mode !== 'distribution' || !!step.options?.length

    // Mode-gated: scored only in their quiz/challenge/classify mode
    case 'combo_visualizer':
      return step.combo_visualizer_mode === 'quiz'
    case 'combo_removal':
    case 'flush_pyramid':
      return true

    // Game Theory Foundations (Module 10) — mode-gated: 'intro' and 'iterate' are guided
    // walkthroughs with nothing to grade (same pattern as pot_win_intro/tendency_summary);
    // 'best_response' and 'counter_exploit' are real graded decisions. clairvoyance_lab's
    // 'explore' mode is free-form investigation; 'find_equilibrium' is the graded challenge.
    case 'strategy_response_lab':
      return step.strategy_response_lab_mode === 'best_response' || step.strategy_response_lab_mode === 'counter_exploit'
    case 'clairvoyance_lab':
      return step.clairvoyance_lab_mode === 'find_equilibrium'

    case 'spr_visualizer':
      return step.spr_visualizer_mode !== 'worlds'
    case 'morphology_builder':
      return step.morphology_builder_mode === 'build' || !!step.options?.length

    // Scored only when a numeric target or an option list is authored —
    // otherwise these are pure exploration/visualization steps
    case 'position_table':
    case 'ev_tree':
    case 'range_compare':
    case 'hand_dna':
    case 'stack_depth_morph':
    case 'mtt_stack_depth_compare':
    case 'dead_money_visualizer':
    case 'strategy_complexity':
    case 'range_diff':
    case 'blocker_lab':
    case 'sizing_slider':
    case 'range_distribution':
      return !!step.options?.length

    // Range vs Range (Module 8) — mode-gated: range_collision is scored only in
    // 'predict'/'archaeology' modes (a real options-based guess); 'reveal'/'morph'
    // are pure illustration. range_xray is a bucket-display visualization, scored
    // only when a follow-up question was authored — same pattern as equity_bucket.
    case 'range_collision':
    case 'range_xray':
      return !!step.options?.length

    case 'pot_odds_explorer':
      return step.pot_odds_correct != null || !!step.options?.length
    case 'outs_deck':
      return step.outs_deck_correct != null || !!step.options?.length
    case 'bluff_breakeven':
      return step.bluff_breakeven_correct != null || !!step.options?.length
    case 'equity_realization':
      return step.equity_realization_correct != null || !!step.options?.length
    case 'players_behind':
      return step.players_behind_correct != null || !!step.options?.length
    case 'open_size_explorer':
      return step.open_size_correct != null || !!step.options?.length

    // Module 12, Lesson 1 ("A Bet Size Is a Sentence") — the exploratory first pass over the
    // Bet Size Translator authors no target at all (by design: "this pass cannot be failed").
    // Every existing Module 10/11 mdf_slider lesson already authors mdf_slider_target, so this
    // is a no-op for all of them — only a target-less step (which didn't exist before this
    // module) newly becomes unscored.
    case 'mdf_slider':
      return step.mdf_slider_target != null

    // Module 12, Lessons 3-4 (Range Compression Explorer) — scored only when a prediction
    // question was authored, matching range_distribution's own identical convention; the
    // component's own no-options path is a passive "Continue" step.
    case 'range_compression_toggle':
      return !!step.options?.length

    // Everything else (decision_spot, bet_size_choose, bluff_pick, board_classify,
    // nut_advantage, blocker_id, range_identify, reflection_prompt, equity_predict,
    // range_build, range_heatmap, scenario_tree, action_sequence,
    // range_morphology, equity_balance, range_bucket, hand_ranking_order, and any
    // unknown future type) always carries a real question/decision to grade.
    default:
      return true
  }
}

// ── Option-based steps ────────────────────────────────────────────────────────
// decision_spot, bet_size_choose, bluff_pick, board_classify, nut_advantage,
// blocker_id, range_identify, reflection_prompt, mdf_slider (when options present)

/** Terminology for the "correct answer" reveal, per step type — keyed off the
 *  step's own `type` (never a separate authored field) so it can't drift from
 *  what resolveCore actually routes to evalOptionBased. Anything not listed
 *  falls back to the generic "Correct answer". */
const OPTION_BASED_TERM: Partial<Record<LessonStep['type'], string>> = {
  decision_spot: 'Correct play',
  bet_size_choose: 'Correct sizing',
  bluff_pick: 'Correct play',
  board_classify: 'Correct classification',
  range_identify: 'Correct range',
  reflection_prompt: 'Best answer',
  action_sequence: 'Correct answer',
  range_morphology: 'Correct classification',
  morphology_builder: 'Correct classification',
  ev_tree: 'Correct decision',
  sizing_slider: 'Correct sizing',
  equity_bucket: 'Correct bucket',
  range_compression_toggle: 'Correct prediction',
}

/** Every option tied for the highest quality tier actually authored on this step —
 *  the "correct answer(s)" per the SAME data the score above was computed from.
 *  Falls back gracefully if no option reaches 'perfect' (rare authoring case):
 *  whatever tier IS the best available is treated as correct for reveal purposes. */
function bestOptions(step: LessonStep) {
  const options = step.options ?? []
  if (options.length === 0) return []
  const bestScore = Math.max(...options.map((o) => QUALITY_SCORES[o.quality]))
  return options.filter((o) => QUALITY_SCORES[o.quality] === bestScore)
}

/** Builds the `answer_reveal` for an option-based step, or undefined if the
 *  learner's chosen option is already among the best-tier options (nothing to
 *  reveal — they got it right, no unnecessary comparison). */
function optionAnswerReveal(
  step: LessonStep,
  chosenOption: { id: string; label: string } | undefined,
  term: string,
): AnswerReveal | undefined {
  const best = bestOptions(step)
  if (best.length === 0) return undefined
  if (chosenOption && best.some((o) => o.id === chosenOption.id)) return undefined
  return {
    term,
    correct: best.map((o) => o.label).join(' or '),
    yours: chosenOption?.label,
  }
}

/** Human-readable label for a response id that has no matching `options[]`
 *  entry — reachable for `cbet_frequency_size` specifically, whose response
 *  (`${frequencyId}|${sizingId}`, built in FrequencySizeLab.tsx from two
 *  independent picker widgets) can land on a frequency/sizing combination
 *  nobody explicitly authored as its own option. Decodes each half against
 *  the step's own picker option lists so the learner sees their real choice
 *  spelled out, not a raw id like "low|medium". */
function describeUnlistedResponse(step: LessonStep, optionId: string): string {
  if (step.type === 'cbet_frequency_size' && optionId.includes('|')) {
    const [freqId, sizeId] = optionId.split('|')
    const freqLabel = step.cbet_frequency_size_frequency_options?.find((o) => o.id === freqId)?.label ?? freqId
    const sizeLabel = step.cbet_frequency_size_sizing_options?.find((o) => o.id === sizeId)?.label ?? sizeId
    return `${freqLabel} + ${sizeLabel}`
  }
  return optionId
}

/** A response with no matching `options[]` entry never gets a bare technical
 *  message — it reuses the step's own best-tier option feedback (which
 *  already explains the real theory behind the correct answer) prefixed with
 *  what the learner actually chose, so every unlisted combination still
 *  teaches instead of just failing silently. Never invents new poker theory
 *  here — only recombines prose the step's own author already wrote. */
function evalUnlistedOptionResponse(step: LessonStep, optionId: string, term: string): EvalCore {
  const best = bestOptions(step)[0]
  const chosenLabel = describeUnlistedResponse(step, optionId)
  const feedback = best
    ? `You chose ${chosenLabel} — not the strategy this spot supports. ${best.feedback}`
    : step.wrong_feedback ?? `You chose ${chosenLabel}. Take another look at the board and the reasoning above before choosing.`
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback,
    ev_loss_bb: 0,
    answer_reveal: optionAnswerReveal(step, undefined, term),
  }
}

function evalOptionBased(step: LessonStep, response: unknown): EvalCore {
  const term = OPTION_BASED_TERM[step.type] ?? 'Correct answer'
  const optionId = String(response ?? '')
  const option = step.options?.find((o) => o.id === optionId)

  if (!option) {
    return evalUnlistedOptionResponse(step, optionId, term)
  }

  return {
    quality: option.quality,
    score: QUALITY_SCORES[option.quality],
    feedback: option.feedback,
    ev_loss_bb: option.ev_loss_bb ?? 0,
    concept_triggered: option.concept_triggered,
    structured_points: option.feedback_structured_items,
    answer_reveal: optionAnswerReveal(step, option, term),
  }
}

// ── Numeric steps (equity_predict, mdf_slider) ────────────────────────────────

function evalNumeric(opts: {
  actual: number
  tolerance: number
  response: unknown
  correctFeedback: string
  wrongFeedback: string
  unit?: string
  /** Terminology for the structured reveal, e.g. "Correct MDF", "Correct required equity". */
  term?: string
  /** When true, populate `answer_reveal` even on a fully-correct answer — for
   *  reference-value displays (solver equity, EV, GTO frequency, ...) where
   *  showing the real number IS the pedagogical point, not just a "you were
   *  wrong" comparison. Defaults to false, leaving every other numeric step
   *  (pot odds, outs, MDF, SPR, bluff break-even, equity realization, ...)
   *  byte-for-byte unchanged: a perfect answer there still gets no reveal. */
  alwaysReveal?: boolean
  /** One-line book/solver citation threaded straight into `answer_reveal.source` —
   *  only ever a passthrough of a step's own authored source field. */
  source?: string
}): EvalCore {
  const { actual, tolerance, response, correctFeedback, wrongFeedback, unit = '', term = 'Correct answer', alwaysReveal = false, source } = opts
  const value = Number(response)
  const correctDisplay = `${actual}${unit}`

  if (isNaN(value)) {
    return {
      quality: 'punt',
      score: QUALITY_SCORES.punt,
      feedback: wrongFeedback,
      ev_loss_bb: 0,
      answer_reveal: { term, correct: correctDisplay, source },
    }
  }

  const delta = Math.abs(value - actual)
  // Every numeric slider/challenge step (pot odds, outs, bluff break-even,
  // equity realization, MDF, SPR, combo counts...) shares this evaluator, so
  // echoing the learner's own answer here is the one reliable place the
  // "your answer vs correct answer" reveal reaches every one of them.
  const yourAnswer = `You answered ${value}${unit}.`
  const yourDisplay = `${value}${unit}`
  // Only computed/attached when a caller opts in (alwaysReveal) — signed
  // distance from the reference value, e.g. "+0.3%" or "Exact match".
  const signedDelta = Math.round((value - actual) * 10) / 10
  const deltaLabel = signedDelta === 0 ? 'Exact match' : `${signedDelta > 0 ? '+' : ''}${signedDelta}${unit}`
  // Most callers' wrongFeedback already states the correct value as part of its
  // explanation (a formula, a WHY, or just "the correct answer is X") — appending
  // another "the correct/exact answer is X" sentence unconditionally produced the
  // literal doubled-up feedback reported for equity realization ("The correct
  // answer is 32%. The correct answer is 32%."). Only append the generic reveal
  // sentence when wrongFeedback/correctFeedback hasn't already surfaced the number.
  const wrongFeedbackStatesAnswer = wrongFeedback.includes(correctDisplay)
  const correctFeedbackStatesAnswer = correctFeedback.includes(correctDisplay)

  if (delta <= tolerance) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `${yourAnswer} ${correctFeedback}`,
      ev_loss_bb: 0,
      ...(alwaysReveal ? { answer_reveal: { term, correct: correctDisplay, yours: yourDisplay, source, delta: deltaLabel } } : {}),
    }
  }
  if (delta <= tolerance * 2) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: correctFeedbackStatesAnswer
        ? `${yourAnswer} ${correctFeedback}`
        : `${yourAnswer} ${correctFeedback} (close — exact answer is ${actual}${unit})`,
      ev_loss_bb: 0,
      answer_reveal: { term, correct: correctDisplay, yours: yourDisplay, ...(alwaysReveal ? { source, delta: deltaLabel } : {}) },
    }
  }
  if (delta <= tolerance * 3.5) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: wrongFeedbackStatesAnswer
        ? `${yourAnswer} ${wrongFeedback}`
        : `${yourAnswer} ${wrongFeedback} The exact value is ${actual}${unit}.`,
      ev_loss_bb: 0,
      answer_reveal: { term, correct: correctDisplay, yours: yourDisplay, ...(alwaysReveal ? { source, delta: deltaLabel } : {}) },
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: wrongFeedbackStatesAnswer
      ? `${yourAnswer} ${wrongFeedback}`
      : `${yourAnswer} ${wrongFeedback} The correct answer is ${actual}${unit}.`,
    ev_loss_bb: 0,
    answer_reveal: { term, correct: correctDisplay, yours: yourDisplay, ...(alwaysReveal ? { source, delta: deltaLabel } : {}) },
  }
}

// ── Geometric Bet Ladder (Module 12, Lesson 6) ─────────────────────────────────
// Two linked numeric sub-judgments (R, then bet-fraction derived from R) submitted
// together as one response — evalNumeric's shape assumes a single number, so this
// is a small, standalone resolver rather than a forced reuse, following the exact
// structural precedent evalRangeSurgeryProtection already established (a narrow,
// independently-testable function, dispatched from one new switch case).
function evalGeometricBetLadder(step: LessonStep, response: unknown): EvalCore {
  const startingPot = step.geometric_ladder_starting_pot ?? 70
  const effectiveStack = step.geometric_ladder_effective_stack ?? 965
  const streets = step.geometric_ladder_streets ?? 3
  const tolerance = step.geometric_ladder_tolerance ?? 0.05
  const { growthRate: correctR, betFraction: correctFraction } = geometricBetSizing(startingPot, effectiveStack, streets)

  const r = response && typeof response === 'object' ? (response as { rGuess?: unknown }).rGuess : undefined
  const frac = response && typeof response === 'object' ? (response as { betFractionGuess?: unknown }).betFractionGuess : undefined
  const rNum = Number(r)
  const fracNum = Number(frac)

  if (isNaN(rNum) || isNaN(fracNum)) {
    return { quality: 'punt', score: QUALITY_SCORES.punt, feedback: 'No answer submitted.', ev_loss_bb: 0 }
  }

  const rCorrect = Math.abs(rNum - correctR) <= correctR * tolerance
  const fractionCorrect = Math.abs(fracNum - correctFraction) <= Math.max(0.02, correctFraction * tolerance)

  const sentences: string[] = []
  if (rCorrect && fractionCorrect) {
    sentences.push(`Both correct — R ≈ ${correctR.toFixed(2)}, bet-fraction ≈ ${(correctFraction * 100).toFixed(0)}% of the pot.`)
    sentences.push('The pot needs to grow by that same multiple every remaining street to land exactly on an all-in by the final one — by construction, not coincidence.')
  } else if (!rCorrect && fractionCorrect) {
    sentences.push(`Your bet-fraction is right (${(correctFraction * 100).toFixed(0)}%), but R itself was off (actual R ≈ ${correctR.toFixed(2)}).`)
    sentences.push('The most common R mistake: computing (Final Pot ÷ Starting Pot) and stopping there — that number is the TOTAL growth needed across every street combined, not the per-street rate. You still need to take the 1/streets root of it.')
  } else if (rCorrect && !fractionCorrect) {
    sentences.push(`R is right (≈${correctR.toFixed(2)}), but the bet-fraction conversion was off (actual ≈ ${(correctFraction * 100).toFixed(0)}% of pot).`)
    sentences.push('Remember why it\'s (R−1)÷2, not R itself: the pot grows because BOTH players put a bet-sized amount in, not just one. Forgetting the ÷2 produces a bet nearly twice too large.')
  } else {
    sentences.push(`Actual R ≈ ${correctR.toFixed(2)}, actual bet-fraction ≈ ${(correctFraction * 100).toFixed(0)}% of the pot — both were off.`)
    sentences.push('Isolate the two steps separately: first Final Pot ÷ Starting Pot, then take the 1/streets root to get R. Then (R−1)÷2 converts R into the per-street bet-fraction.')
  }

  const quality: ActionQuality = rCorrect && fractionCorrect ? 'perfect' : rCorrect || fractionCorrect ? 'acceptable' : 'mistake'

  return {
    quality,
    score: QUALITY_SCORES[quality],
    feedback: sentences.join(' '),
    ev_loss_bb: 0,
    reasoning_stages: [
      { stage: 'computation_correct', label: 'Growth rate (R)', correct: rCorrect, detail: `Actual R ≈ ${correctR.toFixed(3)}` },
      { stage: 'formula_cited', label: 'Bet-fraction = (R−1)÷2', correct: fractionCorrect, detail: `Actual bet-fraction ≈ ${(correctFraction * 100).toFixed(1)}%` },
    ],
  }
}

// ── River Sizing Calculator (Module 12, Lesson 9) ───────────────────────────────
function evalRiverSizingCalculator(step: LessonStep, response: unknown): EvalCore {
  const equityPct = step.river_calc_opponent_equity_pct ?? 25
  const tolerance = step.river_calc_tolerance ?? 0.05
  const correctMinBet = minimumBetToDenyEquity(equityPct / 100)

  const guess = response && typeof response === 'object' ? (response as { minimumBetGuessPct?: unknown }).minimumBetGuessPct : undefined
  const guessNum = Number(guess)

  if (isNaN(guessNum)) {
    return { quality: 'punt', score: QUALITY_SCORES.punt, feedback: 'No answer submitted.', ev_loss_bb: 0 }
  }

  const correctPct = correctMinBet * 100
  const delta = Math.abs(guessNum / 100 - correctMinBet)
  const withinTolerance = delta <= Math.max(0.02, correctMinBet * tolerance)

  let quality: ActionQuality
  let feedback: string
  if (withinTolerance) {
    quality = 'perfect'
    feedback = `Correct — B = ${equityPct}% ÷ (100% − 2×${equityPct}%) = ${correctPct.toFixed(1)}% of the pot. Below this size, Villain has a profitable call somewhere in their range; at or above it, their entire range is a losing call.`
  } else if (delta <= Math.max(0.05, correctMinBet * tolerance * 3)) {
    quality = 'acceptable'
    feedback = `Close, but not quite — the exact minimum is B = EQ ÷ (1 − 2×EQ) = ${equityPct}% ÷ ${(100 - 2 * equityPct).toFixed(0)}% = ${correctPct.toFixed(1)}% of the pot. Isolate the denominator first (1 − 2×EQ), then divide.`
  } else {
    quality = 'mistake'
    feedback = `The correct minimum is ${correctPct.toFixed(1)}% of the pot, computed as B = EQ ÷ (1 − 2×EQ) = ${equityPct}% ÷ ${(100 - 2 * equityPct).toFixed(0)}%. This is the bet-size at which Villain's pot odds on a call exactly equal their stated equity — anything smaller leaves them a profitable call somewhere in their range.`
  }

  return {
    quality,
    score: QUALITY_SCORES[quality],
    feedback,
    ev_loss_bb: 0,
    answer_reveal: { term: 'Minimum bet to deny', correct: `${correctPct.toFixed(1)}%`, yours: `${guessNum}%` },
  }
}

// Module 12, Lesson 10 (capstone): per Part 2's own Interactive Lesson spec, "No street's
// submission is revealed against a single 'correct answer'... the Sizing Strategy Report is
// generated only after all three streets are submitted" — i.e. three SEPARATE, independently-
// scored submissions with a synthesized report at the end, not one combined multi-part
// submission. That is exactly the existing decision_spot (per street) + tendency_summary
// (final report) pattern every prior capstone (Modules 7/8/10/11) already uses — no new
// resolver, no new StepType, no new response shape required.

// ── Equity predict (hand vs range) ────────────────────────────────────────────
// Scored like evalNumeric, but always echoes the learner's own estimate next to
// the actual value, and surfaces a range-specific WHY explanation separately
// (rendered in its own box by StepFeedback) rather than folding it into the
// tier-based encouragement line.

function evalEquityPredict(step: LessonStep, response: unknown): EvalCore {
  const actual = step.equity_actual ?? 0
  const tolerance = step.equity_tolerance ?? 5
  const value = Number(response)

  const concept_triggered = 'Hand vs Range'
  const concept_explanation = step.equity_explanation

  if (isNaN(value)) {
    return {
      quality: 'punt',
      score: QUALITY_SCORES.punt,
      feedback: step.wrong_feedback ?? `Actual equity here is ${actual}%.`,
      ev_loss_bb: 0,
      concept_triggered,
      concept_explanation,
      answer_reveal: { term: 'Actual equity', correct: `${actual}%` },
    }
  }

  const delta = Math.abs(value - actual)
  const header = `Your estimate: ${value}%. Actual equity: ${actual}%.`

  if (delta <= tolerance) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `${header} ${step.correct_feedback ?? 'Right in range.'}`,
      ev_loss_bb: 0,
      concept_triggered,
      concept_explanation,
    }
  }
  if (delta <= tolerance * 2) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: `${header} ${step.correct_feedback ?? 'Close — a reasonable estimate.'}`,
      ev_loss_bb: 0,
      concept_triggered,
      concept_explanation,
      answer_reveal: { term: 'Actual equity', correct: `${actual}%`, yours: `${value}%` },
    }
  }
  if (delta <= tolerance * 3.5) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: `${header} ${step.wrong_feedback ?? 'A bit off — see the breakdown below.'}`,
      ev_loss_bb: 0,
      concept_triggered,
      concept_explanation,
      answer_reveal: { term: 'Actual equity', correct: `${actual}%`, yours: `${value}%` },
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: `${header} ${step.wrong_feedback ?? 'Well off — see the breakdown below.'}`,
    ev_loss_bb: 0,
    concept_triggered,
    concept_explanation,
    answer_reveal: { term: 'Actual equity', correct: `${actual}%`, yours: `${value}%` },
  }
}

// ── Range steps (range_build, range_heatmap) ──────────────────────────────────

/** Number of distinct combos a hand notation represents. A length-4 entry
 *  (e.g. 'JcJd', 'AhQh') is a single concrete board-situated combo — not a
 *  class — so it's exactly one combo, not the pair/suited/offsuit weighting
 *  below. No existing hand-class notation is ever 4 characters, so this
 *  check is purely additive for range_bucket steps that author concrete
 *  combos via `range_bucket_board` (see RangeBucketSort.tsx). */
function handCombos(hand: string): number {
  if (hand.length === 4) return 1    // concrete combo e.g. 'JcJd'
  if (hand.length === 2) return 6    // pair  e.g. 'AA'
  if (hand.endsWith('s')) return 4   // suited e.g. 'AKs'
  if (hand.endsWith('o')) return 12  // offsuit e.g. 'AKo'
  return 6
}

function evalRange(
  targetHands: string[],
  tolerance: number,
  response: unknown,
): EvalCore {
  const selected = new Set(Array.isArray(response) ? (response as string[]) : [])
  const target = new Set(targetHands)

  if (target.size === 0) {
    // No target defined — can't score, record as good
    return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
  }

  let targetCount  = 0
  let selectedCount = 0
  let overlapCount  = 0

  for (const h of target)   targetCount  += handCombos(h)
  for (const h of selected) {
    const c = handCombos(h)
    selectedCount += c
    if (target.has(h)) overlapCount += c
  }

  const precision = selectedCount > 0 ? overlapCount / selectedCount : 0
  const recall    = targetCount   > 0 ? overlapCount / targetCount   : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  const toleranceFraction = (tolerance ?? 5) / 100
  const rawScore = Math.round(f1 * 100)

  const missedPct  = Math.round((1 - recall)    * 100)
  const extraPct   = Math.round((1 - precision) * 100)

  const detail = [
    missedPct > 0 && `${missedPct}% of target combos missed`,
    extraPct  > 0 && `${extraPct}% of selections outside target`,
  ].filter(Boolean).join('; ')

  if (f1 >= 1 - toleranceFraction) {
    return { quality: 'perfect', score: 100, feedback: 'Excellent range construction!', ev_loss_bb: 0 }
  }
  if (f1 >= 0.82 - toleranceFraction) {
    return {
      quality: 'good',
      score: Math.max(QUALITY_SCORES.good, rawScore),
      feedback: `Good range — a few combos off${detail ? ` (${detail})` : ''}.`,
      ev_loss_bb: 0,
    }
  }
  if (f1 >= 0.60 - toleranceFraction) {
    return {
      quality: 'acceptable',
      score: Math.max(QUALITY_SCORES.acceptable, rawScore),
      feedback: `Range is roughly right but has leaks${detail ? ` (${detail})` : ''}. Review the target.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: Math.max(20, rawScore),
    feedback: `Range has significant errors${detail ? ` (${detail})` : ''}. Study the correct ranges for this position.`,
    ev_loss_bb: 0,
  }
}

// ── Multi-action range build (Module 3 MTT upgrade) ───────────────────────────
// Combo-weighted expected-accuracy scoring against a real MttRfiChart (mttRfiBaselines.ts):
// for each of the 169 hand classes, credit = the book's own frequency for whichever action
// the learner assigned that hand (0 for a wrong/unassigned hand). This is what makes a
// book-sourced mixed-frequency hand (e.g. "A5s: raise 0.65 / fold 0.35") gradeable as
// partial credit instead of forcing a false binary right/wrong. Hands absent from both the
// chart and the learner's response are implicit fold/fold — full credit, matching the sparse
// chart convention ("absent = 100% fold").

function evalMultiActionRange(
  chart: MttRfiChart,
  tolerance: number,
  response: unknown,
): EvalCore {
  const assignments: Record<string, MttAction> =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, MttAction>)
      : {}

  const chartByHand = new Map(chart.cells.map((c) => [c.hand, c.actions]))
  const allHands = new Set<string>([...chartByHand.keys(), ...Object.keys(assignments)])

  if (allHands.size === 0) {
    return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
  }

  let totalCombos = 0
  let earnedCombos = 0
  let wrongCombos = 0

  for (const hand of allHands) {
    const combos = handCombos(hand)
    totalCombos += combos
    const bookActions = chartByHand.get(hand) ?? { fold: 1 }
    const chosen: MttAction = assignments[hand] ?? 'fold'
    const credit = bookActions[chosen] ?? 0
    earnedCombos += credit * combos
    if (credit < 0.5) wrongCombos += combos
  }

  const accuracy = totalCombos > 0 ? earnedCombos / totalCombos : 0
  const rawScore = Math.round(accuracy * 100)
  const toleranceFraction = (tolerance ?? 5) / 100
  const wrongPct = Math.round((wrongCombos / totalCombos) * 100)
  const detail = wrongPct > 0 ? `${wrongPct}% of combos assigned the wrong action` : ''

  if (accuracy >= 1 - toleranceFraction) {
    return { quality: 'perfect', score: 100, feedback: 'Excellent — matches the baseline strategy!', ev_loss_bb: 0 }
  }
  if (accuracy >= 0.82 - toleranceFraction) {
    return {
      quality: 'good',
      score: Math.max(QUALITY_SCORES.good, rawScore),
      feedback: `Good — close to the baseline strategy${detail ? ` (${detail})` : ''}.`,
      ev_loss_bb: 0,
    }
  }
  if (accuracy >= 0.60 - toleranceFraction) {
    return {
      quality: 'acceptable',
      score: Math.max(QUALITY_SCORES.acceptable, rawScore),
      feedback: `Roughly right but has leaks${detail ? ` (${detail})` : ''}. Review the boundary hands.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: Math.max(20, rawScore),
    feedback: `Significant errors versus the baseline strategy${detail ? ` (${detail})` : ''}.`,
    ev_loss_bb: 0,
  }
}

// ── 3-bet response range build (Module 4's "They Raised Back" Range Lab) ──────
// Same combo-weighted accuracy as evalMultiActionRange, but the feedback is
// SHAPE-based rather than a generic "X% of combos wrong" line (spec: don't grade
// only by cell-exact %, analyze the composition) — see diagnoseRangeShape in
// threebetResponseRanges.ts, which derives 1-3 targeted messages from whichever
// hand-category mismatches (folding playable suited hands, calling dominated
// offsuit hands, a 4-bet range with no blockers, ...) actually occurred.

function evalThreebetResponseRange(
  chart: ThreebetResponseChart,
  tolerance: number,
  response: unknown,
): EvalCore {
  const assignments: Record<string, ThreebetResponseAction> =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, ThreebetResponseAction>)
      : {}

  const { accuracy, messages } = diagnoseRangeShape(chart, assignments)
  const rawScore = Math.round(accuracy * 100)
  const toleranceFraction = (tolerance ?? 5) / 100
  const feedback = messages.join(' ')

  if (accuracy >= 1 - toleranceFraction) {
    return { quality: 'perfect', score: 100, feedback: `Excellent — matches the baseline strategy's shape. ${feedback}`, ev_loss_bb: 0 }
  }
  if (accuracy >= 0.82 - toleranceFraction) {
    return { quality: 'good', score: Math.max(QUALITY_SCORES.good, rawScore), feedback, ev_loss_bb: 0 }
  }
  if (accuracy >= 0.60 - toleranceFraction) {
    return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, rawScore), feedback, ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(20, rawScore), feedback, ev_loss_bb: 0 }
}

function evalDefendResponseRange(
  chart: DefendResponseChart,
  tolerance: number,
  response: unknown,
  prefilled: Record<string, DefendResponseAction> = {},
): EvalCore {
  const assignments: Record<string, DefendResponseAction> =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, DefendResponseAction>)
      : {}

  const { accuracy, messages } = diagnoseDefendRangeShape(chart, assignments, prefilled)
  const rawScore = Math.round(accuracy * 100)
  const toleranceFraction = (tolerance ?? 5) / 100
  const feedback = messages.join(' ')

  if (accuracy >= 1 - toleranceFraction) {
    return { quality: 'perfect', score: 100, feedback: `Excellent — matches the baseline strategy's shape. ${feedback}`, ev_loss_bb: 0 }
  }
  if (accuracy >= 0.82 - toleranceFraction) {
    return { quality: 'good', score: Math.max(QUALITY_SCORES.good, rawScore), feedback, ev_loss_bb: 0 }
  }
  if (accuracy >= 0.60 - toleranceFraction) {
    return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, rawScore), feedback, ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(20, rawScore), feedback, ev_loss_bb: 0 }
}

// ── Range bucket steps (Module 4) ─────────────────────────────────────────────
// Assign a pool of hands into named buckets (VALUE 3-BET / BLUFF 3-BET / CALL / FOLD, etc.)
// Scored combo-weighted, like evalRange, against a best-category map with optional
// secondary-acceptable categories per hand.

function evalRangeBucket(step: LessonStep, response: unknown): EvalCore {
  const pool = step.range_bucket_pool ?? []
  const correct = step.range_bucket_correct ?? {}
  const acceptable = step.range_bucket_acceptable ?? {}
  const assignments = response && typeof response === 'object' ? (response as Record<string, string>) : {}

  if (pool.length === 0) {
    return { quality: 'good', score: 80, feedback: 'Sort recorded.', ev_loss_bb: 0 }
  }

  let totalCombos = 0
  let correctCombos = 0
  const misplaced: string[] = []

  for (const hand of pool) {
    const c = handCombos(hand)
    totalCombos += c
    const assigned = assignments[hand]
    const best = correct[hand]
    const accepted = acceptable[hand] ?? []
    if (assigned && (assigned === best || accepted.includes(assigned))) {
      correctCombos += c
    } else {
      misplaced.push(hand)
    }
  }

  const accuracy = totalCombos > 0 ? correctCombos / totalCombos : 0
  const pct = Math.round(accuracy * 100)
  const detail =
    misplaced.length > 0
      ? `${misplaced.length} hand${misplaced.length === 1 ? '' : 's'} in the wrong bucket (${misplaced.slice(0, 4).join(', ')}${misplaced.length > 4 ? '…' : ''})`
      : ''

  if (accuracy >= 0.95) {
    return { quality: 'perfect', score: 100, feedback: 'Excellent sort — every hand landed in a sound bucket.', ev_loss_bb: 0 }
  }

  const quality: ActionQuality = accuracy >= 0.8 ? 'good' : accuracy >= 0.6 ? 'acceptable' : 'mistake'
  const score = quality === 'mistake' ? Math.max(20, pct) : Math.max(QUALITY_SCORES[quality], pct)

  // Opt-in instructional layer (see SetSelectionCoaching): with authored
  // per-hand reasoning, a misplaced hand explains WHY it belongs where it
  // belongs instead of just being named. Steps without these fields are
  // unchanged.
  const notes = step.range_bucket_hand_notes
  if (notes || step.range_bucket_takeaway) {
    const bucketLabel = (id: string | undefined) =>
      step.range_bucket_categories?.find((c) => c.id === id)?.label ?? id
    const structured_points: { term: string; description: string }[] = []
    for (const hand of misplaced) {
      const note = notes?.[hand]
      const placed = bucketLabel(assignments[hand])
      const belongs = placed
        ? `Belongs in ${bucketLabel(correct[hand])}, not ${placed}.`
        : `Belongs in ${bucketLabel(correct[hand])} — it was never sorted.`
      structured_points.push({ term: hand, description: note ? `${belongs} ${note}` : belongs })
    }
    if (step.range_bucket_partial_credit_note) {
      structured_points.push({ term: 'Why you earned partial credit', description: step.range_bucket_partial_credit_note })
    }
    if (step.range_bucket_takeaway) {
      structured_points.push({ term: 'Key takeaway', description: step.range_bucket_takeaway })
    }

    const placedRight = pool.length - misplaced.length
    return {
      quality,
      score,
      feedback: `${placedRight} of ${pool.length} hands landed in the right bucket. ${misplaced.join(', ')} ${misplaced.length === 1 ? 'is' : 'are'} in the wrong one — here's what decides each.`,
      ev_loss_bb: 0,
      structured_points,
    }
  }

  if (quality === 'good') {
    return { quality, score, feedback: `Good sort${detail ? ` — ${detail}` : ''}.`, ev_loss_bb: 0 }
  }
  if (quality === 'acceptable') {
    return { quality, score, feedback: `Roughly right, but has leaks${detail ? ` — ${detail}` : ''}.`, ev_loss_bb: 0 }
  }
  return {
    quality,
    score,
    feedback: `Several hands are in the wrong bucket${detail ? ` — ${detail}` : ''}. Review the reasoning for each category.`,
    ev_loss_bb: 0,
  }
}

// ── Range Surgery — protection verdict layer over range_bucket (Module 11, Lesson 5) ──
// Reuses evalRangeBucket's own combo-weighted accuracy score UNCHANGED (so XP/mastery math
// never drifts from the shared scoring every other range_bucket lesson already uses), then
// layers a causal protection verdict on top by checking how much of the pool's authored
// "strong hands" combo mass ended up in the CHECK pile. Additive only — dispatched from
// evaluateStepLocally ONLY when step.range_bucket_protection_target is present (see
// types.ts); every other range_bucket step (Modules 4+) is untouched and keeps calling
// evalRangeBucket directly.

function evalRangeSurgeryProtection(step: LessonStep, response: unknown): EvalCore {
  const base = evalRangeBucket(step, response)
  const target = step.range_bucket_protection_target
  if (!target) return base // defensive — dispatch only routes here when target is authored

  const assignments = response && typeof response === 'object' ? (response as Record<string, string>) : {}
  const { check_category_id, strong_hands, min_check_strong_share, max_check_strong_share } = target

  let totalStrongCombos = 0
  let checkedStrongCombos = 0
  for (const hand of strong_hands) {
    const c = handCombos(hand)
    totalStrongCombos += c
    if (assignments[hand] === check_category_id) checkedStrongCombos += c
  }
  const checkShare = totalStrongCombos > 0 ? checkedStrongCombos / totalStrongCombos : 0
  const checkPct = Math.round(checkShare * 100)
  const minPct = Math.round(min_check_strong_share * 100)
  const maxPct = Math.round(max_check_strong_share * 100)

  let verdict: 'unprotected' | 'protected' | 'over_protected'
  let verdictFeedback: string
  if (checkShare < min_check_strong_share) {
    verdict = 'unprotected'
    verdictFeedback =
      "You left every strong hand in the betting pile. That means your checking range is now provably " +
      "capped and face-up — an aware opponent doesn't need to guess anything to profitably attack every " +
      'check you make on this board, because there is no real strength left behind it to fear.'
  } else if (checkShare > max_check_strong_share) {
    verdict = 'over_protected'
    verdictFeedback =
      "You've protected the checking range — maybe too well. Stripping out this much strength leaves your " +
      'betting range thin and unconvincing in the opposite direction: your bets no longer represent enough ' +
      'real value to be credible, which is its own kind of transparency problem.'
  } else {
    verdict = 'protected'
    verdictFeedback =
      'You moved real strength into the checking pile — enough that an aware opponent cannot safely attack ' +
      'every check you make, without stripping so much value out of your betting range that it stops being ' +
      'credible. That balance is exactly what a protected checking range is after.'
  }

  return {
    ...base,
    feedback: verdictFeedback,
    structured_points: [
      {
        term: 'Protection verdict',
        description: verdict === 'protected' ? 'Protected' : verdict === 'unprotected' ? 'Unprotected (capped)' : 'Over-protected',
      },
      {
        term: 'Strong-hand combos checked back',
        description: `${checkPct}% (target ${minPct}–${maxPct}%)`,
      },
    ],
  }
}

// ── Morphology builder — build mode (Module 4) ────────────────────────────────
// The learner constructs a linear range (Range A) and a polarized range (Range B)
// from the same strength-ordered pool. This checks *shape*, not exact solver
// membership: linear should be a contiguous top-down prefix of the pool; polarized
// should combine top-third and bottom-third hands while skipping some of the middle.

export interface MorphologyCriterion {
  label: string
  met: boolean
}

export interface MorphologyPanelDiagnostic {
  ok: boolean
  yourRange: string[]
  /** Illustrative reference construction, derived from the exact same rule this panel is graded against. */
  targetRange: string[]
  targetLabel: string
  /** True when the structural rule accepts more than one valid construction — the UI must not present
   *  `targetRange` as the only correct answer when this is true. */
  multipleValid: boolean
  criteria?: MorphologyCriterion[]
}

export interface MorphologyBuildDiagnostics {
  linear: MorphologyPanelDiagnostic
  polarized: MorphologyPanelDiagnostic
}

/**
 * Pure structural diagnostics for a morphology_builder 'build' submission — the single source of
 * truth for both scoring (evalMorphologyBuild below) and the visual reveal (MorphologyBuilder.tsx),
 * so the reveal can never drift into a second, separately maintained answer key.
 */
export function diagnoseMorphologyBuild(
  pool: string[],
  linear: string[],
  polarized: string[],
): MorphologyBuildDiagnostics {
  const indexOf = (h: string) => pool.indexOf(h)

  const linearIdx = linear.map(indexOf).filter((i) => i >= 0).sort((a, b) => a - b)
  const expectedPrefix = Array.from({ length: linearIdx.length }, (_, i) => i)
  const linearHasGaps = linearIdx.some((v, i) => v !== expectedPrefix[i])
  const linearOk = linearIdx.length > 0 && !linearHasGaps
  // For a submission of this size, the only prefix that satisfies the rule above is pool[0..size-1] —
  // so, unlike `polarized` below, this reference is not "one of several valid" shapes, it's the exact
  // target implied by how many hands the learner chose.
  const validLinearCount = linear.filter((h) => indexOf(h) >= 0).length
  const linearTarget = pool.slice(0, validLinearCount)

  const n = pool.length
  const topCut = Math.ceil(n / 3)
  const bottomCut = n - Math.ceil(n / 3)
  const polarIdx = polarized.map(indexOf).filter((i) => i >= 0)
  const hasTop = polarIdx.some((i) => i < topCut)
  const hasBottom = polarIdx.some((i) => i >= bottomCut)
  const middleIndices = Array.from({ length: n }, (_, i) => i).filter((i) => i >= topCut && i < bottomCut)
  const hasGap = middleIndices.some((i) => !polarIdx.includes(i))
  const polarOk = hasTop && hasBottom && hasGap
  const polarTarget = [...pool.slice(0, topCut), ...pool.slice(bottomCut)]

  return {
    linear: {
      ok: linearOk,
      yourRange: linear,
      targetRange: linearTarget,
      targetLabel: 'Reference construction',
      multipleValid: false,
    },
    polarized: {
      ok: polarOk,
      yourRange: polarized,
      targetRange: polarTarget,
      targetLabel: 'Reference construction',
      multipleValid: true,
      criteria: [
        { label: 'Includes at least one top-strength hand', met: hasTop },
        { label: 'Includes at least one bottom-strength (weak) hand', met: hasBottom },
        { label: 'Skips at least one middle-strength hand', met: hasGap },
      ],
    },
  }
}

function evalMorphologyBuild(step: LessonStep, response: unknown): EvalCore {
  const pool = step.morphology_builder_pool ?? []
  const resp =
    response && typeof response === 'object' ? (response as { linear?: string[]; polarized?: string[] }) : {}
  const linear = resp.linear ?? []
  const polarized = resp.polarized ?? []

  if (pool.length === 0 || linear.length === 0 || polarized.length === 0) {
    return {
      quality: 'mistake',
      score: 30,
      feedback: 'Build both a linear range (Range A) and a polarized range (Range B) before submitting.',
      ev_loss_bb: 0,
    }
  }

  const { linear: linearDiag, polarized: polarDiag } = diagnoseMorphologyBuild(pool, linear, polarized)
  const linearOk = linearDiag.ok
  const polarOk = polarDiag.ok

  if (linearOk && polarOk) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: 'Both ranges are well-shaped: Range A runs top-down with no gaps, and Range B keeps a clear top-and-bottom split.',
      ev_loss_bb: 0,
    }
  }
  if (linearOk || polarOk) {
    const which = linearOk ? 'polarized (Range B)' : 'linear (Range A)'
    return {
      quality: 'acceptable',
      score: 60,
      feedback: `One range is well-shaped, but the ${which} range has a structural issue — review its shape.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: 30,
    feedback: 'Neither range has the right shape yet. Range A should run top-down with no gaps; Range B should combine top hands with some lower hands while skipping the middle.',
    ev_loss_bb: 0,
  }
}

// ── Scenario tree steps ───────────────────────────────────────────────────────
// ScenarioTree resolves the terminal node quality internally and passes it here
// along with the outcome explanation text.

const SCENARIO_FALLBACK_FEEDBACK: Record<ActionQuality, string> = {
  perfect:    'Optimal line — you found the highest-EV play.',
  good:       'Good decision — near-optimal play.',
  acceptable: 'Acceptable, but there is a higher-EV path.',
  mistake:    'This line loses EV. Review the optimal decision tree.',
  punt:       'Major mistake — this line is significantly –EV.',
}

interface ScenarioResponse {
  quality: ActionQuality
  explanation: string
}

/** Walks every root-to-leaf path in the tree, pairing the option-label trail
 *  with that leaf's outcome — used only to compute the optimal-line reveal,
 *  never to re-derive the learner's own score (the component supplies that). */
function collectScenarioOutcomes(step: LessonStep): { trail: string[]; outcome: ScenarioOutcome }[] {
  const nodeMap = new Map((step.scenario_nodes ?? []).map((n) => [n.id, n]))
  const results: { trail: string[]; outcome: ScenarioOutcome }[] = []

  function walk(nodeId: string | undefined, trail: string[]) {
    if (!nodeId) return
    const node = nodeMap.get(nodeId)
    if (!node) return
    if (node.outcome) {
      results.push({ trail, outcome: node.outcome })
      return
    }
    for (const child of node.children ?? []) {
      walk(child.node_id, [...trail, child.option_label])
    }
  }

  walk(step.scenario_root, [])
  return results
}

/** The best (highest quality tier, then highest EV) line(s) through the tree —
 *  derived from the exact same leaf outcome data the learner's line is scored
 *  against, so this can never drift from what "optimal" means for this scenario. */
function bestScenarioLines(step: LessonStep) {
  const all = collectScenarioOutcomes(step)
  if (all.length === 0) return []
  const bestQualityScore = Math.max(...all.map((o) => QUALITY_SCORES[o.outcome.quality]))
  const topTier = all.filter((o) => QUALITY_SCORES[o.outcome.quality] === bestQualityScore)
  const bestEv = Math.max(...topTier.map((o) => o.outcome.ev_bb))
  return topTier.filter((o) => o.outcome.ev_bb === bestEv)
}

function evalScenarioTree(step: LessonStep, response: unknown): EvalCore {
  // Accept either the new rich object or the legacy bare quality string
  let quality: ActionQuality
  let explanation: string

  if (response && typeof response === 'object' && 'quality' in response) {
    const r = response as ScenarioResponse
    quality     = r.quality
    explanation = r.explanation || SCENARIO_FALLBACK_FEEDBACK[r.quality]
  } else {
    quality     = (response as ActionQuality) ?? 'punt'
    explanation = SCENARIO_FALLBACK_FEEDBACK[quality]
  }

  let answer_reveal: AnswerReveal | undefined
  if (quality !== 'perfect') {
    const best = bestScenarioLines(step)
    if (best.length > 0) {
      const [first, ...rest] = best
      answer_reveal = {
        term: 'Optimal line',
        correct: first.trail.join(' → '),
        alsoAccepted: rest.length > 0 ? rest.map((o) => o.trail.join(' → ')) : undefined,
      }
    }
  }

  return {
    quality,
    score: QUALITY_SCORES[quality] ?? QUALITY_SCORES.punt,
    feedback: explanation,
    ev_loss_bb: 0,
    answer_reveal,
  }
}

// ── Understanding the Flop (Module 6) ─────────────────────────────────────────
// Ground truth for every drill/autopsy/detective below is derived LIVE from
// `classifyFlop`/`estimateVolatility` — never a hand-authored answer key — so a
// content typo can't silently create a wrong-but-unenforced "correct" answer.

// ── Instructional feedback for partial answers ────────────────────────────────
// A tally ("Partial credit — missed 1 tier.") tells a learner they were wrong
// without telling them anything they can use. Every set-selection step that
// opts into `SetSelectionCoaching` below instead answers five questions on a
// non-perfect answer: what you picked, what the answer actually was, WHY each
// item you missed belongs (and each extra one doesn't), why your read still
// earned credit, and the portable rule.
//
// Everything the coaching layer DERIVES (labels, which items were missed, why
// each one belongs) is computed from the same ground truth the score is — the
// live card logic, never an authored answer key — so it cannot drift from the
// grade. Everything it can't derive (the strategic meaning, the takeaway) is a
// verbatim passthrough of prose the step's author wrote. No theory is invented
// in this file.

/** Opt-in instructional layer for `evalIdSetSelection`. Omit it entirely and
 *  the caller's grading/feedback is byte-for-byte unchanged. */
interface SetSelectionCoaching {
  /** Display name for an item id, e.g. 'nut' → 'the nut (A-high) tier'. */
  label: (id: string) => string
  /** Why a correct-but-unselected item genuinely belonged in the answer. */
  whyMissed?: (id: string) => string | undefined
  /** Why a selected-but-incorrect item did not belong. */
  whyExtra?: (id: string) => string | undefined
  /** Reveal terminology, e.g. 'Correct answer', 'Correct tiers'. */
  answerTerm?: string
  /** Authored: what the correct answer MEANS strategically. */
  why?: string
  /** Authored: why a near-miss was understandable — the "where you were almost
   *  right" half. Appended to the derived near-miss line, never replacing it. */
  partialCreditNote?: string
  /** Authored: the one-line rule to carry into future hands. */
  takeaway?: string
}

/** Capitalises the first letter only — the rest of the sentence is derived
 *  prose that may legitimately start with a card ("A♥K♥") or a lowercase
 *  article ("the nut tier"). */
function sentenceCase(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text
}

/** Joins ids into readable prose via `label`, capping the named list so a
 *  30-combo miss doesn't produce an unreadable wall ("…and 24 more"). */
function namedList(ids: string[], label: (id: string) => string, max = 6): string {
  const named = ids.slice(0, max).map(label)
  const rest = ids.length - named.length
  const joined = named.length > 1
    ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
    : named[0] ?? ''
  return rest > 0 ? `${joined} (+${rest} more)` : joined
}

/** Turns a graded set selection into the "your answer / correct answer / why /
 *  why it still counted / takeaway" structure. Called only on a non-perfect
 *  answer — a fully-correct one keeps its own authored explanation. */
function buildSetSelectionInstruction(
  correctIds: Set<string>,
  selectedIds: Set<string>,
  unit: string,
  coaching: SetSelectionCoaching,
): Pick<EvalCore, 'feedback' | 'answer_reveal' | 'structured_points'> {
  const correct = [...correctIds]
  const hits = correct.filter((id) => selectedIds.has(id))
  const missed = correct.filter((id) => !selectedIds.has(id))
  const extra = [...selectedIds].filter((id) => !correctIds.has(id))
  const name = (ids: string[]) => namedList(ids, coaching.label)

  // Lead paragraph: what was missing/over-selected, and the causal reason for
  // each — derived per item, so it names the actual cards/tiers every time.
  // Items whose reason is word-for-word identical (e.g. six AA combos all
  // killed by the same A♠) collapse into one sentence rather than repeating.
  const groupByReason = (ids: string[], why: ((id: string) => string | undefined) | undefined) => {
    const groups = new Map<string, string[]>()
    for (const id of ids) {
      const reason = why?.(id) ?? ''
      const bucket = groups.get(reason)
      if (bucket) bucket.push(id)
      else groups.set(reason, [id])
    }
    return [...groups.entries()]
  }

  const reasons: string[] = []
  for (const [reason, ids] of groupByReason(missed, coaching.whyMissed)) {
    const subject = `${name(ids)} belong${ids.length === 1 ? 's' : ''} in the answer`
    reasons.push(sentenceCase(reason ? `${subject} — ${reason}.` : `${subject}.`))
  }
  for (const [reason, ids] of groupByReason(extra, coaching.whyExtra)) {
    const subject = `${name(ids)} do${ids.length === 1 ? 'es' : ''} not belong`
    reasons.push(sentenceCase(reason ? `${subject} — ${reason}.` : `${subject}.`))
  }

  const opening = selectedIds.size === 0
    ? `You submitted nothing, so the whole answer is still open.`
    : missed.length > 0 && extra.length === 0
      ? `You marked ${name(hits.length > 0 ? hits : [...selectedIds])} — as far as it goes, that's right. It just isn't the whole answer.`
      : extra.length > 0 && missed.length === 0
        ? `You found every ${unit} that mattered, but also flagged ${name(extra)}.`
        : `You marked ${name([...selectedIds])}; the answer is ${name(correct)}.`

  const structured_points: { term: string; description: string }[] = []
  if (coaching.why) structured_points.push({ term: 'Why', description: coaching.why })

  // The near-miss line only exists when there was something to credit. When the
  // step author supplied their own note, the derived half stays short so the
  // two don't say the same thing twice.
  if (hits.length > 0) {
    const description = coaching.partialCreditNote
      ? `You correctly identified ${name(hits)}. ${coaching.partialCreditNote}`
      : `You correctly identified ${name(hits)}${missed.length > 0 ? ', which is genuinely part of the answer — the read was right as far as it went' : ', and that read was sound'}.`
    structured_points.push({ term: 'Why you earned partial credit', description })
  } else if (coaching.partialCreditNote) {
    structured_points.push({ term: 'Where the reasoning went', description: coaching.partialCreditNote })
  }

  if (coaching.takeaway) structured_points.push({ term: 'Key takeaway', description: coaching.takeaway })

  return {
    feedback: [opening, ...reasons].join(' '),
    answer_reveal: {
      term: coaching.answerTerm ?? 'Correct answer',
      correct: name(correct),
      yours: selectedIds.size > 0 ? name([...selectedIds]) : 'Nothing selected',
    },
    structured_points: structured_points.length > 0 ? structured_points : undefined,
  }
}

/** Shared grading for "tap every item that belongs in the set" interactions
 *  (straight detective, runout storm, board autopsy, combo removal, flush
 *  pyramid): score by how well the selected id set matches the correct id set —
 *  no combo weighting, every item counts equally.
 *
 *  `coaching` is optional and affects PRESENTATION ONLY — the quality tier and
 *  score below are computed identically whether it's supplied or not. */
function evalIdSetSelection(
  correctIds: Set<string>,
  selectedIds: Set<string>,
  labels: { unit: string; correctFeedback: string; noneFeedback: string },
  coaching?: SetSelectionCoaching,
): EvalCore {
  if (correctIds.size === 0) {
    return selectedIds.size === 0
      ? { quality: 'perfect', score: 100, feedback: labels.noneFeedback, ev_loss_bb: 0 }
      : { quality: 'mistake', score: QUALITY_SCORES.mistake, feedback: `${labels.noneFeedback} Nothing here should have been selected.`, ev_loss_bb: 0 }
  }

  let overlap = 0
  for (const id of selectedIds) if (correctIds.has(id)) overlap++
  const precision = selectedIds.size > 0 ? overlap / selectedIds.size : 0
  const recall = overlap / correctIds.size
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  const missed = correctIds.size - overlap
  const extra = selectedIds.size - overlap
  const detail = [
    missed > 0 && `missed ${missed} ${labels.unit}${missed === 1 ? '' : 's'}`,
    extra > 0 && `flagged ${extra} extra ${labels.unit}${extra === 1 ? '' : 's'} that don't belong`,
  ].filter(Boolean).join('; ')

  if (f1 >= 0.999) {
    return { quality: 'perfect', score: 100, feedback: labels.correctFeedback, ev_loss_bb: 0 }
  }

  const quality: ActionQuality = f1 >= 0.75 ? 'good' : f1 >= 0.4 ? 'acceptable' : 'mistake'
  const score = quality === 'mistake'
    ? Math.max(15, Math.round(f1 * 100))
    : Math.max(QUALITY_SCORES[quality], Math.round(f1 * 100))

  if (coaching) {
    return { quality, score, ev_loss_bb: 0, ...buildSetSelectionInstruction(correctIds, selectedIds, labels.unit, coaching) }
  }

  const fallback = quality === 'good' ? `Close — ${detail}.`
    : quality === 'acceptable' ? `Partial credit — ${detail}.`
    : `Review the board — ${detail}.`
  return { quality, score, feedback: fallback, ev_loss_bb: 0 }
}

function asBoard(cards: string[] | undefined, label: string): [string, string, string] {
  if (!cards || cards.length !== 3) throw new Error(`${label}: expected exactly 3 cards, got ${cards?.length ?? 0}`)
  return [cards[0], cards[1], cards[2]]
}

/** Human-readable labels for classifyFlop dimension values — display only,
 *  never involved in comparisons (those always use the raw values). */
const CLASSIFY_VALUE_LABEL: Record<string, string> = {
  trips: 'Trips', paired: 'Paired', unpaired: 'Unpaired',
  monotone: 'Monotone', two_tone: 'Two-Tone', rainbow: 'Rainbow',
  high_mid: 'High-Mid', mid_low: 'Mid-Low', high_low: 'High-Low', 'n/a': 'N/A',
  A: 'A', H: 'H (K-Q-J-T)', M: 'M (9-8-7-6)', L: 'L (5-4-3-2)',
}

function evalFlopClassifyDrill(step: LessonStep, response: unknown): EvalCore {
  const boards = step.flop_classify_drill_boards ?? []
  const dimension = step.flop_classify_drill_dimension
  const answers = Array.isArray(response) ? (response as string[]) : []

  if (boards.length === 0 || !dimension) {
    return { quality: 'good', score: 80, feedback: 'Drill recorded.', ev_loss_bb: 0 }
  }

  let correctCount = 0
  const misses: number[] = []
  const correctByIndex = new Map<number, string>()
  boards.forEach((b, i) => {
    const correct = dimensionValue(classifyFlop(asBoard(b, 'flop_classify_drill')), dimension)
    correctByIndex.set(i, correct)
    if (answers[i] === correct) correctCount++
    else misses.push(i + 1)
  })

  const pct = Math.round((correctCount / boards.length) * 100)
  const detail = misses.length > 0 ? ` (missed board${misses.length > 1 ? 's' : ''} ${misses.join(', ')})` : ''
  const answer_reveal: AnswerReveal | undefined = misses.length > 0 ? {
    term: 'Correct classification',
    correct: misses.map((boardNum) => {
      const value = correctByIndex.get(boardNum - 1) ?? ''
      return `Board ${boardNum}: ${CLASSIFY_VALUE_LABEL[value] ?? value}`
    }).join(', '),
  } : undefined

  if (correctCount === boards.length) {
    return { quality: 'perfect', score: 100, feedback: `Perfect — ${boards.length}/${boards.length} correct.`, ev_loss_bb: 0 }
  }
  if (pct >= 80) {
    return { quality: 'good', score: pct, feedback: `${correctCount}/${boards.length} correct${detail}.`, ev_loss_bb: 0, answer_reveal }
  }
  if (pct >= 60) {
    return { quality: 'acceptable', score: pct, feedback: `${correctCount}/${boards.length} correct${detail}. Review the ones you missed.`, ev_loss_bb: 0, answer_reveal }
  }
  return { quality: 'mistake', score: Math.max(15, pct), feedback: `${correctCount}/${boards.length} correct${detail}. Revisit this classification before continuing.`, ev_loss_bb: 0, answer_reveal }
}

const VOLATILITY_ORDER: Record<VolatilityLevel, number> = { low: 0, medium: 1, high: 2 }

function evalFlopBuilder(step: LessonStep, response: unknown): EvalCore {
  const submitted = Array.isArray(response) ? (response as string[]) : []
  const target = step.flop_builder_target ?? {}

  if (submitted.length !== 3) {
    return { quality: 'mistake', score: 20, feedback: 'Build a complete 3-card flop before submitting.', ev_loss_bb: 0 }
  }

  // Structural guard: the interaction must not have changed what it wasn't allowed to.
  if (step.flop_builder_mode === 'assign_suits' && step.flop_builder_fixed_ranks?.length === 3) {
    const submittedRanks = submitted.map((c) => c[0].toUpperCase()).sort()
    const fixedRanks = step.flop_builder_fixed_ranks.map((r) => r.toUpperCase()).sort()
    if (JSON.stringify(submittedRanks) !== JSON.stringify(fixedRanks)) {
      return { quality: 'mistake', score: 10, feedback: 'The ranks changed — only the suits are yours to assign here.', ev_loss_bb: 0 }
    }
  }
  if (step.flop_builder_mode === 'swap_one_card' && step.flop_builder_base_board?.length === 3) {
    const base = step.flop_builder_base_board
    const changed = submitted.filter((c, i) => c.toLowerCase() !== base[i].toLowerCase()).length
    if (changed !== 1) {
      return { quality: 'mistake', score: 10, feedback: 'Exactly one card should change from the starting board.', ev_loss_bb: 0 }
    }
  }

  let c: FlopClassification
  try {
    c = classifyFlop(asBoard(submitted, 'flop_builder'))
  } catch {
    return { quality: 'mistake', score: 10, feedback: 'That board is not valid — check for a duplicate card.', ev_loss_bb: 0 }
  }

  const misses: string[] = []
  if (target.structure && c.structure !== target.structure) misses.push(`structure should be ${target.structure}, not ${c.structure}`)
  if (target.texture && c.texture !== target.texture) misses.push(`texture should be ${target.texture}, not ${c.texture}`)
  if (target.twoToneSubtype && c.twoToneSubtype !== target.twoToneSubtype) misses.push(`two-tone subtype should be ${target.twoToneSubtype}`)
  if (target.minStraights != null && c.possibleFloppedStraights.count < target.minStraights) misses.push(`needs at least ${target.minStraights} possible straight${target.minStraights === 1 ? '' : 's'}`)
  if (target.maxStraights != null && c.possibleFloppedStraights.count > target.maxStraights) misses.push(`needs at most ${target.maxStraights} possible straight${target.maxStraights === 1 ? '' : 's'}`)
  if (target.volatilityAtLeast || target.volatilityAtMost) {
    const level = estimateVolatility(asBoard(submitted, 'flop_builder')).level
    if (target.volatilityAtLeast && VOLATILITY_ORDER[level] < VOLATILITY_ORDER[target.volatilityAtLeast]) misses.push(`needs to be at least ${target.volatilityAtLeast} volatility`)
    if (target.volatilityAtMost && VOLATILITY_ORDER[level] > VOLATILITY_ORDER[target.volatilityAtMost]) misses.push(`needs to be at most ${target.volatilityAtMost} volatility`)
  }

  if (misses.length === 0) {
    return { quality: 'perfect', score: 100, feedback: 'That board hits the target.', ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(20, 60 - misses.length * 15), feedback: `Not quite — ${misses.join('; ')}.`, ev_loss_bb: 0 }
}

function evalStraightDetective(step: LessonStep, response: unknown): EvalCore {
  const board = asBoard(step.straight_detective_board ?? step.board, 'straight_detective')
  const correctCombos = classifyFlop(board).possibleFloppedStraights.combos
  const correctIds = new Set(correctCombos.map((p) => p.join('')))
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

  return evalIdSetSelection(correctIds, selectedIds, {
    unit: 'straight',
    correctFeedback:
      correctIds.size > 0
        ? `Exactly right — ${correctCombos.map((p) => p.join('-')).join(', ')} complete${correctCombos.length === 1 ? 's' : ''} a straight here.`
        : 'Correct — this board has no possible flopped straight.',
    noneFeedback: 'Correct — this board has no possible flopped straight.',
  })
}

function expandComboRemovalSubject(subject: string): [string, string][] {
  const isPair = subject.length === 2 && subject[0] === subject[1]
  const isClassed = subject.length === 3 && (subject[2] === 's' || subject[2] === 'o')
  return isPair || isClassed ? expandHandClass(subject) : expandGenericUnpaired(subject[0], subject[1])
}

/** combo_removal — expand `combo_removal_subject` (a pair like 'AA'/'33', a single
 *  suited/offsuit class like 'AKs', or a generic two-rank hand like 'AK' meaning
 *  suited+offsuit combined) OR `combo_removal_range` (multiple hand classes
 *  flattened into one tile set) into concrete combos, compute which ones the
 *  known cards (`combo_removal_known_cards` and/or `_board_cards`/`_hero_cards`)
 *  actually eliminate, and grade the learner's tapped set against that ground truth. */
function evalComboRemoval(step: LessonStep, response: unknown): EvalCore {
  const subject = step.combo_removal_subject ?? ''
  const range = step.combo_removal_range
  const known = [
    ...(step.combo_removal_known_cards ?? []),
    ...(step.combo_removal_board_cards ?? []),
    ...(step.combo_removal_hero_cards ?? []),
  ]

  let allCombos: [string, string][]
  if (range && range.length > 0) {
    const seen = new Set<string>()
    allCombos = []
    for (const hand of range) {
      for (const combo of expandComboRemovalSubject(hand)) {
        const key = comboKey(combo)
        if (!seen.has(key)) {
          seen.add(key)
          allCombos.push(combo)
        }
      }
    }
  } else {
    allCombos = expandComboRemovalSubject(subject)
  }

  const label = range && range.length > 0 ? 'these' : subject
  const remaining = getRemainingCombos(allCombos, known)
  const remainingKeys = new Set(remaining.map(comboKey))
  const correctIds = new Set(allCombos.map(comboKey).filter((k) => !remainingKeys.has(k)))
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

  // Which known card each combo collides with — the causal "why" behind every
  // tile, read straight off the cards rather than authored per step.
  const knownSet = new Set(known)
  const collidingCard = (id: string) => id.split('-').find((c) => knownSet.has(c))

  const core = evalIdSetSelection(correctIds, selectedIds, {
    unit: 'combo',
    correctFeedback:
      step.combo_removal_explanation
        ?? (correctIds.size > 0
          ? `Correct — ${correctIds.size} of ${allCombos.length} ${label} combinations are impossible given the known cards. ${remaining.length} remain.`
          : `Correct — none of ${label} combinations are affected by the known cards.`),
    noneFeedback: `Correct — none of ${label} combinations are affected by the known cards.`,
  }, {
    label: (id) => id.split('-').map(formatCard).join(''),
    // Phrased without a singular/plural subject so the same reason can be
    // shared by one combo or by six that all collide with the same card.
    whyMissed: (id) => {
      const card = collidingCard(id)
      return card ? `${formatCard(card)} is already accounted for, so no combination containing it can exist` : undefined
    },
    whyExtra: () => known.length > 0
      ? `nothing there collides with ${formatCards(known)}, so those combinations are all still live in the range`
      : undefined,
    answerTerm: 'Impossible combinations',
    why: step.combo_removal_explanation,
    partialCreditNote: step.combo_removal_partial_credit_note,
    takeaway: step.combo_removal_takeaway,
  })

  return {
    ...core,
    reasoning_stages: [{
      stage: 'combo_removal',
      label: 'Combo removal',
      correct: core.quality === 'perfect',
      detail: core.feedback,
    }],
  }
}

/** flush_pyramid — derive the tier breakdown live (never authored), compute
 *  which tiers `flush_pyramid_known_cards` actually touches, and grade the
 *  learner's tapped tier set against that ground truth. */
function evalFlushPyramid(step: LessonStep, response: unknown): EvalCore {
  const suit = step.flush_pyramid_suit ?? 'h'
  const deadRanks = step.flush_pyramid_dead_ranks ?? []
  const known = step.flush_pyramid_known_cards ?? []
  const tiers = flushTiers(suit, deadRanks)

  const correctIds = new Set(
    tiers.filter((t) => getBlockedCombos(t.combos, known).length > 0).map((t) => t.tierLabel),
  )
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

  // ── Per-tier ground truth, derived once and reused for both the grade and
  // the explanation, so the two can never disagree.
  const byLabel = new Map(tiers.map((t) => [t.tierLabel, t]))
  const nutRank = tiers[0]?.combos[0]?.[0]?.[0] ?? 'A'
  const tierName = (id: string) => (id === 'nut' ? `the nut (${nutRank}-high) tier` : `the ${id}-high tier`)
  const comboName = (combo: [string, string]) => combo.map(formatCard).join('')

  const whyTierBlocked = (id: string): string | undefined => {
    const tier = byLabel.get(id)
    if (!tier) return undefined
    const blocked = getBlockedCombos(tier.combos, known)
    if (blocked.length === 0) return undefined
    if (blocked.length === tier.combos.length) {
      return `every one of its ${tier.combos.length} combos is built on ${formatCards(known)}, so the whole tier is gone`
    }
    // A partial hit is the insight the pyramid exists to teach: tiers are named
    // for their HIGH card, so a card also appears as the LOW card of every tier
    // above its own.
    const survivors = tier.combos.length - blocked.length
    return `${blocked.length} of its ${tier.combos.length} combos ${blocked.length === 1 ? 'disappears' : 'disappear'} (${namedList(blocked.map(comboName), (s) => s, 4)}), because a tier is named for its HIGH card, so ${formatCards(known)} also sits inside every tier above its own. The other ${survivors} ${survivors === 1 ? 'is' : 'are'} untouched`
  }

  const core = evalIdSetSelection(correctIds, selectedIds, {
    unit: 'tier',
    correctFeedback:
      step.flush_pyramid_explanation
        ?? (correctIds.size === 1 && correctIds.has('nut')
          ? "Correct — Hero's card removes the nut-flush tier entirely. Every other tier is completely untouched: Villain's range now contains zero of the hands that could trap Hero for the biggest pot."
          : `Correct — ${Array.from(correctIds).join(', ')} tier(s) lose combos to Hero's known card.`),
    noneFeedback: "Correct — none of Villain's flush tiers are affected by Hero's known card.",
  }, {
    label: tierName,
    whyMissed: whyTierBlocked,
    whyExtra: (id) => {
      const tier = byLabel.get(id)
      return tier
        ? `not one of its ${tier.combos.length} combos contains ${formatCards(known)}, so that tier survives in full`
        : undefined
    },
    answerTerm: 'Tiers actually affected',
    why: step.flush_pyramid_explanation,
    partialCreditNote: step.flush_pyramid_partial_credit_note,
    takeaway: step.flush_pyramid_takeaway,
  })

  return {
    ...core,
    reasoning_stages: [{
      stage: 'blocker_classification',
      label: 'Blocker classification',
      correct: core.quality === 'perfect',
      detail: core.feedback,
    }],
  }
}

function evalBoardVolatility(step: LessonStep, response: unknown): EvalCore {
  if (step.board_volatility_mode === 'compare') {
    return evalOptionBased(step, response)
  }

  if (step.board_volatility_mode === 'continuum_sort') {
    const boards = step.board_volatility_continuum_boards ?? []
    const order = Array.isArray(response) ? (response as string[]) : []
    if (boards.length < 2 || order.length !== boards.length) {
      return { quality: 'mistake', score: 20, feedback: 'Order every board before submitting.', ev_loss_bb: 0 }
    }
    const scoreById = new Map(boards.map((b) => [b.id, estimateVolatility(asBoard(b.board, 'board_volatility')).score]))
    const correctOrder = [...boards].sort((a, b) => (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0)).map((b) => b.id)

    let inversions = 0
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const a = correctOrder.indexOf(order[i])
        const b = correctOrder.indexOf(order[j])
        if (a > b) inversions++
      }
    }
    const maxInversions = (order.length * (order.length - 1)) / 2
    const accuracy = maxInversions > 0 ? 1 - inversions / maxInversions : 1
    const pct = Math.round(accuracy * 100)

    if (inversions === 0) return { quality: 'perfect', score: 100, feedback: 'That ordering matches — low to high volatility.', ev_loss_bb: 0 }

    // No `answer_reveal` here — BoardVolatility's own ContinuumSortMode already
    // renders a richer, item-by-item reveal (real board cards via
    // OrderedBoardRow/BoardOrderSpectrum, never a joined text string). Same
    // pattern as board_rank_sort below.
    if (accuracy >= 0.75) return { quality: 'good', score: Math.max(QUALITY_SCORES.good, pct), feedback: 'Close — a couple of boards are out of order.', ev_loss_bb: 0 }
    if (accuracy >= 0.5) return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, pct), feedback: 'Roughly right, but several boards are out of order.', ev_loss_bb: 0 }
    return { quality: 'mistake', score: Math.max(15, pct), feedback: 'This ordering doesn\'t track static-to-dynamic. Review each board\'s texture and straight potential.', ev_loss_bb: 0 }
  }

  // runout_storm (default)
  const board = asBoard(step.board_volatility_board ?? step.board, 'board_volatility')
  const pool = step.board_volatility_storm_pool ?? []
  const correctIds = new Set(pool.filter((card) => turnImpact(board, card).changesBoard))
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

  // No `answer_reveal` here — BoardVolatility's own RunoutStormMode already
  // renders a richer, per-card reveal (real board cards via PlayingCardMini,
  // plus a `turnImpact`-derived explanation for every missed or wrongly
  // flagged card), never a joined text string. Same pattern as
  // continuum_sort/board_rank_sort above.
  return evalIdSetSelection(correctIds, selectedIds, {
    unit: 'card',
    correctFeedback: 'Exactly right — those are the turn cards that meaningfully change this board.',
    noneFeedback: 'Correct — none of these cards meaningfully change this board.',
  })
}

function evalEquityBucket(step: LessonStep, response: unknown): EvalCore {
  if (step.equity_bucket_mode === 'distribution') {
    return evalOptionBased(step, response)
  }

  const actualPct = step.equity_bucket_mode === 'scenario' ? step.equity_bucket_scenario_actual ?? 0 : step.equity_bucket_value ?? 0
  const correctBucket = equityBucket(actualPct)
  const selected = String(response ?? '')
  const explanation = step.equity_bucket_mode === 'scenario' ? step.equity_bucket_scenario_explanation : undefined
  const BUCKET_LABEL: Record<string, string> = { strong: 'Strong (≥75%)', good: 'Good (50–75%)', weak: 'Weak (33–50%)', trash: 'Trash (<33%)' }

  if (selected === correctBucket) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `Correct — ${actualPct}% equity is ${BUCKET_LABEL[correctBucket]}.${explanation ? ` ${explanation}` : ''}`,
      ev_loss_bb: 0,
      concept_explanation: explanation,
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: `Not quite — ${actualPct}% equity is ${BUCKET_LABEL[correctBucket]}, not ${BUCKET_LABEL[selected] ?? selected}.${explanation ? ` ${explanation}` : ''}`,
    ev_loss_bb: 0,
    concept_explanation: explanation,
    answer_reveal: { term: 'Correct bucket', correct: BUCKET_LABEL[correctBucket], yours: selected ? (BUCKET_LABEL[selected] ?? selected) : undefined },
  }
}

function evalBoardAutopsy(step: LessonStep, response: unknown): EvalCore {
  const board = asBoard(step.board_autopsy_board ?? step.board, 'board_autopsy')
  const claimed = step.board_autopsy_claimed ?? {}
  const real = classifyFlop(board)

  const correctIds = new Set(
    Object.entries(claimed)
      .filter(([key, value]) => dimensionValue(real, key as Parameters<typeof dimensionValue>[1]) !== value)
      .map(([key]) => key),
  )
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

  return evalIdSetSelection(correctIds, selectedIds, {
    unit: 'error',
    correctFeedback: correctIds.size > 0 ? 'Exactly right — you caught every mistake in this analysis.' : 'Correct — this analysis has no errors.',
    noneFeedback: 'Correct — this analysis has no errors.',
  })
}

// ── Board rank sort (Module 7) ────────────────────────────────────────────────
// Order boards from bets-most to bets-least. Ground truth is a hand-authored
// target order (`board_rank_sort_target`) — unlike Module 6's continuum_sort,
// c-bet frequency ranking across board families isn't a deterministic function
// of the board, so there is no live classifier to check against here.

function evalBoardRankSort(step: LessonStep, response: unknown): EvalCore {
  const target = step.board_rank_sort_target ?? []
  const submitted = Array.isArray(response) ? (response as string[]) : []

  if (target.length === 0 || submitted.length !== target.length) {
    return { quality: 'punt', score: 0, feedback: 'No order submitted.', ev_loss_bb: 0 }
  }

  let inversions = 0
  for (let i = 0; i < submitted.length; i++) {
    for (let j = i + 1; j < submitted.length; j++) {
      const a = target.indexOf(submitted[i])
      const b = target.indexOf(submitted[j])
      if (a > b) inversions++
    }
  }
  const maxInversions = (submitted.length * (submitted.length - 1)) / 2
  const accuracy = maxInversions > 0 ? 1 - inversions / maxInversions : 1
  const pct = Math.round(accuracy * 100)

  if (inversions === 0) {
    // The default line names c-bet frequency, which is what this UI was built
    // for. A step that re-labels the spectrum to rank something else must say
    // what its own order means, or a correct answer gets congratulated for
    // solving a different question.
    return {
      quality: 'perfect',
      score: 100,
      feedback: step.board_rank_sort_explanation ?? 'That ordering matches — from bets most to bets least.',
      ev_loss_bb: 0,
    }
  }

  const quality: ActionQuality = accuracy >= 0.75 ? 'good' : accuracy >= 0.5 ? 'acceptable' : 'mistake'
  const score = quality === 'mistake' ? Math.max(15, pct) : Math.max(QUALITY_SCORES[quality], pct)

  // Opt-in instructional layer (see SetSelectionCoaching): when the step author
  // supplied per-item reasoning, a wrong order stops being "a couple of these
  // are out of order" and names the actual items, their correct positions, and
  // what separates them. Steps without these fields keep the original prose.
  const notes = step.board_rank_sort_item_notes
  if (notes || step.board_rank_sort_takeaway) {
    const labelOf = (id: string) => step.board_rank_sort_boards?.find((b) => b.id === id)?.label ?? id
    const asOrder = (ids: string[]) => ids.map(labelOf).join(' → ')
    const misplaced = submitted.filter((id, i) => id !== target[i])

    const structured_points: { term: string; description: string }[] = []
    for (const id of target) {
      const note = notes?.[id]
      if (note && misplaced.includes(id)) {
        structured_points.push({ term: `${labelOf(id)} — position ${target.indexOf(id) + 1}`, description: note })
      }
    }
    if (step.board_rank_sort_partial_credit_note) {
      structured_points.push({ term: 'Why you earned partial credit', description: step.board_rank_sort_partial_credit_note })
    }
    if (step.board_rank_sort_takeaway) {
      structured_points.push({ term: 'Key takeaway', description: step.board_rank_sort_takeaway })
    }

    return {
      quality,
      score,
      feedback: `You ordered them ${asOrder(submitted)}. The order that holds up is ${asOrder(target)} — ${misplaced.length} of ${target.length} landed in the wrong slot.`,
      ev_loss_bb: 0,
      answer_reveal: { term: 'Correct order', correct: asOrder(target), yours: asOrder(submitted) },
      structured_points: structured_points.length > 0 ? structured_points : undefined,
    }
  }

  if (quality === 'good') {
    return { quality, score, feedback: 'Close — a couple of these boards are out of order.', ev_loss_bb: 0 }
  }
  if (quality === 'acceptable') {
    return { quality, score, feedback: 'Roughly right, but several boards are out of order. Review what drives frequency on each.', ev_loss_bb: 0 }
  }
  return { quality, score, feedback: 'This ordering doesn\'t track the range-interaction story on these boards. Revisit which range each board favors and why.', ev_loss_bb: 0 }
}

// ── Hand ranking order (Module 1) ─────────────────────────────────────────────
// Learner drags/taps all 10 standard hand categories into strongest-to-weakest
// order. `step.hand_ranking_order_items` IS the correct order (index 0 =
// strongest); `response` is the learner's submitted array of category ids in
// the same strongest-to-weakest slot order.

function evalHandRankingOrder(step: LessonStep, response: unknown): EvalCore {
  const items = step.hand_ranking_order_items ?? []
  const correctOrder = items.map((i) => i.id)
  const submitted = Array.isArray(response) ? (response as string[]) : []

  if (correctOrder.length === 0 || submitted.length !== correctOrder.length) {
    return { quality: 'punt', score: 0, feedback: 'No order submitted.', ev_loss_bb: 0 }
  }

  const labelOf = (id: string) => items.find((i) => i.id === id)?.label ?? id
  const correctRank = new Map(correctOrder.map((id, i) => [id, i]))

  let correctPositions = 0
  for (let i = 0; i < correctOrder.length; i++) {
    if (submitted[i] === correctOrder[i]) correctPositions++
  }
  const accuracy = correctPositions / correctOrder.length

  if (accuracy === 1) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: 'Correct — every hand category is in the right order, strongest to weakest.',
      ev_loss_bb: 0,
    }
  }

  // Find a couple of concrete inversions (a weaker category placed above a
  // stronger one) so the feedback explains WHICH ranking was missed, not just
  // "wrong" — this is what powers the "explain the mistake" requirement.
  const inversions: string[] = []
  for (let i = 0; i < submitted.length && inversions.length < 2; i++) {
    for (let j = i + 1; j < submitted.length && inversions.length < 2; j++) {
      const a = submitted[i]
      const b = submitted[j]
      const rankA = correctRank.get(a)
      const rankB = correctRank.get(b)
      if (rankA != null && rankB != null && rankA > rankB) {
        inversions.push(`${labelOf(b)} actually beats ${labelOf(a)}, but you placed ${labelOf(a)} higher.`)
      }
    }
  }
  const detail = inversions.length > 0 ? ` ${inversions.join(' ')}` : ''
  const pct = Math.round(accuracy * 100)
  const positionSummary = `${correctPositions} of ${correctOrder.length} in the right spot.`

  if (accuracy >= 0.8) {
    return { quality: 'good', score: Math.max(82, pct), feedback: `Close — ${positionSummary}${detail}`, ev_loss_bb: 0 }
  }
  if (accuracy >= 0.5) {
    return { quality: 'acceptable', score: Math.max(62, pct), feedback: `Getting there — ${positionSummary}${detail}`, ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(20, pct), feedback: `${positionSummary} Review the full hierarchy below.${detail}`, ev_loss_bb: 0 }
}

// ── Card display formatting (Lesson 1 steps) ──────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }

/** 'Kc' -> 'K♣', 'Th' -> '10♥' — for feedback text, never internal comparisons. */
function formatCard(card: string): string {
  if (!card || card.length < 2) return card
  const rank = card[0].toUpperCase() === 'T' ? '10' : card[0].toUpperCase()
  const suit = SUIT_SYMBOL[card[1].toLowerCase()] ?? card[1]
  return `${rank}${suit}`
}

function formatCards(cards: string[]): string {
  return cards.map(formatCard).join(', ')
}

// ── Cards identify (Lesson 1, Step 2) ─────────────────────────────────────────
// Learner taps which of the dealt cards are Hero's private hole cards
// (`step.hero_hand`) among Hero's cards + N face-down community placeholders.
// The explanation always lands regardless of accuracy — this is foundational
// content, not a gatekeeping quiz.

function evalCardsIdentify(step: LessonStep, response: unknown): EvalCore {
  const heroCards = step.hero_hand ?? []
  const correctIds = new Set(heroCards)
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])
  const explanation =
    step.concept_content ??
    "In Texas Hold'em you receive 2 private hole cards. Up to 5 community cards are shared by everyone."

  const foundCount = heroCards.filter((c) => correctIds.has(c) && selectedIds.has(c)).length
  const extras = [...selectedIds].filter((c) => !correctIds.has(c)).length
  const gotBoth = heroCards.length > 0 && foundCount === heroCards.length

  if (gotBoth && extras === 0) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `Exactly right — those are your hole cards. ${explanation}`,
      ev_loss_bb: 0,
    }
  }
  if (gotBoth) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: `You found both of your hole cards. ${explanation}`,
      ev_loss_bb: 0,
      answer_reveal: { term: 'Correct hole cards', correct: formatCards(heroCards) },
    }
  }
  return {
    quality: foundCount > 0 ? 'acceptable' : 'mistake',
    score: foundCount > 0 ? QUALITY_SCORES.acceptable : QUALITY_SCORES.mistake,
    feedback: `${foundCount} of ${heroCards.length} correct — your hole cards are ${formatCards(heroCards)}. ${explanation}`,
    ev_loss_bb: 0,
    answer_reveal: { term: 'Correct hole cards', correct: formatCards(heroCards) },
  }
}

// ── Build first hand (Lesson 1, Step 3) ───────────────────────────────────────
// Learner taps the 5 cards (from Hero's 2 hole cards + the 5-card board) that
// form Hero's best possible poker hand, against a hand-authored, unambiguous
// `build_first_hand_correct` target.

function evalBuildFirstHand(step: LessonStep, response: unknown): EvalCore {
  const correct = new Set(step.build_first_hand_correct ?? [])
  const selected = new Set(Array.isArray(response) ? (response as string[]) : [])
  const explanation =
    step.concept_content ??
    "Your final poker hand uses the best 5-card combination available from your 2 hole cards and the 5 community cards."

  if (correct.size === 0) {
    return { quality: 'good', score: 80, feedback: 'Hand recorded.', ev_loss_bb: 0 }
  }

  const overlap = [...selected].filter((c) => correct.has(c)).length
  const allCorrect = overlap === correct.size && selected.size === correct.size

  if (allCorrect) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `Exactly right — that's Hero's best 5-card hand. ${explanation}`,
      ev_loss_bb: 0,
    }
  }

  const accuracy = overlap / correct.size
  const correctList = formatCards([...correct])
  if (accuracy >= 0.6) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: `${overlap} of ${correct.size} correct — Hero's best hand is ${correctList}. ${explanation}`,
      ev_loss_bb: 0,
      answer_reveal: { term: 'Correct hand', correct: correctList },
    }
  }
  return {
    quality: 'mistake',
    score: Math.max(20, Math.round(accuracy * 100)),
    feedback: `Not quite — Hero's best hand is ${correctList}. ${explanation}`,
    ev_loss_bb: 0,
    answer_reveal: { term: 'Correct hand', correct: correctList },
  }
}

// ── Step-type router ──────────────────────────────────────────────────────────

// ── Game Theory Foundations (Module 10) ───────────────────────────────────────
// Every EV number graded below is recomputed live from gameTheoryEngine.ts —
// never a hand-authored "correct answer" — so a step's grading can never
// drift from the exact same math its component displayed to the learner.

function toyGameFromStep(step: LessonStep) {
  return {
    pot: step.strategy_response_lab_pot ?? PRESSURE_GAME_DEFAULT.pot,
    bet: step.strategy_response_lab_bet ?? PRESSURE_GAME_DEFAULT.bet,
    equityWhenCalled: step.strategy_response_lab_equity_when_called ?? PRESSURE_GAME_DEFAULT.equityWhenCalled,
    equityWhenChecked: step.strategy_response_lab_equity_when_checked ?? PRESSURE_GAME_DEFAULT.equityWhenChecked,
  }
}

function evalStrategyResponseLab(step: LessonStep, response: unknown): EvalCore {
  const mode = step.strategy_response_lab_mode ?? 'best_response'
  const r = (response ?? {}) as Record<string, unknown>

  if (mode === 'best_response') {
    const game = toyGameFromStep(step)
    const villainFreq = step.strategy_response_lab_fixed_villain_freq ?? 0.5
    const heroFreqPct = Number(r.heroFreqPct ?? response ?? 0)
    const evBetFull = evOfBetting(game, villainFreq)
    const evCheckFull = evOfChecking(game)
    const actions: ActionEV[] = [
      { id: 'bet', label: 'Bet 100%', ev: evBetFull },
      { id: 'check', label: 'Check 100%', ev: evCheckFull },
    ]
    const best = bestResponse(actions)
    const wantsBet = best.some((a) => a.id === 'bet')
    const wantsCheck = best.some((a) => a.id === 'check')
    const tolerance = (step.strategy_response_lab_tolerance ?? 0.05) * 100

    let onCorrectSide: boolean
    if (wantsBet && wantsCheck) {
      onCorrectSide = true // genuinely indifferent — any frequency is a best response
    } else if (wantsBet) {
      onCorrectSide = heroFreqPct >= 100 - tolerance
    } else {
      onCorrectSide = heroFreqPct <= tolerance
    }

    const correctLabel = wantsBet && wantsCheck ? 'any frequency (indifferent)' : wantsBet ? 'bet 100%' : 'check 100%'
    return onCorrectSide
      ? {
          quality: 'perfect',
          score: 100,
          feedback: `Correct — the Maximally Exploitative Strategy against this exact fixed opponent is to ${correctLabel}. Against a fixed strategy, the best response is a single pure action, not a mix.`,
          ev_loss_bb: 0,
        }
      : {
          quality: 'mistake',
          score: QUALITY_SCORES.mistake,
          feedback: `Against this exact fixed Villain, the highest-EV response is to ${correctLabel} — a mixed frequency leaves EV on the table because Villain isn't adjusting.`,
          ev_loss_bb: 0,
          answer_reveal: { term: 'Most profitable response', correct: correctLabel, yours: `${heroFreqPct.toFixed(0)}%` },
        }
  }

  if (mode === 'counter_exploit') {
    const optionId = String(r.optionId ?? '')
    return evalOptionBased(step, optionId)
  }

  return { ...UNSCORED_CORE }
}

function evalClairvoyanceLab(step: LessonStep, response: unknown): EvalCore {
  const r = (response ?? {}) as Record<string, unknown>
  const pot = 100
  const bet = 100
  const eq = clairvoyanceEquilibrium(pot, bet)
  const editable = step.clairvoyance_lab_editable ?? ['aa_bet', 'qq_bet', 'kk_call']
  const tolerance = (step.clairvoyance_lab_tolerance ?? 0.05) * 100

  const submitted = {
    aa_bet: Number(r.aaBetFreqPct ?? eq.aaBetFreq * 100),
    qq_bet: Number(r.qqBetFreqPct ?? eq.qqBetFreq * 100),
    kk_call: Number(r.kkCallFreqPct ?? eq.kkCallFreq * 100),
  }
  const target = { aa_bet: eq.aaBetFreq * 100, qq_bet: eq.qqBetFreq * 100, kk_call: eq.kkCallFreq * 100 }

  const deltas = editable.map((key) => Math.abs(submitted[key] - target[key]))
  const maxDelta = deltas.length > 0 ? Math.max(...deltas) : 0

  const { evP1, evP2 } = clairvoyanceEV({
    pot, bet,
    aaBetFreq: submitted.aa_bet / 100,
    qqBetFreq: submitted.qq_bet / 100,
    kkCallFreq: submitted.kk_call / 100,
  })

  if (maxDelta <= tolerance) {
    return {
      quality: 'perfect',
      score: 100,
      feedback: `Equilibrium found — AA bets 100%, QQ bets 50%, KK calls 50%. Neither player can improve alone from here. Game EV: P1 $${evP1.toFixed(0)}, P2 $${evP2.toFixed(0)}.`,
      ev_loss_bb: 0,
    }
  }
  if (maxDelta <= tolerance * 3) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: `Close. The exact equilibrium is AA 100% / QQ 50% / KK 50% — every frequency away from that leaves one player a profitable unilateral deviation.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'acceptable',
    score: QUALITY_SCORES.acceptable,
    feedback: `Not yet at equilibrium — try adjusting further. Target: AA bets 100%, QQ bets 50%, KK calls 50%.`,
    ev_loss_bb: 0,
    answer_reveal: { term: 'Equilibrium', correct: 'AA 100% / QQ 50% / KK 50%' },
  }
}

function evalEVIndifferenceBalance(step: LessonStep, response: unknown): EvalCore {
  const pot = step.ev_indifference_balance_pot ?? 100
  const bet = step.ev_indifference_balance_bet ?? 100
  const equityWhenCalled = step.ev_indifference_balance_equity_when_called ?? 0
  const equityWhenChecked = step.ev_indifference_balance_equity_when_checked ?? 0
  const tolerance = step.ev_indifference_balance_tolerance ?? 0.03

  const oppFreqPct = Number(response ?? 50)
  const evA = evOfBetting({ pot, bet, equityWhenCalled }, oppFreqPct / 100)
  const evB = evOfChecking({ pot, equityWhenChecked })
  const found = isIndifferent(evA, evB, tolerance * (pot + bet))

  return found
    ? {
        quality: 'perfect',
        score: 100,
        feedback: `Indifferent — at ${oppFreqPct.toFixed(0)}%, both actions earn the same EV ($${evA.toFixed(2)} vs $${evB.toFixed(2)}). This is exactly the frequency the opponent's strategy has to hold for a mixed strategy to make sense here.`,
        ev_loss_bb: 0,
      }
    : {
        quality: evA > evB ? 'mistake' : 'acceptable',
        score: QUALITY_SCORES.acceptable,
        feedback: `Not indifferent yet — one action still earns more ($${evA.toFixed(2)} vs $${evB.toFixed(2)}). Keep moving the slider toward the crossover.`,
        ev_loss_bb: 0,
      }
}

function evalUnilateralDeviationTest(step: LessonStep, response: unknown): EvalCore {
  const r = (response ?? {}) as Record<string, unknown>
  // Same resolver the step's component renders from — including its reading of
  // WHICH side of the candidate equilibrium this step actually tests (a B-side
  // step tests villainFreq and holds heroFreq fixed, not the other way round).
  const sides = deviationSides(step)
  const panel = resolveDeviationPanel(step, sides.testedBaselinePct)
  const test = deviationVerdict(step)
  const baselineEV = panel.baselineEV
  const truth: 'can_improve' | 'no_improvement' = test.canImprove ? 'can_improve' : 'no_improvement'
  const verdict = String(r.verdict ?? '')

  // "Nothing improves" has two distinct shapes, and saying the wrong one is a
  // theory error: every alternative can be strictly WORSE, or every alternative
  // can TIE (the opponent is defending at exactly the frequency that makes this
  // player indifferent — Acevedo's mixed-strategy condition). `panel.flat`
  // separates them.
  const noImprovementWhy = panel.flat
    ? `every alternative earns exactly the same $${baselineEV.toFixed(2)} — this player is indifferent, so no deviation can improve`
    : `every alternative earns less than $${baselineEV.toFixed(2)}`

  const correct = verdict === truth
  return correct
    ? {
        quality: 'perfect',
        score: 100,
        feedback: truth === 'no_improvement'
          ? `Correct — ${noImprovementWhy}. This is exactly Acevedo's Nash-equilibrium test: no profitable unilateral deviation.`
          : `Correct — this player CAN improve alone here (best alternative gains $${test.gain.toFixed(2)}), which means this is NOT an equilibrium yet.`,
        ev_loss_bb: 0,
      }
    : {
        quality: 'mistake',
        score: QUALITY_SCORES.mistake,
        feedback: truth === 'no_improvement'
          ? `Not quite — ${noImprovementWhy}. No profitable unilateral deviation exists here.`
          : `Not quite — this player CAN improve by changing strategy alone (best alternative gains $${test.gain.toFixed(2)}), so this isn't a stable equilibrium yet.`,
        ev_loss_bb: 0,
        answer_reveal: { term: 'Can this player improve alone?', correct: truth === 'can_improve' ? 'Yes' : 'No' },
      }
}

/** Enriches a resolved `'defend'`/`'3bet'` reveal with the opener's own opening
 *  range as `secondaryRange`, whenever `openerRangeReveal.ts` can resolve one for
 *  this step — never invents a reveal that wasn't already there, and never
 *  overrides one that already carries its own semantics. */
function attachOpenerPanel(
  reveal: DecisionSpotRangeReveal | undefined,
  step: LessonStep,
): DecisionSpotRangeReveal | undefined {
  if (!reveal) return reveal
  const panel = resolveOpenerRangePanel(step)
  if (!panel) return reveal
  return { ...reveal, secondaryRange: panel }
}

function resolveCore(step: LessonStep, response: unknown): EvalCore {
  if (!isScoredStep(step)) {
    return step.type === 'concept_reveal'
      ? { ...UNSCORED_CORE, feedback: 'Concept reviewed.' }
      : UNSCORED_CORE
  }

  switch (step.type) {
    // Option-based steps
    case 'decision_spot':
    case 'bet_size_choose':
    case 'bluff_pick':
    case 'board_classify':
    case 'nut_advantage':
    case 'blocker_id':
    case 'range_identify':
    case 'reflection_prompt':
    // Module 12, Lessons 3-4 — the learner's answer is a plain option id (a prediction about
    // what a toggle state does), the exact same response shape as decision_spot, so grading is
    // pure reuse of evalOptionBased rather than a bespoke resolver.
    case 'range_compression_toggle':
      return evalOptionBased(step, response)

    // Numeric steps
    case 'equity_predict':
      return evalEquityPredict(step, response)

    // Module 12, Lesson 6 — geometricBetSizing(), gated (Section 15/16) and source-locked
    // against the book's own worked example before this branch was written.
    case 'geometric_bet_ladder':
      return evalGeometricBetLadder(step, response)

    // Module 12, Lesson 9 — minimumBetToDenyEquity(), gated and source-locked the same way.
    case 'river_sizing_calculator':
      return evalRiverSizingCalculator(step, response)

    case 'mdf_slider':
      return evalNumeric({
        actual:         step.mdf_slider_target    ?? 0,
        tolerance:      step.mdf_slider_tolerance ?? 3,
        response,
        correctFeedback: `Correct — ${step.mdf_slider_target}%.`,
        wrongFeedback:   `The correct value is ${step.mdf_slider_target}%.`,
        unit: '%',
        term: 'Correct MDF',
      })

    // Range steps
    case 'range_build': {
      const targetCombos =
        step.range_combos ??
        RANGE_TARGETS[step.range_target ?? ''] ??
        []
      return evalRange(targetCombos, step.range_tolerance ?? 5, response)
    }

    case 'range_heatmap': {
      const targetHands = step.range_heatmap_target ?? []
      return evalRange(targetHands, 5, response)
    }

    case 'range_build_multi': {
      if (step.range_build_multi_domain === 'threebet_response') {
        const chart = THREEBET_RESPONSE_CHARTS[step.range_build_multi_chart ?? '']
        if (!chart) {
          return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
        }
        return evalThreebetResponseRange(chart, step.range_build_multi_tolerance ?? 5, response)
      }
      if (step.range_build_multi_domain === 'defend_response') {
        const chart = DEFEND_RESPONSE_CHARTS[step.range_build_multi_chart ?? '']
        if (!chart) {
          return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
        }
        const prefilled = resolveMultiPrefilledAssignments(step) as Record<string, DefendResponseAction>
        return evalDefendResponseRange(chart, step.range_build_multi_tolerance ?? 5, response, prefilled)
      }
      if (step.range_build_multi_domain === 'bb_defense_complete') {
        const map = BB_DEFENSE_COMPLETE_100BB[(step.range_build_multi_chart ?? '') as BBOpenDefenseMatchup]
        if (!map) {
          return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
        }
        const chart: MttRfiChart = {
          key: step.range_build_multi_chart ?? '',
          cells: Object.entries(map).map(([hand, actions]) => ({ hand, actions: actions as Record<MttAction, number> })),
        } as MttRfiChart
        return evalMultiActionRange(chart, step.range_build_multi_tolerance ?? 5, response)
      }
      const chart = MTT_RFI_CHARTS[step.range_build_multi_chart ?? '']
      if (!chart) {
        return { quality: 'good', score: 80, feedback: 'Range recorded.', ev_loss_bb: 0 }
      }
      return evalMultiActionRange(chart, step.range_build_multi_tolerance ?? 5, response)
    }

    case 'table_decision': {
      const evaluation = evaluateTableDecision(
        step.table_decision_chart ?? '',
        step.table_decision_hand ?? '',
        String(response ?? ''),
      )
      if (!evaluation) {
        return { quality: 'good', score: 80, feedback: 'Recorded.', ev_loss_bb: 0 }
      }
      return {
        quality: evaluation.quality,
        score: QUALITY_SCORES[evaluation.quality],
        feedback: evaluation.feedback,
        ev_loss_bb: 0,
      }
    }

    // Scenario tree
    case 'scenario_tree':
      return evalScenarioTree(step, response)

    // Position table — quiz mode is option-based (explore mode is filtered out above)
    case 'position_table':
      return evalOptionBased(step, response)

    // Combo visualizer — quiz mode is a numeric combo-count question (reveal mode filtered out above)
    case 'combo_visualizer':
      return evalNumeric({
        actual:         step.combo_visualizer_correct ?? 0,
        tolerance:      0.5,
        response,
        correctFeedback: step.combo_visualizer_correct_feedback
          ?? `Correct — ${step.combo_visualizer_correct} combinations.`,
        wrongFeedback:   step.combo_visualizer_wrong_feedback
          ?? `The correct count is ${step.combo_visualizer_correct}.`,
        term: 'Correct combo count',
      })

    // Combo removal overlay (Module 9) — tap the concrete combos a known card eliminates
    case 'combo_removal':
      return evalComboRemoval(step, response)

    // Flush pyramid (Module 9) — tap the tiers a known card affects
    case 'flush_pyramid':
      return evalFlushPyramid(step, response)

    // ── Game Theory Foundations (Module 10) ─────────────────────────────────
    case 'strategy_response_lab':
      return evalStrategyResponseLab(step, response)
    case 'clairvoyance_lab':
      return evalClairvoyanceLab(step, response)
    case 'ev_indifference_balance':
      return evalEVIndifferenceBalance(step, response)
    case 'unilateral_deviation_test':
      return evalUnilateralDeviationTest(step, response)

    // Action sequence — notation translation / classification, option-based
    case 'action_sequence':
      return evalOptionBased(step, response)

    // SPR visualizer — scenario mode is a numeric SPR question (worlds mode filtered out above)
    case 'spr_visualizer':
      return evalNumeric({
        actual:         step.spr_visualizer_correct ?? 0,
        tolerance:      step.spr_visualizer_tolerance ?? 0.5,
        response,
        correctFeedback: step.correct_feedback
          ?? `Correct — SPR is ${step.spr_visualizer_correct}.`,
        wrongFeedback:   step.wrong_feedback
          ?? `SPR = effective stack ÷ pot. Correct answer: ${step.spr_visualizer_correct}.`,
        term: 'Correct SPR',
      })

    // Range morphology — shape/capped-uncapped selection, option-based
    case 'range_morphology':
      return evalOptionBased(step, response)

    // ── Foundations Module 2 ────────────────────────────────────────────────

    // Pot odds explorer — 'challenge' mode is a numeric required-equity question;
    // 'fixed'/'slider'/'build' with no options are filtered out above as unscored
    case 'pot_odds_explorer':
      if (step.pot_odds_correct != null) {
        return evalNumeric({
          actual:         step.pot_odds_correct,
          tolerance:      step.pot_odds_tolerance ?? 2,
          response,
          correctFeedback: step.correct_feedback
            ?? `Correct — the required equity is ${step.pot_odds_correct}%.`,
          wrongFeedback:   step.wrong_feedback
            ?? `Required equity = call ÷ final pot. Answer: ${step.pot_odds_correct}%.`,
          unit: '%',
          term: 'Correct required equity',
        })
      }
      return evalOptionBased(step, response)

    // Equity balance — required vs actual equity, then a CALL/FOLD (or similar) decision
    case 'equity_balance':
      return evalOptionBased(step, response)

    // Outs deck — numeric quiz when a target is defined, else option-based
    case 'outs_deck':
      if (step.outs_deck_correct != null) {
        return evalNumeric({
          actual:         step.outs_deck_correct,
          tolerance:      step.outs_deck_tolerance ?? 2,
          response,
          correctFeedback: step.correct_feedback
            ?? `Correct — ${step.outs_deck_correct}${step.outs_deck_mode === 'clean_dirty' ? ' clean outs' : '%'}.`,
          wrongFeedback:   step.wrong_feedback
            ?? `The correct answer is ${step.outs_deck_correct}${step.outs_deck_mode === 'clean_dirty' ? ' clean outs' : '%'}.`,
          unit: step.outs_deck_mode === 'clean_dirty' ? '' : '%',
          term: step.outs_deck_mode === 'clean_dirty' ? 'Correct clean-out count' : 'Correct outs',
        })
      }
      return evalOptionBased(step, response)

    // EV decision tree — a classification/choice question over the displayed tree
    case 'ev_tree':
      return evalOptionBased(step, response)

    // Bluff break-even visualizer — numeric required-fold-% question, else option-based
    case 'bluff_breakeven':
      if (step.bluff_breakeven_correct != null) {
        return evalNumeric({
          actual:         step.bluff_breakeven_correct,
          tolerance:      step.bluff_breakeven_tolerance ?? 3,
          response,
          correctFeedback: step.correct_feedback
            ?? `Correct — this bluff needs to work ${step.bluff_breakeven_correct}% of the time.`,
          wrongFeedback:   step.wrong_feedback
            ?? `Required fold % = bet ÷ (bet + pot). Answer: ${step.bluff_breakeven_correct}%.`,
          unit: '%',
          term: 'Correct required fold %',
        })
      }
      return evalOptionBased(step, response)

    // Equity realization — numeric calculator question, else option-based
    case 'equity_realization':
      if (step.equity_realization_correct != null) {
        return evalNumeric({
          actual:         step.equity_realization_correct,
          tolerance:      step.equity_realization_tolerance ?? 3,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — ${step.equity_realization_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The correct answer is ${step.equity_realization_correct}%.`,
          unit: '%',
          term: 'Correct equity realization',
        })
      }
      return evalOptionBased(step, response)

    // Range compare — a decision question over two displayed ranges
    case 'range_compare':
      return evalOptionBased(step, response)

    // ── Preflop Foundation (Module 3) ───────────────────────────────────────

    // Players behind — numeric resistance-risk question, else option-based
    case 'players_behind':
      if (step.players_behind_correct != null) {
        return evalNumeric({
          actual:         step.players_behind_correct,
          tolerance:      step.players_behind_tolerance ?? 5,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — approximately ${step.players_behind_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The illustrative model gives approximately ${step.players_behind_correct}%.`,
          unit: '%',
          term: 'Correct resistance risk',
        })
      }
      return evalOptionBased(step, response)

    // Hand DNA — a classification/reasoning question over the displayed breakdown
    case 'hand_dna':
      return evalOptionBased(step, response)

    // Stack depth morph — a reasoning question over the morphing range
    case 'stack_depth_morph':
      return evalOptionBased(step, response)

    // MTT stack-depth compare — a reasoning question over the 4-depth comparison, when authored
    case 'mtt_stack_depth_compare':
      return evalOptionBased(step, response)

    // Dead money visualizer — a reasoning question over the ante toggle
    case 'dead_money_visualizer':
      return evalOptionBased(step, response)

    // Open size explorer — numeric break-even-fold question, else option-based
    case 'open_size_explorer':
      if (step.open_size_correct != null) {
        return evalNumeric({
          actual:         step.open_size_correct,
          tolerance:      step.open_size_tolerance ?? 3,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — ${step.open_size_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The correct answer is ${step.open_size_correct}%.`,
          unit: '%',
          term: 'Correct break-even fold %',
        })
      }
      return evalOptionBased(step, response)

    // Strategy complexity meter — a trade-off question
    case 'strategy_complexity':
      return evalOptionBased(step, response)

    // Range diff — a decision question over a canned baseline-vs-example overlay
    case 'range_diff':
      return evalOptionBased(step, response)

    // ── Preflop Aggression (Module 4) ───────────────────────────────────────

    // Range bucket — sort a hand pool into named buckets, combo-weighted scoring.
    // Module 11, Lesson 5's Range Surgery opts into an additive protection-verdict layer
    // by authoring `range_bucket_protection_target` — every other range_bucket lesson
    // (Modules 4+) omits it and keeps calling evalRangeBucket exactly as before.
    case 'range_bucket':
      return step.range_bucket_protection_target
        ? evalRangeSurgeryProtection(step, response)
        : evalRangeBucket(step, response)

    // Morphology builder — 'build' scores range shape; 'classify' is a plain option choice
    case 'morphology_builder':
      if (step.morphology_builder_mode === 'build') return evalMorphologyBuild(step, response)
      return evalOptionBased(step, response)

    // Blocker lab — a reasoning question over the card-removal comparison
    case 'blocker_lab':
      return evalOptionBased(step, response)

    // Sizing slider — a decision question over the live risk/pot/SPR feedback
    case 'sizing_slider':
      return evalOptionBased(step, response)

    // ── Understanding the Flop (Module 6) ───────────────────────────────────

    // Flop classify drill — rapid-fire classification, graded live against classifyFlop
    case 'flop_classify_drill':
      return evalFlopClassifyDrill(step, response)

    // Suit isomorphism — only reached in 'sort' mode ('explain' is filtered out as unscored)
    case 'suit_isomorphism':
      return evalOptionBased(step, response)

    // Flop builder — construct a board that hits a described classification/volatility target
    case 'flop_builder':
      return evalFlopBuilder(step, response)

    // Straight detective — tap the hole-card rank pairs that complete a possible straight
    case 'straight_detective':
      return evalStraightDetective(step, response)

    // Board volatility — Runout Storm / compare / continuum sort
    case 'board_volatility':
      return evalBoardVolatility(step, response)

    // Range × board collision — a decision question over the card-removal-aware visualization
    case 'range_board_collision':
      return evalOptionBased(step, response)

    // Equity bucket — threshold/scenario bucket judgment, or a distribution question
    case 'equity_bucket':
      return evalEquityBucket(step, response)

    // Board autopsy — flag which fields of a flawed analysis are wrong, graded live against classifyFlop
    case 'board_autopsy':
      return evalBoardAutopsy(step, response)

    // Hand ranking order — drag/tap-reorder all 10 categories strongest to weakest
    case 'hand_ranking_order':
      return evalHandRankingOrder(step, response)

    // ── Lesson 1 opening interactive beats ──────────────────────────────────

    // Cards identify — tap Hero's hole cards out of Hero's cards + community placeholders
    case 'cards_identify':
      return evalCardsIdentify(step, response)

    // Build first hand — tap the 5 cards that form Hero's best hand
    case 'build_first_hand':
      return evalBuildFirstHand(step, response)

    // ── C-Betting Fundamentals (Module 7) ───────────────────────────────────

    // Range distribution — a decision question over the Hero/Villain bucket comparison
    case 'range_distribution':
      return evalOptionBased(step, response)

    // C-bet frequency + size lab — the combined frequency|sizing answer, hand-authored options
    case 'cbet_frequency_size':
      return evalOptionBased(step, response)

    // Board rank sort — order boards by expected c-bet frequency, hand-authored target order
    // (also used, unchanged, for the spectrum drag-layout — see board_rank_sort_layout)
    case 'board_rank_sort':
      return evalBoardRankSort(step, response)

    // ── Range vs Range (Module 8) ───────────────────────────────────────────

    // Range Collision Viewer — 'predict'/'archaeology' modes ask an options-based
    // question (favor-scale pick, or "which side is the raiser"); 'reveal'/'morph'
    // are unscored (filtered out by isScoredStep before reaching here).
    case 'range_collision':
      return evalOptionBased(step, response)

    // Range equity predict — slider estimate of a range-vs-range equity split.
    case 'range_equity_predict': {
      // Showing the actual solver/book number is the pedagogical point of this
      // step type, not just a "you were wrong" comparison — so unlike most
      // evalNumeric callers, this one opts into alwaysReveal (see evalNumeric's
      // doc comment) and threads the step's own authored source citation through
      // rather than leaving the learner with only a vague "close to the book's
      // figure" line.
      const rangeEquityActual = step.range_equity_predict_correct ?? 50
      return evalNumeric({
        actual: rangeEquityActual,
        tolerance: step.range_equity_predict_tolerance ?? 8,
        response,
        correctFeedback: `The solver equity for this exact range matchup is ${rangeEquityActual}%.`,
        wrongFeedback: `The solver equity for this exact range matchup is ${rangeEquityActual}%. Range-vs-range equity here is further off than it looks — inspect the ranges below.`,
        unit: '%',
        term: 'Solver equity',
        alwaysReveal: true,
        source: step.range_equity_predict_source_ref,
      })
    }

    // Range X-Ray — scored only when a follow-up question was authored.
    case 'range_xray':
      return evalOptionBased(step, response)

    default:
      // Unknown step type — attempt option-based, fall back to punt
      if (step.options?.length) return evalOptionBased(step, response)
      return {
        quality: 'acceptable',
        score: QUALITY_SCORES.acceptable,
        feedback: 'Response recorded.',
        ev_loss_bb: 0,
      }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a lesson step locally.
 *
 * @param step          The LessonStep containing all evaluation metadata
 * @param userResponse  Raw user answer (option ID, number, string[], quality, etc.)
 * @param currentTotalXP  User's total XP before this step (used for level tracking)
 * @returns A complete StepResult — instantly, without any network call
 */
export function evaluateStepLocally(
  step: LessonStep,
  userResponse: unknown,
  currentTotalXP: number,
): StepResult {
  const core = resolveCore(step, userResponse)

  // Passive/unscored steps never earn XP, no matter what step.xp is authored as —
  // reading content isn't a demonstration of knowledge. See isScoredStep().
  const baseXP    = step.xp ?? 10
  const xp_earned = core.unscored ? 0 : Math.round(baseXP * QUALITY_XP_MULT[core.quality])

  const level_before = levelForXP(currentTotalXP)
  const level_after  = levelForXP(currentTotalXP + xp_earned)

  return {
    score:          core.score,
    quality:        core.quality,
    ev_loss_bb:     core.ev_loss_bb,
    feedback:       core.feedback,
    concept_triggered: core.concept_triggered,
    concept_explanation: core.concept_explanation,
    structured_points: core.structured_points,
    answer_reveal: core.answer_reveal,
    reasoning_stages: core.reasoning_stages,
    // Resolved from `step` alone, independent of `core`/grading — see
    // DecisionSpotRangeReveal's doc comment: this can never affect score/quality/xp_earned.
    // `range_reveal_direction` picks which chart family Hero's seat is read against;
    // omitted/'defend' preserves the original Module 5 behavior unchanged. 'defend'/'3bet'
    // additionally get the opener's own opening range attached as `secondaryRange` whenever
    // it resolves (see attachOpenerPanel) — 'opener' and 'facing_3bet' are already complete
    // standalone reveals and don't need (or want) a second panel bolted on.
    range_reveal:
      step.range_reveal_direction === '3bet' ? attachOpenerPanel(resolveThreebetRangeReveal(step), step)
      : step.range_reveal_direction === 'opener' ? resolveOpenerRangeReveal(step)
      : step.range_reveal_direction === 'facing_3bet' ? resolveFacingThreebetRangeReveal(step)
      : attachOpenerPanel(resolveDefendRangeReveal(step), step),
    // Same purely-presentational, never-graded contract as `range_reveal` above — a
    // direct passthrough of hand-authored step data, never computed here.
    nut_advantage_reveal: step.nut_advantage_reveal,
    solver_reveal: step.solver_reveal,
    theory_panel: step.theory_panel,
    xp_earned,
    level_before,
    level_after,
    leveled_up:         level_after > level_before,
    // Evaluation pipeline metadata
    evaluation_source:  'theory_engine',
    confidence:         'high',
    evaluation_valid:   true,
    fallback_used:      false,
    unscored:           !!core.unscored,
  }
}

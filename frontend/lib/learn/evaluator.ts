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

import type { LessonStep, StepResult, ActionQuality } from './types'
import { levelForXP } from './types'
import { RANGE_TARGETS } from './ranges'

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
}

// ── Option-based steps ────────────────────────────────────────────────────────
// decision_spot, bet_size_choose, bluff_pick, board_classify, nut_advantage,
// blocker_id, range_identify, reflection_prompt, mdf_slider (when options present)

function evalOptionBased(step: LessonStep, response: unknown): EvalCore {
  const optionId = String(response ?? '')
  const option = step.options?.find((o) => o.id === optionId)

  if (!option) {
    // Unknown option — could be a custom value not in the list; treat as mistake
    return {
      quality: 'mistake',
      score: QUALITY_SCORES.mistake,
      feedback: step.wrong_feedback ?? 'Response not recognised. Review the options.',
      ev_loss_bb: 0,
    }
  }

  return {
    quality: option.quality,
    score: QUALITY_SCORES[option.quality],
    feedback: option.feedback,
    ev_loss_bb: option.ev_loss_bb ?? 0,
    concept_triggered: option.concept_triggered,
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
}): EvalCore {
  const { actual, tolerance, response, correctFeedback, wrongFeedback, unit = '' } = opts
  const value = Number(response)

  if (isNaN(value)) {
    return { quality: 'punt', score: QUALITY_SCORES.punt, feedback: wrongFeedback, ev_loss_bb: 0 }
  }

  const delta = Math.abs(value - actual)

  if (delta <= tolerance) {
    return { quality: 'perfect', score: 100, feedback: correctFeedback, ev_loss_bb: 0 }
  }
  if (delta <= tolerance * 2) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: `${correctFeedback} (close — exact answer is ${actual}${unit})`,
      ev_loss_bb: 0,
    }
  }
  if (delta <= tolerance * 3.5) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: `${wrongFeedback} The exact value is ${actual}${unit}.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: `${wrongFeedback} The correct answer is ${actual}${unit}.`,
    ev_loss_bb: 0,
  }
}

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
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: `${header} ${step.wrong_feedback ?? 'Well off — see the breakdown below.'}`,
    ev_loss_bb: 0,
    concept_triggered,
    concept_explanation,
  }
}

// ── Range steps (range_build, range_heatmap) ──────────────────────────────────

/** Number of distinct combos a hand notation represents */
function handCombos(hand: string): number {
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

function evalScenarioTree(response: unknown): EvalCore {
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

  return {
    quality,
    score: QUALITY_SCORES[quality] ?? QUALITY_SCORES.punt,
    feedback: explanation,
    ev_loss_bb: 0,
  }
}

// ── Step-type router ──────────────────────────────────────────────────────────

function resolveCore(step: LessonStep, response: unknown): EvalCore {
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
      return evalOptionBased(step, response)

    // Numeric steps
    case 'equity_predict':
      return evalEquityPredict(step, response)

    case 'mdf_slider':
      return evalNumeric({
        actual:         step.mdf_slider_target    ?? 0,
        tolerance:      step.mdf_slider_tolerance ?? 3,
        response,
        correctFeedback: `Correct — ${step.mdf_slider_target}%.`,
        wrongFeedback:   `The correct value is ${step.mdf_slider_target}%.`,
        unit: '%',
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

    // Scenario tree
    case 'scenario_tree':
      return evalScenarioTree(response)

    // Concept reveal — always awarded, no interaction to evaluate
    case 'concept_reveal':
      return { quality: 'perfect', score: 100, feedback: 'Concept reviewed.', ev_loss_bb: 0 }

    // Position table — quiz mode is option-based; explore mode is unscored
    case 'position_table':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Combo visualizer — quiz mode is a numeric combo-count question; reveal is unscored
    case 'combo_visualizer':
      if (step.combo_visualizer_mode === 'quiz') {
        return evalNumeric({
          actual:         step.combo_visualizer_correct ?? 0,
          tolerance:      0.5,
          response,
          correctFeedback: step.combo_visualizer_correct_feedback
            ?? `Correct — ${step.combo_visualizer_correct} combinations.`,
          wrongFeedback:   step.combo_visualizer_wrong_feedback
            ?? `The correct count is ${step.combo_visualizer_correct}.`,
        })
      }
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Action sequence — notation translation / classification, option-based
    case 'action_sequence':
      return evalOptionBased(step, response)

    // SPR visualizer — scenario mode is a numeric SPR question; worlds mode is unscored
    case 'spr_visualizer':
      if (step.spr_visualizer_mode === 'worlds') {
        return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }
      }
      return evalNumeric({
        actual:         step.spr_visualizer_correct ?? 0,
        tolerance:      step.spr_visualizer_tolerance ?? 0.5,
        response,
        correctFeedback: step.correct_feedback
          ?? `Correct — SPR is ${step.spr_visualizer_correct}.`,
        wrongFeedback:   step.wrong_feedback
          ?? `SPR = effective stack ÷ pot. Correct answer: ${step.spr_visualizer_correct}.`,
      })

    // Range morphology — shape/capped-uncapped selection, option-based
    case 'range_morphology':
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

  const baseXP    = step.xp ?? 10
  const xp_earned = Math.round(baseXP * QUALITY_XP_MULT[core.quality])

  const level_before = levelForXP(currentTotalXP)
  const level_after  = levelForXP(currentTotalXP + xp_earned)

  return {
    score:          core.score,
    quality:        core.quality,
    ev_loss_bb:     core.ev_loss_bb,
    feedback:       core.feedback,
    concept_triggered: core.concept_triggered,
    concept_explanation: core.concept_explanation,
    xp_earned,
    level_before,
    level_after,
    leveled_up:         level_after > level_before,
    // Evaluation pipeline metadata
    evaluation_source:  'theory_engine',
    confidence:         'high',
    evaluation_valid:   true,
    fallback_used:      false,
  }
}

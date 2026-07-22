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
  // Every numeric slider/challenge step (pot odds, outs, bluff break-even,
  // equity realization, MDF, SPR, combo counts...) shares this evaluator, so
  // echoing the learner's own answer here is the one reliable place the
  // "your answer vs correct answer" reveal reaches every one of them.
  const yourAnswer = `You answered ${value}${unit}.`

  if (delta <= tolerance) {
    return { quality: 'perfect', score: 100, feedback: `${yourAnswer} ${correctFeedback}`, ev_loss_bb: 0 }
  }
  if (delta <= tolerance * 2) {
    return {
      quality: 'good',
      score: QUALITY_SCORES.good,
      feedback: `${yourAnswer} ${correctFeedback} (close — exact answer is ${actual}${unit})`,
      ev_loss_bb: 0,
    }
  }
  if (delta <= tolerance * 3.5) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: `${yourAnswer} ${wrongFeedback} The exact value is ${actual}${unit}.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: QUALITY_SCORES.mistake,
    feedback: `${yourAnswer} ${wrongFeedback} The correct answer is ${actual}${unit}.`,
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
  if (accuracy >= 0.8) {
    return {
      quality: 'good',
      score: Math.max(QUALITY_SCORES.good, pct),
      feedback: `Good sort${detail ? ` — ${detail}` : ''}.`,
      ev_loss_bb: 0,
    }
  }
  if (accuracy >= 0.6) {
    return {
      quality: 'acceptable',
      score: Math.max(QUALITY_SCORES.acceptable, pct),
      feedback: `Roughly right, but has leaks${detail ? ` — ${detail}` : ''}.`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: Math.max(20, pct),
    feedback: `Several hands are in the wrong bucket${detail ? ` — ${detail}` : ''}. Review the reasoning for each category.`,
    ev_loss_bb: 0,
  }
}

// ── Morphology builder — build mode (Module 4) ────────────────────────────────
// The learner constructs a linear range (Range A) and a polarized range (Range B)
// from the same strength-ordered pool. This checks *shape*, not exact solver
// membership: linear should be a contiguous top-down prefix of the pool; polarized
// should combine top-third and bottom-third hands while skipping some of the middle.

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

  const indexOf = (h: string) => pool.indexOf(h)

  const linearIdx = linear.map(indexOf).filter((i) => i >= 0).sort((a, b) => a - b)
  const expectedPrefix = Array.from({ length: linearIdx.length }, (_, i) => i)
  const linearHasGaps = linearIdx.some((v, i) => v !== expectedPrefix[i])
  const linearOk = linearIdx.length > 0 && !linearHasGaps

  const n = pool.length
  const topCut = Math.ceil(n / 3)
  const bottomCut = n - Math.ceil(n / 3)
  const polarIdx = polarized.map(indexOf).filter((i) => i >= 0)
  const hasTop = polarIdx.some((i) => i < topCut)
  const hasBottom = polarIdx.some((i) => i >= bottomCut)
  const middleIndices = Array.from({ length: n }, (_, i) => i).filter((i) => i >= topCut && i < bottomCut)
  const hasGap = middleIndices.some((i) => !polarIdx.includes(i))
  const polarOk = hasTop && hasBottom && hasGap

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

    // ── Foundations Module 2 ────────────────────────────────────────────────

    // Pot odds explorer — 'challenge' mode is a numeric required-equity question;
    // 'fixed'/'slider'/'build' are unscored exploration unless options are present
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
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Equity balance — required vs actual equity, then a CALL/FOLD (or similar) decision
    case 'equity_balance':
      return evalOptionBased(step, response)

    // Outs deck — numeric quiz when a target is defined, else option-based, else unscored
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
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // EV decision tree — a classification/choice question over the displayed tree, or unscored
    case 'ev_tree':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Bluff break-even visualizer — numeric required-fold-% question, else option-based, else unscored
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
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Equity realization — numeric calculator question, else option-based, else unscored
    case 'equity_realization':
      if (step.equity_realization_correct != null) {
        return evalNumeric({
          actual:         step.equity_realization_correct,
          tolerance:      step.equity_realization_tolerance ?? 3,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — ${step.equity_realization_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The correct answer is ${step.equity_realization_correct}%.`,
          unit: '%',
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Range compare — a decision question over two displayed ranges, or unscored
    case 'range_compare':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // ── Preflop Foundation (Module 3) ───────────────────────────────────────

    // Players behind — numeric resistance-risk question, else option-based, else unscored
    case 'players_behind':
      if (step.players_behind_correct != null) {
        return evalNumeric({
          actual:         step.players_behind_correct,
          tolerance:      step.players_behind_tolerance ?? 5,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — approximately ${step.players_behind_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The illustrative model gives approximately ${step.players_behind_correct}%.`,
          unit: '%',
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Hand DNA — a classification/reasoning question over the displayed breakdown, or unscored
    case 'hand_dna':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Stack depth morph — a reasoning question over the morphing range, or unscored
    case 'stack_depth_morph':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Dead money visualizer — a reasoning question over the ante toggle, or unscored
    case 'dead_money_visualizer':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Open size explorer — numeric break-even-fold question, else option-based, else unscored
    case 'open_size_explorer':
      if (step.open_size_correct != null) {
        return evalNumeric({
          actual:         step.open_size_correct,
          tolerance:      step.open_size_tolerance ?? 3,
          response,
          correctFeedback: step.correct_feedback ?? `Correct — ${step.open_size_correct}%.`,
          wrongFeedback:   step.wrong_feedback ?? `The correct answer is ${step.open_size_correct}%.`,
          unit: '%',
        })
      }
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Strategy complexity meter — a trade-off question, or unscored
    case 'strategy_complexity':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Range diff — a decision question over a canned baseline-vs-example overlay, or unscored
    case 'range_diff':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // ── Preflop Aggression (Module 4) ───────────────────────────────────────

    // Range bucket — sort a hand pool into named buckets, combo-weighted scoring
    case 'range_bucket':
      return evalRangeBucket(step, response)

    // Morphology builder — 'build' scores range shape; 'classify' is a plain option choice
    case 'morphology_builder':
      if (step.morphology_builder_mode === 'build') return evalMorphologyBuild(step, response)
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Blocker lab — a reasoning question over the card-removal comparison, or unscored
    case 'blocker_lab':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

    // Sizing slider — a decision question over the live risk/pot/SPR feedback, or unscored
    case 'sizing_slider':
      if (step.options?.length) return evalOptionBased(step, response)
      return { quality: 'perfect', score: 100, feedback: 'Reviewed.', ev_loss_bb: 0 }

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

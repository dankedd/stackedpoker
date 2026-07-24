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
  /** True when this step had nothing to grade (passive/informational content or an
   *  exploration-mode visualizer). See `isScoredStep` for the classification rule. */
  unscored?: boolean
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
    case 'dead_money_visualizer':
    case 'strategy_complexity':
    case 'range_diff':
    case 'blocker_lab':
    case 'sizing_slider':
    case 'range_distribution':
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

    // Everything else (decision_spot, bet_size_choose, bluff_pick, board_classify,
    // nut_advantage, blocker_id, range_identify, reflection_prompt, equity_predict,
    // mdf_slider, range_build, range_heatmap, scenario_tree, action_sequence,
    // range_morphology, equity_balance, range_bucket, hand_ranking_order, and any
    // unknown future type) always carries a real question/decision to grade.
    default:
      return true
  }
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

// ── Understanding the Flop (Module 6) ─────────────────────────────────────────
// Ground truth for every drill/autopsy/detective below is derived LIVE from
// `classifyFlop`/`estimateVolatility` — never a hand-authored answer key — so a
// content typo can't silently create a wrong-but-unenforced "correct" answer.

/** Shared grading for "tap every item that belongs in the set" interactions
 *  (straight detective, runout storm, board autopsy): score by how well the
 *  selected id set matches the correct id set — no combo weighting, every
 *  item counts equally. */
function evalIdSetSelection(
  correctIds: Set<string>,
  selectedIds: Set<string>,
  labels: { unit: string; correctFeedback: string; noneFeedback: string },
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
  if (f1 >= 0.75) {
    return { quality: 'good', score: Math.max(QUALITY_SCORES.good, Math.round(f1 * 100)), feedback: `Close — ${detail}.`, ev_loss_bb: 0 }
  }
  if (f1 >= 0.4) {
    return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, Math.round(f1 * 100)), feedback: `Partial credit — ${detail}.`, ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(15, Math.round(f1 * 100)), feedback: `Review the board — ${detail}.`, ev_loss_bb: 0 }
}

function asBoard(cards: string[] | undefined, label: string): [string, string, string] {
  if (!cards || cards.length !== 3) throw new Error(`${label}: expected exactly 3 cards, got ${cards?.length ?? 0}`)
  return [cards[0], cards[1], cards[2]]
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
  boards.forEach((b, i) => {
    const correct = dimensionValue(classifyFlop(asBoard(b, 'flop_classify_drill')), dimension)
    if (answers[i] === correct) correctCount++
    else misses.push(i + 1)
  })

  const pct = Math.round((correctCount / boards.length) * 100)
  const detail = misses.length > 0 ? ` (missed board${misses.length > 1 ? 's' : ''} ${misses.join(', ')})` : ''

  if (correctCount === boards.length) {
    return { quality: 'perfect', score: 100, feedback: `Perfect — ${boards.length}/${boards.length} correct.`, ev_loss_bb: 0 }
  }
  if (pct >= 80) {
    return { quality: 'good', score: pct, feedback: `${correctCount}/${boards.length} correct${detail}.`, ev_loss_bb: 0 }
  }
  if (pct >= 60) {
    return { quality: 'acceptable', score: pct, feedback: `${correctCount}/${boards.length} correct${detail}. Review the ones you missed.`, ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(15, pct), feedback: `${correctCount}/${boards.length} correct${detail}. Revisit this classification before continuing.`, ev_loss_bb: 0 }
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
    if (accuracy >= 0.75) return { quality: 'good', score: Math.max(QUALITY_SCORES.good, pct), feedback: 'Close — a couple of boards are out of order.', ev_loss_bb: 0 }
    if (accuracy >= 0.5) return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, pct), feedback: 'Roughly right, but several boards are out of order.', ev_loss_bb: 0 }
    return { quality: 'mistake', score: Math.max(15, pct), feedback: 'This ordering doesn\'t track static-to-dynamic. Review each board\'s texture and straight potential.', ev_loss_bb: 0 }
  }

  // runout_storm (default)
  const board = asBoard(step.board_volatility_board ?? step.board, 'board_volatility')
  const pool = step.board_volatility_storm_pool ?? []
  const correctIds = new Set(pool.filter((card) => turnImpact(board, card).changesBoard))
  const selectedIds = new Set(Array.isArray(response) ? (response as string[]) : [])

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
    return { quality: 'perfect', score: 100, feedback: 'That ordering matches — from bets most to bets least.', ev_loss_bb: 0 }
  }
  if (accuracy >= 0.75) {
    return { quality: 'good', score: Math.max(QUALITY_SCORES.good, pct), feedback: 'Close — a couple of these boards are out of order.', ev_loss_bb: 0 }
  }
  if (accuracy >= 0.5) {
    return { quality: 'acceptable', score: Math.max(QUALITY_SCORES.acceptable, pct), feedback: 'Roughly right, but several boards are out of order. Review what drives frequency on each.', ev_loss_bb: 0 }
  }
  return { quality: 'mistake', score: Math.max(15, pct), feedback: 'This ordering doesn\'t track the range-interaction story on these boards. Revisit which range each board favors and why.', ev_loss_bb: 0 }
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
    }
  }
  return {
    quality: foundCount > 0 ? 'acceptable' : 'mistake',
    score: foundCount > 0 ? QUALITY_SCORES.acceptable : QUALITY_SCORES.mistake,
    feedback: `${foundCount} of ${heroCards.length} correct — your hole cards are ${heroCards.join(' and ')}. ${explanation}`,
    ev_loss_bb: 0,
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
  const correctList = [...correct].join(', ')
  if (accuracy >= 0.6) {
    return {
      quality: 'acceptable',
      score: QUALITY_SCORES.acceptable,
      feedback: `${overlap} of ${correct.size} correct — Hero's best hand is ${correctList}. ${explanation}`,
      ev_loss_bb: 0,
    }
  }
  return {
    quality: 'mistake',
    score: Math.max(20, Math.round(accuracy * 100)),
    feedback: `Not quite — Hero's best hand is ${correctList}. ${explanation}`,
    ev_loss_bb: 0,
  }
}

// ── Step-type router ──────────────────────────────────────────────────────────

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
      })

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
        })
      }
      return evalOptionBased(step, response)

    // Hand DNA — a classification/reasoning question over the displayed breakdown
    case 'hand_dna':
      return evalOptionBased(step, response)

    // Stack depth morph — a reasoning question over the morphing range
    case 'stack_depth_morph':
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

    // Range bucket — sort a hand pool into named buckets, combo-weighted scoring
    case 'range_bucket':
      return evalRangeBucket(step, response)

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
    case 'board_rank_sort':
      return evalBoardRankSort(step, response)

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

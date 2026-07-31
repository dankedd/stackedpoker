/**
 * Builds the structured context payload the in-lesson AI Coach sends with
 * every message — the client-side half of "the Coach already knows the
 * current step, never re-derive it from prose." Mirrors, but does not
 * replace, the server-side guardrail in
 * backend/app/engines/learn/coach_context.py (sanitize_context strips
 * ANSWER_KEY_FIELDS unless the server has independently verified the step
 * was actually completed) — this builder additionally avoids ever
 * *transmitting* those fields before the step is answered, as a second,
 * client-side line of defense.
 */

import type { Lesson, LessonStep, StepResult } from './types'
import { buildPreflopTableRenderState, type PreflopTableRenderState } from './preflopTableState'

export interface LessonCoachPokerState {
  board?: string[]
  heroPosition?: string
  villainPosition?: string
  heroHand?: string[]
  potBb?: number
  effectiveStackBb?: number
  street?: string
  tableSize?: number
  anteBb?: number
  actionBeforeHero?: string[]
  /** Same derivation PreflopTable.tsx renders from — never re-derived differently. */
  preflopTable?: PreflopTableRenderState
}

export interface LessonCoachRangeSide {
  label: string
  range: string[]
}

export interface LessonCoachContext {
  lessonId: string
  lessonTitle: string
  moduleId?: string
  stepId: string
  stepType: string
  stepIndex: number
  conceptIds: string[]
  narrative?: string
  question?: string
  options?: { id: string; label: string }[]
  poker: LessonCoachPokerState
  rangeContext?: { a?: LessonCoachRangeSide; b?: LessonCoachRangeSide }
  /** Every OTHER step field not already captured above — the widget's own
   *  "given" data (pot odds bet/pot, outs, equity inputs, range-builder pools,
   *  comparison scenarios, ...). Always included; never answer-revealing by
   *  construction (see extractScenarioFields). Lets any widget type reach the
   *  coach without per-widget code. */
  scenario?: Record<string, unknown>
  hintLevel: number
  hasAnswered: boolean
  selectedAnswer?: unknown
  isCorrect?: boolean
  /** Only ever populated when `hasAnswered` — still independently stripped
   *  server-side regardless of what's sent (see module docstring). */
  correctAnswer?: string
  correctFeedback?: string
  answerReveal?: StepResult['answer_reveal']
  /** The widget-specific answer-key fields the generic classifier caught
   *  (e.g. `pot_odds_correct`, `equity_actual`) — same `hasAnswered` gating. */
  widgetAnswerKey?: Record<string, unknown>
  /** The actual per-attempt grading feedback shown to the learner on the
   *  StepFeedback screen (`StepResult.feedback`) — distinct from the
   *  authored, generic `correctFeedback` above. Only once `hasAnswered`. */
  evaluatorFeedback?: string
}

function extractOptions(step: LessonStep): { id: string; label: string }[] | undefined {
  if (!step.options?.length) return undefined
  return step.options.map((o) => ({ id: o.id, label: o.label }))
}

function extractRangeContext(step: LessonStep): LessonCoachContext['rangeContext'] {
  const a = step.range_compare_a ?? step.range_collision_a
  const b = step.range_compare_b ?? step.range_collision_b
  if (!a && !b) return undefined
  return {
    a: a ? { label: a.label, range: a.range } : undefined,
    b: b ? { label: b.label, range: b.range } : undefined,
  }
}

// ── Generic widget scenario/answer-key classifier ───────────────────────────
// LessonStep has ~60 widget-specific step types, each with its own fields
// (pot_odds_pot, outs_deck_out_cards, range_bucket_pool, ...), but the naming
// is consistent enough across all of them to classify generically instead of
// hand-enumerating every widget: a field ending in one of these suffixes, or
// exactly named one of these, is the ANSWER KEY (what the learner is graded
// against) — everything else on the step is safe "given" scenario data. Two
// confirmed fields don't fit the suffix convention but ARE answer-revealing:
// `equity_actual` (equity_predict's graded target) and `range_bucket_acceptable`
// (alternate correct categorizations) — called out explicitly rather than
// silently missed by the pattern match.
const ANSWER_KEY_SUFFIXES = [/_correct$/, /_target$/, /_acceptable$/, /_correct_feedback$/, /_wrong_feedback$/]
const ANSWER_KEY_EXACT = new Set([
  'correct_answer', 'correct_feedback', 'wrong_feedback', 'equity_actual', 'quality',
])

/** Fields already surfaced via their own named LessonCoachContext property —
 *  excluded from the generic scenario/answer-key buckets below so the
 *  payload never carries the same fact twice. Also excludes
 *  `remediation_ladder`: it's an array of OTHER full LessonStep objects (each
 *  with their own answer-key fields), which this flat, single-step
 *  classifier only inspects one level deep — including it here would risk
 *  leaking a different step's answer key un-sanitized. */
const ALREADY_SURFACED = new Set([
  'id', 'type', 'source', 'concept_ids',
  'board', 'hero_position', 'villain_position', 'hero_hand', 'pot_bb',
  'effective_stack_bb', 'street', 'table_size', 'ante_bb', 'action_before_hero',
  'narrative', 'decision_spot_question', 'options',
  'range_compare_a', 'range_compare_b', 'range_collision_a', 'range_collision_b',
  'remediation_ladder',
])

function isAnswerKeyField(key: string): boolean {
  return ANSWER_KEY_EXACT.has(key) || ANSWER_KEY_SUFFIXES.some((re) => re.test(key))
}

/** Every remaining step field that isn't answer-key-shaped and isn't already
 *  surfaced by a dedicated context property — the widget's own "given" data
 *  (pot/bet sizes, boards, ranges, pools, comparison scenarios, ...), safe to
 *  always include since none of it reveals the correct answer. This is what
 *  lets a non-decision_spot step (pot_odds_explorer, outs_deck, range_bucket,
 *  scenario comparisons, etc.) reach the coach without per-widget code. */
function extractScenarioFields(step: LessonStep): Record<string, unknown> | undefined {
  const scenario: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(step)) {
    if (value == null) continue
    if (ALREADY_SURFACED.has(key) || isAnswerKeyField(key)) continue
    scenario[key] = value
  }
  return Object.keys(scenario).length > 0 ? scenario : undefined
}

/** The widget-specific answer-key fields the generic classifier caught (e.g.
 *  `pot_odds_correct`, `range_bucket_correct`, `equity_actual`) — the same
 *  protection as `correctAnswer`/`correctFeedback`: only ever populated once
 *  `hasAnswered`, independently re-stripped server-side regardless. */
function extractWidgetAnswerKey(step: LessonStep): Record<string, unknown> | undefined {
  const answerKey: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(step)) {
    if (value == null) continue
    if (ALREADY_SURFACED.has(key) || !isAnswerKeyField(key)) continue
    answerKey[key] = value
  }
  return Object.keys(answerKey).length > 0 ? answerKey : undefined
}

/** A step is "answered" for Coach purposes once a StepResult exists for it —
 *  mirrors LessonPlayer's own `answeredSteps`/`resultsByStepId` bookkeeping,
 *  never a second independent notion of completion. */
export function buildLessonCoachContext(
  lesson: Lesson,
  step: LessonStep,
  stepIndex: number,
  result: StepResult | null,
  selectedAnswer: unknown,
  hintLevel: number,
): LessonCoachContext {
  const hasAnswered = result != null && !result.unscored

  const preflopTable =
    !step.board?.length && step.hero_position ? buildPreflopTableRenderState(step) : undefined

  const poker: LessonCoachPokerState = {
    board: step.board,
    heroPosition: step.hero_position,
    villainPosition: step.villain_position,
    heroHand: step.hero_hand,
    potBb: step.pot_bb,
    effectiveStackBb: step.effective_stack_bb,
    street: step.street,
    tableSize: step.table_size,
    anteBb: step.ante_bb,
    actionBeforeHero: step.action_before_hero,
    preflopTable,
  }

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    moduleId: lesson.module_id,
    stepId: step.id,
    stepType: step.type,
    stepIndex,
    conceptIds: step.concept_ids?.length ? step.concept_ids : lesson.concept_ids,
    narrative: step.narrative,
    question: step.decision_spot_question,
    options: extractOptions(step),
    poker,
    rangeContext: extractRangeContext(step),
    scenario: extractScenarioFields(step),
    hintLevel,
    hasAnswered,
    selectedAnswer: hasAnswered ? selectedAnswer : undefined,
    isCorrect: hasAnswered ? result!.quality === 'perfect' || result!.quality === 'good' : undefined,
    correctAnswer: hasAnswered ? step.correct_answer : undefined,
    correctFeedback: hasAnswered ? step.correct_feedback : undefined,
    answerReveal: hasAnswered ? result!.answer_reveal : undefined,
    widgetAnswerKey: hasAnswered ? extractWidgetAnswerKey(step) : undefined,
    evaluatorFeedback: hasAnswered ? result!.feedback : undefined,
  }
}

/** Flattens a LessonCoachContext into the plain dict shape
 *  backend/app/engines/learn/coach_context.py expects — field names match
 *  ANSWER_KEY_FIELDS / the existing context-string builder in ai_coach.py so
 *  no server-side change is needed to recognize them. */
export function toCoachApiContext(ctx: LessonCoachContext): Record<string, unknown> {
  return {
    lessonId: ctx.lessonId,
    lesson_title: ctx.lessonTitle,
    moduleId: ctx.moduleId,
    stepId: ctx.stepId,
    step_type: ctx.stepType,
    concept_ids: ctx.conceptIds,
    narrative: ctx.narrative,
    question: ctx.question,
    options: ctx.options,
    board: ctx.poker.board,
    hero_position: ctx.poker.heroPosition,
    villain_position: ctx.poker.villainPosition,
    hero_hand: ctx.poker.heroHand,
    pot_bb: ctx.poker.potBb,
    effective_stack_bb: ctx.poker.effectiveStackBb,
    street: ctx.poker.street,
    table_size: ctx.poker.tableSize,
    ante_bb: ctx.poker.anteBb,
    action_before_hero: ctx.poker.actionBeforeHero,
    range_context: ctx.rangeContext,
    scenario: ctx.scenario,
    hint_level: ctx.hintLevel || undefined,
    user_action: ctx.selectedAnswer != null ? String(ctx.selectedAnswer) : undefined,
    correctAnswer: ctx.correctAnswer,
    correct_feedback: ctx.correctFeedback,
    answer_reveal: ctx.answerReveal,
    widget_answer_key: ctx.widgetAnswerKey,
    evaluator_feedback: ctx.evaluatorFeedback,
  }
}

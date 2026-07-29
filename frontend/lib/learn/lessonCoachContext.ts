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
  hintLevel: number
  hasAnswered: boolean
  selectedAnswer?: unknown
  isCorrect?: boolean
  /** Only ever populated when `hasAnswered` — still independently stripped
   *  server-side regardless of what's sent (see module docstring). */
  correctAnswer?: string
  correctFeedback?: string
  answerReveal?: StepResult['answer_reveal']
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
    hintLevel,
    hasAnswered,
    selectedAnswer: hasAnswered ? selectedAnswer : undefined,
    isCorrect: hasAnswered ? result!.quality === 'perfect' || result!.quality === 'good' : undefined,
    correctAnswer: hasAnswered ? step.correct_answer : undefined,
    correctFeedback: hasAnswered ? step.correct_feedback : undefined,
    answerReveal: hasAnswered ? result!.answer_reveal : undefined,
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
    hint_level: ctx.hintLevel || undefined,
    user_action: ctx.selectedAnswer != null ? String(ctx.selectedAnswer) : undefined,
    correctAnswer: ctx.correctAnswer,
    correct_feedback: ctx.correctFeedback,
    answer_reveal: ctx.answerReveal,
  }
}

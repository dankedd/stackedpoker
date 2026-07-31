/**
 * Tests for the AI Coach's client-side context builder — the structured
 * payload sent with every /coach/message request while inside a lesson step.
 *
 * Mirrors backend/tests/test_coach.py's answer-leak philosophy on the client
 * side: answer-key-shaped fields (correctAnswer/correct_feedback/answer_reveal)
 * must never even be POPULATED in the built context before the step is
 * answered — a second line of defense on top of the server's own
 * sanitize_context (see coach_context.py), which strips them regardless of
 * what the client sends.
 */
import { describe, it, expect } from 'vitest'
import { buildLessonCoachContext, toCoachApiContext } from '../lessonCoachContext'
import type { Lesson, LessonStep, StepResult } from '../types'

const lesson: Lesson = {
  id: 'lesson-1',
  slug: 'lesson-1',
  module_id: 'module-8',
  path_id: 'path-1',
  title: 'Range vs Range',
  lesson_type: 'micro',
  difficulty: 'beginner',
  estimated_min: 5,
  xp_reward: 20,
  concept_ids: ['range_advantage'],
  steps: [],
} as unknown as Lesson

const decisionStep: LessonStep = {
  id: 'step-1',
  type: 'decision_spot',
  concept_ids: ['range_advantage'],
  narrative: 'BTN opens, BB calls. Flop comes A-7-6 two-tone.',
  decision_spot_question: 'Who has the range advantage?',
  board: ['Ad', '7h', '6c'],
  hero_position: 'BTN',
  villain_position: 'BB',
  pot_bb: 6,
  effective_stack_bb: 100,
  street: 'flop',
  options: [
    { id: 'btn', label: 'BTN', quality: 'perfect', feedback: 'Correct.' },
    { id: 'bb', label: 'BB', quality: 'punt', feedback: 'Not favored.' },
  ],
  correct_answer: 'btn',
  correct_feedback: 'BTN retains more overpairs on this board.',
}

function makeResult(overrides: Partial<StepResult> = {}): StepResult {
  return {
    score: 100,
    quality: 'perfect',
    ev_loss_bb: 0,
    feedback: 'Nice.',
    xp_earned: 10,
    level_before: 1,
    level_after: 1,
    leveled_up: false,
    evaluation_source: 'heuristic',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
    ...overrides,
  } as StepResult
}

describe('buildLessonCoachContext — pre-answer', () => {
  it('marks hasAnswered false and omits selectedAnswer/answer-key fields when result is null', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(ctx.hasAnswered).toBe(false)
    expect(ctx.isCorrect).toBeUndefined()
    expect(ctx.selectedAnswer).toBeUndefined()
    expect(ctx.correctAnswer).toBeUndefined()
    expect(ctx.correctFeedback).toBeUndefined()
    expect(ctx.answerReveal).toBeUndefined()
  })

  it('never populates answer-key fields in the API-bound context pre-answer', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    const api = toCoachApiContext(ctx)
    expect(api.correctAnswer).toBeUndefined()
    expect(api.correct_feedback).toBeUndefined()
    expect(api.answer_reveal).toBeUndefined()
  })

  it('carries question/options/poker state but never quality/feedback per-option data', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(ctx.question).toBe('Who has the range advantage?')
    expect(ctx.options).toEqual([
      { id: 'btn', label: 'BTN' },
      { id: 'bb', label: 'BB' },
    ])
    expect(ctx.poker.board).toEqual(['Ad', '7h', '6c'])
    expect(ctx.poker.heroPosition).toBe('BTN')
  })

  it('an unscored/passive step never counts as answered even with a result present', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, makeResult({ unscored: true }), 'btn', 0)
    expect(ctx.hasAnswered).toBe(false)
  })
})

describe('buildLessonCoachContext — post-answer', () => {
  it('populates answer-key fields only once a real (scored) result exists', () => {
    const result = makeResult({ quality: 'perfect' })
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, result, 'btn', 0)
    expect(ctx.hasAnswered).toBe(true)
    expect(ctx.isCorrect).toBe(true)
    expect(ctx.selectedAnswer).toBe('btn')
    expect(ctx.correctAnswer).toBe('btn')
    expect(ctx.correctFeedback).toBe('BTN retains more overpairs on this board.')
  })

  it('marks isCorrect false for a mistake/punt quality result', () => {
    const result = makeResult({ quality: 'punt' })
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, result, 'bb', 0)
    expect(ctx.isCorrect).toBe(false)
  })

  it('forwards answer-key fields into the API-bound context once answered', () => {
    const result = makeResult({ quality: 'punt' })
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, result, 'bb', 0)
    const api = toCoachApiContext(ctx)
    expect(api.correctAnswer).toBe('btn')
    expect(api.correct_feedback).toBe('BTN retains more overpairs on this board.')
  })
})

describe('buildLessonCoachContext — range context', () => {
  it('extracts range_compare_a/b when present, never fabricating equity', () => {
    const rangeStep: LessonStep = {
      ...decisionStep,
      type: 'range_compare',
      range_compare_a: { label: 'BTN', range: ['AA', 'KK'] },
      range_compare_b: { label: 'BB', range: ['22', '33'] },
    }
    const ctx = buildLessonCoachContext(lesson, rangeStep, 0, null, undefined, 0)
    expect(ctx.rangeContext).toEqual({
      a: { label: 'BTN', range: ['AA', 'KK'] },
      b: { label: 'BB', range: ['22', '33'] },
    })
  })

  it('omits rangeContext entirely when the step has no range-vs-range fields', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(ctx.rangeContext).toBeUndefined()
  })
})

describe('buildLessonCoachContext — concept ids fallback', () => {
  it('falls back to the lesson-level concept_ids when the step has none', () => {
    const stepWithoutConcepts: LessonStep = { ...decisionStep, concept_ids: undefined }
    const ctx = buildLessonCoachContext(lesson, stepWithoutConcepts, 0, null, undefined, 0)
    expect(ctx.conceptIds).toEqual(['range_advantage'])
  })
})

describe('buildLessonCoachContext — step/lesson change isolation', () => {
  it('produces a distinct stepId/lessonId identity for a different step in the same lesson', () => {
    const step2: LessonStep = { ...decisionStep, id: 'step-2', decision_spot_question: 'A different question' }
    const ctxA = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    const ctxB = buildLessonCoachContext(lesson, step2, 1, null, undefined, 0)
    // This is exactly what LessonCoachDrawer keys its CoachChat thread on
    // (`${lessonId}:${stepId}`) — a differing identity is what forces a
    // fresh conversation instead of leaking the previous step's context.
    expect(`${ctxA.lessonId}:${ctxA.stepId}`).not.toBe(`${ctxB.lessonId}:${ctxB.stepId}`)
    expect(ctxB.question).toBe('A different question')
  })

  it('produces a distinct identity for the same step id in a different lesson', () => {
    const otherLesson: Lesson = { ...lesson, id: 'lesson-2', title: 'A Different Lesson' }
    const ctxA = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    const ctxB = buildLessonCoachContext(otherLesson, decisionStep, 0, null, undefined, 0)
    expect(`${ctxA.lessonId}:${ctxA.stepId}`).not.toBe(`${ctxB.lessonId}:${ctxB.stepId}`)
  })
})

describe('buildLessonCoachContext — no fabricated data', () => {
  it('never invents an equity/frequency-shaped field when the step carries none', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    const api = toCoachApiContext(ctx)
    const serialized = JSON.stringify(api)
    expect(serialized).not.toMatch(/equity|frequency|%/i)
    expect(ctx.rangeContext).toBeUndefined()
  })
})

describe('buildLessonCoachContext — scenario: generic widget capture', () => {
  const potOddsStep: LessonStep = {
    id: 'pot-odds-1',
    type: 'pot_odds_explorer',
    concept_ids: ['pot_odds'],
    pot_odds_explorer_mode: 'challenge',
    pot_odds_pot: 20,
    pot_odds_bet: 10,
    pot_odds_prompt: 'What equity do you need to profitably call?',
    pot_odds_correct: 33.3,
    pot_odds_tolerance: 2,
  }

  it("a non-decision_spot widget step's own prompt/data fields reach `scenario`, always (not gated by hasAnswered)", () => {
    const ctx = buildLessonCoachContext(lesson, potOddsStep, 0, null, undefined, 0)
    expect(ctx.scenario).toMatchObject({
      pot_odds_explorer_mode: 'challenge',
      pot_odds_pot: 20,
      pot_odds_bet: 10,
      pot_odds_prompt: 'What equity do you need to profitably call?',
      pot_odds_tolerance: 2,
    })
  })

  it('the answer-key field (pot_odds_correct) never appears in `scenario`, pre- or post-answer', () => {
    const preAnswer = buildLessonCoachContext(lesson, potOddsStep, 0, null, undefined, 0)
    expect(preAnswer.scenario).not.toHaveProperty('pot_odds_correct')

    const postAnswer = buildLessonCoachContext(lesson, potOddsStep, 0, makeResult(), 33, 0)
    expect(postAnswer.scenario).not.toHaveProperty('pot_odds_correct')
  })

  it('the answer-key field only appears in `widgetAnswerKey`, and only once answered', () => {
    const preAnswer = buildLessonCoachContext(lesson, potOddsStep, 0, null, undefined, 0)
    expect(preAnswer.widgetAnswerKey).toBeUndefined()

    const postAnswer = buildLessonCoachContext(lesson, potOddsStep, 0, makeResult(), 33, 0)
    expect(postAnswer.widgetAnswerKey).toEqual({ pot_odds_correct: 33.3 })
  })

  it('a field not matching the _correct/_target suffix convention (equity_actual) is still classified as answer-key', () => {
    const equityStep: LessonStep = {
      id: 'equity-1',
      type: 'equity_predict',
      equity_actual: 62,
      equity_tolerance: 5,
      equity_villain_range: ['KK', 'AKs'],
    }
    const preAnswer = buildLessonCoachContext(lesson, equityStep, 0, null, undefined, 0)
    expect(preAnswer.scenario).not.toHaveProperty('equity_actual')
    expect(preAnswer.scenario).toMatchObject({ equity_tolerance: 5, equity_villain_range: ['KK', 'AKs'] })

    const postAnswer = buildLessonCoachContext(lesson, equityStep, 0, makeResult(), 60, 0)
    expect(postAnswer.widgetAnswerKey).toEqual({ equity_actual: 62 })
  })

  it('never duplicates a field already surfaced by a dedicated context property (board/narrative/options/etc.)', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(ctx.scenario).toBeUndefined() // decisionStep has nothing beyond already-named fields
  })

  it("remediation_ladder (an array of OTHER steps' own answer keys) is never swept into scenario", () => {
    const stepWithLadder: LessonStep = {
      ...potOddsStep,
      remediation_ladder: [{ id: 'remedial-1', type: 'decision_spot', correct_answer: 'SHOULD-NOT-LEAK' } as LessonStep],
    }
    const ctx = buildLessonCoachContext(lesson, stepWithLadder, 0, null, undefined, 0)
    expect(JSON.stringify(ctx.scenario)).not.toMatch(/SHOULD-NOT-LEAK/)
  })
})

describe('buildLessonCoachContext — evaluatorFeedback (per-attempt grading feedback)', () => {
  it('is undefined pre-answer', () => {
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(ctx.evaluatorFeedback).toBeUndefined()
  })

  it("mirrors the actual attempt's StepResult.feedback once answered — distinct from the authored correctFeedback", () => {
    const result = makeResult({ feedback: 'You called off with a hand that has almost no fold equity here.' })
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, result, 'bb', 0)
    expect(ctx.evaluatorFeedback).toBe('You called off with a hand that has almost no fold equity here.')
    expect(ctx.evaluatorFeedback).not.toBe(ctx.correctFeedback)
  })

  it('forwards into the API context as `evaluator_feedback` — the exact key ai_coach.py reads', () => {
    const result = makeResult({ feedback: 'Solid read, wrong sizing.' })
    const ctx = buildLessonCoachContext(lesson, decisionStep, 0, result, 'btn', 0)
    const api = toCoachApiContext(ctx)
    expect(api.evaluator_feedback).toBe('Solid read, wrong sizing.')
  })
})

describe('toCoachApiContext — hint level', () => {
  it('omits hint_level when zero (falsy), includes it when set', () => {
    const noHint = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 0)
    expect(toCoachApiContext(noHint).hint_level).toBeUndefined()

    const withHint = buildLessonCoachContext(lesson, decisionStep, 0, null, undefined, 2)
    expect(toCoachApiContext(withHint).hint_level).toBe(2)
  })
})

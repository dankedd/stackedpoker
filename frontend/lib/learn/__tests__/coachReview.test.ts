/**
 * Coach Review must derive strengths/weaknesses/mistakes ONLY from the
 * learner's actual StepResult[] for a completed lesson — never manufacture
 * a weakness that wasn't demonstrated, and never include a concept that
 * was never exercised by a graded step.
 */
import { describe, it, expect } from 'vitest'
import { buildLessonReviewContext } from '../coachReview'
import type { Lesson, LessonStep, StepResult } from '../types'

function step(id: string, conceptIds: string[]): LessonStep {
  return { id, type: 'decision_spot', concept_ids: conceptIds }
}

function result(overrides: Partial<StepResult> = {}): StepResult {
  return {
    score: 100,
    quality: 'perfect',
    ev_loss_bb: 0,
    feedback: '',
    xp_earned: 10,
    level_before: 1,
    level_after: 1,
    leveled_up: false,
    evaluation_source: 'client',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
    ...overrides,
  } as StepResult
}

function lesson(steps: LessonStep[], conceptIds: string[]): Lesson {
  return {
    id: 'lesson-x',
    module_id: 'module-x',
    slug: 'lesson-x',
    title: 'Think in Ranges',
    lesson_type: 'micro',
    concept_ids: conceptIds,
    steps,
    estimated_min: 5,
    xp_reward: 100,
    sort_order: 1,
  } as Lesson
}

describe('buildLessonReviewContext', () => {
  it('labels a concept strong only when its steps actually scored high', () => {
    const l = lesson(
      [step('s1', ['range_morphology']), step('s2', ['range_morphology'])],
      ['range_morphology'],
    )
    const results = [result({ score: 90 }), result({ score: 85 })]

    const review = buildLessonReviewContext(l, results, 100)

    expect(review.strongConcepts).toEqual(['range_morphology'])
    expect(review.weakConcepts).toEqual([])
  })

  it('labels a concept weak only when its steps actually scored low', () => {
    const l = lesson(
      [step('s1', ['range_morphology']), step('s2', ['range_morphology'])],
      ['range_morphology'],
    )
    const results = [
      result({ score: 30, feedback: 'Left a gap between value and bluffs.', concept_triggered: 'range_morphology' }),
      result({ score: 40 }),
    ]

    const review = buildLessonReviewContext(l, results, 100)

    expect(review.weakConcepts).toEqual(['range_morphology'])
    expect(review.strongConcepts).toEqual([])
    expect(review.mistakes).toHaveLength(2)
    expect(review.mistakes[0].feedback).toContain('gap between value and bluffs')
  })

  it('never labels a concept that no graded step actually exercised', () => {
    // lesson.concept_ids lists a concept, but no step carries it and no
    // result touches it — must not appear as strong OR weak.
    const l = lesson([step('s1', ['hand_rankings'])], ['hand_rankings', 'never_tested_concept'])
    const results = [result({ score: 95 })]

    const review = buildLessonReviewContext(l, results, 50)

    expect(review.strongConcepts).toEqual(['hand_rankings'])
    expect(review.weakConcepts).not.toContain('never_tested_concept')
    expect(review.strongConcepts).not.toContain('never_tested_concept')
  })

  it('excludes unscored/invalid steps from both scoring and concept averages', () => {
    const l = lesson(
      [step('s1', ['concept_a']), step('s2', ['concept_a'])],
      ['concept_a'],
    )
    const results = [
      result({ score: 0, unscored: true }), // passive/theory step — must not drag the average down
      result({ score: 90 }),
    ]

    const review = buildLessonReviewContext(l, results, 20)

    expect(review.avgScore).toBe(90) // not (0+90)/2
    expect(review.strongConcepts).toEqual(['concept_a'])
  })

  it('caps mistakes and sorts worst-first', () => {
    const steps = Array.from({ length: 7 }, (_, i) => step(`s${i}`, ['c']))
    const results = steps.map((_, i) => result({ score: 50 - i })) // 50,49,...,44 — all "weak"

    const l = lesson(steps, ['c'])
    const review = buildLessonReviewContext(l, results, 0)

    expect(review.mistakes).toHaveLength(5)
    expect(review.mistakes[0].score).toBe(44) // worst first
    expect(review.mistakes[4].score).toBe(48)
  })

  it('returns no mistakes and no weak concepts for a flawless lesson', () => {
    const l = lesson([step('s1', ['c'])], ['c'])
    const results = [result({ score: 100 })]

    const review = buildLessonReviewContext(l, results, 10)

    expect(review.mistakes).toEqual([])
    expect(review.weakConcepts).toEqual([])
  })
})

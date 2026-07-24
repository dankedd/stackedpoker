/**
 * Derives a Coach Review context from a learner's ACTUAL completed-lesson
 * performance (lesson + StepResult[]) — never fabricated. Sent to the AI
 * Coach as `context.lessonReview` so it can open with a personalized recap
 * instead of a blank chatbot. See backend/app/engines/learn/coach_context.py
 * for the server-side handling of this shape.
 */

import type { Lesson, StepResult } from './types'

export interface CoachLessonReviewMistake {
  stepType: string
  conceptId?: string
  score: number
  feedback: string
}

export interface CoachLessonReviewContext {
  lessonId: string
  lessonTitle: string
  moduleId?: string
  totalXP: number
  avgScore: number
  /** Concepts averaging >=80 across the steps that actually exercised them. */
  strongConcepts: string[]
  /** Concepts averaging <60 across the steps that actually exercised them. */
  weakConcepts: string[]
  /** Worst-scoring graded steps, capped so the payload stays small. */
  mistakes: CoachLessonReviewMistake[]
}

const STRONG_THRESHOLD = 80
const WEAK_THRESHOLD = 60
const MAX_MISTAKES = 5

export function buildLessonReviewContext(
  lesson: Lesson,
  results: StepResult[],
  totalXP: number,
): CoachLessonReviewContext {
  const validResults = results.filter((r) => r.evaluation_valid !== false && !r.unscored)
  const avgScore =
    validResults.length > 0
      ? Math.round(validResults.reduce((s, r) => s + r.score, 0) / validResults.length)
      : 100

  // Only concepts actually exercised by a graded step get a strong/weak
  // label — a concept_id listed on the lesson but never tested is neither.
  const conceptScores: Record<string, number[]> = {}
  lesson.steps.forEach((step, i) => {
    const r = results[i]
    if (!r || r.evaluation_valid === false || r.unscored) return
    const ids = step.concept_ids?.length ? step.concept_ids : lesson.concept_ids
    ids.forEach((id) => {
      if (!conceptScores[id]) conceptScores[id] = []
      conceptScores[id].push(r.score)
    })
  })

  const strongConcepts: string[] = []
  const weakConcepts: string[] = []
  for (const [id, scores] of Object.entries(conceptScores)) {
    if (scores.length === 0) continue
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (avg >= STRONG_THRESHOLD) strongConcepts.push(id)
    else if (avg < WEAK_THRESHOLD) weakConcepts.push(id)
  }

  const mistakes: CoachLessonReviewMistake[] = results
    .map((r, i) => ({ r, step: lesson.steps[i] }))
    .filter(({ r }) => r && r.evaluation_valid !== false && !r.unscored && r.score < WEAK_THRESHOLD)
    .sort((a, b) => a.r.score - b.r.score)
    .slice(0, MAX_MISTAKES)
    .map(({ r, step }) => ({
      stepType: step?.type ?? 'step',
      conceptId: r.concept_triggered ?? step?.concept_ids?.[0],
      score: r.score,
      feedback: (r.feedback ?? '').slice(0, 240),
    }))

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    moduleId: lesson.module_id,
    totalXP,
    avgScore,
    strongConcepts,
    weakConcepts,
    mistakes,
  }
}

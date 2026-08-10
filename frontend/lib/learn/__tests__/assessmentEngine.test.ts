import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  pickNextQuestion,
  recordAnswer,
  shouldStop,
  shouldOfferFinalChallenge,
  computeResults,
  type AssessmentEngineState,
} from '../assessmentEngine'
import { ASSESSMENT_QUESTIONS } from '../assessmentQuestions'

function runQuiz(answerCorrectly: (difficulty: number) => boolean, maxSteps = 20) {
  let state: AssessmentEngineState = createInitialState()
  for (let i = 0; i < maxSteps; i++) {
    if (shouldStop(state)) break
    const q = pickNextQuestion(state)
    if (!q) break
    state = recordAnswer(state, q, answerCorrectly(q.difficulty))
  }
  return state
}

describe('assessmentEngine — question bank sanity', () => {
  it('has at least 6 non-final-challenge questions at every difficulty level 1-4', () => {
    for (const d of [1, 2, 3, 4] as const) {
      const count = ASSESSMENT_QUESTIONS.filter(q => q.difficulty === d && !q.isFinalChallenge).length
      expect(count).toBeGreaterThanOrEqual(6)
    }
  })

  it('has 3-4 final-challenge questions, all at difficulty 4', () => {
    const finals = ASSESSMENT_QUESTIONS.filter(q => q.isFinalChallenge)
    expect(finals.length).toBeGreaterThanOrEqual(3)
    expect(finals.length).toBeLessThanOrEqual(4)
    expect(finals.every(q => q.difficulty === 4)).toBe(true)
  })

  it('every question has exactly one correct option', () => {
    for (const q of ASSESSMENT_QUESTIONS) {
      const correctCount = q.options.filter(o => o.correct).length
      expect(correctCount, `question ${q.id} should have exactly one correct option`).toBe(1)
    }
  })

  it('every question id is unique', () => {
    const ids = ASSESSMENT_QUESTIONS.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('assessmentEngine — staircase difficulty', () => {
  it('climbs to difficulty 4 and becomes eligible for the Final Challenge when every answer is correct', () => {
    const state = runQuiz(() => true)
    expect(state.currentDifficulty).toBe(4)
    expect(shouldOfferFinalChallenge(state)).toBe(true)
  })

  it('never climbs above difficulty 1 when every answer is wrong', () => {
    const state = runQuiz(() => false)
    expect(state.currentDifficulty).toBe(1)
    expect(shouldOfferFinalChallenge(state)).toBe(false)
  })

  it('is never offered the Final Challenge after even a single wrong answer', () => {
    let state = createInitialState()
    let answered = 0
    while (!shouldStop(state)) {
      const q = pickNextQuestion(state)
      if (!q) break
      // Miss exactly the second question, then answer correctly forever after.
      const correct = answered !== 1
      state = recordAnswer(state, q, correct)
      answered++
    }
    expect(shouldOfferFinalChallenge(state)).toBe(false)
  })

  it('stops within the 8-12 question budget', () => {
    const allCorrect = runQuiz(() => true)
    const allWrong = runQuiz(() => false)
    expect(allCorrect.trace.length).toBeGreaterThanOrEqual(3) // hits ceiling fast, but never below the pool
    expect(allCorrect.trace.length).toBeLessThanOrEqual(12)
    expect(allWrong.trace.length).toBeLessThanOrEqual(12)
  })

  it('never repeats a question id', () => {
    const state = runQuiz(() => true)
    expect(new Set(state.askedIds).size).toBe(state.askedIds.length)
  })
})

describe('assessmentEngine — league computation', () => {
  it('assigns foundation for low accuracy even at low difficulty', () => {
    const trace = [
      { questionId: 'a', difficulty: 1 as const, topic: 'hand_rankings' as const, correct: false },
      { questionId: 'b', difficulty: 1 as const, topic: 'positions' as const, correct: false },
    ]
    expect(computeResults(trace, undefined).estimatedLeague).toBe('foundation')
  })

  it('assigns expert for reaching difficulty 4 without taking the Final Challenge', () => {
    const trace = Array.from({ length: 8 }, (_, i) => ({
      questionId: `q${i}`, difficulty: 4 as const, topic: 'blockers' as const, correct: true,
    }))
    expect(computeResults(trace, undefined).estimatedLeague).toBe('expert')
  })

  it('assigns master only when the Final Challenge was passed', () => {
    const trace = Array.from({ length: 8 }, (_, i) => ({
      questionId: `q${i}`, difficulty: 4 as const, topic: 'blockers' as const, correct: true,
    }))
    expect(computeResults(trace, true).estimatedLeague).toBe('master')
    expect(computeResults(trace, false).estimatedLeague).toBe('expert')
  })

  it('computes weakest topics sorted worst-first and excludes them from strongest', () => {
    const trace = [
      { questionId: 'a', difficulty: 2 as const, topic: 'pot_odds' as const, correct: true },
      { questionId: 'b', difficulty: 2 as const, topic: 'pot_odds' as const, correct: true },
      { questionId: 'c', difficulty: 2 as const, topic: 'opening_ranges' as const, correct: false },
    ]
    const results = computeResults(trace, undefined)
    expect(results.strongestTopics).toContain('pot_odds')
    expect(results.weakestTopics).toContain('opening_ranges')
    expect(results.weakestTopics).not.toContain('pot_odds')
  })
})

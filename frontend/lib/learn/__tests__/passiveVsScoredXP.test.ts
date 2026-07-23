/**
 * Regression tests for the passive-content XP bug: theory/exploration steps
 * (concept_reveal, and the unscored exploration modes of the various
 * visualizer step types) were being silently fabricated a "perfect" 100
 * score and full XP, indistinguishable from a genuinely answered question.
 *
 * The fix introduces `isScoredStep()` as the single source of truth for
 * "does this step have anything to grade," and `evaluateStepLocally()` now
 * returns `unscored: true` / `xp_earned: 0` for anything it says no to,
 * regardless of the step's authored `xp` value.
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally, isScoredStep } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

describe('concept_reveal: passive content never earns XP or a fake score', () => {
  const step = findStep('c1-s1') // concept_reveal, visual: 'table', authored xp: 2

  it('is classified as unscored', () => {
    expect(isScoredStep(step)).toBe(false)
  })

  it('evaluateStepLocally returns unscored:true with 0 XP, no matter the authored step.xp', () => {
    expect(step.xp).toBeGreaterThan(0) // sanity: this step DOES carry an xp value in curriculum.ts
    const result = evaluateStepLocally(step, null, 0)
    expect(result.unscored).toBe(true)
    expect(result.xp_earned).toBe(0)
    expect(result.leveled_up).toBe(false)
  })

  it('never leaks a fake "Perfect Play"/100 score into anything consuming score directly', () => {
    // score/quality are meaningless placeholders on an unscored result — callers
    // must gate on `unscored`, not treat this score as a real grade. This locks
    // the placeholder shape so a future change can't silently start treating
    // it as a real 100.
    const result = evaluateStepLocally(step, null, 0)
    expect(result.score).toBe(0)
  })
})

describe('exploration-mode visualizers: no XP merely for exploring', () => {
  it.each([
    ['position_table explore mode', 'c1-s2'],
    ['combo_visualizer reveal mode', 'c6-s27'],
    ['spr_visualizer worlds mode', 'c8-s45'],
  ])('%s (%s) is unscored and earns 0 XP', (_label, id) => {
    const step = findStep(id)
    expect(isScoredStep(step)).toBe(false)
    const result = evaluateStepLocally(step, null, 0)
    expect(result.unscored).toBe(true)
    expect(result.xp_earned).toBe(0)
  })
})

describe('challenge-mode counterparts of the same components: XP awarded when solved correctly', () => {
  it('position_table quiz mode (c1-s3) is scored, and a correct pick earns full XP', () => {
    const step = findStep('c1-s3')
    expect(isScoredStep(step)).toBe(true)
    const correctOptionId = step.options?.find((o) => o.quality === 'perfect')?.id
    expect(correctOptionId).toBeTruthy()
    const result = evaluateStepLocally(step, correctOptionId, 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).toBe('perfect')
    expect(result.xp_earned).toBe(step.xp)
  })

  it('combo_visualizer quiz mode (c6-s27b) is scored, and answering correctly earns full XP', () => {
    const step = findStep('c6-s27b')
    expect(isScoredStep(step)).toBe(true)
    expect(step.combo_visualizer_correct).toBe(6)
    const result = evaluateStepLocally(step, 6, 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).toBe('perfect')
    expect(result.xp_earned).toBe(step.xp)
  })

  it('spr_visualizer scenario mode (c8-s43) is scored, and answering correctly earns full XP', () => {
    const step = findStep('c8-s43')
    expect(isScoredStep(step)).toBe(true)
    expect(step.spr_visualizer_correct).toBe(8)
    const result = evaluateStepLocally(step, 8, 0)
    expect(result.unscored).toBe(false)
    expect(result.xp_earned).toBe(step.xp)
  })
})

describe('scored questions: correct vs incorrect XP', () => {
  // Synthetic, tightly-controlled fixture — real curriculum content shifts over
  // time, but the correct/incorrect XP contract itself should not depend on it.
  const step: LessonStep = {
    id: 'test-decision',
    type: 'decision_spot',
    xp: 10,
    options: [
      { id: 'right', label: 'Right', quality: 'perfect', feedback: 'Correct.' },
      { id: 'wrong', label: 'Wrong', quality: 'punt', feedback: 'Incorrect.' },
    ],
  }

  it('a correct answer is scored, not unscored, and earns the configured XP', () => {
    const result = evaluateStepLocally(step, 'right', 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).toBe('perfect')
    expect(result.score).toBe(100)
    expect(result.xp_earned).toBe(10)
  })

  it('a wrong answer earns 0 XP but is still a real (non-unscored) graded result with feedback', () => {
    const result = evaluateStepLocally(step, 'wrong', 0)
    expect(result.unscored).toBe(false)
    expect(result.quality).toBe('punt')
    expect(result.xp_earned).toBe(0)
    expect(result.feedback).toBe('Incorrect.')
  })

  it('a wrong answer never produces negative XP (no punishing existing XP)', () => {
    const result = evaluateStepLocally(step, 'wrong', 500)
    expect(result.xp_earned).toBeGreaterThanOrEqual(0)
    expect(result.level_after).toBeGreaterThanOrEqual(result.level_before)
  })
})

describe('isScoredStep / evaluateStepLocally agree for every step in the curriculum', () => {
  it('no unscored step ever produces nonzero XP, and every unscored step is flagged unscored', () => {
    for (const step of ALL_STEPS) {
      const scored = isScoredStep(step)
      const result = evaluateStepLocally(step, null, 0)
      if (!scored) {
        expect(result.unscored, `${step.id} (${step.type}) should be unscored`).toBe(true)
        expect(result.xp_earned, `${step.id} (${step.type}) should earn 0 XP unscored`).toBe(0)
      } else {
        expect(result.unscored, `${step.id} (${step.type}) should NOT be unscored`).toBe(false)
      }
    }
  })
})

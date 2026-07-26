import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import type { ActionQuality, LessonStep, StepResult } from '../types'

/**
 * Regression coverage for the adaptive remediation engine after the removal
 * of the learner-facing confidence check (see MEMORY: confidence prompts
 * were removed globally). `shouldInjectRemediation`/`pickRemediationStep`/
 * `pickInjectedStep` used to take an optional `learnerConfidence` argument
 * that escalated the remediation ladder by an extra rung on a high-confidence
 * wrong answer. That input no longer exists anywhere in the system, so these
 * tests prove the ladder still advances correctly on miss count alone —
 * nothing was silently defaulted to a fabricated confidence value.
 */

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
}

const originalWindow = (globalThis as { window?: unknown }).window

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() })
})

afterAll(() => {
  if (originalWindow === undefined) {
    vi.unstubAllGlobals()
  } else {
    vi.stubGlobal('window', originalWindow)
  }
})

function stepResult(quality: ActionQuality): StepResult {
  return {
    score: 0,
    quality,
    ev_loss_bb: 0,
    feedback: '',
    xp_earned: 0,
    level_before: 0,
    level_after: 0,
    leveled_up: false,
    evaluation_source: 'heuristic',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
  }
}

function ladderStep(overrides: Partial<LessonStep> = {}): LessonStep {
  return {
    id: 'base-step',
    type: 'decision_spot',
    concept_ids: ['test_concept'],
    remediation_ladder: [
      { id: 'rung-1', type: 'concept_reveal' },
      { id: 'rung-2', type: 'concept_reveal' },
    ],
    ...overrides,
  }
}

describe('adaptiveEngine — remediation without a confidence input', () => {
  it('shouldInjectRemediation: fires on a first miss for a step with a ladder', async () => {
    const { shouldInjectRemediation, recordConceptResult } = await import('../adaptiveEngine')
    const step = ladderStep()
    recordConceptResult('test_concept', 'mistake')
    expect(shouldInjectRemediation(step, 'mistake')).toBe(true)
  })

  it('shouldInjectRemediation: never fires without a remediation_ladder', async () => {
    const { shouldInjectRemediation } = await import('../adaptiveEngine')
    const step = ladderStep({ remediation_ladder: undefined })
    expect(shouldInjectRemediation(step, 'mistake')).toBe(false)
  })

  it('shouldInjectRemediation: never fires on a correct answer', async () => {
    const { shouldInjectRemediation } = await import('../adaptiveEngine')
    const step = ladderStep()
    expect(shouldInjectRemediation(step, 'perfect')).toBe(false)
  })

  it('pickRemediationStep: picks the ladder rung matching the current miss count, purely from miss history', async () => {
    const { pickRemediationStep, recordConceptResult } = await import('../adaptiveEngine')
    const step = ladderStep()

    recordConceptResult('test_concept', 'mistake') // miss #1
    expect(pickRemediationStep(step)?.id).toBe('rung-1')

    recordConceptResult('test_concept', 'mistake') // miss #2
    expect(pickRemediationStep(step)?.id).toBe('rung-2')
  })

  it('pickRemediationStep: exhausts the ladder once miss count exceeds its length', async () => {
    const { shouldInjectRemediation, recordConceptResult } = await import('../adaptiveEngine')
    const step = ladderStep()

    recordConceptResult('test_concept', 'mistake')
    recordConceptResult('test_concept', 'mistake')
    recordConceptResult('test_concept', 'mistake') // miss #3 — ladder only has 2 rungs

    expect(shouldInjectRemediation(step, 'mistake')).toBe(false)
  })

  it('a correct answer resets the miss counter, so the ladder starts over next time', async () => {
    const { pickRemediationStep, recordConceptResult } = await import('../adaptiveEngine')
    const step = ladderStep()

    recordConceptResult('test_concept', 'mistake')
    recordConceptResult('test_concept', 'mistake')
    expect(pickRemediationStep(step)?.id).toBe('rung-2')

    recordConceptResult('test_concept', 'perfect') // clean pass — forgives prior misses
    recordConceptResult('test_concept', 'mistake')
    expect(pickRemediationStep(step)?.id).toBe('rung-1')
  })

  it('pickInjectedStep: returns the remediation rung on a miss, and null on a correct answer (no reinforcement path exists anymore)', async () => {
    const { pickInjectedStep, recordConceptResult } = await import('../adaptiveEngine')
    const step = ladderStep()
    recordConceptResult('test_concept', 'mistake')

    expect(pickInjectedStep(step, stepResult('mistake'))?.id).toBe('rung-1')
    expect(pickInjectedStep(step, stepResult('perfect'))).toBeNull()
  })
})

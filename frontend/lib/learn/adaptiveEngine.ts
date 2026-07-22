/**
 * Adaptive remediation engine.
 *
 * Local-only, like the rest of the learn engine (evaluator.ts) — no network
 * calls, no backend schema. Concept-miss counts persist in localStorage so
 * repeated misses on the same concept (e.g. "linear vs polarized") across a
 * session — or across return visits on the same browser — trigger a
 * different representation of the idea rather than the same question again.
 *
 * Steps opt in by authoring a `remediation_ladder` (ordered alternate
 * representations) and/or a `reinforcement_step` (a single short follow-up
 * for a correct-but-low-confidence answer). Most steps have neither and are
 * unaffected.
 */

import type { ActionQuality, LessonStep, StepResult } from './types'

const STORAGE_KEY = 'poker_learn_concept_misses'

type MissMap = Record<string, number>

function readMissMap(): MissMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MissMap) : {}
  } catch {
    return {}
  }
}

function writeMissMap(map: MissMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — degrade silently, no remediation persists
  }
}

/** Current miss count for a concept (0 if never missed / never seen). */
export function getConceptMisses(conceptId: string | undefined): number {
  if (!conceptId) return 0
  return readMissMap()[conceptId] ?? 0
}

/**
 * Record the outcome of a step tagged with `conceptId`.
 * Misses (mistake/punt) increment the counter; a correct answer (perfect/good)
 * resets it — a clean pass through the concept "forgives" earlier misses.
 */
export function recordConceptResult(conceptId: string | undefined, quality: ActionQuality): void {
  if (!conceptId) return
  const map = readMissMap()
  if (quality === 'mistake' || quality === 'punt') {
    map[conceptId] = (map[conceptId] ?? 0) + 1
  } else if (quality === 'perfect' || quality === 'good') {
    map[conceptId] = 0
  }
  writeMissMap(map)
}

/**
 * Should a remediation step be injected right after this miss?
 * Fires whenever the step carries a ladder and hasn't exhausted it. A
 * high-confidence wrong answer escalates by jumping an extra rung — the
 * learner was sure and still wrong, so a gentler nudge won't be enough.
 */
export function shouldInjectRemediation(
  step: LessonStep,
  quality: ActionQuality,
  learnerConfidence?: 'low' | 'medium' | 'high',
): boolean {
  if (quality !== 'mistake' && quality !== 'punt') return false
  const ladder = step.remediation_ladder
  if (!ladder || ladder.length === 0) return false
  const missCount = getConceptMisses(step.concept_ids?.[0])
  const effectiveIndex = learnerConfidence === 'high' ? missCount + 1 : missCount
  return effectiveIndex - 1 < ladder.length
}

/** Pick the next rung of the ladder for the current miss count (1-indexed → array index). */
export function pickRemediationStep(
  step: LessonStep,
  quality: ActionQuality,
  learnerConfidence?: 'low' | 'medium' | 'high',
): LessonStep | null {
  const ladder = step.remediation_ladder
  if (!ladder || ladder.length === 0) return null
  const missCount = getConceptMisses(step.concept_ids?.[0])
  const effectiveIndex = learnerConfidence === 'high' ? missCount + 1 : missCount
  const rung = ladder[Math.max(0, Math.min(effectiveIndex - 1, ladder.length - 1))]
  return rung ?? null
}

/** A short reinforcement step for a correct-but-low-confidence answer, if the step authored one. */
export function pickReinforcementStep(
  step: LessonStep,
  quality: ActionQuality,
  learnerConfidence?: 'low' | 'medium' | 'high',
): LessonStep | null {
  if (quality !== 'perfect' && quality !== 'good') return null
  if (learnerConfidence !== 'low') return null
  return step.reinforcement_step ?? null
}

/**
 * Single entry point for LessonPlayer: given the step just answered and its
 * result, return the extra step to insert right after it (remediation on a
 * miss, reinforcement on a low-confidence correct answer), or null if
 * nothing should be injected.
 */
export function pickInjectedStep(step: LessonStep, result: StepResult): LessonStep | null {
  const { quality, learner_confidence } = result
  if (shouldInjectRemediation(step, quality, learner_confidence)) {
    return pickRemediationStep(step, quality, learner_confidence)
  }
  return pickReinforcementStep(step, quality, learner_confidence)
}

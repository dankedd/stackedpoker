/**
 * Curriculum-level regression tests for the "prefilled foundation" system on
 * range_build steps. Complements rangePrefill.test.ts (pure state-transition
 * unit tests) with checks over the real curriculum data: every foundation
 * must be a genuine subset of its own step's target, must never be the whole
 * range, and must never exactly match a range_build target graded anywhere
 * else in the curriculum — see requirement 8 in the prefilled-foundation spec
 * and the sibling audits in module1Audit.test.ts / module3Audit.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { RANGE_TARGETS, RANGE_FOUNDATIONS } from '../ranges'
import { resolvePrefilledHands, resolveTargetHands } from '../rangePrefill'
import { expandHandClass } from '../combos'
import type { LessonStep } from '../types'

const allSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const rangeBuildSteps = allSteps.filter((s) => s.type === 'range_build')

function comboWeight(hands: string[]): number {
  return hands.reduce((sum, h) => sum + expandHandClass(h).length, 0)
}

describe('The Button open-range builder (fi-s7) has a foundation wired up', () => {
  it('fi-s7 defines a prefilled foundation with explanatory copy', () => {
    const step = rangeBuildSteps.find((s) => s.id === 'fi-s7')
    expect(step).toBeTruthy()
    expect(resolvePrefilledHands(step!).length).toBeGreaterThan(0)
    expect(step!.range_prefilled_note).toBeTruthy()
  })
})

describe('Every range_build foundation is a genuine subset of its own target', () => {
  it('never contains a hand outside the graded target range', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = resolvePrefilledHands(step)
      if (foundation.length === 0) continue
      const target = new Set(resolveTargetHands(step))
      for (const h of foundation) {
        if (!target.has(h)) offenders.push(`${step.id}: prefilled hand "${h}" is not in the graded target`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('Prefilling never covers the whole range — the boundary decision must survive', () => {
  it('foundation hand count is strictly smaller than the target hand count', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = resolvePrefilledHands(step)
      if (foundation.length === 0) continue
      const target = resolveTargetHands(step)
      if (foundation.length >= target.length) {
        offenders.push(`${step.id}: foundation (${foundation.length}) is not smaller than target (${target.length})`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('foundation covers a minority of the target\'s combo-weighted mass (<=60%)', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = resolvePrefilledHands(step)
      if (foundation.length === 0) continue
      const targetWeight = comboWeight(resolveTargetHands(step))
      const foundationWeight = comboWeight(foundation)
      const pct = targetWeight > 0 ? foundationWeight / targetWeight : 0
      if (pct > 0.6) offenders.push(`${step.id}: foundation covers ${(pct * 100).toFixed(0)}% of target combos`)
    }
    expect(offenders).toEqual([])
  })
})

describe('Answer leakage — no foundation exactly matches a graded range_build target anywhere in the curriculum', () => {
  // Every RANGE_TARGETS value AND every inline range_combos used as a grading
  // target anywhere in the curriculum — a foundation matching one of these
  // exactly would hand the learner that step's (or a later step's) answer.
  const gradedTargetSets: { key: string; set: Set<string> }[] = [
    ...Object.entries(RANGE_TARGETS).map(([key, hands]) => ({ key, set: new Set(hands) })),
    ...rangeBuildSteps
      .filter((s) => Array.isArray(s.range_combos) && s.range_combos.length > 0)
      .map((s) => ({ key: `${s.id} (inline range_combos)`, set: new Set(s.range_combos!) })),
  ]

  it('has at least one graded target to check against (sanity)', () => {
    expect(gradedTargetSets.length).toBeGreaterThan(0)
  })

  it('no named RANGE_FOUNDATIONS entry is an exact-set match for any graded target', () => {
    const offenders: string[] = []
    for (const [foundationKey, hands] of Object.entries(RANGE_FOUNDATIONS)) {
      const foundationSet = new Set(hands)
      for (const { key, set } of gradedTargetSets) {
        if (foundationSet.size > 0 && foundationSet.size === set.size && [...foundationSet].every((h) => set.has(h))) {
          offenders.push(`foundation "${foundationKey}" is identical to graded target "${key}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no step-level resolved prefilled range is an exact-set match for any graded target', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = resolvePrefilledHands(step)
      if (foundation.length === 0) continue
      const foundationSet = new Set(foundation)
      for (const { key, set } of gradedTargetSets) {
        if (foundationSet.size === set.size && [...foundationSet].every((h) => set.has(h))) {
          offenders.push(`${step.id}: prefilled foundation is identical to graded target "${key}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

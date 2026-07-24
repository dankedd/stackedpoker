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

// Every range_build step that intentionally ships with NO prefill, plus why.
// A step landing here is a conscious pedagogical call, not a gap — see the
// "no accidental gaps" describe block below, which fails the build the
// moment a NEW range_build step appears without either a foundation or an
// entry (and reason) in this map.
const INTENTIONALLY_UNPREFILLED: Record<string, string> = {
  'bos-s3': "target IS the 'obvious core' itself — prefilling would hand over ~100% of the answer",
  'sqz-s7a': 'target is already a minimal curated 9-hand squeeze range — no room for a foundation that leaves a real decision',
}

describe('The Button open-range builder (fi-s7) has a foundation wired up', () => {
  it('fi-s7 defines a prefilled foundation with explanatory copy', () => {
    const step = rangeBuildSteps.find((s) => s.id === 'fi-s7')
    expect(step).toBeTruthy()
    expect(resolvePrefilledHands(step!).length).toBeGreaterThan(0)
    expect(step!.range_prefilled_note).toBeTruthy()
  })
})

describe('Every range_prefilled_key on a step resolves to a real, non-empty foundation', () => {
  it('RANGE_FOUNDATIONS has an entry for every range_prefilled_key referenced in the curriculum', () => {
    const offenders: string[] = []
    for (const step of allSteps) {
      if (!step.range_prefilled_key) continue
      const hands = RANGE_FOUNDATIONS[step.range_prefilled_key]
      if (!hands || hands.length === 0) {
        offenders.push(`${step.id}: range_prefilled_key "${step.range_prefilled_key}" does not resolve to a non-empty foundation`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('No range_build step is silently left without a prefill decision', () => {
  it('every range_build step either has a resolvable foundation or an explicit documented reason', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const hasFoundation = resolvePrefilledHands(step).length > 0
      const isDocumented = step.id in INTENTIONALLY_UNPREFILLED
      if (!hasFoundation && !isDocumented) {
        offenders.push(`${step.id}: no foundation configured and not listed in INTENTIONALLY_UNPREFILLED`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every documented "intentionally unprefilled" id still exists and is still actually unprefilled', () => {
    const offenders: string[] = []
    for (const id of Object.keys(INTENTIONALLY_UNPREFILLED)) {
      const step = rangeBuildSteps.find((s) => s.id === id)
      if (!step) {
        offenders.push(`${id}: listed as intentionally unprefilled but no longer exists as a range_build step`)
        continue
      }
      if (resolvePrefilledHands(step).length > 0) {
        offenders.push(`${id}: listed as intentionally unprefilled but now has a foundation — remove it from the map`)
      }
    }
    expect(offenders).toEqual([])
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

  // Deliberate, documented exceptions to the "no exact match" rule below.
  // Each entry here is NOT a leak: the matched target is an EARLIER step in
  // the SAME lesson that the learner has already built and been graded on
  // themselves before reaching the step doing the reusing — nothing is
  // exposed ahead of when the learner already saw it. See the "bos-s3 /
  // bos-s4 share one authored constant" describe block above for the intent.
  const ALLOWED_EXACT_MATCHES: Record<string, string[]> = {
    BTN_open_core: ['bos-s3 (inline range_combos)'],
  }
  const ALLOWED_STEP_MATCHES: Record<string, string[]> = {
    'bos-s4': ['bos-s3 (inline range_combos)'],
  }

  it('has at least one graded target to check against (sanity)', () => {
    expect(gradedTargetSets.length).toBeGreaterThan(0)
  })

  it('no named RANGE_FOUNDATIONS entry is an exact-set match for any graded target (except documented reuse)', () => {
    const offenders: string[] = []
    for (const [foundationKey, hands] of Object.entries(RANGE_FOUNDATIONS)) {
      const foundationSet = new Set(hands)
      const allowed = new Set(ALLOWED_EXACT_MATCHES[foundationKey] ?? [])
      for (const { key, set } of gradedTargetSets) {
        if (allowed.has(key)) continue
        if (foundationSet.size > 0 && foundationSet.size === set.size && [...foundationSet].every((h) => set.has(h))) {
          offenders.push(`foundation "${foundationKey}" is identical to graded target "${key}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no step-level resolved prefilled range is an exact-set match for any graded target (except documented reuse)', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = resolvePrefilledHands(step)
      if (foundation.length === 0) continue
      const foundationSet = new Set(foundation)
      const allowed = new Set(ALLOWED_STEP_MATCHES[step.id] ?? [])
      for (const { key, set } of gradedTargetSets) {
        if (allowed.has(key)) continue
        if (foundationSet.size === set.size && [...foundationSet].every((h) => set.has(h))) {
          offenders.push(`${step.id}: prefilled foundation is identical to graded target "${key}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no foundation exactly equals its own step\'s target (belt-and-suspenders on top of the size check)', () => {
    const offenders: string[] = []
    for (const step of rangeBuildSteps) {
      const foundation = new Set(resolvePrefilledHands(step))
      if (foundation.size === 0) continue
      const target = new Set(resolveTargetHands(step))
      const identical = foundation.size === target.size && [...foundation].every((h) => target.has(h))
      if (identical) offenders.push(`${step.id}: foundation is identical to its own target`)
    }
    expect(offenders).toEqual([])
  })
})

describe('bos-s3 / bos-s4 share one authored "obvious core" constant (no drift between two hand-typed lists)', () => {
  it('bos-s4\'s foundation is exactly bos-s3\'s target — the core taught one step earlier', () => {
    const bos3 = rangeBuildSteps.find((s) => s.id === 'bos-s3')!
    const bos4 = rangeBuildSteps.find((s) => s.id === 'bos-s4')!
    expect(new Set(resolvePrefilledHands(bos4))).toEqual(new Set(resolveTargetHands(bos3)))
  })
})

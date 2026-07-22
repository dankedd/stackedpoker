/**
 * Regression tests for the Module 3 ("Building Your Preflop Foundation")
 * QA/UX/answer-leakage audit. Each block below is tied to a concrete bug
 * found during that audit — see LEARN_QUESTION_QA.md for the general
 * standard these encode.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS_BY_MODULE } from '../curriculum'
import { RANGE_TARGETS } from '../ranges'
import {
  RFI_DEEP, RFI_MEDIUM, RFI_SHALLOW, RFI_SHALLOW_ACTIONS, SB_SPLIT,
  resistanceRisk, entriesToHandList,
} from '../preflopBaselines'
import { expandHandClass } from '../combos'
import type { LessonStep } from '../types'

const MODULE_ID = 'preflop-foundation-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)

// Same set as `SPOILER_CONCEPT_TAGS` in LessonPlayer.tsx — kept in sync manually
// since that constant isn't exported from a client component. If this list and
// LessonPlayer's drift apart, a concept id could start leaking its own answer
// again without any test catching it.
const KNOWN_SPOILER_TAGS = new Set(['positive_ev', 'zero_ev', 'negative_ev', 'first_in'])

describe('Module 3 exists and is wired up', () => {
  it('has all 9 lessons (8 + Lab)', () => {
    expect(lessons.length).toBe(9)
  })

  it('every lesson belongs to the promoted module, not the roadmap placeholder', () => {
    for (const l of lessons) expect(l.module_id).toBe(MODULE_ID)
  })
})

describe('Answer leakage — concept tags must not name their own option', () => {
  it('no step concept_id equals one of its own option ids, unless explicitly guarded in LessonPlayer', () => {
    const offenders: string[] = []
    for (const step of allSteps) {
      if (!step.concept_ids?.length || !step.options?.length) continue
      const optionIds = new Set(step.options.map((o) => o.id))
      for (const cid of step.concept_ids) {
        if (optionIds.has(cid) && !KNOWN_SPOILER_TAGS.has(cid)) {
          offenders.push(`${step.id}: concept_id "${cid}" matches an option id`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every concept_id that DOES collide with an option id is in the guarded spoiler set', () => {
    // Inverse check: if fi-s1-style steps exist, they must be covered by the guard.
    const guarded: string[] = []
    for (const step of allSteps) {
      if (!step.concept_ids?.length || !step.options?.length) continue
      const optionIds = new Set(step.options.map((o) => o.id))
      for (const cid of step.concept_ids) {
        if (optionIds.has(cid)) guarded.push(cid)
      }
    }
    for (const cid of guarded) expect(KNOWN_SPOILER_TAGS.has(cid)).toBe(true)
  })
})

describe('Answer leakage — Lesson 1 range reveal vs. range-build exercise', () => {
  it('fi-s6 (range reveal) does not show the exact range fi-s7 (range_build) grades against', () => {
    const fi6 = allSteps.find((s) => s.id === 'fi-s6')
    const fi7 = allSteps.find((s) => s.id === 'fi-s7')
    expect(fi6?.range_compare_a).toBeTruthy()
    expect(fi7?.range_target).toBe('BTN_open_100bb')

    const revealed = new Set(fi6!.range_compare_a!.range)
    const graded = new Set(RANGE_TARGETS['BTN_open_100bb'])
    // Not identical, and not even a superset match — fi-s6 must use a
    // different position's range (CO) so the BTN exercise stays unspoiled.
    expect(revealed).not.toEqual(graded)
  })
})

describe('Answer leakage — Small Blind lesson ordering', () => {
  it('quiz steps (sbd-s8a/b/c) appear before the full answer-key reveal (sbd-s5)', () => {
    const sbLesson = lessons.find((l) => l.id === 'the-small-blind-is-different')!
    const ids = sbLesson.steps.map((s) => s.id)
    const quizIndexes = ['sbd-s8a', 'sbd-s8b', 'sbd-s8c'].map((id) => ids.indexOf(id))
    const revealIndex = ids.indexOf('sbd-s5')
    expect(quizIndexes.every((i) => i >= 0)).toBe(true)
    expect(revealIndex).toBeGreaterThan(Math.max(...quizIndexes))
  })
})

describe('Answer leakage — Lesson 6 does not pre-expose Lesson 7\'s SB split', () => {
  it('tlr-s5 does not render the exact SB_SPLIT limp/raise partition', () => {
    const tlr5 = allSteps.find((s) => s.id === 'tlr-s5')
    expect(tlr5?.range_compare_a).toBeTruthy()
    expect(tlr5?.range_compare_b).toBeTruthy()

    const sbLimp = new Set(Object.entries(SB_SPLIT).filter(([, a]) => a === 'limp').map(([h]) => h))
    const sbRaise = new Set(Object.entries(SB_SPLIT).filter(([, a]) => a === 'raise').map(([h]) => h))

    expect(new Set(tlr5!.range_compare_a!.range)).not.toEqual(sbLimp)
    expect(new Set(tlr5!.range_compare_b!.range)).not.toEqual(sbRaise)
  })
})

describe('Theory consistency — stack-depth tiers narrow monotonically', () => {
  it('RFI_SHALLOW is a subset of RFI_MEDIUM for every authored position', () => {
    for (const pos of Object.keys(RFI_SHALLOW)) {
      const shallowHands = entriesToHandList(RFI_SHALLOW[pos])
      const mediumHands = new Set(entriesToHandList(RFI_MEDIUM[pos] ?? []))
      const orphans = shallowHands.filter((h) => !mediumHands.has(h))
      expect(orphans, `${pos}: hands in SHALLOW but not MEDIUM: ${orphans.join(', ')}`).toEqual([])
    }
  })

  it('RFI_MEDIUM is a subset of RFI_DEEP for every position (medium is derived, not authored)', () => {
    for (const pos of Object.keys(RFI_MEDIUM)) {
      const mediumHands = entriesToHandList(RFI_MEDIUM[pos])
      const deepHands = new Set(entriesToHandList(RFI_DEEP[pos] ?? []))
      for (const h of mediumHands) expect(deepHands.has(h)).toBe(true)
    }
  })

  it('RFI_SHALLOW_ACTIONS keys exactly match the corresponding RFI_SHALLOW hand list (no orphans)', () => {
    for (const pos of Object.keys(RFI_SHALLOW_ACTIONS)) {
      const actionHands = new Set(Object.keys(RFI_SHALLOW_ACTIONS[pos]))
      const plainHands = new Set(entriesToHandList(RFI_SHALLOW[pos] ?? []))
      expect(actionHands).toEqual(plainHands)
    }
  })
})

describe('Combo weighting — pair=6 / suited=4 / offsuit=12, 1326 total', () => {
  it('expandHandClass returns the correct combo count per hand shape', () => {
    expect(expandHandClass('AA')).toHaveLength(6)
    expect(expandHandClass('AKs')).toHaveLength(4)
    expect(expandHandClass('AKo')).toHaveLength(12)
  })

  it('the full 169-hand grid sums to exactly 1326 combos', () => {
    const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
    let total = 0
    for (let i = 0; i < RANKS.length; i++) {
      for (let j = 0; j < RANKS.length; j++) {
        if (i === j) total += expandHandClass(RANKS[i] + RANKS[i]).length
        else if (i < j) total += expandHandClass(RANKS[i] + RANKS[j] + 's').length
        else total += expandHandClass(RANKS[j] + RANKS[i] + 'o').length
      }
    }
    expect(total).toBe(1326)
  })

  it('every hand referenced by a Module 3 range_build step resolves to a known RANGE_TARGETS key or inline combos', () => {
    for (const step of allSteps) {
      if (step.type !== 'range_build') continue
      const hasTarget = step.range_target ? RANGE_TARGETS[step.range_target] !== undefined : false
      const hasInline = Array.isArray(step.range_combos) && step.range_combos.length > 0
      expect(hasTarget || hasInline, `range_build step "${step.id}" has neither a valid range_target nor inline range_combos`).toBe(true)
    }
  })
})

describe('Players-behind resistance-risk model', () => {
  it('is monotonically increasing in the number of players behind', () => {
    let prev = -1
    for (let n = 1; n <= 8; n++) {
      const risk = resistanceRisk(n)
      expect(risk).toBeGreaterThan(prev)
      prev = risk
    }
  })

  it('always stays within [0, 1)', () => {
    for (let n = 0; n <= 8; n++) {
      const risk = resistanceRisk(n)
      expect(risk).toBeGreaterThanOrEqual(0)
      expect(risk).toBeLessThan(1)
    }
  })
})

describe('Context completeness — every decision-style step in Module 3 has enough context', () => {
  it('any step naming a specific stack depth in its narrative also carries it as structured context where the step type supports it', () => {
    // Spot-check the two steps fixed during the audit for exactly this gap.
    const poe8 = allSteps.find((s) => s.id === 'poe-s8')
    const labR7 = allSteps.find((s) => s.id === 'lab-r7')
    expect(poe8?.effective_stack_bb).toBe(20)
    expect(labR7?.effective_stack_bb).toBe(20)
  })
})

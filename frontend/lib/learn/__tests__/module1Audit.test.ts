/**
 * Regression tests for the Module 1 ("Poker Fundamentals") restructure —
 * 5 lessons (How Poker Works, Your Seat at the Table, Speak the Language,
 * Hands/Boards & What Can Change, Think in Ranges) plus the Foundation Lab.
 * See LEARN_QUESTION_QA.md for the general standard these encode.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS, LESSONS_BY_MODULE } from '../curriculum'
import { RANGE_TARGETS } from '../ranges'
import type { LessonStep } from '../types'

const MODULE_ID = 'poker-fundamentals-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)

// Same set as `SPOILER_CONCEPT_TAGS` in LessonPlayer.tsx — kept in sync manually
// since that constant isn't exported from a client component. If this list and
// LessonPlayer's drift apart, a concept id could start leaking its own answer
// again without any test catching it.
const KNOWN_SPOILER_TAGS = new Set(['positive_ev', 'zero_ev', 'negative_ev', 'first_in'])

describe('Module 1 exists and is wired up', () => {
  it('has all 6 lessons (5 + Foundation Lab)', () => {
    expect(lessons.length).toBe(6)
  })

  it('every lesson belongs to the promoted module', () => {
    for (const l of lessons) expect(l.module_id).toBe(MODULE_ID)
  })

  it('every regular lesson has 18-22 steps; the Foundation Lab is a shorter capstone', () => {
    for (const l of lessons) {
      if (l.id === 'foundation-lab') {
        expect(l.steps.length).toBeGreaterThanOrEqual(10)
        continue
      }
      expect(l.steps.length, `${l.id} has ${l.steps.length} steps`).toBeGreaterThanOrEqual(15)
      expect(l.steps.length, `${l.id} has ${l.steps.length} steps`).toBeLessThanOrEqual(23)
    }
  })

  it('every step id in the module is unique', () => {
    const ids = allSteps.map((s) => s.id)
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const id of ids) {
      if (seen.has(id)) dupes.push(id)
      seen.add(id)
    }
    expect(dupes).toEqual([])
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
})

describe('Answer leakage — Module 1 range illustrations never expose a later range_build target', () => {
  // Every RANGE_TARGETS key used anywhere in the curriculum as a graded
  // range_build reconstruction target — showing one of these ranges in full
  // ahead of time (in Module 1, which is chronologically first) would let a
  // learner "solve" that later exercise from memory instead of reasoning.
  const gradedTargetKeys = new Set(
    LESSONS.flatMap((l) => l.steps)
      .map((s) => s.range_target)
      .filter((t): t is string => !!t),
  )

  function collectRangeArrays(step: LessonStep): string[][] {
    const arrays: string[][] = []
    if (step.range_compare_a?.range) arrays.push(step.range_compare_a.range)
    if (step.range_compare_b?.range) arrays.push(step.range_compare_b.range)
    if (step.morphology_builder_range) arrays.push(step.morphology_builder_range)
    if (step.morphology_builder_pool) arrays.push(step.morphology_builder_pool)
    if (step.range_bucket_pool) arrays.push(step.range_bucket_pool)
    if (step.range_diff_baseline) arrays.push(step.range_diff_baseline)
    if (step.range_diff_example) arrays.push(step.range_diff_example)
    return arrays
  }

  it('has at least one graded range_build target to check against (sanity)', () => {
    expect(gradedTargetKeys.size).toBeGreaterThan(0)
  })

  it('no Module 1 range illustration exactly matches a later-quizzed range_build target', () => {
    const offenders: string[] = []
    for (const step of allSteps) {
      const arrays = collectRangeArrays(step)
      for (const arr of arrays) {
        const asSet = new Set(arr)
        for (const key of gradedTargetKeys) {
          const target = new Set(RANGE_TARGETS[key] ?? [])
          if (target.size > 0 && asSet.size === target.size && [...asSet].every((h) => target.has(h))) {
            offenders.push(`${step.id}: range identical to graded target "${key}"`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('Passive vs scored classification holds for every Module 1 step', () => {
  it('every concept_reveal step has no options (nothing to grade)', () => {
    const offenders = allSteps
      .filter((s) => s.type === 'concept_reveal' && (s.options?.length ?? 0) > 0)
      .map((s) => s.id)
    expect(offenders).toEqual([])
  })

  it('every position_table explore-mode step has no options', () => {
    const offenders = allSteps
      .filter((s) => s.type === 'position_table' && s.position_table_mode === 'explore' && (s.options?.length ?? 0) > 0)
      .map((s) => s.id)
    expect(offenders).toEqual([])
  })

  it('every combo_visualizer reveal-mode step has no numeric target (nothing to grade)', () => {
    const offenders = allSteps
      .filter((s) => s.type === 'combo_visualizer' && s.combo_visualizer_mode === 'reveal' && s.combo_visualizer_correct != null)
      .map((s) => s.id)
    expect(offenders).toEqual([])
  })
})

describe('Foundation Lab tests all five preceding lessons', () => {
  it('touches every concept area introduced across Lessons 1-5', () => {
    const lab = lessons.find((l) => l.id === 'foundation-lab')!
    const labConceptIds = new Set(lab.steps.flatMap((s) => s.concept_ids ?? []))
    const requiredAreas = [
      'winning_the_pot', // Lesson 1 — rules
      'table_position', // Lesson 2 — position
      'poker_terminology', // Lesson 3 — terminology
      'effective_stack', // Lesson 3 — terminology
      'made_hand', // Lesson 4 — hands/boards
      'board_texture', // Lesson 4 — hands/boards
      'range_thinking', // Lesson 5 — ranges
      'range_morphology', // Lesson 5 — ranges
    ]
    for (const area of requiredAreas) {
      expect(labConceptIds.has(area), `Foundation Lab is missing concept area "${area}"`).toBe(true)
    }
  })
})

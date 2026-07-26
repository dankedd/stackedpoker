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
  RFI_DEEP, RFI_MEDIUM, RFI_SHALLOW, RFI_SHALLOW_ACTIONS,
  resistanceRisk, entriesToHandList,
} from '../preflopBaselines'
import { expandHandClass } from '../combos'
import { MTT_RFI_CHARTS, MTT_RFI_CHART_KEYS } from '../mttRfiBaselines'
import { MTT_LAB_POOL, LAB_POOL_TARGET_COUNTS, DRILL_POOL_TARGET_COUNTS, selectLabAttempt, selectDrillAttempt } from '../mttRfiLabPool'
import { MTT_RFI_COVERAGE } from '../mttRfiCoverage'
import { MTT_RFI_FOUNDATIONS } from '../mttRfiRanges'
import type { LessonStep } from '../types'

const MODULE_ID = 'preflop-foundation-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)

// Same set as `SPOILER_CONCEPT_TAGS` in LessonPlayer.tsx — kept in sync manually
// since that constant isn't exported from a client component. If this list and
// LessonPlayer's drift apart, a concept id could start leaking its own answer
// again without any test catching it.
const KNOWN_SPOILER_TAGS = new Set(['positive_ev', 'zero_ev', 'negative_ev', 'first_in'])

// Target structure of the Module 3 structural redesign (RFI Mastery rebuild):
// one repeatable 8-step loop (Understand/Predict/Build/Compare/Transform/Drill/Review)
// per position, no standalone BB lesson (no first-in decision exists for BB).
const EXPECTED_LESSON_IDS = [
  'first-in',
  'more-than-two-cards',
  'stacks-change-the-range',
  'utg-mastery',
  'utg1-mastery',
  'utg2-mastery',
  'lj-mastery',
  'hj-mastery',
  'cutoff-ranges',
  'button-ranges',
  'the-small-blind-is-different',
  'preflop-foundation-lab',
]

// Lesson ids retired by the redesign, and where their content went — see the
// migration plan. Verified gone here so a future edit can't silently
// resurrect a stale id and orphan progress against it.
const RETIRED_LESSON_IDS = [
  'the-players-behind-you', // merged into first-in
  'early-position-ranges', // split into utg-mastery / utg1-mastery / utg2-mastery
  'middle-position-ranges', // split into lj-mastery / hj-mastery
  'the-price-of-entering', // ante/sizing folded into first-in + every position lesson's context bar
  'to-limp-or-to-raise', // limping concept folded into the-small-blind-is-different
  'build-the-opening-strategy', // superseded by the 8 position-mastery lessons + the Lab
  'opening-range-drill', // superseded by each position lesson's Drill step + the Lab's interleaving
]

describe('Module 3 exists and is wired up', () => {
  it('has all 12 lessons (3 intro + 8 position-mastery + Lab), in the right order', () => {
    expect(lessons.length).toBe(12)
    expect(lessons.map((l) => l.id)).toEqual(EXPECTED_LESSON_IDS)
  })

  it('every lesson belongs to the promoted module, not the roadmap placeholder', () => {
    for (const l of lessons) expect(l.module_id).toBe(MODULE_ID)
  })

  it('the 7 kept lesson ids are preserved (migration safety — no orphaned user progress)', () => {
    const keptIds = [
      'first-in', 'more-than-two-cards', 'stacks-change-the-range',
      'cutoff-ranges', 'button-ranges', 'the-small-blind-is-different', 'preflop-foundation-lab',
    ]
    const currentIds = new Set(lessons.map((l) => l.id))
    for (const id of keptIds) expect(currentIds.has(id), `kept lesson id "${id}" missing`).toBe(true)
  })

  it('retired lesson ids never resurface (their content was intentionally merged/superseded elsewhere)', () => {
    const currentIds = new Set(lessons.map((l) => l.id))
    for (const id of RETIRED_LESSON_IDS) expect(currentIds.has(id), `retired lesson id "${id}" should not exist`).toBe(false)
  })

  it('sort_order is strictly increasing across the lesson list', () => {
    const orders = lessons.map((l) => l.sort_order)
    for (let i = 1; i < orders.length; i++) expect(orders[i]).toBeGreaterThan(orders[i - 1])
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
  it('the low-stakes Predict guesses (sb-predict-1..4) appear before the full 60bb reveal (sb-build) and the Drill', () => {
    const sbLesson = lessons.find((l) => l.id === 'the-small-blind-is-different')!
    const ids = sbLesson.steps.map((s) => s.id)
    const predictIndexes = ['sb-predict-1', 'sb-predict-2', 'sb-predict-3', 'sb-predict-4'].map((id) => ids.indexOf(id))
    const buildIndex = ids.indexOf('sb-build')
    const firstDrillIndex = ids.findIndex((id) => id.startsWith('sb-drill-'))
    expect(predictIndexes.every((i) => i >= 0)).toBe(true)
    expect(buildIndex).toBeGreaterThan(Math.max(...predictIndexes))
    expect(firstDrillIndex).toBeGreaterThan(buildIndex)
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

describe('range_build_multi steps resolve against the canonical MTT chart data', () => {
  const multiSteps = allSteps.filter((s) => s.type === 'range_build_multi')

  it('the module actually contains range_build_multi steps (regression guard against silently losing them)', () => {
    expect(multiSteps.length).toBeGreaterThan(10)
  })

  it('every range_build_multi_chart resolves to a real MTT_RFI_CHARTS entry', () => {
    for (const step of multiSteps) {
      expect(step.range_build_multi_chart, `${step.id} has no range_build_multi_chart`).toBeTruthy()
      expect(
        MTT_RFI_CHARTS[step.range_build_multi_chart ?? ''],
        `${step.id}: chart key "${step.range_build_multi_chart}" does not exist`,
      ).toBeDefined()
    }
  })

  it('every range_build_multi_prefilled_key resolves and is a subset of hands actually in its target chart', () => {
    for (const step of multiSteps) {
      if (!step.range_build_multi_prefilled_key) continue
      const foundation = MTT_RFI_FOUNDATIONS[step.range_build_multi_prefilled_key]
      expect(foundation, `${step.id}: prefill key "${step.range_build_multi_prefilled_key}" not found`).toBeDefined()
      const chart = MTT_RFI_CHARTS[step.range_build_multi_chart ?? '']
      const chartHandActions = new Map(chart.cells.map((c) => [c.hand, c.actions]))
      for (const [hand, action] of Object.entries(foundation!.hands)) {
        const actions = chartHandActions.get(hand)
        expect(actions, `${step.id}: prefilled hand "${hand}" is not in the target chart at all`).toBeDefined()
        expect(
          actions?.[action] ?? 0,
          `${step.id}: prefilled ${hand}->${action} is not what the chart actually says (should be a pure/obvious action)`,
        ).toBeGreaterThanOrEqual(0.9)
      }
    }
  })
})

describe('MTT_LAB_POOL — validated question pool for the Drill and Lab', () => {
  it('every pool question\'s chartKeys resolve against MTT_RFI_CHARTS', () => {
    for (const q of MTT_LAB_POOL) {
      for (const key of q.chartKeys) {
        expect(MTT_RFI_CHARTS[key], `pool question "${q.id}" references unknown chart "${key}"`).toBeDefined()
      }
    }
  })

  it('has no duplicate question ids', () => {
    const ids = MTT_LAB_POOL.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every LAB_POOL_TARGET_COUNTS category has at least that many pool entries available', () => {
    for (const [category, count] of Object.entries(LAB_POOL_TARGET_COUNTS)) {
      const available = MTT_LAB_POOL.filter((q) => q.category === category).length
      expect(available, `category "${category}" has only ${available} entries, needs >= ${count}`).toBeGreaterThanOrEqual(count)
    }
  })

  it('LAB_POOL_TARGET_COUNTS sums to ~40', () => {
    const total = Object.values(LAB_POOL_TARGET_COUNTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(40)
  })

  it('selectLabAttempt always returns exactly 40 steps, stratified across every category', () => {
    for (const seed of ['seed-a', 'seed-b', 'seed-c']) {
      const steps = selectLabAttempt(seed)
      expect(steps.length).toBe(40)
    }
  })

  it('selectDrillAttempt returns a smaller, valid draw with no reconstruction questions', () => {
    const steps = selectDrillAttempt('seed-x')
    const expectedTotal = Object.values(DRILL_POOL_TARGET_COUNTS).reduce((a, b) => a + b, 0)
    expect(steps.length).toBe(expectedTotal)
    expect(DRILL_POOL_TARGET_COUNTS.reconstruction).toBeUndefined()
  })

  it('a Lab retry (different seed) can draw a different combination of questions', () => {
    const a = selectLabAttempt('retry-seed-a').map((s) => s.id)
    const b = selectLabAttempt('retry-seed-b').map((s) => s.id)
    expect(a).not.toEqual(b)
  })
})

describe('Chart coverage — every one of the 32 canonical charts is actually taught or drilled', () => {
  it('every MTT_RFI_CHART_KEYS entry is referenced by at least one lesson step or Lab pool question', () => {
    // Coverage is recorded by mttRfiLabPool.ts (pool questions) as a module-load side
    // effect; lesson-authored range_build_multi steps are checked directly here since
    // curriculum.ts doesn't call recordCoverage itself (keeping lesson authoring plain data).
    const lessonChartKeys = new Set(
      allSteps.filter((s) => s.type === 'range_build_multi').map((s) => s.range_build_multi_chart),
    )
    const uncovered: string[] = []
    for (const key of MTT_RFI_CHART_KEYS) {
      const coveredByPool = (MTT_RFI_COVERAGE[key]?.usedByLabPoolQuestionIds.length ?? 0) > 0
      const coveredByLesson = lessonChartKeys.has(key)
      if (!coveredByPool && !coveredByLesson) uncovered.push(key)
    }
    expect(uncovered, `charts never taught or drilled: ${uncovered.join(', ')}`).toEqual([])
  })
})

describe('Context completeness — every decision-style step in Module 3 has enough context', () => {
  it('any step naming a specific stack depth ("Xbb") in its narrative also carries it as structured context', () => {
    // Generalized regression guard for the gap originally caught on poe-s8 (now
    // retired along with the-price-of-entering): a narrative shouldn't be the
    // only place a stack depth lives if the step type has a field for it.
    const offenders: string[] = []
    for (const step of allSteps) {
      if (!step.narrative || step.effective_stack_bb != null) continue
      // mtt_stack_depth_compare steps are inherently multi-depth — their structured
      // depth context is mtt_stack_depth_compare_reference_bb, not effective_stack_bb.
      if (step.type === 'mtt_stack_depth_compare') continue
      // Only a single, specific depth named as real context is a gap — steps that
      // deliberately name several depths (e.g. "10bb, 25bb, or 60bb") are asking a
      // multi-depth comparison question, not missing structured context.
      const matches = [...step.narrative.matchAll(/(\d+)\s*bb\b/gi)]
      const distinctValues = new Set(matches.map((m) => m[1]))
      if (distinctValues.size === 1) {
        offenders.push(`${step.id}: narrative mentions a single stack depth but effective_stack_bb is not set`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every generated hand-decision (table_decision) pool question carries structured position/stack/table context, never just prose', () => {
    const handDecisionQuestions = MTT_LAB_POOL.filter((q) => q.stepTemplate.type === 'table_decision')
    expect(handDecisionQuestions.length).toBeGreaterThan(0)
    for (const q of handDecisionQuestions) {
      const step = q.stepTemplate
      expect(step.hero_position, `${q.id} mentions a stack depth but has no hero_position`).toBeTruthy()
      expect(step.table_size, `${q.id} mentions a stack depth but has no table_size`).toBeTruthy()
    }
  })
})

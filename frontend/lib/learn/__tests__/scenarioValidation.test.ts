import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { validateAllLessons, validateStep, isTableRenderingStep } from '../scenarioValidator'

/**
 * The permanent CI gate for scenario/table/text consistency across the entire Learn
 * curriculum. `scenarioValidator.ts` is the single implementation this file, and the
 * standalone `scripts/validate-scenarios.ts` report, both call — there is no second
 * copy of this logic to drift out of sync with.
 *
 * A new lesson that names a raise size, a stack depth, an ante, a hand, or a seat's
 * identity in its narrative WITHOUT the structured `action_before_hero`/
 * `effective_stack_bb`/`stack_overrides_bb`/`ante_bb`/`hero_hand`/`villain_position`
 * fields backing that claim fails this test — the same bug class the "Realizing
 * Equity" and "A9s BB-jam" incidents both were, made permanently unrepresentable.
 */
describe('Scenario validation — sanity guard against an empty/broken sweep', () => {
  it('found a substantial number of PreflopTable-rendering scenarios to audit', () => {
    const tableSteps = LESSONS.flatMap((l) => l.steps).filter(isTableRenderingStep)
    expect(tableSteps.length).toBeGreaterThan(100)
  })
})

describe('Scenario validation — every PreflopTable scenario in the curriculum', () => {
  const report = validateAllLessons(LESSONS)

  it('has zero mismatches between narrative, structured scenario data, and the rendered table', () => {
    if (report.issues.length > 0) {
      const details = report.issues
        .map((i) => `  ${i.lessonId} / ${i.stepId} [${i.field}]: ${i.message}`)
        .join('\n')
      throw new Error(`${report.issues.length} scenario mismatch(es) found:\n${details}`)
    }
    expect(report.issues).toEqual([])
  })
})

describe('validateStep — synthetic regression fixtures (one per audited fact)', () => {
  const base = {
    id: 'x', type: 'decision_spot' as const, table_size: 6, effective_stack_bb: 100,
  }
  const lesson = { id: 'l', title: 'L', module_id: 'm', slug: 's', lesson_type: 'micro' as const, concept_ids: [], steps: [], estimated_min: 1, xp_reward: 1, sort_order: 1 }

  it('flags a narrative-described open with no action_before_hero at all', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BB', villain_position: 'BTN',
      narrative: 'BTN opens to 2.3bb. Hero is in the BB.',
    })
    expect(issues.some((i) => i.field === 'raise_sizing')).toBe(true)
  })

  it('flags a raise size in action_before_hero that disagrees with the narrative', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BB', villain_position: 'BTN',
      narrative: 'BTN opens to 2.3bb. Hero is in the BB.',
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 3bb', 'SB folds'],
    })
    expect(issues.some((i) => i.field === 'raise_sizing')).toBe(true)
  })

  it('flags a villain_position that disagrees with the last aggressor in action_before_hero', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BB', villain_position: 'CO',
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.3bb', 'SB folds'],
    })
    expect(issues.some((i) => i.field === 'villain_position')).toBe(true)
  })

  it('does NOT flag villain_position when the last raise is Hero\'s own (a rejam spot)', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BB', villain_position: 'HJ', effective_stack_bb: 15,
      action_before_hero: ['UTG folds', 'HJ raises to 2bb', 'CO folds', 'BTN folds', 'SB folds', 'Hero raises all-in to 15bb'],
    })
    expect(issues.some((i) => i.field === 'villain_position')).toBe(false)
  })

  it('flags a hero_hand that disagrees with the narrative-named cards', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BTN', hero_hand: ['Qs', 'Jh'], action_before_hero: [],
      narrative: 'Hero looks down at A♠K♠ on the button.',
    })
    expect(issues.some((i) => i.field === 'hero_hole_cards')).toBe(true)
  })

  it('flags an effective_stack_bb that disagrees with the narrative\'s stated depth', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BTN', effective_stack_bb: 100, action_before_hero: [],
      narrative: 'Cash game, 60bb effective. Hero opens BTN.',
    })
    expect(issues.some((i) => i.field === 'effective_stack')).toBe(true)
  })

  it('flags a short-stacked seat named in prose with no stack_overrides_bb entry (the lab-r7c shape)', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'SB', effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN folds'],
      narrative: 'Hero is in the SB — the BB, still to act, has only 10bb left.',
    })
    expect(issues.some((i) => i.field === 'stack_sizes')).toBe(true)
  })

  it('does NOT flag a short-stacked seat once stack_overrides_bb backs the narrative claim', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'SB', effective_stack_bb: 100, stack_overrides_bb: { BB: 10 },
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN folds'],
      narrative: 'Hero is in the SB — the BB, still to act, has only 10bb left.',
    })
    expect(issues.some((i) => i.field === 'stack_sizes')).toBe(false)
  })

  it('flags "no ante" narrative text when ante_bb is actually set', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BTN', ante_bb: 0.125, action_before_hero: [],
      narrative: 'TOURNAMENT — no ante at this level. Hero opens BTN.',
    })
    expect(issues.some((i) => i.field === 'antes')).toBe(true)
  })

  it('a fully consistent scenario has zero issues', () => {
    const issues = validateStep(lesson, {
      ...base, hero_position: 'BB', villain_position: 'BTN', hero_hand: ['As', 'Ks'],
      narrative: 'Cash game, 100bb effective. BTN opens to 2.3bb. Hero looks down at A♠K♠ in the BB.',
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.3bb', 'SB folds'],
    })
    expect(issues).toEqual([])
  })
})

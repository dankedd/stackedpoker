import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { buildPreflopTableRenderState, BB_BB } from '../preflopTableState'
import { isTableRenderingStep, validateAllLessons } from '../scenarioValidator'
import type { LessonStep } from '../types'

/**
 * The core invariant this whole file protects (see the "Realizing Equity" bug
 * that motivated it, re-s8a-d): the poker table must always visualize the
 * game state that exists at the moment the learner is asked to decide — not
 * the hand's starting state. `buildPreflopTableRenderState` already derives
 * everything (commitments, pot, stack-behind, fold state) from a step's
 * `hero_position`/`table_size`/`action_before_hero`/`ante_bb`/`effective_stack_bb`
 * fields ONLY — never from prose. These tests exist at two levels:
 *
 *  1. Scenario-level (A-H): pin the derivation engine's behavior for the
 *     exact hand shapes described in the spec, using the SAME engine every
 *     PreflopTable step already goes through — no second poker-state system.
 *  2. Repo-wide sweep: walk every authored step and catch content bugs
 *     (missing/incomplete action_before_hero, non-monotonic raises, a folded
 *     Hero, etc.) BEFORE they reach a learner — this is what makes the
 *     "Realizing Equity" bug class a permanent regression, not a one-off fix.
 */

// ── All PreflopTable-rendering steps in the curriculum ──────────────────────
// `isTableRenderingStep` (scenarioValidator.ts) is the ONE place this gate is
// defined — confirmed by grepping every step component that imports
// PreflopTable: DecisionSpot.tsx, TableDecision.tsx, ConceptReveal.tsx,
// ScenarioComparison.tsx. Every other step type, e.g. range_bucket or
// spr_visualizer, never renders a table even when hero_position is set, so
// they're correctly out of scope for this invariant. A board means postflop —
// a different visualization path, also out of scope here.
const allSteps: { lessonId: string; lessonTitle: string; step: LessonStep }[] = LESSONS.flatMap((lesson) =>
  lesson.steps.map((step) => ({ lessonId: lesson.id, lessonTitle: lesson.title, step })),
)
const tableSteps = allSteps.filter(({ step }) => isTableRenderingStep(step))

describe('Repo-wide sweep — every PreflopTable-rendering step exists and is non-trivial', () => {
  it('found a substantial number of steps to audit (sanity guard against an empty/broken sweep)', () => {
    expect(tableSteps.length).toBeGreaterThan(100)
  })
})

describe('Scenario A — unopened pot (blinds only)', () => {
  it('SB 0.5 + BB 1 = 1.5 BB, no aggressor', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'UTG', table_size: 6, action_before_hero: [], effective_stack_bb: 100,
    })!
    expect(state.potBb).toBeCloseTo(1.5)
    expect(state.seats.find((s) => s.position === 'SB')?.committedBb).toBe(0.5)
    expect(state.seats.find((s) => s.position === 'BB')?.committedBb).toBe(1)
    expect(state.heroIsFirstToAct).toBe(true)
  })
})

describe('Scenario B — BTN open (the exact shape of the reported bug)', () => {
  it('BTN raises to 2.3, SB 0.5, BB 1 → BTN chip = 2.3, pot = 3.8', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.3bb', 'SB folds'],
    })!
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(2.3)
    expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 2.3 })
    expect(state.potBb).toBeCloseTo(3.8)
    expect(state.seats.find((s) => s.isHero)?.position).toBe('BB')
    expect(state.heroIsFirstToAct).toBe(false)
  })
})

describe('Scenario C — open + fold: a folded seat keeps its earlier commitment', () => {
  it('CO raises 2.3, BTN folds, SB folds, Hero BB acts — SB\'s blind stays in the pot', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN folds', 'SB folds'],
    })!
    const co = state.seats.find((s) => s.position === 'CO')!
    expect(co.action?.kind).toBe('raise')
    expect(co.committedBb).toBe(2.3)
    const sb = state.seats.find((s) => s.position === 'SB')!
    expect(sb.action?.kind).toBe('fold')
    expect(sb.committedBb).toBe(0.5) // the folded blind is NOT lost
    expect(state.seats.find((s) => s.isHero)?.committedBb).toBe(BB_BB)
    expect(state.potBb).toBeCloseTo(2.3 + 0.5 + 1)
  })
})

describe('Scenario D — open + call', () => {
  it('CO 2.3, BTN calls 2.3, SB folds, Hero BB acts → pot = 6.1', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls', 'SB folds'],
    })!
    expect(state.seats.find((s) => s.position === 'CO')?.committedBb).toBe(2.3)
    expect(state.seats.find((s) => s.position === 'BTN')?.committedBb).toBe(2.3)
    expect(state.potBb).toBeCloseTo(2.3 + 2.3 + 0.5 + 1)
    expect(state.potBb).toBeCloseTo(6.1)
  })
})

describe('Scenario E — open + 3-bet: commitments and pot exactly match the raise sequence', () => {
  it('CO 2.3, BTN 3-bets to 7.5, SB folds, BB folds, CO to act', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'CO', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN raises to 7.5bb', 'SB folds', 'BB folds'],
    })!
    const hero = state.seats.find((s) => s.isHero)!
    expect(hero.position).toBe('CO')
    expect(hero.committedBb).toBe(2.3) // Hero's own prior open, not overwritten
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(7.5)
    expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 7.5 })
    expect(state.potBb).toBeCloseTo(2.3 + 7.5 + 0.5 + 1)
  })
})

describe('Scenario F — open + 3-bet + 4-bet: commitments are REPLACED, never summed', () => {
  it('CO 2.3 → later 20 means CO total committed = 20, NOT 22.3', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN raises to 7.5bb', 'CO raises to 20bb', 'SB folds'],
    })!
    const co = state.seats.find((s) => s.position === 'CO')!
    expect(co.committedBb).toBe(20)
    expect(co.committedBb).not.toBe(22.3)
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(7.5)
    expect(state.potBb).toBeCloseTo(20 + 7.5 + 0.5 + 1)
  })
})

describe('Scenario G — ante game: antes + blinds + raises = correct pot', () => {
  it('6-max, 0.125bb ante, CO raises to 2.3bb', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100, ante_bb: 0.125,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN folds', 'SB folds'],
    })!
    const anteContribution = 0.125 * 6
    expect(state.potBb).toBeCloseTo(2.3 + 0.5 + 1 + anteContribution)
  })
})

describe('Scenario H — folded blind: forced-blind commitment survives the fold', () => {
  it('SB posts 0.5 and folds — dimmed/folded, but the 0.5 chip stays in the pot', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds'],
    })!
    const sb = state.seats.find((s) => s.position === 'SB')!
    expect(sb.action?.kind).toBe('fold')
    expect(sb.committedBb).toBe(0.5)
    expect(state.potBb).toBeCloseTo(0.5 + 1)
  })
})

describe('"Realizing Equity" regression (re-s8a-d) — the exact reported bug', () => {
  const lesson = LESSONS.find((l) => l.id === 'realizing-equity' || l.id === 'defending-as-co')
  if (!lesson) throw new Error('Fixture lesson "realizing-equity"/"defending-as-co" not found — did curriculum content change?')

  for (const id of ['re-s8a', 're-s8b', 're-s8c', 're-s8d']) {
    it(`${id}: BTN's 2.3bb open is present in structured data, BB (Hero) is to act, pot is 3.8`, () => {
      const step = lesson.steps.find((s) => s.id === id)
      if (!step) throw new Error(`missing step ${id}`)

      expect(step.hero_position).toBe('BB')
      expect(step.villain_position).toBe('BTN')
      expect(step.effective_stack_bb).toBe(100)
      expect(step.action_before_hero).toBeDefined()

      const state = buildPreflopTableRenderState({
        hero_position: step.hero_position,
        table_size: step.table_size,
        action_before_hero: step.action_before_hero,
        effective_stack_bb: step.effective_stack_bb,
        ante_bb: step.ante_bb,
      })!

      const btn = state.seats.find((s) => s.position === 'BTN')!
      expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 2.3 })
      expect(btn.committedBb).toBe(2.3)
      expect(state.seats.find((s) => s.position === 'SB')?.committedBb).toBe(0.5)
      expect(state.seats.find((s) => s.isHero)?.committedBb).toBe(1)
      expect(state.potBb).toBeCloseTo(3.8)
      expect(state.heroIsFirstToAct).toBe(false)
    })
  }

  it('re-s8a actually renders "2.3" on the table via the real PreflopTable component', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { PreflopTable } = await import('@/components/learn/visuals/PreflopTable')
    const step = lesson.steps.find((s) => s.id === 're-s8a')!
    const html = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only JSX from a .ts file
      (await import('react')).createElement(PreflopTable as any, {
        tableSize: step.table_size,
        heroPosition: step.hero_position,
        heroHand: step.hero_hand,
        effectiveStackBb: step.effective_stack_bb,
        anteBb: step.ante_bb,
        actionBeforeHero: step.action_before_hero,
      }),
    )
    expect(html).toContain('>2.3<')
    expect(html).toContain('3.8 BB') // the pot, derived — never a separately hardcoded value
    expect(html).toContain('aria-label="BTN, RAISE"')
  })
})

// ── Repo-wide sweep: delegated to lib/learn/scenarioValidator.ts ───────────────
// Structural invariants (parse validity, monotonic raises, Hero-not-folded, pot
// consistency, authored pot_bb, villain_position-vs-last-aggressor), the
// scenario_a/scenario_b top-level mirroring check, and every narrative-vs-data
// cross-check (action claims, hole cards, stack sizes, antes) all live in
// `scenarioValidator.ts`'s `validateStep`/`validateAllLessons` — the SAME
// functions `scripts/validate-scenarios.ts`'s standalone report calls. This is
// deliberately ONE implementation exercised from two call sites, not a second
// copy of the same checks re-derived inline here (see
// `__tests__/scenarioValidation.test.ts` for the full sweep assertion and the
// per-check synthetic fixtures).
describe('Repo-wide sweep — every authored PreflopTable/scenario-comparison step matches its scenario data', () => {
  const report = validateAllLessons(LESSONS)
  const byStep = new Map<string, typeof report.issues>()
  for (const issue of report.issues) {
    const key = `${issue.lessonId}/${issue.stepId}`
    byStep.set(key, [...(byStep.get(key) ?? []), issue])
  }

  // tableSteps (rendering gate) UNION every scenario_a/b comparison step — the
  // top-level mirroring check applies to the latter independent of whether it
  // also renders a table (see scenarioValidator.ts check #0).
  const auditedSteps = new Map(tableSteps.map((s) => [`${s.lessonId}/${s.step.id}`, s]))
  for (const entry of allSteps) {
    if (entry.step.scenario_a && entry.step.scenario_b && entry.step.hero_position) {
      auditedSteps.set(`${entry.lessonId}/${entry.step.id}`, entry)
    }
  }

  for (const { lessonId, step } of auditedSteps.values()) {
    const issues = byStep.get(`${lessonId}/${step.id}`) ?? []
    it(`${lessonId} / ${step.id}: narrative, action_before_hero, and the rendered table all agree`, () => {
      expect(issues, issues.map((i) => `[${i.field}] ${i.message}`).join('\n')).toEqual([])
    })
  }
})

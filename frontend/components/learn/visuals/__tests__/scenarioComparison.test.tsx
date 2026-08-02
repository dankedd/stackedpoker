import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScenarioComparison } from '../ScenarioComparison'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { LESSONS_BY_MODULE } from '@/lib/learn/curriculum'
import type { LessonStep, ComparisonScenario } from '@/lib/learn/types'

const noop = () => {}

const scenarioA: ComparisonScenario = {
  label: 'SB opens',
  short_description: 'BB vs SB Open',
  hero_position: 'BB',
  villain_position: 'SB',
  table_size: 6,
  effective_stack_bb: 100,
  action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN folds', 'SB raises to 2.3bb'],
}

const scenarioB: ComparisonScenario = {
  label: 'CO opens',
  short_description: 'BB vs CO Open',
  hero_position: 'BB',
  villain_position: 'CO',
  table_size: 6,
  effective_stack_bb: 100,
  action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN folds', 'SB folds'],
}

describe('ScenarioComparison — renders through the shared PreflopTable pipeline', () => {
  it('defaults to Scenario 1 (scenario_a) and shows its real table state', () => {
    const html = renderToStaticMarkup(<ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(html).toContain('preflop-table-root')
    expect(html).toContain('>BB<')
    expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
    // Scenario A's opener is SB — the center-status line names it as the opener.
    expect(html).toContain('SB OPEN')
    expect(html).not.toContain('CO OPEN')
  })

  it('an explicitly forced Scenario 2 (scenario_b) shows the DIFFERENT opener and action sequence', () => {
    const html = renderToStaticMarkup(
      <ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} initialScenario="b" />,
    )
    expect(html).toContain('>BB<')
    expect(html).toContain('CO OPEN')
    expect(html).not.toContain('SB OPEN')
    // SB folded in scenario B — not the opener.
    expect(html).toContain('aria-label="SB, folded"')
  })

  it('renders both switcher buttons with concise labels and the Hero-relationship line', () => {
    const html = renderToStaticMarkup(<ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(html).toContain('SB opens')
    expect(html).toContain('CO opens')
    expect(html).toContain('BB vs SB Open')
    expect(html).toContain('BB vs CO Open')
    expect(html).toContain('Scenario 1')
    expect(html).toContain('Scenario 2')
  })

  it('renders the authored comparison-context line when present, and omits it when absent', () => {
    const withContext = renderToStaticMarkup(
      <ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} comparisonContext="Same Hero seat. Different opener position." />,
    )
    expect(withContext).toContain('Same Hero seat. Different opener position.')

    const withoutContext = renderToStaticMarkup(<ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(withoutContext).not.toContain('Different opener position')
  })

  it('never renders a fabricated table when a scenario lacks hero_position', () => {
    const brokenB: ComparisonScenario = { label: 'CO opens' } // no hero_position
    const html = renderToStaticMarkup(<ScenarioComparison scenarioA={scenarioA} scenarioB={brokenB} />)
    expect(html).toBe('')
  })
})

describe('DecisionSpot — scenario comparison integration', () => {
  const comparisonStep: LessonStep = {
    id: 'test-comparison',
    type: 'decision_spot',
    decision_spot_question: 'How does Hero\'s range change from Scenario 1 to Scenario 2?',
    scenario_a: scenarioA,
    scenario_b: scenarioB,
    scenario_comparison_context: 'Same Hero seat (BB). Different opener position.',
    options: [
      { id: 'tighter', label: 'Tighter', quality: 'perfect', feedback: 'ok' },
      { id: 'wider', label: 'Wider', quality: 'mistake', feedback: 'no' },
    ],
  }

  it('renders the ScenarioComparison switcher, defaulting to Scenario 1, when both scenarios are authored', () => {
    const html = renderToStaticMarkup(<DecisionSpot step={comparisonStep} onAnswer={noop} />)
    expect(html).toContain('Compare Scenarios')
    expect(html).toContain('SB OPEN')
    expect(html).not.toContain('CO OPEN')
  })

  it('falls back to the normal single-table branch when only scenario_a is present (no fabricated scenario_b)', () => {
    const partialStep: LessonStep = {
      ...comparisonStep,
      id: 'test-partial',
      scenario_b: undefined,
      hero_position: 'BB',
      villain_position: 'SB',
    }
    const html = renderToStaticMarkup(<DecisionSpot step={partialStep} onAnswer={noop} />)
    expect(html).not.toContain('Compare Scenarios')
    expect(html).toContain('preflop-table-root')
    expect(html).toContain('>BB<')
  })

  it('does not affect a normal non-comparison decision spot (no switcher rendered)', () => {
    const normalStep: LessonStep = {
      id: 'test-normal',
      type: 'decision_spot',
      hero_position: 'CO',
      effective_stack_bb: 40,
      table_size: 9,
      action_before_hero: ['UTG folds', 'HJ folds'],
      decision_spot_question: 'What is your play?',
      options: [{ id: 'raise', label: 'RAISE', quality: 'perfect', feedback: 'ok' }],
    }
    const html = renderToStaticMarkup(<DecisionSpot step={normalStep} onAnswer={noop} />)
    expect(html).not.toContain('Compare Scenarios')
    expect(html).toContain('preflop-table-root')
  })
})

describe('"Position and Equity Realization" — every scenario-comparison step is wired correctly', () => {
  const lesson = (LESSONS_BY_MODULE['preflop-aggression-module'] ?? []).find(
    (l) => l.id === 'position-and-equity-realization',
  )
  if (!lesson) throw new Error('Fixture lesson "position-and-equity-realization" not found — did curriculum content change?')

  const comparisonStepIds = ['pce-s1', 'pce-s7a', 'pce-s7b', 'pce-s7c', 'pce-s7d']

  it('has exactly the expected set of comparison steps', () => {
    const actual = lesson.steps.filter((s) => s.scenario_a && s.scenario_b).map((s) => s.id)
    expect(actual.sort()).toEqual([...comparisonStepIds].sort())
  })

  for (const id of comparisonStepIds) {
    it(`${id} renders Scenario 1 by default and Scenario 2 shows a genuinely different table`, () => {
      const step = lesson.steps.find((s) => s.id === id)
      if (!step) throw new Error(`missing step ${id}`)
      const a = renderToStaticMarkup(<ScenarioComparison scenarioA={step.scenario_a!} scenarioB={step.scenario_b!} />)
      const b = renderToStaticMarkup(
        <ScenarioComparison scenarioA={step.scenario_a!} scenarioB={step.scenario_b!} initialScenario="b" />,
      )
      expect(a).not.toEqual(b)
      expect(a).toContain(`>${step.scenario_a!.hero_position}<`)
      expect(b).toContain(`>${step.scenario_b!.hero_position}<`)
      // Hero's "HERO ·" prefix is present in both renders — same integrated
      // label geometry, every scenario.
      expect(a).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
      expect(b).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
    })
  }

  it('pce-s7a/b/c/d hold Hero\'s seat fixed and vary only the opener (the "same seat" comparisons)', () => {
    for (const id of ['pce-s7a', 'pce-s7b', 'pce-s7c', 'pce-s7d']) {
      const step = lesson.steps.find((s) => s.id === id)!
      expect(step.scenario_a!.hero_position).toBe(step.scenario_b!.hero_position)
      expect(step.scenario_a!.villain_position).not.toBe(step.scenario_b!.villain_position)
    }
  })

  it('pce-s1 holds the opener fixed and varies only Hero\'s seat (BTN vs CO open → SB vs CO open, same hand)', () => {
    const step = lesson.steps.find((s) => s.id === 'pce-s1')!
    expect(step.scenario_a!.hero_position).toBe('BTN')
    expect(step.scenario_a!.villain_position).toBe('CO')
    expect(step.scenario_b!.hero_position).toBe('SB')
    expect(step.scenario_b!.villain_position).toBe('CO')
    expect(step.scenario_a!.hero_hand).toEqual(step.scenario_b!.hero_hand)
    expect(step.scenario_a!.effective_stack_bb).toBe(step.scenario_b!.effective_stack_bb)
  })

  it('pce-s6 (ambiguous "LJ (UTG)" narrative) was intentionally left unmigrated — flagged for content review, not auto-built', () => {
    const step = lesson.steps.find((s) => s.id === 'pce-s6')
    expect(step?.scenario_a).toBeUndefined()
    expect(step?.scenario_b).toBeUndefined()
  })
})

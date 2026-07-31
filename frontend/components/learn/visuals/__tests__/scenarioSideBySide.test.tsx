import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScenarioSideBySide } from '../ScenarioSideBySide'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { LESSONS_BY_MODULE } from '@/lib/learn/curriculum'
import type { LessonStep, ComparisonScenario } from '@/lib/learn/types'

const noop = () => {}

const scenarioA: ComparisonScenario = {
  label: 'UTG',
  short_description: '8 players behind',
  hero_position: 'UTG',
  hero_hand: ['Qs', '7s'],
  table_size: 9,
  action_before_hero: [],
}

const scenarioB: ComparisonScenario = {
  label: 'SB',
  short_description: '1 player behind (BB)',
  hero_position: 'SB',
  hero_hand: ['Qs', '7s'],
  table_size: 9,
  action_before_hero: ['Everyone folds'],
}

describe('ScenarioSideBySide — mounts BOTH scenarios as independent PreflopTables', () => {
  it('renders two separate preflop-table-root instances, not a switcher', () => {
    const html = renderToStaticMarkup(<ScenarioSideBySide scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(html.match(/preflop-table-root/g)?.length).toBe(2)
    expect(html).not.toContain('Compare Scenarios</p>\n') // no switcher tabs
    expect(html).not.toContain('role="tablist"')
  })

  it('shows both hero positions and both labels simultaneously', () => {
    const html = renderToStaticMarkup(<ScenarioSideBySide scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(html).toContain('>UTG<')
    expect(html).toContain('>SB<')
    expect(html).toContain('8 players behind')
    expect(html).toContain('1 player behind (BB)')
  })

  it('UTG scenario shows FIRST TO ACT; SB scenario shows action folded to SB', () => {
    const html = renderToStaticMarkup(<ScenarioSideBySide scenarioA={scenarioA} scenarioB={scenarioB} />)
    expect(html).toContain('FIRST TO ACT')
    expect(html).toContain('ACTION FOLDED TO SB')
  })

  it('renders the authored comparison-context line when present', () => {
    const html = renderToStaticMarkup(
      <ScenarioSideBySide scenarioA={scenarioA} scenarioB={scenarioB} comparisonContext="Same hand, same table." />,
    )
    expect(html).toContain('Same hand, same table.')
  })

  it('never renders a fabricated table when a scenario lacks hero_position', () => {
    const brokenB: ComparisonScenario = { label: 'SB' } // no hero_position
    const html = renderToStaticMarkup(<ScenarioSideBySide scenarioA={scenarioA} scenarioB={brokenB} />)
    expect(html).toBe('')
  })
})

describe('DecisionSpot — scenario_layout: side_by_side wiring', () => {
  const sideBySideStep: LessonStep = {
    id: 'test-side-by-side',
    type: 'decision_spot',
    decision_spot_question: 'Which player faces more resistance?',
    scenario_a: scenarioA,
    scenario_b: scenarioB,
    scenario_layout: 'side_by_side',
    scenario_comparison_context: 'Same hand, same table.',
    options: [
      { id: 'utg', label: 'UTG', quality: 'perfect', feedback: 'ok' },
      { id: 'sb', label: 'SB', quality: 'mistake', feedback: 'no' },
    ],
  }

  it('renders both tables at once instead of the switcher', () => {
    const html = renderToStaticMarkup(<DecisionSpot step={sideBySideStep} onAnswer={noop} />)
    expect(html.match(/preflop-table-root/g)?.length).toBe(2)
    expect(html).not.toContain('role="tablist"')
  })

  it('a comparison step WITHOUT scenario_layout still renders the single-table switcher (default unchanged)', () => {
    const switcherStep: LessonStep = { ...sideBySideStep, id: 'test-switcher', scenario_layout: undefined }
    const html = renderToStaticMarkup(<DecisionSpot step={switcherStep} onAnswer={noop} />)
    expect(html.match(/preflop-table-root/g)?.length).toBe(1)
    expect(html).toContain('role="tablist"')
  })
})

describe('"First In" — fi-pby-1 is wired for the UTG-vs-SB side-by-side comparison', () => {
  const lesson = (LESSONS_BY_MODULE['preflop-foundation-module'] ?? []).find((l) => l.id === 'first-in')
  if (!lesson) throw new Error('Fixture lesson "first-in" not found — did curriculum content change?')
  const step = lesson.steps.find((s) => s.id === 'fi-pby-1')
  if (!step) throw new Error('fi-pby-1 not found in "first-in" lesson')

  it('keeps the original question, options, correct answer, and xp unchanged', () => {
    expect(step.narrative).toBe(
      "Hero holds Q♠7♠ twice. At UTG, 8 players remain behind before the blinds. At SB, only BB remains. Which player must survive more possible resistance?",
    )
    expect(step.options?.map((o) => o.id)).toEqual(['utg', 'sb'])
    expect(step.options?.find((o) => o.id === 'utg')?.quality).toBe('perfect')
    expect(step.options?.find((o) => o.id === 'sb')?.quality).toBe('mistake')
    expect(step.xp).toBe(6)
  })

  it('opts into the side-by-side layout with UTG as scenario_a and SB as scenario_b', () => {
    expect(step.scenario_layout).toBe('side_by_side')
    expect(step.scenario_a?.hero_position).toBe('UTG')
    expect(step.scenario_b?.hero_position).toBe('SB')
    expect(step.scenario_a?.hero_hand).toEqual(['Qs', '7s'])
    expect(step.scenario_b?.hero_hand).toEqual(['Qs', '7s'])
  })

  it('renders through DecisionSpot as two simultaneous tables', () => {
    const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)
    expect(html.match(/preflop-table-root/g)?.length).toBe(2)
    expect(html).toContain('>UTG<')
    expect(html).toContain('>SB<')
  })
})

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DecisionSpot } from '../DecisionSpot'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

const preflopStep: LessonStep = {
  id: 'test-preflop',
  type: 'decision_spot',
  hero_position: 'CO',
  hero_hand: ['Ac', 'Kd'],
  effective_stack_bb: 40,
  table_size: 9,
  action_before_hero: ['UTG folds', 'HJ folds'],
  decision_spot_question: 'What is your play?',
  options: [
    { id: 'raise', label: 'RAISE', quality: 'perfect', feedback: 'Correct.' },
    { id: 'fold', label: 'FOLD', quality: 'mistake', feedback: 'Not quite.' },
  ],
}

const postflopStep: LessonStep = {
  id: 'test-postflop',
  type: 'decision_spot',
  hero_position: 'BTN',
  board: ['Ah', 'Kd', '2c'],
  decision_spot_question: 'What is your play?',
  options: [
    { id: 'cbet', label: 'C-BET', quality: 'perfect', feedback: 'Correct.' },
    { id: 'check', label: 'CHECK', quality: 'mistake', feedback: 'Not quite.' },
  ],
}

describe('DecisionSpot — preflop table gating', () => {
  it('renders the shared PreflopTable for a preflop step (hero_position, no board)', () => {
    const html = renderToStaticMarkup(<DecisionSpot step={preflopStep} onAnswer={noop} />)
    expect(html).toContain('>CO<')
    expect(html).toMatch(/text-violet-300\/70[^<]*>Hero</) // Hero's rail caption
    expect(html).toContain('FOLD') // UTG/HJ folded seats
  })

  it('does NOT render a preflop table for a postflop step (hero_position + board present)', () => {
    const html = renderToStaticMarkup(<DecisionSpot step={postflopStep} onAnswer={noop} />)
    expect(html).not.toContain('HERO · BTN')
    expect(html).not.toContain('preflop-table-root')
  })

  it('renders no table at all when hero_position is absent', () => {
    const html = renderToStaticMarkup(
      <DecisionSpot
        step={{ id: 'no-pos', type: 'decision_spot', decision_spot_question: 'Q?', options: [{ id: 'a', label: 'A', quality: 'perfect', feedback: 'ok' }] }}
        onAnswer={noop}
      />,
    )
    expect(html).not.toContain('preflop-table-root')
  })
})

describe('DecisionSpot — curriculum sweep: no postflop step ever renders a preflop table', () => {
  const allSteps = LESSONS.flatMap((l) => l.steps)
  const postflopDecisionSpots = allSteps.filter(
    (s) => (s.type === 'decision_spot' || s.type === 'bet_size_choose') && s.hero_position && (s.board?.length ?? 0) > 0,
  )

  it('has at least one real postflop fixture to guard against (regression sanity)', () => {
    expect(postflopDecisionSpots.length).toBeGreaterThan(0)
  })

  for (const step of postflopDecisionSpots.slice(0, 20)) {
    it(`${step.id} does not render the preflop table`, () => {
      const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)
      expect(html).not.toContain('preflop-table-root')
    })
  }
})

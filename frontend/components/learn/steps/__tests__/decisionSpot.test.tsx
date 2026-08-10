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
    expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</) // Hero's integrated rail label
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

// Postflop scenarios used to be barred from the table entirely and rendered a
// text "Action so far" list instead. They now use the SAME table, switched into
// postflop mode — so the invariant this sweep protects is no longer "no table",
// it's "never the PREFLOP table": a flop/turn/river step must show its board and
// name its real street, never claim to be preflop.
describe('DecisionSpot — curriculum sweep: postflop steps render a postflop table, never a preflop one', () => {
  const allSteps = LESSONS.flatMap((l) => l.steps)
  const postflopDecisionSpots = allSteps.filter(
    (s) => (s.type === 'decision_spot' || s.type === 'bet_size_choose') && s.hero_position && (s.board?.length ?? 0) > 0,
  )

  it('has at least one real postflop fixture to guard against (regression sanity)', () => {
    expect(postflopDecisionSpots.length).toBeGreaterThan(0)
  })

  for (const step of postflopDecisionSpots.slice(0, 20)) {
    it(`${step.id} never claims to be preflop`, () => {
      const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)
      if (!html.includes('preflop-table-root')) return // board-only illustration — keeps the compact card
      expect(html).not.toContain('PREFLOP ·')
      // The board belongs on the felt, not in a separate text panel.
      expect(html).not.toContain('Action so far')
    })
  }

  it('the reported scene (csd-s4b) renders a real flop table with its board and street', () => {
    const step = allSteps.find((s) => s.id === 'csd-s4b')!
    const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)

    expect(html).toContain('preflop-table-root')
    expect(html).not.toContain('Action so far')
    // Board on the felt — all three flop cards, by their accessible names.
    expect(html).toContain('Jack of spades')
    expect(html).toContain('6 of hearts')
    expect(html).toContain('6 of diamonds')
    // Street-aware status bar, not the hardcoded preflop one.
    expect(html).toContain('FLOP · 40BB EFFECTIVE')
    expect(html).toContain('FLOP · BB CHECKS')
    expect(html).not.toContain('PREFLOP ·')
  })
})

import { describe, it, expect } from 'vitest'
import {
  buildPostflopTableRenderState,
  canRenderPostflopTable,
  derivePostflopStatus,
  streetForBoard,
} from '../postflopTableState'
import { parseActionBeforeHero } from '../preflopTableState'
import { LESSONS_BY_ID } from '../curriculum'
import type { LessonStep } from '../types'

// The scenario from the report: 6-max, BTN opens to 2.3bb, SB folds, BB calls,
// flop J♠6♥6♦, BB checks, Hero (BTN) to act, 40bb effective. Every number the
// table draws is derived here, so a content edit that breaks the scene breaks
// these tests rather than silently rendering a wrong pot.
const CSD_S4B = {
  hero_position: 'BTN',
  table_size: 6,
  effective_stack_bb: 40,
  action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.3bb', 'SB folds', 'BB calls'],
  postflop_action: ['BB checks'],
  board: ['Js', '6h', '6d'],
} as LessonStep

describe('streetForBoard', () => {
  it('names the street from the real board length, never guessing a missing card', () => {
    expect(streetForBoard(['Js', '6h', '6d'])).toBe('flop')
    expect(streetForBoard(['Js', '6h', '6d', '2c'])).toBe('turn')
    expect(streetForBoard(['Js', '6h', '6d', '2c', '9s'])).toBe('river')
    expect(streetForBoard(['Js', '6h'])).toBeUndefined()
    expect(streetForBoard(undefined)).toBeUndefined()
  })
})

describe('postflop table state — the J♠6♥6♦ c-bet scene', () => {
  const state = buildPostflopTableRenderState(CSD_S4B)!

  it('builds a flop scene', () => {
    expect(state).toBeDefined()
    expect(state.street).toBe('flop')
    expect(state.tableSize).toBe(6)
    expect(state.heroPosition).toBe('BTN')
  })

  it('carries the preflop pot forward as dead money: 0.5 (SB) + 2.3 (BTN) + 2.3 (BB)', () => {
    expect(state.deadPotBb).toBeCloseTo(5.1, 5)
  })

  it('a check adds nothing, so the pot on the flop is still the preflop pot', () => {
    expect(state.potBb).toBeCloseTo(5.1, 5)
  })

  it('shows no chips in front of anyone — preflop chips are in the middle now', () => {
    for (const seat of state.seats) expect(seat.committedBb).toBe(0)
  })

  it('BB shows CHECK; BTN (Hero) has not acted yet', () => {
    const bb = state.seats.find((s) => s.position === 'BB')!
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(bb.action?.kind).toBe('check')
    expect(btn.action).toBeUndefined()
  })

  it('seats that folded preflop stay folded and show no chip', () => {
    const sb = state.seats.find((s) => s.position === 'SB')!
    expect(sb.action?.kind).toBe('fold')
    expect(sb.committedBb).toBe(0)
    expect(state.livePositions).toEqual(['BB', 'BTN'])
  })

  it('stacks behind net out everything committed across both streets', () => {
    const btn = state.seats.find((s) => s.position === 'BTN')!
    const bb = state.seats.find((s) => s.position === 'BB')!
    expect(btn.stackBehindBb).toBeCloseTo(37.7, 5) // 40 - 2.3 open
    expect(bb.stackBehindBb).toBeCloseTo(37.7, 5)  // 40 - 2.3 call
  })

  it('summarises the street in one line instead of a hand-history list', () => {
    expect(derivePostflopStatus(state)).toBe('FLOP · BB CHECKS')
  })
})

describe('postflop table state — a river bet builds a real current-street pot', () => {
  const state = buildPostflopTableRenderState({
    hero_position: 'BB',
    table_size: 6,
    effective_stack_bb: 40,
    pot_bb: 20,
    street: 'river',
    board: ['Ah', '9d', '4c', '2s', '7h'],
    postflop_action: ['BTN bets 20bb'],
  } as LessonStep)!

  it('uses the authored pot as dead money when no preflop history exists', () => {
    expect(state.deadPotBb).toBe(20)
  })

  it("puts the bettor's chips in front of them, and counts them in the pot", () => {
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(20)
    expect(state.potBb).toBe(40)
    expect(btn.stackBehindBb).toBe(20)
  })

  it('reads a pot-sized river bet as a bet, not a raise-to', () => {
    expect(derivePostflopStatus(state)).toBe('RIVER · BTN BETS 20BB')
  })
})

describe('"bets Nbb" parses everywhere the other verbs do', () => {
  it('parses a postflop bet and an all-in bet, flagged so the seat badge reads BET', () => {
    expect(parseActionBeforeHero(['BB bets 3.5bb'], 'BTN', 6)).toEqual([
      { position: 'BB', kind: 'raise', betBb: 3.5, isBet: true },
    ])
    expect(parseActionBeforeHero(['BB bets all-in for 12bb'], 'BTN', 6)).toEqual([
      { position: 'BB', kind: 'allin', betBb: 12, isBet: true },
    ])
  })

  it('a preflop raise is NOT flagged as a bet — the two read differently on the felt', () => {
    expect(parseActionBeforeHero(['BTN raises to 2.3bb'], 'BB', 6)).toEqual([
      { position: 'BTN', kind: 'raise', betBb: 2.3 },
    ])
  })

  it('still refuses to guess at prose it does not understand', () => {
    expect(parseActionBeforeHero(['BTN bets pot on the river'], 'BB', 6)).toBeUndefined()
  })
})

describe('canRenderPostflopTable — the shared gate', () => {
  it('accepts a scene with a real hand attached', () => {
    expect(canRenderPostflopTable(CSD_S4B)).toBe(true)
  })

  it('rejects a board-only illustration with no action at all', () => {
    expect(canRenderPostflopTable({
      hero_position: 'BTN',
      table_size: 6,
      board: ['Js', '6h', '6d'],
    } as LessonStep)).toBe(false)
  })

  it('rejects a step with no board (that is a preflop table)', () => {
    expect(canRenderPostflopTable({
      hero_position: 'BTN',
      table_size: 6,
      action_before_hero: ['BTN raises to 2.3bb'],
    } as LessonStep)).toBe(false)
  })
})

describe('curriculum — every postflop scenario step now drives a table', () => {
  const MIGRATED: [string, string][] = [
    ['cbet-not-automatic', 'cna-s5'],
    ['cbet-not-automatic', 'cna-s6'],
    ['cbet-not-automatic', 'cna-s7'],
    ['high-frequency-cbets', 'hfc-s3'],
    ['high-frequency-cbets', 'hfc-s5'],
    ['cbet-slows-down', 'csd-s4b'],
    ['small-bet-or-big-bet', 'sbb-s11'],
    ['small-bet-or-big-bet', 'sbb-s15'],
    ['from-hands-to-combos', 'fhr-s1'],
    ['block-the-value', 'btv-s1'],
    ['block-the-value', 'btv-rd1'],
    ['block-the-value', 'btv-rd2'],
    ['block-the-value', 'btv-rd3'],
  ]

  for (const [lessonId, stepId] of MIGRATED) {
    it(`${lessonId}/${stepId} renders as a table`, () => {
      const step = LESSONS_BY_ID[lessonId].steps.find((s) => s.id === stepId)!
      expect(step, `${stepId} missing`).toBeTruthy()
      expect(canRenderPostflopTable(step), `${stepId} would still fall back to the text card`).toBe(true)
    })
  }

  it('no postflop step keeps a current-street action buried in its preflop history', () => {
    const offenders: string[] = []
    for (const lesson of Object.values(LESSONS_BY_ID)) {
      for (const step of lesson.steps) {
        if (!step.board?.length || !step.action_before_hero?.length) continue
        // A postflop scene's `action_before_hero` is preflop only. A trailing
        // check/bet by a player who already acted preflop is the tell that the
        // street boundary was never split out.
        const parsed = parseActionBeforeHero(step.action_before_hero, step.hero_position ?? 'BTN', step.table_size ?? 9)
        if (!parsed) continue
        const seen = new Set<string>()
        for (const a of parsed) {
          if (seen.has(a.position)) offenders.push(`${lesson.id}/${step.id}: ${a.position} acts twice preflop`)
          seen.add(a.position)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

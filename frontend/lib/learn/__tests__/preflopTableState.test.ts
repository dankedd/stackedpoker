import { describe, it, expect } from 'vitest'
import {
  preflopActionOrder,
  positionsBeforeHero,
  parseActionBeforeHero,
  latestActionBySeat,
  buildPreflopTableRenderState,
  deriveCenterStatus,
  dealerPosition,
  SB_BB,
  BB_BB,
} from '../preflopTableState'

describe('preflopActionOrder — derived from canonical clockwise seat order, never hardcoded per size', () => {
  it('9-max: UTG through BB, in real preflop action order', () => {
    expect(preflopActionOrder(9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
  })

  it('6-max: no UTG+1/UTG+2/LJ (they do not exist at this table size)', () => {
    expect(preflopActionOrder(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
  })

  it('2-max (heads-up): SB/BTN acts first, BB second', () => {
    expect(preflopActionOrder(2)).toEqual(['BTN', 'BB'])
  })
})

describe('positionsBeforeHero — the core of correct fold-state derivation (spec item 14)', () => {
  it('UTG: nobody acts before Hero (first to act)', () => {
    expect(positionsBeforeHero('UTG', 9)).toEqual([])
  })

  it('UTG+1: only UTG acts before Hero', () => {
    expect(positionsBeforeHero('UTG+1', 9)).toEqual(['UTG'])
  })

  it('UTG+2: UTG and UTG+1 act before Hero', () => {
    expect(positionsBeforeHero('UTG+2', 9)).toEqual(['UTG', 'UTG+1'])
  })

  it('LJ: everyone from UTG through UTG+2 acts before Hero', () => {
    expect(positionsBeforeHero('LJ', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2'])
  })

  it('HJ: everyone from UTG through LJ acts before Hero', () => {
    expect(positionsBeforeHero('HJ', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ'])
  })

  it('CO: everyone from UTG through HJ acts before Hero', () => {
    expect(positionsBeforeHero('CO', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ'])
  })

  it('BTN: every non-blind position acts before Hero', () => {
    expect(positionsBeforeHero('BTN', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'])
  })

  it('SB: every non-blind position acts before Hero (dealer button included)', () => {
    expect(positionsBeforeHero('SB', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'])
  })

  it('BB: everyone else acts before Hero', () => {
    expect(positionsBeforeHero('BB', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'])
  })

  it('6-max HJ: only UTG acts before Hero (no UTG+1/UTG+2/LJ at this size)', () => {
    expect(positionsBeforeHero('HJ', 6)).toEqual(['UTG'])
  })
})

describe('dealerPosition / blind constants', () => {
  it('dealer is always the BTN seat', () => {
    expect(dealerPosition()).toBe('BTN')
  })

  it('SB/BB are the standard 0.5bb / 1bb forced blinds', () => {
    expect(SB_BB).toBe(0.5)
    expect(BB_BB).toBe(1)
  })
})

describe('parseActionBeforeHero — the existing action_before_hero field, parsed not guessed', () => {
  it('undefined entries → undefined (unknown; caller must not fabricate a fold-state row)', () => {
    expect(parseActionBeforeHero(undefined, 'CO', 9)).toBeUndefined()
  })

  it('empty array → Hero is first to act', () => {
    expect(parseActionBeforeHero([], 'UTG', 9)).toEqual([])
  })

  it('"Everyone folds" expands to every position before Hero, all folded', () => {
    expect(parseActionBeforeHero(['Everyone folds'], 'CO', 9)).toEqual([
      { position: 'UTG', kind: 'fold' },
      { position: 'UTG+1', kind: 'fold' },
      { position: 'UTG+2', kind: 'fold' },
      { position: 'LJ', kind: 'fold' },
      { position: 'HJ', kind: 'fold' },
    ])
  })

  it('parses a facing-open sequence: folds + a real raise size', () => {
    expect(parseActionBeforeHero(['UTG folds', 'HJ raises to 2.3bb'], 'CO', 9)).toEqual([
      { position: 'UTG', kind: 'fold' },
      { position: 'HJ', kind: 'raise', betBb: 2.3 },
    ])
  })

  it('parses a squeeze sequence: an open and a flat call', () => {
    expect(parseActionBeforeHero(['CO raises to 2.3bb', 'BTN calls'], 'SB', 9)).toEqual([
      { position: 'CO', kind: 'raise', betBb: 2.3 },
      { position: 'BTN', kind: 'call' },
    ])
  })

  it('parses limps and checks', () => {
    expect(parseActionBeforeHero(['UTG limps', 'HJ limps'], 'CO', 9)).toEqual([
      { position: 'UTG', kind: 'limp' },
      { position: 'HJ', kind: 'limp' },
    ])
  })

  it('parses an all-in shove', () => {
    expect(parseActionBeforeHero(['BB raises all-in to 15bb'], 'BTN', 9)).toEqual([
      { position: 'BB', kind: 'allin', betBb: 15 },
    ])
  })

  it('flags a "Hero raises to Nbb" entry as Hero\'s own prior action (rejam spots)', () => {
    const parsed = parseActionBeforeHero(['Hero raises to 2bb', 'SB folds', 'BB raises all-in to 15bb'], 'BTN', 9)
    expect(parsed).toEqual([
      { position: 'BTN', kind: 'raise', betBb: 2, isHero: true },
      { position: 'SB', kind: 'fold' },
      { position: 'BB', kind: 'allin', betBb: 15 },
    ])
  })

  it('an unparseable entry degrades to undefined rather than guessing', () => {
    expect(parseActionBeforeHero(['UTG does something weird'], 'CO', 9)).toBeUndefined()
  })
})

describe('latestActionBySeat — a seat\'s most recent action wins if mentioned more than once', () => {
  it('keeps only the last entry per position', () => {
    const map = latestActionBySeat([
      { position: 'BTN', kind: 'raise', betBb: 2 },
      { position: 'BTN', kind: 'allin', betBb: 40 },
    ])
    expect(map.get('BTN')).toEqual({ position: 'BTN', kind: 'allin', betBb: 40 })
  })
})

describe('buildPreflopTableRenderState — full derivation entry point', () => {
  it('returns undefined when there is no hero_position at all', () => {
    expect(buildPreflopTableRenderState({})).toBeUndefined()
  })

  it('Hero UTG: bottom-center seat is UTG, heroIsFirstToAct is true, no folds fabricated', () => {
    const state = buildPreflopTableRenderState({ hero_position: 'UTG', table_size: 9, action_before_hero: [] })!
    expect(state.heroPosition).toBe('UTG')
    expect(state.heroIsFirstToAct).toBe(true)
    expect(state.seats.find((s) => s.isHero)?.position).toBe('UTG')
    expect(state.seats.every((s) => s.position === 'UTG' || s.action === undefined)).toBe(true)
  })

  it('Hero UTG+1: UTG shows folded, Hero does not', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'UTG+1', table_size: 9, action_before_hero: ['UTG folds'],
    })!
    expect(state.seats.find((s) => s.position === 'UTG')?.action?.kind).toBe('fold')
    expect(state.seats.find((s) => s.isHero)?.action).toBeUndefined()
  })

  it('Hero HJ: every earlier position (UTG, UTG+1, UTG+2, LJ) shows folded', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'HJ', table_size: 9, action_before_hero: ['Everyone folds'],
    })!
    for (const pos of ['UTG', 'UTG+1', 'UTG+2', 'LJ']) {
      expect(state.seats.find((s) => s.position === pos)?.action?.kind).toBe('fold')
    }
  })

  it('Hero BTN: UTG through CO all show folded, dealer button is on Hero\'s own seat', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BTN', table_size: 9, action_before_hero: ['Everyone folds'],
    })!
    for (const pos of ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']) {
      expect(state.seats.find((s) => s.position === pos)?.action?.kind).toBe('fold')
    }
    const heroSeat = state.seats.find((s) => s.isHero)!
    expect(heroSeat.position).toBe('BTN')
    expect(heroSeat.isDealer).toBe(true)
  })

  it('Hero SB: BTN dealer marker is correct and independent of Hero, SB/BB post the right blinds', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'SB', table_size: 9, action_before_hero: ['Everyone folds'],
    })!
    const btnSeat = state.seats.find((s) => s.position === 'BTN')!
    expect(btnSeat.isDealer).toBe(true)
    expect(btnSeat.isHero).toBe(false)
    expect(state.seats.find((s) => s.position === 'SB')?.postedBlindBb).toBe(SB_BB)
    expect(state.seats.find((s) => s.position === 'BB')?.postedBlindBb).toBe(BB_BB)
  })

  it('Hero BB: positional mapping is correct and BB posts its own blind', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 9, action_before_hero: ['Everyone folds', ],
    })!
    expect(state.seats.find((s) => s.isHero)?.position).toBe('BB')
    expect(state.seats.find((s) => s.isHero)?.postedBlindBb).toBe(BB_BB)
  })

  it('facing an open: the opener\'s action is visible on their own seat, not Hero\'s', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BTN', table_size: 9, action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb'],
    })!
    expect(state.seats.find((s) => s.position === 'CO')?.action).toEqual({ position: 'CO', kind: 'raise', betBb: 2.3 })
    expect(state.seats.find((s) => s.isHero)?.action).toBeUndefined()
  })

  it('squeeze spot: both the opener\'s raise and the caller\'s call are visible', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'SB', table_size: 9, action_before_hero: ['CO raises to 2.3bb', 'BTN calls'],
    })!
    expect(state.seats.find((s) => s.position === 'CO')?.action?.kind).toBe('raise')
    expect(state.seats.find((s) => s.position === 'BTN')?.action?.kind).toBe('call')
  })

  it('carries ante_bb through untouched (never invented when absent)', () => {
    const withAnte = buildPreflopTableRenderState({ hero_position: 'CO', table_size: 9, ante_bb: 0.125 })!
    expect(withAnte.anteBb).toBe(0.125)
    const withoutAnte = buildPreflopTableRenderState({ hero_position: 'CO', table_size: 9 })!
    expect(withoutAnte.anteBb).toBeUndefined()
  })

  it('unknown action_before_hero (undefined) never fabricates fold state for earlier seats', () => {
    const state = buildPreflopTableRenderState({ hero_position: 'CO', table_size: 9 })!
    expect(state.actionsBeforeHero).toBeUndefined()
    expect(state.seats.every((s) => s.action === undefined)).toBe(true)
  })
})

describe('deriveCenterStatus — a one-line orientation summary, never a hand-history paragraph', () => {
  it('UTG: FIRST TO ACT', () => {
    const state = buildPreflopTableRenderState({ hero_position: 'UTG', table_size: 9, action_before_hero: [] })!
    expect(deriveCenterStatus(state)).toBe('FIRST TO ACT')
  })

  it('CO with everyone folding: ACTION FOLDED TO CO', () => {
    const state = buildPreflopTableRenderState({ hero_position: 'CO', table_size: 9, action_before_hero: ['Everyone folds'] })!
    expect(deriveCenterStatus(state)).toBe('ACTION FOLDED TO CO')
  })

  it('facing a single open: "<POS> OPEN"', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BTN', table_size: 9, action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb'],
    })!
    expect(deriveCenterStatus(state)).toBe('CO OPEN')
  })

  it('squeeze: "<POS> OPEN · <POS> CALL"', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'SB', table_size: 9, action_before_hero: ['CO raises to 2.3bb', 'BTN calls'],
    })!
    expect(deriveCenterStatus(state)).toBe('CO OPEN · BTN CALL')
  })

  it('unknown action data: no summary is fabricated', () => {
    const state = buildPreflopTableRenderState({ hero_position: 'CO', table_size: 9 })!
    expect(deriveCenterStatus(state)).toBeUndefined()
  })
})

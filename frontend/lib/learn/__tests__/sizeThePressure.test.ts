/**
 * Regression tests for Module 4's "Size the Pressure" lesson — pins the fix
 * for stp-s4, which previously (a) never showed Hero's own 3-bet on the table
 * at all (action_before_hero stopped after the blinds folded, so only CO's
 * open was visible) and (b) used an illegal size ("3bb" over a 2.3bb open is
 * below the real poker minimum reraise of 2.3 + (2.3 - 1) = 3.6bb).
 */
import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { buildPreflopTableRenderState, deriveCenterStatus } from '../preflopTableState'
import type { LessonStep } from '../types'

function findStep(id: string): LessonStep {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === id)
  if (!step) throw new Error(`fixture step '${id}' not found in curriculum — has it been renamed?`)
  return step
}

/** Real no-limit hold'em minimum-reraise rule: a raise must increase the bet
 *  by at least the size of the last raise increment. */
function minLegalRaiseTo(currentBetBb: number, lastRaiseIncrementBb: number): number {
  return currentBetBb + lastRaiseIncrementBb
}

describe('stp-s4 — the critiqued 3-bet is actually visualized on the table', () => {
  const step = findStep('stp-s4')

  it('action_before_hero includes Hero\'s own completed 3-bet, not just CO\'s open', () => {
    const heroEntry = step.action_before_hero!.find((a) => /^(Hero|BB)\s+raises/i.test(a))
    expect(heroEntry, `action_before_hero=${JSON.stringify(step.action_before_hero)}`).toBeDefined()
  })

  it('the narrative\'s stated 3-bet size matches the size actually animated on the table', () => {
    const narrativeMatch = step.narrative!.match(/3-bets? to (?:just )?(\d+(?:\.\d+)?)bb/i)
    const actionMatch = step.action_before_hero!.join(' ').match(/(?:Hero|BB) raises to (\d+(?:\.\d+)?)bb/i)
    expect(narrativeMatch, step.narrative).toBeDefined()
    expect(actionMatch, JSON.stringify(step.action_before_hero)).toBeDefined()
    expect(parseFloat(narrativeMatch![1])).toBe(parseFloat(actionMatch![1]))
  })

  it('the table state shows the pot and center status reflecting the 3-bet, not the open', () => {
    const state = buildPreflopTableRenderState({
      hero_position: step.hero_position,
      table_size: step.table_size,
      action_before_hero: step.action_before_hero,
      effective_stack_bb: step.effective_stack_bb,
    })!
    const status = deriveCenterStatus(state)
    expect(status).toContain('3-BET')
    expect(status).not.toBe('CO OPEN') // the open must not be the animation's endpoint

    const bb = state.seats.find((s) => s.position === 'BB')!
    const co = state.seats.find((s) => s.position === 'CO')!
    expect(bb.committedBb).toBeGreaterThan(co.committedBb) // Hero is the last aggressor
    expect(state.potBb).toBeCloseTo(0.5 + co.committedBb + bb.committedBb, 5)
  })

  it('the 3-bet size is a LEGAL raise over CO\'s 2.3bb open (>= min reraise of 3.6bb)', () => {
    const actionMatch = step.action_before_hero!.join(' ').match(/(?:Hero|BB) raises to (\d+(?:\.\d+)?)bb/i)
    const threeBetSize = parseFloat(actionMatch![1])
    const openSize = 2.3
    const bigBlind = 1
    const minLegal = minLegalRaiseTo(openSize, openSize - bigBlind)
    expect(threeBetSize).toBeGreaterThanOrEqual(minLegal)
  })

  it('the answer key is unchanged: this is still a "spot the too-small sizing" exercise', () => {
    const perfect = step.options!.find((o) => o.quality === 'perfect')!
    expect(perfect.id).toBe('great_price')
    expect(perfect.label.toLowerCase()).toContain('better price')
  })
})

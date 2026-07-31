/**
 * Regression tests for `MTT_RFI_FOUNDATIONS` (mttRfiRanges.ts) — the "obvious core"
 * prefills for `range_build_multi` steps. Every foundation must only ever prefill a
 * hand with the action the REAL chart actually assigns it (never a guessed/invented
 * action), and only for hands that chart considers a clean, non-mixed decision — a
 * prefill is meant to hand the learner a fact they shouldn't have to think about, not
 * quietly put words in the solver's mouth.
 */
import { describe, it, expect } from 'vitest'
import { MTT_RFI_CHARTS } from '../mttRfiBaselines'
import { MTT_RFI_FOUNDATIONS } from '../mttRfiRanges'
import { isMixedHand } from '../mttRfiRanges'
import { comboCount } from '../handGrid'
import { LESSONS } from '../curriculum'

describe('MTT_RFI_FOUNDATIONS — every prefilled hand matches its real chart action', () => {
  for (const [foundationKey, foundation] of Object.entries(MTT_RFI_FOUNDATIONS)) {
    const chart = MTT_RFI_CHARTS[foundation.chartKey]

    it(`${foundationKey}: target chart "${foundation.chartKey}" exists`, () => {
      expect(chart, `${foundationKey} references unknown chart ${foundation.chartKey}`).toBeDefined()
    })

    for (const [hand, prefilledAction] of Object.entries(foundation.hands)) {
      it(`${foundationKey}: ${hand} is prefilled as '${prefilledAction}', a clean (non-mixed) decision in ${foundation.chartKey}`, () => {
        const cell = chart.cells.find((c) => c.hand === hand)
        expect(cell, `${hand} is absent from ${foundation.chartKey} (would mean 100% fold) but is prefilled as '${prefilledAction}'`).toBeDefined()
        expect(isMixedHand(cell!.actions), `${hand} is a genuinely mixed hand in ${foundation.chartKey} — should not be prefilled`).toBe(false)
        const dominantAction = Object.entries(cell!.actions).sort((a, b) => b[1] - a[1])[0][0]
        expect(dominantAction, `${hand} prefilled as '${prefilledAction}' but the chart's real action is '${dominantAction}'`).toBe(prefilledAction)
      })
    }
  }
})

describe('UTG_RFI_60BB_foundation — widened from "only 99+" to ~60% of the range (Module 3, UTG Mastery)', () => {
  const foundation = MTT_RFI_FOUNDATIONS.UTG_RFI_60BB_foundation
  const chart = MTT_RFI_CHARTS.UTG_RFI_60BB

  const totalRaiseWeightedCombos = chart.cells.reduce((sum, c) => sum + comboCount(c.hand) * (c.actions.raise ?? 0), 0)
  const prefilledCombos = Object.keys(foundation.hands).reduce((sum, hand) => sum + comboCount(hand), 0)

  it('prefills the expected 21 hand-classes', () => {
    expect(Object.keys(foundation.hands).sort()).toEqual(
      ['AA', 'AJs', 'AKo', 'AKs', 'AQo', 'AQs', 'JJ', 'JTs', 'KJs', 'KK', 'KQo', 'KQs', 'KTs', 'QJs', 'QQ', 'QTs', 'TT', '66', '77', '88', '99'].sort(),
    )
  })

  it('is roughly 60% of the chart\'s raise-weighted combos (not the old ~13%, not a full rebuild)', () => {
    const pct = prefilledCombos / totalRaiseWeightedCombos
    expect(pct).toBeGreaterThan(0.55)
    expect(pct).toBeLessThan(0.65)
  })

  it('leaves every genuinely mixed-frequency hand for the learner', () => {
    const mixedHands = chart.cells.filter((c) => isMixedHand(c.actions)).map((c) => c.hand)
    expect(mixedHands.length).toBeGreaterThan(0)
    for (const hand of mixedHands) {
      expect(foundation.hands[hand], `${hand} is mixed-frequency but was prefilled`).toBeUndefined()
    }
  })

  it('leaves the marginal-tier pure hands (weaker suited Aces, marginal suited broadways/connectors, borderline offsuit broadways) for the learner', () => {
    const leftForLearner = ['AJo', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'K9s', 'Q9s', 'T9s']
    for (const hand of leftForLearner) {
      expect(foundation.hands[hand], `${hand} should be left for the learner, not prefilled`).toBeUndefined()
    }
  })
})

describe('"UTG Mastery" (utg-s6) — updated copy reflects the new obvious-core prefill', () => {
  const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'utg-s6')

  it('exists and is unchanged in scoring shape (xp, chart, diff review)', () => {
    expect(step).toBeTruthy()
    expect(step!.xp).toBe(24)
    expect(step!.range_build_multi_chart).toBe('UTG_RFI_60BB')
    expect(step!.range_build_multi_show_diff).toBe(true)
  })

  it('no longer describes the prefill as "only the pure top pairs" / "Only 99+"', () => {
    expect(step!.narrative ?? '').not.toContain('only the pure top pairs')
    expect(step!.range_build_multi_prefilled_note ?? '').not.toContain('Only 99+')
  })

  it('describes the prefill as the obvious core, marginal hands left to the learner', () => {
    expect(step!.range_build_multi_prefilled_note).toContain('obvious core')
    expect(step!.range_build_multi_prefilled_note).toContain('marginal')
  })
})

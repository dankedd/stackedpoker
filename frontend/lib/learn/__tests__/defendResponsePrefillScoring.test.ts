import { describe, it, expect } from 'vitest'
import { diagnoseDefendRangeShape, DEFEND_RESPONSE_FOUNDATIONS } from '../defendResponseRanges'
import { DEFEND_RESPONSE_CHARTS } from '../defendResponseBaselines'
import { LESSONS } from '../curriculum'
import { resolveMultiPrefilledAssignments } from '../multiActionRangePrefill'

/**
 * hj-s5's foundation prefills ~59% of HJ_vs_UTG_60BB's combos (the obvious value
 * 3-bets and mandatory pocket-pair/broadway calls) so the learner isn't clicking
 * through hands with no real decision. The requirement this guards: those
 * prefilled hands must never earn (or cost) points unless the learner actually
 * changes them — otherwise a large foundation would silently pad the score with
 * combos nobody actually decided on.
 */
describe('diagnoseDefendRangeShape — prefilled hands are excluded from scoring unless touched', () => {
  const chart = DEFEND_RESPONSE_CHARTS.HJ_vs_UTG_60BB
  const foundation = DEFEND_RESPONSE_FOUNDATIONS.HJ_vs_UTG_60BB_foundation.hands

  it('a submission that only reproduces the foundation (learner touched nothing new) scores as if nothing was assessed', () => {
    const { accuracy } = diagnoseDefendRangeShape(chart, { ...foundation }, foundation)
    // Every hand outside the foundation defaults to 'fold' in `assignments` (absent),
    // which is wrong for most of them (the chart's remaining hands are mostly calls/3bets)
    // — so leaving them untouched should score LOW, not high, proving the foundation
    // itself isn't quietly inflating the result.
    expect(accuracy).toBeLessThan(0.3)
  })

  it('correctly completing every remaining hand (foundation left untouched) scores perfect', () => {
    const fullCorrect: Record<string, string> = { ...foundation }
    for (const cell of chart.cells) {
      if (!(cell.hand in fullCorrect)) fullCorrect[cell.hand] = Object.keys(cell.actions)[0]
    }
    const { accuracy } = diagnoseDefendRangeShape(chart, fullCorrect as any, foundation)
    expect(accuracy).toBe(1)
  })

  it('changing a prefilled hand to the WRONG action is graded normally (counts against the learner)', () => {
    const fullCorrect: Record<string, string> = { ...foundation }
    for (const cell of chart.cells) {
      if (!(cell.hand in fullCorrect)) fullCorrect[cell.hand] = Object.keys(cell.actions)[0]
    }
    const baseline = diagnoseDefendRangeShape(chart, fullCorrect as any, foundation).accuracy
    // AA is prefilled as '3bet' (correct) — flip it to 'fold', a real mistake.
    const withMistake = { ...fullCorrect, AA: 'fold' }
    const { accuracy } = diagnoseDefendRangeShape(chart, withMistake as any, foundation)
    expect(accuracy).toBeLessThan(baseline)
  })

  it('changing a prefilled hand back to the SAME action it already had does not affect the score either way', () => {
    const fullCorrect: Record<string, string> = { ...foundation }
    for (const cell of chart.cells) {
      if (!(cell.hand in fullCorrect)) fullCorrect[cell.hand] = Object.keys(cell.actions)[0]
    }
    const a = diagnoseDefendRangeShape(chart, fullCorrect as any, foundation).accuracy
    const b = diagnoseDefendRangeShape(chart, { ...fullCorrect } as any, foundation).accuracy
    expect(a).toBe(b)
  })

  it('with no prefilled map passed (default {}), grading falls back to the original whole-chart behavior', () => {
    const { accuracy } = diagnoseDefendRangeShape(chart, { ...foundation })
    // Now the foundation IS scored as part of the population (old behavior) — should
    // land somewhere in the middle, not near-zero like the excluded-scoring case above.
    expect(accuracy).toBeGreaterThan(0.3)
    expect(accuracy).toBeLessThan(1)
  })
})

describe('hj-s5 — the "Build Your Defense Range" HJ step wires up the real foundation', () => {
  it('resolves the ~59% HJ_vs_UTG_60BB_foundation, not an empty grid', () => {
    const step = LESSONS.flatMap((l) => l.steps).find((s) => s.id === 'hj-s5')!
    const prefilled = resolveMultiPrefilledAssignments(step)
    const chart = DEFEND_RESPONSE_CHARTS.HJ_vs_UTG_60BB
    const totalCombos = chart.cells.reduce((sum, c) => sum + (c.hand.endsWith('s') ? 4 : c.hand.endsWith('o') ? 12 : 6), 0)
    const prefilledCombos = Object.keys(prefilled).reduce(
      (sum, h) => sum + (h.endsWith('s') ? 4 : h.endsWith('o') ? 12 : 6),
      0,
    )
    const pct = prefilledCombos / totalCombos
    expect(pct).toBeGreaterThan(0.5)
    expect(pct).toBeLessThan(0.7)
  })
})

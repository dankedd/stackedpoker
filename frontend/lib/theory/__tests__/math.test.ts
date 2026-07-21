import { describe, it, expect } from 'vitest'
import {
  requiredEquityFromPot,
  drawProbabilityNextCard,
  drawProbabilityByRiver,
  calculateCallEV,
  bluffBreakEvenFrequency,
  calculateSimpleEqR,
} from '../math'

describe('requiredEquityFromPot', () => {
  it('pot 100, villain bets 100 -> 33.3%', () => {
    // pot-before-call includes villain's bet already in the middle
    expect(requiredEquityFromPot(200, 100)).toBeCloseTo(33.33, 1)
  })

  it('pot 100, villain bets 50 -> 25%', () => {
    expect(requiredEquityFromPot(150, 50)).toBeCloseTo(25, 5)
  })

  it('pot 60, villain bets 30 -> 25%', () => {
    expect(requiredEquityFromPot(90, 30)).toBeCloseTo(25, 5)
  })
})

describe('drawProbabilityNextCard', () => {
  it('9 outs / 47 unseen ≈ 19.1%', () => {
    expect(drawProbabilityNextCard(9, 47) * 100).toBeCloseTo(19.15, 1)
  })

  it('clamps to 1 when outs exceed unseen', () => {
    expect(drawProbabilityNextCard(60, 47)).toBe(1)
  })
})

describe('drawProbabilityByRiver', () => {
  it('9 outs by the river ≈ 35.0%', () => {
    expect(drawProbabilityByRiver(9, 47) * 100).toBeCloseTo(34.97, 1)
  })

  it('is always >= the single-card probability', () => {
    const next = drawProbabilityNextCard(8, 47)
    const river = drawProbabilityByRiver(8, 47)
    expect(river).toBeGreaterThan(next)
  })
})

describe('calculateCallEV', () => {
  it('matches the worked example: 40% win +150, 60% lose -50 -> +30', () => {
    expect(calculateCallEV(0.4, 150, 0.6, -50)).toBeCloseTo(30, 5)
  })
})

describe('bluffBreakEvenFrequency', () => {
  it('pot-sized bluff needs 50% folds', () => {
    expect(bluffBreakEvenFrequency(100, 100) * 100).toBeCloseTo(50, 5)
  })
})

describe('calculateSimpleEqR', () => {
  it('40% raw equity, 32% captured -> 80% realization', () => {
    expect(calculateSimpleEqR(40, 32)).toBeCloseTo(0.8, 5)
  })

  it('returns 0 when raw equity is 0', () => {
    expect(calculateSimpleEqR(0, 10)).toBe(0)
  })
})

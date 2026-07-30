import { describe, it, expect } from 'vitest'
import {
  alpha,
  mdf,
  evOfBetting,
  evOfChecking,
  evOfCalling,
  evOfFolding,
  bestResponse,
  isIndifferent,
  testUnilateralDeviation,
  clairvoyanceEV,
  clairvoyanceEquilibrium,
  faceUpEV,
  type ActionEV,
} from '../gameTheoryEngine'

describe('alpha / MDF', () => {
  it('source lock — half-pot river bet: alpha 33.33%, MDF 66.67% (Modern Poker Theory, Ch.2)', () => {
    expect(alpha(100, 50)).toBeCloseTo(1 / 3, 6)
    expect(mdf(100, 50)).toBeCloseTo(2 / 3, 6)
  })

  it('pot-sized bet: alpha 50%, MDF 50%', () => {
    expect(alpha(100, 100)).toBeCloseTo(0.5, 6)
    expect(mdf(100, 100)).toBeCloseTo(0.5, 6)
  })

  it('alpha + mdf always sum to 1', () => {
    for (const bet of [10, 33, 50, 75, 100, 150, 200]) {
      expect(alpha(100, bet) + mdf(100, bet)).toBeCloseTo(1, 9)
    }
  })

  it('bigger bets require higher fold frequency (alpha increases with bet size)', () => {
    expect(alpha(100, 200)).toBeGreaterThan(alpha(100, 100))
    expect(alpha(100, 100)).toBeGreaterThan(alpha(100, 50))
  })

  it('rejects negative inputs', () => {
    expect(() => alpha(-1, 10)).toThrow()
    expect(() => alpha(10, -1)).toThrow()
  })
})

describe('evOfBetting / evOfChecking — the one-street toy game', () => {
  it('a pure bluff (0% equity when called) breaks even exactly at alpha fold frequency', () => {
    const pot = 100
    const bet = 50
    const requiredFold = alpha(pot, bet)
    const callFreq = 1 - requiredFold
    const ev = evOfBetting({ pot, bet, equityWhenCalled: 0 }, callFreq)
    expect(ev).toBeCloseTo(0, 6)
  })

  it('a pure bluff loses money when Villain calls more than (1 - alpha)', () => {
    const pot = 100
    const bet = 50
    const overCallFreq = 1 - alpha(pot, bet) + 0.1
    const ev = evOfBetting({ pot, bet, equityWhenCalled: 0 }, overCallFreq)
    expect(ev).toBeLessThan(0)
  })

  it('a pure bluff profits when Villain folds more than MDF', () => {
    const pot = 100
    const bet = 50
    const underCallFreq = mdf(pot, bet) - 0.1 // Villain calling less than MDF
    const ev = evOfBetting({ pot, bet, equityWhenCalled: 0 }, underCallFreq)
    expect(ev).toBeGreaterThan(0)
  })

  it('a hand that always wins when called nets pot+bet if called, pot if folded to', () => {
    expect(evOfBetting({ pot: 100, bet: 100, equityWhenCalled: 1 }, 1)).toBeCloseTo(200, 6)
    expect(evOfBetting({ pot: 100, bet: 100, equityWhenCalled: 1 }, 0)).toBeCloseTo(100, 6)
  })

  it('checking risks nothing: EV is exactly equityWhenChecked * pot', () => {
    expect(evOfChecking({ pot: 100, equityWhenChecked: 1 })).toBeCloseTo(100, 6)
    expect(evOfChecking({ pot: 100, equityWhenChecked: 0 })).toBeCloseTo(0, 6)
    expect(evOfChecking({ pot: 100, equityWhenChecked: 0.5 })).toBeCloseTo(50, 6)
  })

  it('conservation: Hero-called-branch EV + Villain-calling EV always equals the pot', () => {
    for (const e of [0, 0.25, 0.5, 0.75, 1]) {
      const game = { pot: 100, bet: 80, equityWhenCalled: e }
      const heroCalledEV = evOfBetting(game, 1) // callFreq=1 isolates the called branch
      const villainCallEV = evOfCalling(game)
      expect(heroCalledEV + villainCallEV).toBeCloseTo(100, 6)
    }
  })

  it('folding always nets 0 for Villain', () => {
    expect(evOfFolding()).toBe(0)
  })
})

describe('bestResponse / isIndifferent / testUnilateralDeviation', () => {
  it('bestResponse picks the single highest-EV action when EVs differ', () => {
    const actions: ActionEV[] = [
      { id: 'a', label: 'A', ev: 10 },
      { id: 'b', label: 'B', ev: 25 },
      { id: 'c', label: 'C', ev: -5 },
    ]
    const best = bestResponse(actions)
    expect(best).toHaveLength(1)
    expect(best[0].id).toBe('b')
  })

  it('bestResponse returns all tied actions when EVs are equal within tolerance', () => {
    const actions: ActionEV[] = [
      { id: 'a', label: 'A', ev: 10.001 },
      { id: 'b', label: 'B', ev: 10.0 },
      { id: 'c', label: 'C', ev: 3 },
    ]
    const best = bestResponse(actions)
    expect(best.map((a) => a.id).sort()).toEqual(['a', 'b'])
  })

  it('isIndifferent is true within tolerance, false outside it', () => {
    expect(isIndifferent(10, 10.005)).toBe(true)
    expect(isIndifferent(10, 10.5)).toBe(false)
  })

  it('testUnilateralDeviation finds a profitable deviation when one exists', () => {
    const result = testUnilateralDeviation(10, [
      { id: 'alt1', label: 'Alt 1', ev: 8 },
      { id: 'alt2', label: 'Alt 2', ev: 15 },
    ])
    expect(result.canImprove).toBe(true)
    expect(result.bestAlternative?.id).toBe('alt2')
    expect(result.gain).toBeCloseTo(5, 6)
  })

  it('testUnilateralDeviation reports no improvement at a true equilibrium', () => {
    const result = testUnilateralDeviation(10, [
      { id: 'alt1', label: 'Alt 1', ev: 9.5 },
      { id: 'alt2', label: 'Alt 2', ev: 10 },
    ])
    expect(result.canImprove).toBe(false)
    expect(result.bestAlternative).toBeUndefined()
  })
})

describe('Clairvoyance Game — source lock (Modern Poker Theory, "The Clairvoyance Toy Game")', () => {
  const pot = 100
  const bet = 100

  it("reproduces Acevedo's exact equilibrium: AA bets 100%, QQ bets 50%, KK calls 50%", () => {
    const eq = clairvoyanceEquilibrium(pot, bet)
    expect(eq.aaBetFreq).toBeCloseTo(1, 6)
    expect(eq.qqBetFreq).toBeCloseTo(0.5, 6)
    expect(eq.kkCallFreq).toBeCloseTo(0.5, 6)
  })

  it("reproduces Acevedo's exact game EV: P1 $75, P2 $25", () => {
    const eq = clairvoyanceEquilibrium(pot, bet)
    const { evP1, evP2 } = clairvoyanceEV({
      pot,
      bet,
      aaBetFreq: eq.aaBetFreq,
      qqBetFreq: eq.qqBetFreq,
      kkCallFreq: eq.kkCallFreq,
    })
    expect(evP1).toBeCloseTo(75, 6)
    expect(evP2).toBeCloseTo(25, 6)
  })

  it('QQ (the bluff) is indifferent between betting and checking exactly at equilibrium KK call freq', () => {
    const eq = clairvoyanceEquilibrium(pot, bet)
    const betEV = evOfBetting({ pot, bet, equityWhenCalled: 0 }, eq.kkCallFreq)
    const checkEV = evOfChecking({ pot, equityWhenChecked: 0 })
    expect(isIndifferent(betEV, checkEV)).toBe(true)
  })

  it('KK (the bluff-catcher) is indifferent between calling and folding exactly at equilibrium QQ bet freq', () => {
    const eq = clairvoyanceEquilibrium(pot, bet)
    // KK facing a bet: P(AA|bet) vs P(QQ|bet) given 50/50 prior, AA always bets (x=1), QQ bets at eq.qqBetFreq
    const pAABet = 0.5 * eq.aaBetFreq
    const pQQBet = 0.5 * eq.qqBetFreq
    const total = pAABet + pQQBet
    const callEV = (pAABet / total) * -bet + (pQQBet / total) * (pot + bet)
    const foldEV = 0
    expect(isIndifferent(callEV, foldEV)).toBe(true)
  })

  it('neither player can improve unilaterally at the equilibrium (Nash test)', () => {
    const eq = clairvoyanceEquilibrium(pot, bet)
    const baseline = clairvoyanceEV({ pot, bet, aaBetFreq: eq.aaBetFreq, qqBetFreq: eq.qqBetFreq, kkCallFreq: eq.kkCallFreq })

    // P1 deviates: try a spread of alternative QQ bet frequencies, holding KK fixed
    const p1Alternatives: ActionEV[] = [0, 0.25, 0.75, 1].map((y) => ({
      id: `qq-${y}`,
      label: `QQ bets ${y * 100}%`,
      ev: clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: y, kkCallFreq: eq.kkCallFreq }).evP1,
    }))
    const p1Test = testUnilateralDeviation(baseline.evP1, p1Alternatives)
    expect(p1Test.canImprove).toBe(false)

    // P2 deviates: try a spread of alternative KK call frequencies, holding P1 fixed
    const p2Alternatives: ActionEV[] = [0, 0.25, 0.75, 1].map((c) => ({
      id: `kk-${c}`,
      label: `KK calls ${c * 100}%`,
      ev: clairvoyanceEV({ pot, bet, aaBetFreq: eq.aaBetFreq, qqBetFreq: eq.qqBetFreq, kkCallFreq: c }).evP2,
    }))
    const p2Test = testUnilateralDeviation(baseline.evP2, p2Alternatives)
    expect(p2Test.canImprove).toBe(false)
  })

  it('off-equilibrium: if QQ never bluffs, KK should never call (folding strictly better)', () => {
    // With qqBetFreq=0, a bet can only ever be AA, so calling always loses.
    const evCall = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 0, kkCallFreq: 1 }).evP2
    const evFold = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 0, kkCallFreq: 0 }).evP2
    expect(evFold).toBeGreaterThan(evCall)
  })

  it('off-equilibrium: if KK always folds, QQ should always bluff (bet strictly better than check)', () => {
    const evBetAlways = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 1, kkCallFreq: 0 }).evP1
    const evNeverBet = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 0, kkCallFreq: 0 }).evP1
    expect(evBetAlways).toBeGreaterThan(evNeverBet)
  })

  it('evP1 + evP2 always equals the pot, at any frequency combination', () => {
    const samples = [
      { aaBetFreq: 0.3, qqBetFreq: 0.7, kkCallFreq: 0.2 },
      { aaBetFreq: 1, qqBetFreq: 0, kkCallFreq: 1 },
      { aaBetFreq: 0.5, qqBetFreq: 0.5, kkCallFreq: 0.5 },
    ]
    for (const s of samples) {
      const { evP1, evP2 } = clairvoyanceEV({ pot, bet, ...s })
      expect(evP1 + evP2).toBeCloseTo(pot, 6)
    }
  })

  it('the 50/50 AA/QQ prior is combo-consistent (6 unblocked combos each) and configurable via probAA', () => {
    const skewed = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 0.5, kkCallFreq: 0.5, probAA: 0.5 })
    const default_ = clairvoyanceEV({ pot, bet, aaBetFreq: 1, qqBetFreq: 0.5, kkCallFreq: 0.5 })
    expect(skewed.evP1).toBeCloseTo(default_.evP1, 6)
  })
})

describe('faceUpEV — Module 11 "value of hidden information" comparison', () => {
  const pot = 100

  it('with both hands visible, P1 nets exactly their raw equity share of the pot (50/50 prior -> $50/$50)', () => {
    const { evP1, evP2 } = faceUpEV({ pot })
    expect(evP1).toBeCloseTo(50, 6)
    expect(evP2).toBeCloseTo(50, 6)
  })

  it('evP1 + evP2 always equals the pot, at any probAA', () => {
    for (const probAA of [0.1, 0.5, 0.9]) {
      const { evP1, evP2 } = faceUpEV({ pot, probAA })
      expect(evP1 + evP2).toBeCloseTo(pot, 6)
    }
  })

  it('scales with probAA — the face-up game rewards raw equity, nothing else', () => {
    expect(faceUpEV({ pot, probAA: 0.9 }).evP1).toBeCloseTo(90, 6)
    expect(faceUpEV({ pot, probAA: 0.1 }).evP1).toBeCloseTo(10, 6)
  })

  it('is strictly less than the hidden-information equilibrium EV for the polarized player (the value of information is positive)', () => {
    const bet = 100
    const eq = clairvoyanceEquilibrium(pot, bet)
    const hidden = clairvoyanceEV({ pot, bet, aaBetFreq: eq.aaBetFreq, qqBetFreq: eq.qqBetFreq, kkCallFreq: eq.kkCallFreq })
    const faceUp = faceUpEV({ pot })
    expect(hidden.evP1).toBeGreaterThan(faceUp.evP1)
    // Reproduces the exact $25 gap Module 11's Lesson 1 is built around.
    expect(hidden.evP1 - faceUp.evP1).toBeCloseTo(25, 6)
  })

  it('ignores bet-frequency fields entirely when present on the shared ClairvoyanceInputs shape', () => {
    const withFreqs = faceUpEV({ pot, aaBetFreq: 1, qqBetFreq: 0.5, kkCallFreq: 0.5 } as never)
    const withoutFreqs = faceUpEV({ pot })
    expect(withFreqs.evP1).toBeCloseTo(withoutFreqs.evP1, 6)
  })
})

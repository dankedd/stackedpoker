import { describe, it, expect } from 'vitest'
import { LESSONS_BY_SLUG } from '../curriculum'
import { evaluateStepLocally } from '../evaluator'
import {
  DEVIATION_SAMPLE_FREQS,
  deviationBranches,
  deviationEV,
  deviationSides,
  deviationVerdict,
  evAtTestedFreq,
  resolveDeviationPanel,
} from '../unilateralDeviation'
import type { LessonStep } from '../types'

/**
 * Regression suite for Lesson 10.4 ("When Neither Player Can Improve")'s
 * interactive deviation test.
 *
 * Two bugs are locked out here:
 *
 *  1. THE SLIDER DROVE NOTHING ON A B-SIDE STEP. Both the component and the
 *     grader read the authored candidate's `heroFreq` as "the tested player's
 *     own frequency". That is only true for an A-side step: the SAME candidate
 *     object describes both players ("Hero never bets, Villain calls 50%"), so
 *     on a B-side step it put the slider on Player A's frequency and fed
 *     Player B's frequency in as the fixed opponent — testing the wrong player
 *     entirely, and grading npi-s4 as "B can improve" when the lesson's own
 *     next step states B cannot.
 *
 *  2. THE READOUT COULD NOT RESPOND. Everything on screen came from a single
 *     blended EV number. At exactly MDF that number is flat by construction,
 *     so the whole panel looked broken. `resolveDeviationPanel` now also
 *     returns the branch decomposition, which moves at every slider position.
 *
 * The math is checked against the toy game's own arithmetic (pot $100, bet
 * $100, Hero's hand worth zero at showdown), not against remembered numbers.
 */

const LESSON = LESSONS_BY_SLUG['when-neither-player-can-improve']

function step(id: string): LessonStep {
  const found = LESSON.steps.find((s) => s.id === id)
  if (!found) throw new Error(`missing step ${id}`)
  return found
}

const A_SIDE = step('npi-s2')      // Player A tested; candidate {heroFreq: 0, villainFreq: 50}
const B_SIDE_FLAT = step('npi-s4') // Player B tested; same candidate — Hero never bets
const B_SIDE_LIVE = step('npi-s7') // Player B tested; perturbed to {heroFreq: 60, villainFreq: 50}

describe('deviationSides — which player the step actually tests', () => {
  it('an A-side step controls the bettor (heroFreq) and holds the caller fixed', () => {
    expect(deviationSides(A_SIDE)).toMatchObject({ player: 'A', testedBaselinePct: 0, fixedPct: 50 })
  })

  it('a B-side step controls the CALLER (villainFreq) and holds the bettor fixed — the bug', () => {
    // Before the fix both of these read testedBaselinePct: 0 / fixedPct: 50,
    // i.e. the slider started on Player A's frequency on a Player B step.
    expect(deviationSides(B_SIDE_FLAT)).toMatchObject({ player: 'B', testedBaselinePct: 50, fixedPct: 0 })
    expect(deviationSides(B_SIDE_LIVE)).toMatchObject({ player: 'B', testedBaselinePct: 50, fixedPct: 60 })
  })
})

describe('slider value → recalculation (the reported bug)', () => {
  it('a B-side step recomputes a DIFFERENT EV at every slider position', () => {
    // Hero bets 60%; Villain calling f% of that wins the pot + the bet, and the
    // 40% Hero checks is Villain's outright. EV = 0.4·100 + 0.6·f·200.
    const evs = [0, 25, 50, 75, 100].map((f) => evAtTestedFreq(B_SIDE_LIVE, f))
    expect(evs).toEqual([40, 70, 100, 130, 160])
    expect(new Set(evs).size).toBe(evs.length) // every position is a distinct number
  })

  it('sweeping the whole 0-100 range produces a strictly increasing EV, no dead zones', () => {
    const sweep = Array.from({ length: 101 }, (_, f) => evAtTestedFreq(B_SIDE_LIVE, f))
    for (let i = 1; i < sweep.length; i++) expect(sweep[i]).toBeGreaterThan(sweep[i - 1])
  })

  it('the panel the UI renders carries that recalculated EV and its delta vs the baseline', () => {
    const atBaseline = resolveDeviationPanel(B_SIDE_LIVE, 50)
    expect(atBaseline.currentEV).toBe(100)
    expect(atBaseline.gain).toBe(0)
    expect(atBaseline.changed).toBe(false)

    const deviated = resolveDeviationPanel(B_SIDE_LIVE, 90)
    expect(deviated.currentEV).toBeCloseTo(148, 10)
    expect(deviated.gain).toBeCloseTo(48, 10)
    expect(deviated.changed).toBe(true)
  })

  it('every distinct slider position yields a distinct panel on a live step', () => {
    const seen = new Set(Array.from({ length: 101 }, (_, f) => resolveDeviationPanel(B_SIDE_LIVE, f).currentEV))
    expect(seen.size).toBe(101)
  })
})

describe('an indifferent step is flat by theory — but its branches still move', () => {
  it("Player A's total EV is $0.00 at every frequency (Villain calls exactly the break-even 50%)", () => {
    for (const f of [0, 17, 42, 57, 80, 100]) expect(evAtTestedFreq(A_SIDE, f)).toBe(0)
    expect(resolveDeviationPanel(A_SIDE, 57).flat).toBe(true)
  })

  it('the branch breakdown is what responds: fold-wins and call-losses grow in equal, opposite amounts', () => {
    const at57 = resolveDeviationPanel(A_SIDE, 57)
    const fold = at57.branches.find((b) => b.id === 'fold')!
    const call = at57.branches.find((b) => b.id === 'call')!
    expect(fold.ev).toBeCloseTo(28.5, 10)   // 57% × 50% × $100 won
    expect(call.ev).toBeCloseTo(-28.5, 10)  // 57% × 50% × $100 lost
    expect(fold.reach).toBeCloseTo(0.285, 10)

    // ...and they are genuinely different at a different slider position.
    const at100 = resolveDeviationPanel(A_SIDE, 100)
    expect(at100.branches.find((b) => b.id === 'fold')!.ev).toBeCloseTo(50, 10)
    expect(at100.branches.find((b) => b.id === 'call')!.ev).toBeCloseTo(-50, 10)
    expect(at100.branches.map((b) => b.ev)).not.toEqual(at57.branches.map((b) => b.ev))
  })

  it('branches always sum to the total EV they are explaining', () => {
    for (const s of [A_SIDE, B_SIDE_FLAT, B_SIDE_LIVE]) {
      for (const f of [0, 33, 50, 66, 100]) {
        const panel = resolveDeviationPanel(s, f)
        const sum = panel.branches.reduce((acc, b) => acc + b.ev, 0)
        expect(sum).toBeCloseTo(panel.currentEV, 10)
      }
    }
  })

  it("Player B's EV is flat when Hero never bets — no decision node is ever reached", () => {
    for (const f of DEVIATION_SAMPLE_FREQS) expect(evAtTestedFreq(B_SIDE_FLAT, f)).toBe(100)
    expect(resolveDeviationPanel(B_SIDE_FLAT, 100).flat).toBe(true)
  })
})

describe("the two players' EVs still obey the engine's conservation identity", () => {
  it('A + B always sums to the pot, at every pair of frequencies', () => {
    const game = { pot: 100, bet: 100 }
    for (const b of [0, 25, 60, 100]) {
      for (const c of [0, 25, 50, 100]) {
        expect(deviationEV(game, 'A', b, c) + deviationEV(game, 'B', b, c)).toBeCloseTo(100, 10)
      }
    }
  })

  it('clamps a nonsense frequency instead of extrapolating past the game', () => {
    const game = { pot: 100, bet: 100 }
    expect(deviationBranches(game, 'A', 150, 50)).toEqual(deviationBranches(game, 'A', 100, 50))
    expect(deviationBranches(game, 'A', -20, 50)).toEqual(deviationBranches(game, 'A', 0, 50))
  })
})

describe('grading now agrees with the lesson the learner is reading', () => {
  it("npi-s2: A cannot improve — matching npi-s3's \"A CAN'T improve alone\"", () => {
    expect(deviationVerdict(A_SIDE).canImprove).toBe(false)
    expect(evaluateStepLocally(A_SIDE, { triedFreqPct: 57, verdict: 'no_improvement' }, 0).quality).toBe('perfect')
  })

  it('npi-s4: B cannot improve either — matching npi-s5\'s "EQUILIBRIUM" reveal', () => {
    // THE BUG: this graded as can_improve, so the learner who answered what the
    // very next step told them was right got marked wrong.
    expect(deviationVerdict(B_SIDE_FLAT).canImprove).toBe(false)
    expect(evaluateStepLocally(B_SIDE_FLAT, { triedFreqPct: 100, verdict: 'no_improvement' }, 0).quality).toBe('perfect')
    expect(evaluateStepLocally(B_SIDE_FLAT, { triedFreqPct: 100, verdict: 'can_improve' }, 0).quality).toBe('mistake')
  })

  it('npi-s7: B CAN improve once Hero actually bets — matching npi-s8\'s "NOT EQUILIBRIUM"', () => {
    const test = deviationVerdict(B_SIDE_LIVE)
    expect(test.canImprove).toBe(true)
    expect(test.bestAlternative?.label).toBe('100%')
    expect(test.gain).toBeCloseTo(60, 10)
    expect(evaluateStepLocally(B_SIDE_LIVE, { triedFreqPct: 100, verdict: 'can_improve' }, 0).quality).toBe('perfect')
  })

  it('explains a flat surface as indifference rather than claiming alternatives "earn less"', () => {
    const result = evaluateStepLocally(A_SIDE, { triedFreqPct: 57, verdict: 'no_improvement' }, 0)
    expect(result.feedback).toMatch(/indifferent/i)
    expect(result.feedback).not.toMatch(/earns less/i)
  })
})

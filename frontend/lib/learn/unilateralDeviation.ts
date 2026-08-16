/**
 * Unilateral Deviation Test (Module 10, Lesson 10.4) — the one place the
 * "can this player improve by changing strategy alone?" math lives.
 *
 * WHY THIS FILE EXISTS: the component (UnilateralDeviationTest.tsx) and the
 * grader (evaluator.ts's `evalUnilateralDeviationTest`) each carried their own
 * copy of this EV function. The copies agreed with each other but BOTH read the
 * authored candidate equilibrium wrongly for Player B — see `deviationSides`
 * below — so a B-side step put the slider on the wrong player's frequency and
 * then graded the lesson's own stated answer as a mistake. One shared resolver
 * makes that class of drift impossible: what the learner sees and what the
 * grader decides are now the same numbers, computed once.
 *
 * All EV math is exact_derived from gameTheoryEngine.ts's primitives
 * (`evOfBetting`/`evOfChecking`/`evOfCalling`/`evOfFolding`) applied to the
 * pot/bet the step itself declares. Nothing here is an authored per-frequency
 * number, and nothing here invents a frequency: every frequency comes from the
 * step's `unilateral_deviation_test_equilibrium` or from the learner's slider.
 *
 * Source: Acevedo, "Modern Poker Theory", Ch.2 — "The Nash Equilibrium"
 * ("No player can unilaterally change their strategy to improve their own
 * expectation", and "the only way a hand can be played in more than one way at
 * the equilibrium is if multiple strategic choices have the same EV"). The toy
 * game the frequencies are applied to is PRESSURE_GAME_DEFAULT, a labelled
 * pedagogical_model, not a book-cited spot.
 */

import type { LessonStep } from './types'
import {
  evOfBetting, evOfChecking, evOfCalling, evOfFolding,
  testUnilateralDeviation, isIndifferent, DEFAULT_EV_TOLERANCE,
  type ActionEV, type DeviationTestResult,
} from './gameTheoryEngine'

/** Player A is the bettor (holding a zero-equity bluff); Player B is the defender. */
export type DeviationPlayer = 'A' | 'B'

/** The frequencies the sampled-alternatives sweep tries, and that grading tests against. */
export const DEVIATION_SAMPLE_FREQS = [0, 10, 25, 40, 60, 75, 90, 100] as const

export interface DeviationSides {
  player: DeviationPlayer
  playerLabel: string
  /** The tested player's OWN candidate-equilibrium frequency — the slider's starting point. */
  testedBaselinePct: number
  /** The other player's frequency, held fixed for the whole step. */
  fixedPct: number
  /** What the tested player's own frequency means ("bets this hand" / "calls a bet"). */
  testedMeaning: string
  /** What the fixed side's frequency means, for the on-screen "held fixed at" row. */
  fixedMeaning: string
}

/**
 * Splits one authored candidate equilibrium into "the side being tested" and
 * "the side held fixed".
 *
 * The curriculum authors ONE candidate per game state, describing BOTH players:
 * `heroFreq` is always Player A's (the bettor's) betting frequency and
 * `villainFreq` is always Player B's (the defender's) calling frequency — the
 * exact same object is reused by the A-side and the B-side step of a lesson
 * (10.4 tests both sides of a single candidate: "Hero never bets, Villain calls
 * 50%"). So which of the two the learner controls is decided by
 * `unilateral_deviation_test_player`, NEVER by the field name. Reading
 * `heroFreq` as "the tested player's own frequency" — as both call sites used
 * to — silently swaps the two players on every B-side step.
 */
export function deviationSides(step: LessonStep): DeviationSides {
  const eq = step.unilateral_deviation_test_equilibrium ?? { heroFreq: 50, villainFreq: 50 }
  const player: DeviationPlayer = step.unilateral_deviation_test_player ?? 'A'
  return player === 'A'
    ? {
        player,
        playerLabel: 'Player A',
        testedBaselinePct: eq.heroFreq,
        fixedPct: eq.villainFreq,
        testedMeaning: 'bets this hand',
        fixedMeaning: 'Player B calls',
      }
    : {
        player,
        playerLabel: 'Player B',
        testedBaselinePct: eq.villainFreq,
        fixedPct: eq.heroFreq,
        testedMeaning: 'calls a bet',
        fixedMeaning: 'Player A bets',
      }
}

export interface DeviationGame {
  pot: number
  bet: number
}

export function deviationGame(step: LessonStep): DeviationGame {
  return {
    pot: step.unilateral_deviation_test_pot ?? 100,
    bet: step.unilateral_deviation_test_bet ?? 100,
  }
}

/**
 * One branch of the game tree, weighted by how often it is actually reached.
 * The branches of a player always sum to that player's total EV — which is what
 * makes them worth showing: on a flat EV surface the learner can watch two
 * branches grow in equal and opposite amounts as they move their own frequency,
 * which is precisely WHY the total doesn't move.
 */
export interface DeviationBranch {
  id: string
  label: string
  /** How often this branch happens, 0-1, at the current pair of frequencies. */
  reach: number
  /** This branch's contribution to the tested player's total EV, already weighted by `reach`. */
  ev: number
}

/**
 * Every branch of the toy game from the tested player's point of view, given
 * BOTH players' frequencies as percentages (A's betting frequency and B's
 * calling frequency — always in that order, never "tested/fixed").
 */
export function deviationBranches(
  game: DeviationGame,
  player: DeviationPlayer,
  bettorFreqPct: number,
  callerFreqPct: number,
): DeviationBranch[] {
  const { pot, bet } = game
  const b = clamp01(bettorFreqPct / 100)
  const c = clamp01(callerFreqPct / 100)
  const toy = { pot, bet, equityWhenCalled: 0 }

  // Hero's own branch EVs, straight from the engine: a called bluff loses the
  // bet, a folded-to bluff wins the pot, a check wins nothing (the hand is
  // worth zero at showdown too).
  const heroCalledEV = evOfBetting(toy, 1)
  const heroFoldedEV = evOfBetting(toy, 0)
  const heroCheckEV = evOfChecking({ pot, equityWhenChecked: 0 })

  if (player === 'A') {
    return [
      { id: 'fold', label: 'You bet, they fold', reach: b * (1 - c), ev: b * (1 - c) * heroFoldedEV },
      { id: 'call', label: 'You bet, they call', reach: b * c, ev: b * c * heroCalledEV },
      { id: 'check', label: 'You check it back', reach: 1 - b, ev: (1 - b) * heroCheckEV },
    ]
  }

  // Player B's branch EVs are the engine's own conservation identity: every
  // branch pays B exactly `pot − A's EV in that branch`. B's call wins the pot
  // plus the bluff (evOfCalling), B's fold wins nothing, and when A checks the
  // pot goes to B (A's zero-equity hand loses the showdown).
  return [
    { id: 'call', label: 'They bet, you call', reach: b * c, ev: b * c * evOfCalling(toy) },
    { id: 'fold', label: 'They bet, you fold', reach: b * (1 - c), ev: b * (1 - c) * evOfFolding() },
    { id: 'check', label: 'They check, pot is yours', reach: 1 - b, ev: (1 - b) * (pot - heroCheckEV) },
  ]
}

/** The tested player's total EV at a given pair of frequencies — the sum of their branches. */
export function deviationEV(
  game: DeviationGame,
  player: DeviationPlayer,
  bettorFreqPct: number,
  callerFreqPct: number,
): number {
  return deviationBranches(game, player, bettorFreqPct, callerFreqPct).reduce((sum, br) => sum + br.ev, 0)
}

/**
 * The tested player's EV when THEY play `testedFreqPct` and the other side stays
 * put — the only EV function the UI and the grader should ever call.
 */
export function evAtTestedFreq(step: LessonStep, testedFreqPct: number): number {
  const sides = deviationSides(step)
  const game = deviationGame(step)
  return sides.player === 'A'
    ? deviationEV(game, 'A', testedFreqPct, sides.fixedPct)
    : deviationEV(game, 'B', sides.fixedPct, testedFreqPct)
}

/** The sampled alternatives the Nash test sweeps — the tested player's own frequency, everything else fixed. */
export function deviationAlternatives(step: LessonStep): ActionEV[] {
  return DEVIATION_SAMPLE_FREQS.map((f) => ({
    id: `f${f}`,
    label: `${f}%`,
    ev: evAtTestedFreq(step, f),
  }))
}

/** Runs Acevedo's unilateral-deviation test on this step's candidate equilibrium. */
export function deviationVerdict(step: LessonStep): DeviationTestResult {
  const sides = deviationSides(step)
  const tolerance = step.unilateral_deviation_test_tolerance ?? 1
  return testUnilateralDeviation(
    evAtTestedFreq(step, sides.testedBaselinePct),
    deviationAlternatives(step),
    tolerance,
  )
}

export interface DeviationPanel extends DeviationSides {
  pot: number
  bet: number
  /** Where the slider is right now. */
  currentFreqPct: number
  /** The tested player's EV at the candidate equilibrium — the "no deviation" baseline. */
  baselineEV: number
  /** The tested player's EV at `currentFreqPct`. */
  currentEV: number
  /** currentEV − baselineEV. */
  gain: number
  /** Whether the deviation is worth anything at all (beyond float slack). */
  changed: boolean
  /** The live branch breakdown at `currentFreqPct` — sums to `currentEV`. */
  branches: DeviationBranch[]
  /**
   * True when this player's EV does not respond to their OWN frequency at all
   * (every sampled alternative ties the baseline). That is the Indifference
   * Principle, not a broken control — the branches still move, in equal and
   * opposite amounts.
   */
  flat: boolean
}

/**
 * Everything the step needs to render at a given slider position. Pure: same
 * step + same frequency always produces the same panel.
 */
export function resolveDeviationPanel(step: LessonStep, currentFreqPct: number): DeviationPanel {
  const sides = deviationSides(step)
  const game = deviationGame(step)
  const baselineEV = evAtTestedFreq(step, sides.testedBaselinePct)
  const currentEV = evAtTestedFreq(step, currentFreqPct)
  const branches = sides.player === 'A'
    ? deviationBranches(game, 'A', currentFreqPct, sides.fixedPct)
    : deviationBranches(game, 'B', sides.fixedPct, currentFreqPct)

  const flat = deviationAlternatives(step).every((alt) => isIndifferent(alt.ev, baselineEV, DEFAULT_EV_TOLERANCE))

  return {
    ...sides,
    pot: game.pot,
    bet: game.bet,
    currentFreqPct,
    baselineEV,
    currentEV,
    gain: currentEV - baselineEV,
    changed: Math.abs(currentEV - baselineEV) > DEFAULT_EV_TOLERANCE,
    branches,
    flat,
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

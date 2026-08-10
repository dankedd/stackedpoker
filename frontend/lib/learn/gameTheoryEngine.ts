/**
 * Game Theory Foundations (Module 10) — pure calculation engine.
 *
 * Every function here is a small, deterministic, framework-independent piece
 * of math applied to EXPLICITLY supplied game rules (a pot, a bet, a hand's
 * equity when called). Nothing in this file is a poker solver, a real
 * equity model, or a source of invented frequencies — it only evaluates the
 * consequences of numbers the caller already decided (a slider position, a
 * scenario's stated pot/bet). See LEARN_QUESTION_QA.md's data-authenticity
 * rules and types.ts's `SourceEvidenceType` for how callers must label the
 * inputs they feed in.
 *
 * ── The one-street toy bet/check game ─────────────────────────────────────
 * `evOfBetting` / `evOfChecking` model a single betting round: Hero acts
 * first (bet `bet` or check), Villain responds (call or fold, only when
 * facing a bet). Money already in the pot is treated as unattributed —
 * whoever wins the confrontation wins it; `equityWhenCalled` /
 * `equityWhenChecked` are Hero's win probability in each branch (0 = Hero's
 * hand always loses that showdown, 1 = Hero's hand always wins it).
 *
 * Net-EV derivation (verified by hand, reproduces every source-cited number
 * this module cites — see gameTheoryEngine.test.ts's "source lock" suite):
 *   - Hero bets, Villain folds  → Hero nets +pot (their own bet returns to them)
 *   - Hero bets, Villain calls  → Hero nets  equity·(pot+bet) − (1−equity)·bet
 *   - Hero checks                → Hero nets  equityWhenChecked · pot (no money at risk)
 * Villain's own net EV in every branch is exactly `pot − Hero's net EV for
 * that branch` — betting/calling money the loser puts in always finishes
 * inside the winner's stack, so the two players' branch EVs always sum to
 * the original pot. This conservation identity is asserted in the test file.
 */

// ── Alpha / MDF ──────────────────────────────────────────────────────────────
//
// Standard formulas (Acevedo, "Modern Poker Theory", Ch.2 — The Elements of
// Game Theory): a bet of size `bet` into a pot of size `pot` requires Villain
// to fold at least `alpha` of the time for a zero-equity bluff to break even,
// and Villain must continue (call/raise) with at least `mdf` of their range
// to prevent that bluff from being automatically profitable. Locked against
// the book's own half-pot example (33.33% / 66.67%) in the test suite.

export function alpha(pot: number, bet: number): number {
  if (pot < 0 || bet < 0) throw new Error('alpha: pot and bet must be non-negative')
  if (pot + bet === 0) return 0
  return bet / (pot + bet)
}

export function mdf(pot: number, bet: number): number {
  return 1 - alpha(pot, bet)
}

// ── Pot odds (Module 12) ────────────────────────────────────────────────────
//
// Distinct from `alpha`, though built from the same two inputs (Acevedo, Ch.2
// Table 14 / Ch.10 p.600-602): pot odds asks what price a CALL is getting —
// bet / (pot + bet + bet), i.e. bet / (pot + 2·bet), the symmetric bet=call
// case. Alpha asks how often a BET needs to work for a bluff to break even —
// bet / (pot + bet). At a half-pot bet these are genuinely different numbers
// (25% pot odds vs. 33.3% Alpha) — locked against the book's own worked
// example in the test suite, specifically to guard against a test that
// accidentally treats the two as equal.

// ── Geometric bet-sizing (Module 12, Lesson 6) ──────────────────────────────
//
// Acevedo, Ch.10 "Geometrical Bet-sizing" (pp.612-614): the optimal multi-street
// bet-size for a perfectly polarized range is the same POT FRACTION on every
// street, chosen so the pot grows by a constant ratio R each street and the
// final bet is exactly all-in. The book states FP = SP · R^S and gives one
// fully worked example (pot=$70, final pot=$2,000, 3 streets) but its own
// printed bet-fraction formula did not survive this project's PDF text
// extraction (a diagram, like several others in this book — see the file
// header's Source Discipline note) — only the RESULT numbers are book-cited.
//
// Re-derived here from the standard model both this bet AND Villain's matching
// call add to the pot each street (the same model Alpha/MDF above already use):
//   pot_new = pot_old · (1 + 2f)   where f = bet as a fraction of pot_old
// For the pot to grow by ratio R every street, (1 + 2f) = R, so f = (R-1)/2.
// `frontend/lib/theory/math.ts`'s existing (unused, zero call sites, zero test
// coverage) `geometricBetSize` instead returns R-1 directly — silently assuming
// only HERO's bet grows the pot, ignoring Villain's call. At this function's
// book-cited numbers that produces ≈206% instead of the correct ≈103%. That
// function is left untouched (a separate content layer, not this module's to
// fix) and NOT reused here — see docs/module-12-architecture.md Section 5's
// explicitly gated resolution of this exact discrepancy.

export interface GeometricBetSizingResult {
  /** Pot growth rate per street (R). */
  growthRate: number
  /** Bet as a fraction of the CURRENT street's pot (the same fraction every street). */
  betFraction: number
}

export function geometricBetSizing(startingPot: number, effectiveStack: number, streetsRemaining: number): GeometricBetSizingResult {
  if (startingPot <= 0) throw new Error('geometricBetSizing: startingPot must be positive')
  if (effectiveStack < 0) throw new Error('geometricBetSizing: effectiveStack must be non-negative')
  if (streetsRemaining <= 0) throw new Error('geometricBetSizing: streetsRemaining must be positive')
  const finalPot = startingPot + 2 * effectiveStack
  const growthRate = Math.pow(finalPot / startingPot, 1 / streetsRemaining)
  const betFraction = (growthRate - 1) / 2
  return { growthRate, betFraction }
}

// ── Minimum bet to deny equity (Module 12, Lesson 9) ────────────────────────
//
// Acevedo, "River Calling Strategies" (Ch.10 pp.786-788): when P1's range beats
// P2's range except for a small equity share EQ, the smallest bet-size that
// still forces P2 to fold their ENTIRE range (denying that equity completely)
// is found by making P2 indifferent to calling — i.e. the bet-size at which
// the pot odds P1 offers exactly equal P2's equity. As with geometric sizing
// above, the book's own printed formula (captioned "Where: Starting pot = 1,
// EQ is P2 equity, B is P1 bet-size") is a diagram that did not survive text
// extraction — only the two worked RESULTS are book-cited text: EQ=10% -> B
// = 12.5% of the pot; EQ=40% -> B = 2x the pot (200%). Both are reproduced
// exactly by re-deriving B from the pot-odds-equals-equity indifference
// condition: EQ = B / (1 + 2B)  =>  B = EQ / (1 - 2EQ) — the same "P2's price
// on a call" structure `potOddsRequiredEquity` above already uses, solved for
// B instead of for the price. Undefined/Infinity at EQ >= 50%, which the
// caller must handle as a distinct UI state (Lesson 9's own "the formula stops
// producing a meaningful answer past that point" teaching moment) rather than
// silently clamped or hidden.

export function minimumBetToDenyEquity(opponentEquity: number): number {
  if (opponentEquity < 0) throw new Error('minimumBetToDenyEquity: opponentEquity must be non-negative')
  if (opponentEquity >= 0.5) return Infinity
  return opponentEquity / (1 - 2 * opponentEquity)
}

export function potOddsRequiredEquity(pot: number, bet: number): number {
  if (pot < 0 || bet < 0) throw new Error('potOddsRequiredEquity: pot and bet must be non-negative')
  if (pot + 2 * bet === 0) return 0
  return bet / (pot + 2 * bet)
}

// ── The one-street toy bet/check game ─────────────────────────────────────────

export interface ToyBetGame {
  pot: number
  bet: number
  /** Hero's probability of winning the showdown when Villain calls the bet. 0-1. */
  equityWhenCalled: number
}

export interface ToyCheckGame {
  pot: number
  /** Hero's probability of winning the showdown after a check (no further money risked). 0-1. */
  equityWhenChecked: number
}

/** Hero's net expected $ from betting, given Villain calls with probability `villainCallFreq` (0-1). */
export function evOfBetting(game: ToyBetGame, villainCallFreq: number): number {
  const { pot, bet, equityWhenCalled: e } = game
  const calledEV = e * (pot + bet) - (1 - e) * bet
  const foldedEV = pot
  return villainCallFreq * calledEV + (1 - villainCallFreq) * foldedEV
}

/** Hero's net expected $ from checking. Independent of Villain's strategy — no bet is in flight. */
export function evOfChecking(game: ToyCheckGame): number {
  return game.equityWhenChecked * game.pot
}

/** Villain's net expected $ from calling a bet — always `pot − Hero's called-branch EV`. */
export function evOfCalling(game: ToyBetGame): number {
  const { pot, bet, equityWhenCalled: e } = game
  const heroCalledEV = e * (pot + bet) - (1 - e) * bet
  return pot - heroCalledEV
}

/** Villain's net expected $ from folding — always 0 (forfeits any share of the pot). */
export function evOfFolding(): number {
  return 0
}

// ── Generic decision-theory helpers ────────────────────────────────────────────

export interface ActionEV {
  id: string
  label: string
  ev: number
}

/** Default absolute-$ tolerance for treating two EVs as "equal" — small floating-point slack only. */
export const DEFAULT_EV_TOLERANCE = 0.01

/** Returns every action tied for the maximum EV (within tolerance) — a singleton array
 *  for a clear best response, 2+ entries when the learner has found genuine indifference. */
export function bestResponse(actions: ActionEV[], tolerance = DEFAULT_EV_TOLERANCE): ActionEV[] {
  if (actions.length === 0) return []
  const maxEV = Math.max(...actions.map((a) => a.ev))
  return actions.filter((a) => maxEV - a.ev <= tolerance)
}

/** Whether two actions' EVs are equal within tolerance — the Indifference Principle's test. */
export function isIndifferent(evA: number, evB: number, tolerance = DEFAULT_EV_TOLERANCE): boolean {
  return Math.abs(evA - evB) <= tolerance
}

export interface DeviationTestResult {
  /** True if some alternative strictly beats the current strategy's EV by more than tolerance. */
  canImprove: boolean
  currentEV: number
  bestAlternative?: ActionEV
  /** How much EV the best alternative gains over the current strategy (0 or negative if none). */
  gain: number
}

/** The Unilateral Deviation Test: can a player improve strictly by switching strategy alone,
 *  holding the opponent's strategy fixed? This is literally Acevedo's Nash-equilibrium test —
 *  no profitable unilateral deviation for EITHER player, tested one player at a time. */
export function testUnilateralDeviation(
  currentEV: number,
  alternatives: ActionEV[],
  tolerance = DEFAULT_EV_TOLERANCE,
): DeviationTestResult {
  let best: ActionEV | undefined
  for (const alt of alternatives) {
    if (alt.ev - currentEV > tolerance) {
      if (!best || alt.ev > best.ev) best = alt
    }
  }
  return {
    canImprove: !!best,
    currentEV,
    bestAlternative: best,
    gain: best ? best.ev - currentEV : 0,
  }
}

// ── The Clairvoyance Game (Acevedo's polarized-range toy game) ────────────────
//
// P1 holds AA or QQ (each 6 unblocked combos on the board 3♠3♥3♣2♦2♠ — no ace
// or queen removed — so the 50/50 combo-weighted prior below is itself
// EXACT_DERIVED from the stated board, not an assumption). P2 holds KK always.
// Hand strength on this board is a fixed, explicit ranking: AA beats KK beats
// QQ. P1 acts first (bet `bet` or check); P2 responds (call/fold vs a bet).
// When P1 checks, the hand goes straight to showdown (this toy game does not
// model a reverse bet from P2 — Acevedo's own worked example only exercises
// the bet/call/fold node, so no further action branch is invented here).
//
// EV_P1 = P(AA)·(pot + aaBetFreq·kkCallFreq·bet) + P(QQ)·qqBetFreq·(pot − kkCallFreq·(pot+bet))
// — derived directly from evOfBetting/evOfChecking above (AA: equityWhenCalled=1,
// equityWhenChecked=1; QQ: equityWhenCalled=0, equityWhenChecked=0), then
// probability-weighted over P1's two possible holdings. Verified in the test
// suite to reproduce Acevedo's own solution (AA bets 100%, QQ bets 50%, KK
// calls 50%, EV split $75/$25) exactly at pot=bet=$100.

export interface ClairvoyanceInputs {
  pot: number
  bet: number
  /** P1's frequency of betting AA (the value hand). 0-1. */
  aaBetFreq: number
  /** P1's frequency of betting QQ (the bluff — QQ always loses to KK at showdown). 0-1. */
  qqBetFreq: number
  /** P2's frequency of calling with KK when facing a bet. 0-1. */
  kkCallFreq: number
  /** P1's prior probability of holding AA vs QQ. Defaults to the board-derived 0.5/0.5 combo split. */
  probAA?: number
}

export interface ClairvoyanceResult {
  evP1: number
  evP2: number
}

export function clairvoyanceEV(inputs: ClairvoyanceInputs): ClairvoyanceResult {
  const { pot, bet, aaBetFreq: x, qqBetFreq: y, kkCallFreq: c } = inputs
  const probAA = inputs.probAA ?? 0.5
  const probQQ = 1 - probAA

  const aaGame: ToyBetGame = { pot, bet, equityWhenCalled: 1 }
  const aaCheckGame: ToyCheckGame = { pot, equityWhenChecked: 1 }
  const qqGame: ToyBetGame = { pot, bet, equityWhenCalled: 0 }
  const qqCheckGame: ToyCheckGame = { pot, equityWhenChecked: 0 }

  const aaBranchEV = x * evOfBetting(aaGame, c) + (1 - x) * evOfChecking(aaCheckGame)
  const qqBranchEV = y * evOfBetting(qqGame, c) + (1 - y) * evOfChecking(qqCheckGame)

  const evP1 = probAA * aaBranchEV + probQQ * qqBranchEV
  return { evP1, evP2: pot - evP1 }
}

/** The face-up (fully-revealed-information) variant of the same Clairvoyance Game —
 *  Module 11's "value of hidden information" comparison. With both hands visible,
 *  every decision becomes trivial: P2 folds to any bet from AA (can never win) and
 *  never pays off a bet from QQ (already knows it beats it), so betting can extract
 *  nothing beyond a hand's own raw showdown value. AA nets the full pot (whether bet
 *  and folded to, or checked to showdown — both net +pot since P2 never calls a
 *  visible AA and never needs to be shown a check). QQ nets 0 (loses at showdown;
 *  betting it face-up would only add a needless loss, so the optimal face-up line
 *  simply never bets it). The `aaBetFreq`/`qqBetFreq`/`kkCallFreq` fields of `inputs`
 *  are accepted for call-site symmetry with `clairvoyanceEV` (so a caller can build
 *  one `ClairvoyanceInputs` object and pass it to both functions) but are irrelevant
 *  here — once information is public, those frequencies stop affecting the outcome,
 *  which is itself the point being demonstrated. Only `pot` and `probAA` matter. */
export function faceUpEV(inputs: Pick<ClairvoyanceInputs, 'pot' | 'probAA'>): ClairvoyanceResult {
  const probAA = inputs.probAA ?? 0.5
  const evP1 = probAA * inputs.pot
  return { evP1, evP2: inputs.pot - evP1 }
}

/** The Clairvoyance Game's Nash equilibrium — derived, not authored: QQ's equilibrium
 *  bet frequency IS `alpha(pot,bet)` (the fold frequency that makes the bluff break
 *  even), and KK's equilibrium call frequency IS `mdf(pot,bet)`. AA always bets (a
 *  hand that never loses has nothing to gain by ever checking). */
export function clairvoyanceEquilibrium(pot: number, bet: number) {
  return {
    aaBetFreq: 1,
    qqBetFreq: alpha(pot, bet),
    kkCallFreq: mdf(pot, bet),
  }
}

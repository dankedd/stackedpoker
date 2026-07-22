/**
 * Poker Theory Mathematics
 * =========================
 * Original implementations of fundamental poker math.
 * These are mathematical facts, not copyrighted content.
 */

import type { AlphaMdfResult, BetSizeLabel } from "./types";

/**
 * Alpha — required fold frequency for a bluff (0% equity) to break even.
 * Formula: alpha = bet / (bet + pot)
 */
export function alpha(betSize: number, potSize: number): number {
  if (potSize <= 0 || betSize < 0) return 0;
  return betSize / (betSize + potSize);
}

/**
 * MDF — Minimum Defense Frequency.
 * Formula: MDF = 1 - alpha = pot / (bet + pot)
 */
export function mdf(betSize: number, potSize: number): number {
  return 1 - alpha(betSize, potSize);
}

/**
 * Pot odds as a percentage — minimum equity needed to call profitably.
 * Formula: call / (pot + call)
 */
export function potOddsPercent(potSize: number, callAmount: number): number {
  const total = potSize + callAmount;
  return total > 0 ? callAmount / total : 0;
}

/**
 * Required fold equity for a semi-bluff to break even.
 * Accounts for the hand's equity when called.
 */
export function requiredFoldEquity(
  betSize: number,
  potSize: number,
  handEquity: number = 0
): number {
  const a = alpha(betSize, potSize);
  if (handEquity >= 1) return 0;
  return Math.max(0, (a - handEquity) / (1 - handEquity));
}

/**
 * Compute full alpha/MDF analysis for a given bet size.
 */
export function analyzeBetSize(
  betFraction: number, // bet as fraction of pot (e.g. 0.5 = half-pot)
  potSize: number = 1  // normalize to 1 by default
): AlphaMdfResult {
  const betSize = betFraction * potSize;
  const a = alpha(betSize, potSize);
  const m = mdf(betSize, potSize);
  const bluffFraction = a;
  const valueFraction = 1 - a;

  // Format bluff:value label
  const ratio = valueFraction > 0 ? bluffFraction / valueFraction : 0;
  let bluffToValueLabel: string;
  if (ratio <= 0.1) bluffToValueLabel = "1 bluff : 10+ value";
  else if (ratio <= 0.25) bluffToValueLabel = "1 bluff : 4 value";
  else if (ratio <= 0.4) bluffToValueLabel = "1 bluff : 3 value";
  else if (ratio <= 0.6) bluffToValueLabel = "1 bluff : 2 value";
  else if (ratio <= 0.85) bluffToValueLabel = "2 bluffs : 3 value";
  else if (ratio <= 1.15) bluffToValueLabel = "1 bluff : 1 value";
  else if (ratio <= 1.5) bluffToValueLabel = "3 bluffs : 2 value";
  else bluffToValueLabel = "2 bluffs : 1 value";

  return {
    betFraction,
    alpha: a,
    mdf: m,
    bluffFraction,
    valueFraction,
    bluffToValueLabel,
  };
}

/**
 * Geometric bet size per street to go all-in on the final street.
 */
export function geometricBetSize(
  startingPot: number,
  effectiveStack: number,
  streetsRemaining: number
): number {
  if (streetsRemaining <= 0) return 1.0;
  if (startingPot <= 0) return 0.5;
  const finalPot = startingPot + 2 * effectiveStack;
  const ratio = finalPot / startingPot;
  return Math.pow(ratio, 1 / streetsRemaining) - 1;
}

/**
 * Compute SPR (stack-to-pot ratio).
 */
export function computeSPR(effectiveStackBB: number, potBB: number): number {
  return potBB > 0 ? effectiveStackBB / potBB : 0;
}

/**
 * Classify SPR into a strategic zone.
 */
export function classifySPR(spr: number): "micro" | "low" | "medium" | "high" | "deep" {
  if (spr <= 1) return "micro";
  if (spr <= 5) return "low";
  if (spr <= 11) return "medium";
  if (spr <= 20) return "high";
  return "deep";
}

/**
 * Classify a bet fraction into a named size category.
 */
export function classifyBetSize(betFraction: number): string {
  if (betFraction <= 0) return "check";
  if (betFraction <= 0.30) return "small_donk";
  if (betFraction <= 0.45) return "small_cbet";
  if (betFraction <= 0.60) return "medium_cbet";
  if (betFraction <= 0.85) return "large_bet";
  if (betFraction <= 1.1) return "pot_size_bet";
  return "overbet";
}

/**
 * Classify hand equity vs range into an equity bucket.
 */
export function classifyEquityBucket(
  equity: number
): "strong" | "good" | "weak" | "trash" {
  if (equity >= 0.75) return "strong";
  if (equity >= 0.50) return "good";
  if (equity >= 0.33) return "weak";
  return "trash";
}

/**
 * Rule-of-4 and rule-of-2 out approximations.
 */
export function outsToEquityFlop(outs: number): number {
  return Math.min(outs * 0.04, 1.0); // ~4% per out on flop (two cards)
}

export function outsToEquityTurn(outs: number): number {
  return Math.min(outs * 0.02, 1.0); // ~2% per out on turn (one card)
}

/** Backdoor draw equity (~4.26% per backdoor draw) */
export const BACKDOOR_EQUITY = 0.0426;

/**
 * Required equity to call, as a percentage (0-100). Thin, readably-named
 * wrapper around potOddsPercent for pot-odds screens.
 */
export function requiredEquityFromPot(potBeforeCall: number, callAmount: number): number {
  return potOddsPercent(potBeforeCall, callAmount) * 100;
}

/**
 * Exact probability (0-1) of hitting at least one out on the very next card.
 */
export function drawProbabilityNextCard(outs: number, unseen: number = 47): number {
  if (unseen <= 0) return 0;
  return Math.min(outs / unseen, 1);
}

/**
 * Exact probability (0-1) of hitting at least one out across two remaining
 * cards (e.g. turn + river), via the complement of missing both.
 * missTurn = (unseen - outs) / unseen
 * missRiver = (unseen - outs - 1) / (unseen - 1)   [one fewer unseen card, one fewer out]
 */
export function drawProbabilityByRiver(outs: number, unseenAfterFlop: number = 47): number {
  if (unseenAfterFlop <= 1) return 0;
  const missTurn = (unseenAfterFlop - outs) / unseenAfterFlop;
  const missRiver = (unseenAfterFlop - outs - 1) / (unseenAfterFlop - 1);
  return Math.min(1 - missTurn * missRiver, 1);
}

/**
 * Weighted expected value of a two-outcome decision (win/lose).
 * winAmount/loseAmount are signed from Hero's perspective (loseAmount is
 * typically negative, e.g. the amount risked).
 */
export function calculateCallEV(
  winProb: number,
  winAmount: number,
  loseProb: number,
  loseAmount: number
): number {
  return winProb * winAmount + loseProb * loseAmount;
}

/**
 * Required fold frequency for a bluff to break even — alias of alpha(),
 * named for fold-equity screens.
 */
export function bluffBreakEvenFrequency(betSize: number, potSize: number): number {
  return alpha(betSize, potSize);
}

/**
 * Equity realization: the fraction of raw showdown equity a hand actually
 * converts into pot share. >1 = over-realization, <1 = under-realization.
 */
export function calculateSimpleEqR(rawEquity: number, actualCapture: number): number {
  if (rawEquity <= 0) return 0;
  return actualCapture / rawEquity;
}

/**
 * Hero's additional chips risked when reraising to `raiseTo` (bb), on top of
 * whatever Hero already has in this street (0 preflop unless Hero is in the blinds).
 */
export function calculateRaiseRisk(raiseTo: number, heroAlreadyIn: number = 0): number {
  return Math.max(0, raiseTo - heroAlreadyIn);
}

/**
 * A villain's cost to call a reraise to `raiseTo` (bb), given what they
 * already have in this street (their open size, or their earlier call).
 */
export function calculateCallCost(raiseTo: number, villainAlreadyIn: number): number {
  return Math.max(0, raiseTo - villainAlreadyIn);
}

/**
 * Resulting pot if a reraise to `raiseTo` gets called. `potBeforeRaise` is the
 * pot immediately before Hero acts (already includes blinds, the opener's bet,
 * and any dead money from callers) — this only adds the *new* money entering:
 * Hero's incremental raise plus each continuing villain's incremental call.
 */
export function calculatePotAfterCall(
  potBeforeRaise: number,
  raiseTo: number,
  heroAlreadyIn: number = 0,
  villainsAlreadyIn: number[] = [],
): number {
  const heroRisk = calculateRaiseRisk(raiseTo, heroAlreadyIn);
  const callCosts = villainsAlreadyIn.reduce((sum, alreadyIn) => sum + calculateCallCost(raiseTo, alreadyIn), 0);
  return potBeforeRaise + heroRisk + callCosts;
}

/**
 * Reference alpha/MDF table for common bet sizes.
 */
export const ALPHA_TABLE: Record<BetSizeLabel, AlphaMdfResult> = {
  "25%_pot":  analyzeBetSize(0.25),
  "33%_pot":  analyzeBetSize(0.33),
  "50%_pot":  analyzeBetSize(0.50),
  "67%_pot":  analyzeBetSize(0.67),
  "75%_pot":  analyzeBetSize(0.75),
  "pot":      analyzeBetSize(1.00),
  "1.5x_pot": analyzeBetSize(1.50),
  "2x_pot":   analyzeBetSize(2.00),
  "all_in":   analyzeBetSize(10.0), // approximation for all-in
};

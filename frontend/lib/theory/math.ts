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

import { alpha, mdf, potOddsPercent } from "@/lib/theory/math";

/**
 * Pot odds.
 *
 * Every number comes from lib/theory/math.ts — the same functions the
 * StackedPoker lessons run on — so the tool and the curriculum can never
 * disagree about what a half-pot bet costs.
 */

export interface PotOddsInput {
  /** Pot BEFORE villain's bet. */
  pot: number;
  /** Villain's bet. */
  bet: number;
  /** What you must put in to call. Defaults to the bet in a heads-up spot. */
  call?: number;
}

export interface PotOddsResult {
  /** Total pot once your call is in. */
  potAfterCall: number;
  /** Minimum equity for the call to break even, 0–100. */
  requiredEquityPct: number;
  /** The price expressed as odds, e.g. "3.0 : 1". */
  oddsRatio: string;
  /** Bet as a fraction of the pot, 0–1+. */
  betAsPotFraction: number;
  /** How often villain's bluff must work, 0–100. */
  alphaPct: number;
  /** How much of your range must continue, 0–100. */
  mdfPct: number;
  /** Amount risked to win the current pot. */
  callAmount: number;
}

export type PotOddsError =
  | { kind: "pot-not-positive" }
  | { kind: "bet-negative" }
  | { kind: "call-negative" };

export function validatePotOdds(input: PotOddsInput): PotOddsError | null {
  if (!(input.pot > 0)) return { kind: "pot-not-positive" };
  if (!(input.bet >= 0)) return { kind: "bet-negative" };
  if (input.call !== undefined && !(input.call >= 0)) return { kind: "call-negative" };
  return null;
}

export function calculatePotOdds(input: PotOddsInput): PotOddsResult {
  const invalid = validatePotOdds(input);
  if (invalid) throw new Error(`Invalid pot odds input: ${invalid.kind}`);

  const { pot, bet } = input;
  // Heads-up, the amount to call IS the bet. It is a separate input because
  // multiway (or a short all-in) breaks that equality.
  const callAmount = input.call ?? bet;
  const potBeforeCall = pot + bet;
  const potAfterCall = potBeforeCall + callAmount;

  const requiredEquity = potOddsPercent(potBeforeCall, callAmount);

  return {
    potAfterCall,
    requiredEquityPct: requiredEquity * 100,
    oddsRatio: callAmount > 0 ? `${(potBeforeCall / callAmount).toFixed(1)} : 1` : "no cost",
    betAsPotFraction: pot > 0 ? bet / pot : 0,
    alphaPct: alpha(bet, pot) * 100,
    mdfPct: mdf(bet, pot) * 100,
    callAmount,
  };
}

/**
 * The plain-English reading of the price.
 *
 * Deliberately about the PRICE, not about whether to call: a break-even
 * threshold is arithmetic, but "you should call" depends on your hand's
 * equity against villain's range, which this tool does not know. Saying more
 * than the maths supports is exactly what the theory-source rules forbid.
 */
export function explainPotOdds(result: PotOddsResult): string {
  const equity = result.requiredEquityPct.toFixed(1);
  return (
    `You are risking ${formatAmount(result.callAmount)} to win ` +
    `${formatAmount(result.potAfterCall - result.callAmount)}, so the call breaks even at ` +
    `${equity}% equity. Below ${equity}% it loses money; above it, it makes money. ` +
    `Whether your hand clears that bar depends on villain's range, which the price alone ` +
    `cannot tell you.`
  );
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Preset bet sizes, as a fraction of the pot — the shortcut buttons. */
export const COMMON_BET_FRACTIONS = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2] as const;

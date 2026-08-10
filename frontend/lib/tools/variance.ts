/**
 * Poker variance — confidence intervals and downswing sizing.
 *
 * This is statistics, not poker strategy. Results per 100 hands are treated
 * as independent draws with a known mean (your win rate) and a known standard
 * deviation, so the total over N hands is a sum of N/100 such draws:
 *
 *     expected  = winRate x (hands / 100)
 *     std dev   = sd x sqrt(hands / 100)
 *
 * The interval then comes from the normal approximation. Every one of those
 * steps is textbook probability, which is why this ships without a poker
 * source — but the ASSUMPTIONS are not free, and `VARIANCE_ASSUMPTIONS`
 * below is rendered on the page rather than buried here. A variance
 * calculator that hides its assumptions tells players their downswing is
 * impossible when it is merely unlikely.
 *
 * The tool does NOT estimate your standard deviation for you. A realistic SD
 * depends on game, format and stake, and StackedPoker has no reviewed source
 * for those figures, so the number stays the player's own input.
 */

export interface VarianceInput {
  /** Win rate in big blinds per 100 hands. May be negative. */
  winRateBb100: number;
  /** Standard deviation in big blinds per 100 hands. */
  stdDevBb100: number;
  hands: number;
  /** 0–1. Defaults to 0.95. */
  confidence?: number;
}

export interface VariancePoint {
  hands: number;
  expected: number;
  upper: number;
  lower: number;
}

export interface VarianceResult {
  /** Expected result over the whole sample, in big blinds. */
  expectedBb: number;
  /** Standard deviation of the total, in big blinds. */
  stdDevBb: number;
  confidence: number;
  zScore: number;
  lowerBb: number;
  upperBb: number;
  /** Probability the sample finishes below zero, 0–100. */
  probabilityOfLossPct: number;
  /** Win rate range the sample is consistent with, in bb/100. */
  lowerWinRate: number;
  upperWinRate: number;
  /** Curve for the chart. */
  points: VariancePoint[];
}

export type VarianceError =
  | { kind: "hands-not-positive" }
  | { kind: "std-dev-not-positive" }
  | { kind: "confidence-out-of-range" };

export function validateVariance(input: VarianceInput): VarianceError | null {
  if (!(input.hands > 0)) return { kind: "hands-not-positive" };
  if (!(input.stdDevBb100 > 0)) return { kind: "std-dev-not-positive" };
  const confidence = input.confidence ?? 0.95;
  if (!(confidence > 0 && confidence < 1)) return { kind: "confidence-out-of-range" };
  return null;
}

/** The z-scores offered in the UI, so no inverse-normal approximation is needed. */
export const CONFIDENCE_LEVELS: { confidence: number; z: number; label: string }[] = [
  { confidence: 0.68, z: 1, label: "68%" },
  { confidence: 0.9, z: 1.645, label: "90%" },
  { confidence: 0.95, z: 1.96, label: "95%" },
  { confidence: 0.99, z: 2.576, label: "99%" },
];

export function zScoreFor(confidence: number): number {
  const match = CONFIDENCE_LEVELS.find((level) => Math.abs(level.confidence - confidence) < 1e-9);
  return match ? match.z : 1.96;
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 error-function
 * approximation — accurate to ~1e-7, far beyond what a percentage needs.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Number of points on the chart. Enough to look smooth, few enough to stay light. */
const CURVE_POINTS = 60;

export function calculateVariance(input: VarianceInput): VarianceResult {
  const invalid = validateVariance(input);
  if (invalid) throw new Error(`Invalid variance input: ${invalid.kind}`);

  const confidence = input.confidence ?? 0.95;
  const z = zScoreFor(confidence);
  const blocks = input.hands / 100;

  const expectedBb = input.winRateBb100 * blocks;
  const stdDevBb = input.stdDevBb100 * Math.sqrt(blocks);
  const margin = z * stdDevBb;

  const points: VariancePoint[] = [];
  for (let i = 0; i <= CURVE_POINTS; i += 1) {
    const hands = Math.round((input.hands * i) / CURVE_POINTS);
    const pointBlocks = hands / 100;
    const expected = input.winRateBb100 * pointBlocks;
    const spread = z * input.stdDevBb100 * Math.sqrt(pointBlocks);
    points.push({ hands, expected, upper: expected + spread, lower: expected - spread });
  }

  return {
    expectedBb,
    stdDevBb,
    confidence,
    zScore: z,
    lowerBb: expectedBb - margin,
    upperBb: expectedBb + margin,
    // P(total < 0) under the normal approximation.
    probabilityOfLossPct: normalCdf(-expectedBb / stdDevBb) * 100,
    lowerWinRate: input.winRateBb100 - (z * input.stdDevBb100) / Math.sqrt(blocks),
    upperWinRate: input.winRateBb100 + (z * input.stdDevBb100) / Math.sqrt(blocks),
    points,
  };
}

export function explainVariance(result: VarianceResult, hands: number): string {
  const pct = (result.confidence * 100).toFixed(0);
  return (
    `Over ${hands.toLocaleString("en-US")} hands, ${pct}% of the time you finish between ` +
    `${formatBb(result.lowerBb)} and ${formatBb(result.upperBb)} big blinds — a spread of ` +
    `${formatBb(result.upperBb - result.lowerBb)} bb around an expectation of ` +
    `${formatBb(result.expectedBb)}. That same sample is consistent with a true win rate ` +
    `anywhere from ${result.lowerWinRate.toFixed(2)} to ${result.upperWinRate.toFixed(2)} bb/100, ` +
    `which is why a sample this size cannot settle whether you are a winning player.`
  );
}

function formatBb(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Shown on the page. The assumptions are the result — a number without them
 * invites exactly the wrong conclusion.
 */
export const VARIANCE_ASSUMPTIONS = [
  "Results per 100 hands are treated as independent and normally distributed. Real sessions are neither, so the tails are thicker than this model shows.",
  "Your win rate is treated as a known, fixed number. In reality it is itself an estimate, and games change.",
  "Standard deviation is your input. StackedPoker publishes no SD figures because it has no reviewed source for them — take yours from your own tracking software.",
  "Results are in big blinds, not currency, and ignore rake changes, table selection and tilt.",
] as const;

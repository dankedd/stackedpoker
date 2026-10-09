/**
 * Feature flag for the Preflop Trainer section (/preflop-trainer).
 *
 * OFF unless NEXT_PUBLIC_FEATURE_PREFLOP_RANGES === "true". While off the
 * section does not exist: no header item and every route under
 * /preflop-trainer 404s. Read at build time — changing it needs a redeploy.
 *
 * Why a flag: the current data comes from "Modern Poker Theory" and stays
 * dark until the rights are settled or the JSON is replaced with own output.
 */
export const PREFLOP_RANGES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PREFLOP_RANGES === "true";

export const PREFLOP_TRAINER_PATH = "/preflop-trainer";
export const PREFLOP_RANGES_PATH = "/preflop-trainer/ranges";

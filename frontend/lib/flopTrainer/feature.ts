import { PREFLOP_RANGES_ENABLED } from "@/lib/ranges/feature";

/**
 * The Flop Equity Trainer (/flop-trainer) uses the same Modern Poker Theory
 * ranges as the Preflop Trainer, so it follows the same flag
 * (NEXT_PUBLIC_FEATURE_PREFLOP_RANGES): off → no header item and a 404.
 */
export const FLOP_TRAINER_ENABLED = PREFLOP_RANGES_ENABLED;

export const FLOP_TRAINER_PATH = "/flop-trainer";

import { PREFLOP_RANGES_ENABLED } from "@/lib/ranges/feature";

/**
 * The Flop Equity Trainer (/flop-trainer) uses the same Modern Poker Theory
 * ranges as the Preflop Trainer, so it follows the same flag
 * (NEXT_PUBLIC_FEATURE_PREFLOP_RANGES): off → no header item and a 404.
 */
export const FLOP_TRAINER_ENABLED = PREFLOP_RANGES_ENABLED;

export const FLOP_TRAINER_PATH = "/flop-trainer";
export const FLOP_QUICK_FIRE_PATH = "/flop-trainer/quick-fire";
export const FLOP_EXPLORER_PATH = "/flop-trainer/explorer";

/**
 * The spots the Flop Trainer deals, by menu choice (?spot=bn|utg). A product
 * choice, not a data limit: they are the postflop chapters' own spots, whose
 * ranges and c-bet strategies the book prints. Hand Review uses every
 * precomputed spot in the catalog (spotCatalog.json, `precomputed`).
 */
export const FLOP_TRAINER_SPOTS = { bn: "srp_bb_vs_bn_40", utg: "srp_bb_vs_utg_40" } as const;

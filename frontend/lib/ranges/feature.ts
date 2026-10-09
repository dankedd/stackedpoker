/**
 * Feature flag for the preflop range tool (/tools/preflop-ranges).
 *
 * OFF unless NEXT_PUBLIC_FEATURE_PREFLOP_RANGES === "true". While off the
 * tool does not exist anywhere: no registry entry (so no sitemap, search,
 * related links or tools-index card), no footer link, and the route 404s.
 * Read at build time — changing it needs a rebuild/redeploy.
 *
 * Why a flag: the current data comes from "Modern Poker Theory" and stays
 * dark until the rights are settled or the JSON is replaced with own output.
 */
export const PREFLOP_RANGES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PREFLOP_RANGES === "true";

export const PREFLOP_RANGES_SLUG = "preflop-ranges";

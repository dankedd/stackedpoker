/**
 * Puzzle Tagging System
 * ======================
 * Original structured metadata for puzzle classification and coaching.
 * Each tag describes a strategic concept that a puzzle teaches or tests.
 */

import type { PuzzleTag, PuzzleTagMetadata } from "./types";

export const PUZZLE_TAG_REGISTRY: Record<PuzzleTag, PuzzleTagMetadata> = {

  // ─── Range & Equity ─────────────────────────────────────────────────────

  range_advantage: {
    tag: "range_advantage",
    category: "ranges",
    displayName: "Range Advantage",
    description: "One player's range has higher overall equity than the opponent's on this board.",
    relatedConcepts: ["range_advantage", "cbet_theory"],
    difficulty: "intermediate",
  },
  nut_advantage: {
    tag: "nut_advantage",
    category: "ranges",
    displayName: "Nut Advantage",
    description: "One player can have the nuts; the other cannot. Enables overbets and polar strategies.",
    relatedConcepts: ["nut_advantage", "overbet", "polarized_betting"],
    difficulty: "advanced",
  },
  capped_range: {
    tag: "capped_range",
    category: "ranges",
    displayName: "Capped Range",
    description: "A range missing its strongest hands is exploitable by large bets and overbets.",
    relatedConcepts: ["capped_range", "overbet"],
    difficulty: "intermediate",
  },
  bluff_catcher: {
    tag: "bluff_catcher",
    category: "ranges",
    displayName: "Bluff Catcher",
    description: "A hand that only beats a bluff — calling decisions governed by MDF.",
    relatedConcepts: ["mdf", "indifference"],
    difficulty: "intermediate",
  },
  equity_realization: {
    tag: "equity_realization",
    category: "equity",
    displayName: "Equity Realization",
    description: "Understanding how much of your theoretical equity you actually capture.",
    relatedConcepts: ["equity_realization", "position_value"],
    difficulty: "intermediate",
  },

  // ─── Board Texture ───────────────────────────────────────────────────────

  dry_board: {
    tag: "dry_board",
    category: "postflop",
    displayName: "Dry Board",
    description: "Rainbow, disconnected board — few draws, IP can use high-frequency small cbet.",
    relatedConcepts: ["cbet_theory", "merged_betting"],
    difficulty: "beginner",
  },
  wet_board: {
    tag: "wet_board",
    category: "postflop",
    displayName: "Wet Board",
    description: "Many draws present — charging draws requires larger sizes, lower cbet frequency.",
    relatedConcepts: ["cbet_theory", "polarized_betting"],
    difficulty: "intermediate",
  },
  low_connected_board: {
    tag: "low_connected_board",
    category: "postflop",
    displayName: "Low Connected Board",
    description: "BB's calling range connects strongly — OOP donk bet becomes viable or dominant.",
    relatedConcepts: ["donk_bet", "range_advantage", "nut_advantage"],
    difficulty: "advanced",
  },
  ace_high_board: {
    tag: "ace_high_board",
    category: "postflop",
    displayName: "Ace-High Board",
    description: "Preflop aggressor holds more aces — massive range advantage, merged small cbet optimal.",
    relatedConcepts: ["range_advantage", "merged_betting", "cbet_theory"],
    difficulty: "intermediate",
  },
  paired_board: {
    tag: "paired_board",
    category: "postflop",
    displayName: "Paired Board",
    description: "Board has a pair — equity compresses, kicker value changes strategy.",
    relatedConcepts: ["cbet_theory"],
    difficulty: "intermediate",
  },
  monotone_board: {
    tag: "monotone_board",
    category: "postflop",
    displayName: "Monotone Board",
    description: "All three cards same suit — flush equity dominates, check frequently without a flush.",
    relatedConcepts: ["cbet_theory", "equity_realization"],
    difficulty: "advanced",
  },

  // ─── Betting Concepts ────────────────────────────────────────────────────

  merged_cbet: {
    tag: "merged_cbet",
    category: "postflop",
    displayName: "Merged C-Bet",
    description: "Betting most of the range at a small size — high frequency, low sizing.",
    relatedConcepts: ["merged_betting", "cbet_theory", "range_advantage"],
    difficulty: "intermediate",
  },
  polarized_cbet: {
    tag: "polarized_cbet",
    category: "postflop",
    displayName: "Polarized C-Bet",
    description: "Betting only strong hands and bluffs at a large size — lower frequency, higher size.",
    relatedConcepts: ["polarized_betting", "cbet_theory"],
    difficulty: "advanced",
  },
  donk_bet: {
    tag: "donk_bet",
    category: "postflop",
    displayName: "Donk Bet",
    description: "OOP leads into the preflop aggressor — valid on low connected boards with nut advantage.",
    relatedConcepts: ["donk_bet", "nut_advantage", "range_advantage"],
    difficulty: "advanced",
  },
  check_raise: {
    tag: "check_raise",
    category: "postflop",
    displayName: "Check-Raise",
    description: "Check with intent to raise — used to protect checking range and extract value OOP.",
    relatedConcepts: ["polarized_betting", "nut_advantage"],
    difficulty: "intermediate",
  },
  overbet_spot: {
    tag: "overbet_spot",
    category: "bet_sizing",
    displayName: "Overbet Spot",
    description: "Betting >100% pot — requires nut advantage and polarized range.",
    relatedConcepts: ["overbet", "nut_advantage", "mdf"],
    difficulty: "advanced",
  },
  delayed_cbet: {
    tag: "delayed_cbet",
    category: "postflop",
    displayName: "Delayed C-Bet",
    description: "IP checks flop, bets turn — a deceptive line that merges checking range.",
    relatedConcepts: ["cbet_theory", "range_theory"],
    difficulty: "intermediate",
  },
  geometric_sizing: {
    tag: "geometric_sizing",
    category: "bet_sizing",
    displayName: "Geometric Sizing",
    description: "Equal pot-fraction bets across streets targeting a river all-in.",
    relatedConcepts: ["geometric_sizing", "spr_theory"],
    difficulty: "advanced",
  },

  // ─── MDF / Alpha ─────────────────────────────────────────────────────────

  MDF_pressure: {
    tag: "MDF_pressure",
    category: "game_theory",
    displayName: "MDF Pressure",
    description: "Understanding the minimum frequency to defend against a bet.",
    relatedConcepts: ["mdf", "alpha", "indifference"],
    difficulty: "intermediate",
  },
  alpha_calculation: {
    tag: "alpha_calculation",
    category: "game_theory",
    displayName: "Alpha / Break-Even Bluff",
    description: "Calculating the fold frequency needed for a bluff to profit.",
    relatedConcepts: ["alpha", "fold_equity"],
    difficulty: "intermediate",
  },
  fold_too_much: {
    tag: "fold_too_much",
    category: "exploitative",
    displayName: "Folding Too Much",
    description: "Folding above MDF makes bluffing automatically profitable for the opponent.",
    relatedConcepts: ["mdf", "exploitative_play"],
    difficulty: "intermediate",
  },
  call_too_much: {
    tag: "call_too_much",
    category: "exploitative",
    displayName: "Calling Too Much (Calling Station)",
    description: "Calling beyond MDF allows over-value betting and reduces bluff profitability.",
    relatedConcepts: ["mdf", "exploitative_play"],
    difficulty: "intermediate",
  },

  // ─── SPR ─────────────────────────────────────────────────────────────────

  spr_commitment: {
    tag: "spr_commitment",
    category: "equity",
    displayName: "SPR Commitment Decision",
    description: "Determining whether hand strength justifies stack commitment at current SPR.",
    relatedConcepts: ["spr_theory"],
    difficulty: "intermediate",
  },
  low_spr_top_pair: {
    tag: "low_spr_top_pair",
    category: "equity",
    displayName: "Low SPR: Top Pair Commits",
    description: "At low SPR (1–5), top pair top kicker is typically a commitment hand.",
    relatedConcepts: ["spr_theory", "equity_realization"],
    difficulty: "beginner",
  },
  high_spr_nuttiness: {
    tag: "high_spr_nuttiness",
    category: "equity",
    displayName: "High SPR: Nuttiness Required",
    description: "At high SPR (11+), only sets, straights, and flushes justify large pot commitment.",
    relatedConcepts: ["spr_theory", "nut_advantage"],
    difficulty: "intermediate",
  },

  // ─── Draws ───────────────────────────────────────────────────────────────

  semi_bluff: {
    tag: "semi_bluff",
    category: "postflop",
    displayName: "Semi-Bluff",
    description: "Betting/raising with a drawing hand — wins by fold or by improving.",
    relatedConcepts: ["fold_equity", "equity_realization"],
    difficulty: "beginner",
  },
  flush_draw: {
    tag: "flush_draw",
    category: "postflop",
    displayName: "Flush Draw",
    description: "Nine outs to complete a flush — ~35% equity with two cards to come.",
    relatedConcepts: [],
    difficulty: "beginner",
  },
  oesd: {
    tag: "oesd",
    category: "postflop",
    displayName: "Open-Ended Straight Draw",
    description: "Eight outs to complete a straight — ~31% equity with two cards to come.",
    relatedConcepts: [],
    difficulty: "beginner",
  },
  gutshot: {
    tag: "gutshot",
    category: "postflop",
    displayName: "Gutshot Straight Draw",
    description: "Four outs to complete an inside straight — ~16% equity with two cards to come.",
    relatedConcepts: [],
    difficulty: "beginner",
  },
  backdoor_draw: {
    tag: "backdoor_draw",
    category: "postflop",
    displayName: "Backdoor Draw",
    description: "Needs two running cards to complete — ~4.3% equity. NOT equivalent to an OESD.",
    relatedConcepts: [],
    difficulty: "intermediate",
  },
  combo_draw: {
    tag: "combo_draw",
    category: "postflop",
    displayName: "Combo Draw",
    description: "Simultaneous flush draw + straight draw — 12–15 outs, 45–55% equity.",
    relatedConcepts: [],
    difficulty: "intermediate",
  },

  // ─── Position ────────────────────────────────────────────────────────────

  ip_advantage: {
    tag: "ip_advantage",
    category: "position",
    displayName: "In Position Advantage",
    description: "Acting last provides informational advantage and better equity realization.",
    relatedConcepts: ["position_value", "equity_realization"],
    difficulty: "beginner",
  },
  oop_challenge: {
    tag: "oop_challenge",
    category: "position",
    displayName: "Out-of-Position Challenge",
    description: "OOP must check more, protect ranges, and use larger sizes to compensate.",
    relatedConcepts: ["position_value", "equity_realization"],
    difficulty: "intermediate",
  },
  bvb_dynamics: {
    tag: "bvb_dynamics",
    category: "position",
    displayName: "Blind vs Blind Dynamics",
    description: "BB is IP postflop vs SB — unique dynamics enabling wide BB defense.",
    relatedConcepts: ["position_value", "equity_realization"],
    difficulty: "intermediate",
  },

  // ─── Preflop ─────────────────────────────────────────────────────────────

  rfi_spot: {
    tag: "rfi_spot",
    category: "preflop",
    displayName: "Raise First In",
    description: "Opening the pot with a raise — the most common preflop spot.",
    relatedConcepts: [],
    difficulty: "beginner",
  },
  "3bet_spot": {
    tag: "3bet_spot",
    category: "preflop",
    displayName: "3-Bet Spot",
    description: "Re-raising a preflop open — creates a polarized range pot.",
    relatedConcepts: [],
    difficulty: "intermediate",
  },
  "4bet_spot": {
    tag: "4bet_spot",
    category: "preflop",
    displayName: "4-Bet Spot",
    description: "Re-raising a 3-bet — often commits stacks at medium stack depths.",
    relatedConcepts: [],
    difficulty: "advanced",
  },
  squeeze_spot: {
    tag: "squeeze_spot",
    category: "preflop",
    displayName: "Squeeze",
    description: "3-betting after a raise and one or more calls — extra dead money.",
    relatedConcepts: [],
    difficulty: "intermediate",
  },
  cold_call: {
    tag: "cold_call",
    category: "preflop",
    displayName: "Cold Call",
    description: "Calling a raise when no money has been previously invested.",
    relatedConcepts: ["equity_realization"],
    difficulty: "intermediate",
  },
  steal_spot: {
    tag: "steal_spot",
    category: "preflop",
    displayName: "Steal Spot",
    description: "Raising from late position into tight blinds — high fold equity.",
    relatedConcepts: ["alpha", "fold_equity"],
    difficulty: "beginner",
  },
  push_fold: {
    tag: "push_fold",
    category: "tournament",
    displayName: "Push/Fold Decision",
    description: "Short stack all-in or fold decision — decided by nash equilibrium ranges.",
    relatedConcepts: ["nash_equilibrium", "fold_equity"],
    difficulty: "intermediate",
  },

  // ─── Exploit ─────────────────────────────────────────────────────────────

  exploit_spot: {
    tag: "exploit_spot",
    category: "exploitative",
    displayName: "Exploit Opportunity",
    description: "Deviating from GTO to capitalize on a specific opponent tendency.",
    relatedConcepts: ["exploitative_play"],
    difficulty: "advanced",
  },
  leak_detection: {
    tag: "leak_detection",
    category: "exploitative",
    displayName: "Leak Detection",
    description: "Identifying a recurring mistake pattern in play.",
    relatedConcepts: ["exploitative_play"],
    difficulty: "intermediate",
  },
  gto_deviation: {
    tag: "gto_deviation",
    category: "exploitative",
    displayName: "GTO Deviation",
    description: "A play that is not GTO-optimal — understanding why it's suboptimal.",
    relatedConcepts: ["nash_equilibrium", "exploitative_play"],
    difficulty: "advanced",
  },

  // ─── Tournament ───────────────────────────────────────────────────────────

  icm_pressure: {
    tag: "icm_pressure",
    category: "tournament",
    displayName: "ICM Pressure",
    description: "Tournament payout structure changes chip EV decisions.",
    relatedConcepts: [],
    difficulty: "advanced",
  },
  bubble_factor: {
    tag: "bubble_factor",
    category: "tournament",
    displayName: "Bubble Factor",
    description: "Near the bubble, chip EV understates the risk of elimination.",
    relatedConcepts: [],
    difficulty: "advanced",
  },

  // ─── Strategy Quality ─────────────────────────────────────────────────────

  value_bet_strong: {
    tag: "value_bet_strong",
    category: "postflop",
    displayName: "Value Bet — Strong",
    description: "Betting for value with a hand that is significantly ahead of villain's range.",
    relatedConcepts: ["equity_bucket", "cbet_theory"],
    difficulty: "beginner",
  },
  thin_value: {
    tag: "thin_value",
    category: "postflop",
    displayName: "Thin Value Bet",
    description: "Betting with a marginal edge — correct when hand is barely ahead.",
    relatedConcepts: ["equity_bucket", "exploitative_play"],
    difficulty: "advanced",
  },
  bluff_candidate: {
    tag: "bluff_candidate",
    category: "postflop",
    displayName: "Bluff Candidate",
    description: "A hand suitable for bluffing — has blockers, low showdown value, or equity backup.",
    relatedConcepts: ["blockers", "semi_bluff", "alpha"],
    difficulty: "intermediate",
  },
  showdown_value: {
    tag: "showdown_value",
    category: "postflop",
    displayName: "Showdown Value",
    description: "A hand likely to win at showdown — check/call rather than bet/fold.",
    relatedConcepts: ["equity_bucket"],
    difficulty: "beginner",
  },
  pot_control: {
    tag: "pot_control",
    category: "postflop",
    displayName: "Pot Control",
    description: "Keeping the pot small with a marginal hand to reach showdown cheaply.",
    relatedConcepts: ["spr_theory", "equity_realization"],
    difficulty: "intermediate",
  },
};

/**
 * Get all tags for a given strategic category.
 */
export function getTagsByCategory(category: string): PuzzleTagMetadata[] {
  return Object.values(PUZZLE_TAG_REGISTRY).filter(t => t.category === category);
}

/**
 * Get all tags for a given difficulty level.
 */
export function getTagsByDifficulty(
  difficulty: "beginner" | "intermediate" | "advanced"
): PuzzleTagMetadata[] {
  return Object.values(PUZZLE_TAG_REGISTRY).filter(t => t.difficulty === difficulty);
}

/**
 * Classify a set of tags into study categories for a puzzle.
 */
export function classifyPuzzleStudyAreas(tags: PuzzleTag[]): string[] {
  const categories = new Set<string>();
  for (const tag of tags) {
    const meta = PUZZLE_TAG_REGISTRY[tag];
    if (meta) categories.add(meta.category);
  }
  return Array.from(categories);
}

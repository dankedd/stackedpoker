import type { TopicCluster } from "../types";

/**
 * Topic clusters (§7).
 *
 * The taxonomy is a shallow tree: one hub ("poker-strategy") over nine
 * topical clusters. Membership is NOT listed here — it is computed in
 * lib/seo/content/index.ts from each entry's own `clusters` array, so a new
 * wiki article or lesson joins its cluster (and every "related pages" strip
 * that reads from it) the moment it is added (§23).
 *
 * `pathway` is the exception: an ordered reading route through a cluster,
 * mirroring the brief's Preflop → Opening Ranges → 3-Betting → 4-Betting →
 * Squeezing → Defending chain. Order is editorial, so it is declared.
 */

export interface TopicClusterSource extends Omit<TopicCluster, "memberPaths"> {
  /** Ordered paths that lead the cluster's listing. Others follow. */
  pathway?: string[];
}

export const ROOT_CLUSTER_ID = "poker-strategy";

export const TOPIC_CLUSTERS: TopicClusterSource[] = [
  {
    id: ROOT_CLUSTER_ID,
    title: "Poker Strategy",
    description:
      "The whole StackedPoker curriculum, from the rules of Texas Hold'em to solver-level range construction.",
  },
  {
    id: "fundamentals",
    title: "Poker Fundamentals",
    description:
      "Rules, hand rankings, position and the vocabulary every other topic assumes you already have.",
    parentId: ROOT_CLUSTER_ID,
  },
  {
    id: "preflop",
    title: "Preflop Strategy",
    description:
      "Opening ranges, 3-betting, 4-betting, squeezing and defending — the decisions that shape every pot before a flop is dealt.",
    parentId: ROOT_CLUSTER_ID,
    pathway: [
      "/courses/preflop-foundation-module",
      "/courses/preflop-aggression-module",
      "/wiki/3bet",
      "/wiki/squeeze",
      "/courses/defending-the-open-module",
      "/wiki/position",
    ],
  },
  {
    id: "postflop",
    title: "Postflop Strategy",
    description:
      "Board texture, continuation betting, and how ranges interact once the flop is out.",
    parentId: ROOT_CLUSTER_ID,
    pathway: ["/wiki/cbet", "/wiki/range-advantage", "/wiki/nut-advantage", "/wiki/spr"],
  },
  {
    id: "ranges",
    title: "Ranges & Range Construction",
    description:
      "Thinking in ranges rather than hands: polarization, capping, blockers and card removal.",
    parentId: ROOT_CLUSTER_ID,
    pathway: ["/wiki/polarization", "/wiki/capped-range", "/wiki/blockers", "/wiki/equity-buckets"],
  },
  {
    id: "equity",
    title: "Equity & Poker Math",
    description:
      "Pot odds, outs, expected value and equity realization — the arithmetic under every decision.",
    parentId: ROOT_CLUSTER_ID,
    pathway: [
      "/tools/pot-odds-calculator",
      "/tools/outs-calculator",
      "/tools/ev-calculator",
      "/wiki/equity-realization",
    ],
  },
  {
    id: "bet-sizing",
    title: "Bet Sizing",
    description:
      "Why a size is chosen, not guessed: merged and polarized betting, overbets and geometric sizing.",
    parentId: ROOT_CLUSTER_ID,
    pathway: ["/wiki/merged-betting", "/wiki/overbet", "/wiki/geometric-sizing"],
  },
  {
    id: "game-theory",
    title: "Game Theory Foundations",
    description:
      "Equilibrium, indifference, minimum defense frequency and alpha — what 'GTO' actually refers to.",
    parentId: ROOT_CLUSTER_ID,
    pathway: ["/wiki/nash-equilibrium", "/wiki/indifference", "/wiki/mdf", "/wiki/alpha"],
  },
  {
    id: "exploitative",
    title: "Exploitative Play",
    description: "Deviating from equilibrium on purpose, once you know what you are deviating from.",
    parentId: ROOT_CLUSTER_ID,
    pathway: ["/wiki/exploitative-play"],
  },
  {
    id: "glossary",
    title: "Poker Terminology",
    description: "Every term StackedPoker uses, defined and linked to the lesson that teaches it.",
    parentId: ROOT_CLUSTER_ID,
  },
];

export function clusterById(id: string): TopicClusterSource | undefined {
  return TOPIC_CLUSTERS.find((c) => c.id === id);
}

export function clusterTitle(id: string): string {
  return clusterById(id)?.title ?? id;
}

/**
 * Curriculum module → topic clusters.
 *
 * Modules are the product's own grouping; clusters are the site's topical
 * grouping. Mapping them explicitly is what lets a lesson page link sideways
 * to a wiki article on the same subject instead of only up to its module.
 * Unmapped modules fall back to the root cluster rather than disappearing.
 */
export const MODULE_CLUSTERS: Record<string, string[]> = {
  "poker-fundamentals-module": ["fundamentals"],
  "math-foundations-module": ["equity", "fundamentals"],
  "preflop-foundation-module": ["preflop"],
  "preflop-aggression-module": ["preflop", "ranges"],
  "defending-the-open-module": ["preflop"],
  "flop-fundamentals-module": ["postflop"],
  "cbetting-fundamentals-module": ["postflop", "bet-sizing"],
  "range-vs-range-module": ["ranges", "postflop"],
  "blockers-module": ["ranges"],
  "game-theory-foundations-module": ["game-theory"],
  "polarized-module": ["ranges", "bet-sizing"],
  "bet-sizing-language-module": ["bet-sizing"],
  "defending-bets-module": ["postflop", "game-theory"],
  "flop-strategy-module": ["postflop"],
  "turn-strategy-module": ["postflop"],
  "river-strategy-module": ["postflop"],
  "multistreet-planning-module": ["postflop", "bet-sizing"],
  "three-bet-pots-module": ["preflop", "postflop"],
  "four-bet-pots-module": ["preflop"],
  "blind-vs-blind-module": ["preflop"],
  "short-stack-strategy-module": ["preflop"],
  "deep-stack-strategy-module": ["postflop"],
  "tournament-foundations-module": ["preflop"],
  "icm-module": ["preflop"],
  "population-exploits-module": ["exploitative"],
  "player-exploitation-module": ["exploitative"],
  "think-like-solver-module": ["game-theory"],
  "range-reconstruction-module": ["ranges"],
  "elite-decision-making-module": ["exploitative", "game-theory"],
};

export function clustersForModule(moduleSlug: string | undefined): string[] {
  if (!moduleSlug) return [ROOT_CLUSTER_ID];
  return MODULE_CLUSTERS[moduleSlug] ?? [ROOT_CLUSTER_ID];
}

import { FLOP_TRAINER_ENABLED, FLOP_TRAINER_PATH } from "@/lib/flopTrainer/feature";
import { PREFLOP_RANGES_ENABLED, PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { HAND_HISTORY_ENABLED, HANDS_PATH } from "@/lib/handHistory/feature";
import { t as handHistoryStrings } from "@/lib/handHistory/strings";
import { isFeaturePublic } from "@/lib/features";
import { ROUTES } from "./routes";

/**
 * Site-wide navigation links — the header nav and both footers.
 *
 * These are the links that appear on EVERY page, which makes them the
 * backbone of the internal-link graph: a page reachable from here can never
 * be an orphan. The graph builder in lib/seo/graph.ts reads this exact list,
 * so the orphan check measures the links the site actually renders rather
 * than a second, hand-maintained approximation of them.
 */

export interface NavLink {
  label: string;
  href: string;
  /** Marks the core product surface — styled differently in the header. */
  primary?: boolean;
}

/**
 * Header items for a given flag state. A function (rather than only the
 * constant below) so tests can check both states of the Preflop Trainer flag.
 *
 * The Wiki is deliberately NOT a header item: it stays reachable from the
 * footer ("Poker wiki" under Reference), the sitemap and every breadcrumb,
 * which keeps it one hop from every page for crawlers.
 */
export function primaryNav({
  preflopTrainer,
  flopTrainer = false,
  handHistory = false,
  learn = isFeaturePublic("learn"),
  puzzles = isFeaturePublic("puzzles"),
}: {
  preflopTrainer: boolean;
  /** Behind the same flag as the Preflop Trainer (lib/flopTrainer/feature.ts). */
  flopTrainer?: boolean;
  handHistory?: boolean;
  /** Learn and Puzzles are header items only once public (lib/features.ts);
   *  until then they live in the dev-only "In development" menu (devNav). */
  learn?: boolean;
  puzzles?: boolean;
}): NavLink[] {
  return [
    ...(learn ? [{ label: "Learn", href: "/learn", primary: true }] : []),
    ...(puzzles ? [{ label: "Puzzles", href: ROUTES.puzzles }] : []),
    // Behind NEXT_PUBLIC_FEATURE_PREFLOP_RANGES (lib/ranges/feature.ts).
    ...(preflopTrainer ? [{ label: "Preflop Trainer", href: PREFLOP_TRAINER_PATH }] : []),
    ...(flopTrainer ? [{ label: "Flop Trainer", href: FLOP_TRAINER_PATH }] : []),
    // Behind NEXT_PUBLIC_FEATURE_HAND_HISTORY (lib/handHistory/feature.ts).
    ...(handHistory ? [{ label: handHistoryStrings.section.navItem, href: HANDS_PATH }] : []),
    { label: "Bankroll", href: "/bankroll" },
    { label: "Leaderboard", href: "/leaderboard" },
    // Product areas switched to "live" in PRODUCT_AREAS (none today).
    ...areasWith("live"),
  ];
}

/**
 * Unfinished product areas — the ONE switch for each. Their pages still exist
 * (so the work can continue), but what visitors get depends on `status`:
 *
 *   "off"   in no menu, link or tile; the page is noindex and redirects
 *           (redirect()) to `redirectTo`, so old links land on a working page.
 *   "dev"   only in the "In development" menu, which only users with dev
 *           access see (lib/features.ts); the page renders its placeholder.
 *   "live"  a normal header item.
 *
 * Switching one back on is a one-line change here.
 */
export type ProductAreaStatus = "off" | "dev" | "live";

export interface ProductArea extends NavLink {
  status: ProductAreaStatus;
  /** Where the page sends visitors while it is "off". */
  redirectTo: string;
}

/** The working place for "practice": the Preflop Trainer, or Hands when its flag is off. */
const PRACTICE_FALLBACK = PREFLOP_RANGES_ENABLED ? PREFLOP_TRAINER_PATH : HAND_HISTORY_ENABLED ? HANDS_PATH : "/";
/** Analysis and replay of your own hands live in Hand Review (/hands). */
const HANDS_FALLBACK = HAND_HISTORY_ENABLED ? HANDS_PATH : "/";

export const PRODUCT_AREAS = {
  practice: { label: "Practice", href: "/practice", status: "off", redirectTo: PRACTICE_FALLBACK },
  analyze: { label: "Analyze", href: "/analyze", status: "off", redirectTo: HANDS_FALLBACK },
  replay: { label: "Replay", href: "/replay", status: "off", redirectTo: HANDS_FALLBACK },
} as const satisfies Record<string, ProductArea>;

export type ProductAreaKey = keyof typeof PRODUCT_AREAS;

const areasWith = (status: ProductAreaStatus): NavLink[] =>
  Object.values(PRODUCT_AREAS as Record<string, ProductArea>)
    .filter((a) => a.status === status)
    .map(({ label, href }) => ({ label, href }));

/**
 * Features in development (lib/features.ts) and product areas with status
 * "dev", for the "In development" menu — which only users with dev access see.
 */
export function devNav(): NavLink[] {
  return [
    ...(isFeaturePublic("learn") ? [] : [{ label: "Learn", href: "/learn" }]),
    ...(isFeaturePublic("puzzles") ? [] : [{ label: "Puzzles", href: ROUTES.puzzles }]),
    ...areasWith("dev"),
  ];
}

/** Planned free-tool pages (status "planned" in lib/seo/content/tools.ts) send visitors here. */
export const PLANNED_TOOL_REDIRECT: Record<string, string> = {
  "range-viewer": "/preflop-charts",
};

/** Header navigation (components/layout/Navbar.tsx) — desktop and mobile menu. */
export const PRIMARY_NAV: NavLink[] = primaryNav({
  preflopTrainer: PREFLOP_RANGES_ENABLED,
  flopTrainer: FLOP_TRAINER_ENABLED,
  handHistory: HAND_HISTORY_ENABLED,
});

export interface NavGroup {
  group: string;
  items: NavLink[];
}

/** App/content footer (components/layout/Footer.tsx). */
export const FOOTER_NAV: NavGroup[] = [
  {
    group: "Learn",
    items: [
      { label: "Poker training", href: "/poker-training" },
      { label: "Free poker training", href: "/free-poker-training" },
      { label: "Texas Hold'em strategy", href: "/texas-holdem-strategy" },
      { label: "Poker courses", href: ROUTES.courses },
      ...(isFeaturePublic("learn") ? [{ label: "Learning hub", href: "/learn" }] : []),
      { label: "Pricing", href: ROUTES.pricing },
    ],
  },
  {
    group: "Reference",
    items: [
      { label: "Poker wiki", href: ROUTES.wiki },
      { label: "Preflop charts", href: "/preflop-charts" },
      { label: "Glossary", href: ROUTES.glossary },
      { label: "Topics", href: ROUTES.search },
      { label: "Blog", href: ROUTES.blog },
    ],
  },
  {
    group: "Free tools",
    items: [
      { label: "Pot odds calculator", href: "/tools/pot-odds-calculator" },
      { label: "Outs calculator", href: "/tools/outs-calculator" },
      { label: "EV calculator", href: "/tools/ev-calculator" },
      { label: "All tools", href: ROUTES.tools },
    ],
  },
];

/** Marketing footer (components/landing/LandingFooter.tsx). */
export const LANDING_FOOTER_NAV: NavGroup[] = [
  {
    group: "Product",
    items: [
      ...(isFeaturePublic("learn") ? [{ label: "Learn", href: "/learn" }] : []),
      { label: "Poker training", href: "/poker-training" },
      { label: "Poker courses", href: ROUTES.courses },
      { label: "Bankroll", href: "/bankroll" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "Pricing", href: ROUTES.pricing },
    ],
  },
  {
    group: "Resources",
    items: [
      { label: "Poker wiki", href: ROUTES.wiki },
      { label: "Glossary", href: ROUTES.glossary },
      { label: "Free tools", href: ROUTES.tools },
      { label: "Topics", href: ROUTES.search },
      { label: "Blog", href: ROUTES.blog },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
  {
    group: "Legal",
    items: [
      { label: "Privacy Policy", href: ROUTES.privacy },
      { label: "Terms of Service", href: ROUTES.terms },
      { label: "Educational use", href: "/terms#disclaimer" },
    ],
  },
];

/**
 * Every internal path linked from the chrome that wraps a content page.
 *
 * Fragments and external URLs are dropped — a `#disclaimer` link is not an
 * incoming link to a new page.
 */
export function globalLinkTargets(): string[] {
  const hrefs = [
    "/",
    ...PRIMARY_NAV.map((l) => l.href),
    ...FOOTER_NAV.flatMap((g) => g.items.map((l) => l.href)),
    ...LANDING_FOOTER_NAV.flatMap((g) => g.items.map((l) => l.href)),
  ];
  return [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.includes("#")))];
}

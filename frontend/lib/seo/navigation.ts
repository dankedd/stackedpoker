import { PREFLOP_RANGES_ENABLED, PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { HAND_HISTORY_ENABLED, HANDS_PATH } from "@/lib/handHistory/feature";
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
  handHistory = false,
}: {
  preflopTrainer: boolean;
  handHistory?: boolean;
}): NavLink[] {
  return [
    { label: "Learn", href: "/learn", primary: true },
    // Playable training built on the same sourced theory as Learn. In the primary
    // nav rather than the "in development" cluster because it ships working.
    { label: "Puzzles", href: ROUTES.puzzles },
    // Behind NEXT_PUBLIC_FEATURE_PREFLOP_RANGES (lib/ranges/feature.ts).
    ...(preflopTrainer ? [{ label: "Preflop Trainer", href: PREFLOP_TRAINER_PATH }] : []),
    // Behind NEXT_PUBLIC_FEATURE_HAND_HISTORY (lib/handHistory/feature.ts).
    ...(handHistory ? [{ label: "Handen", href: HANDS_PATH }] : []),
    { label: "Bankroll", href: "/bankroll" },
    { label: "Leaderboard", href: "/leaderboard" },
  ];
}

/** Header navigation (components/layout/Navbar.tsx) — desktop and mobile menu. */
export const PRIMARY_NAV: NavLink[] = primaryNav({
  preflopTrainer: PREFLOP_RANGES_ENABLED,
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
      { label: "Learning hub", href: "/learn" },
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
      { label: "Learn", href: "/learn" },
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

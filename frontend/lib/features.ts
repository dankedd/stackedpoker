/**
 * Feature availability — the ONE place to switch Learn and Puzzles on.
 *
 *   "dev"     only users with development access (profiles.subscription_tier
 *             = 'admin') can see or open it; everyone else is redirected
 *             to the homepage by middleware.ts, and the backend refuses its
 *             API calls (backend/app/services/features.py).
 *   "public"  normal behaviour.
 *
 * To make a feature public: change its value here AND in
 * backend/app/services/features.py (lib/__tests__/features.test.ts fails
 * when the two disagree), then deploy both.
 */

import { normalizeTier, type Tier } from "@/lib/entitlements";
import { isPublicSeoPath } from "@/lib/seo/routes";
import { PREFLOP_RANGES_ENABLED, PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";

export type FeatureMode = "dev" | "public";

export const FEATURES = {
  learn: "dev",
  puzzles: "dev",
  // Friends, profiles, sharing, chat, groups, forum. Goes public once the
  // supabase/migrations/*social* files have run in production.
  social: "dev",
} as const satisfies Record<string, FeatureMode>;

export type Feature = keyof typeof FEATURES;

/** Route prefixes each feature owns. */
export const FEATURE_ROUTES: Record<Feature, string[]> = {
  // /progress only redirects to /learn. The public SEO lesson pages
  // (/learn/<lesson>) stay open — see gatedFeatureForPath.
  learn: ["/learn", "/progress"],
  puzzles: ["/puzzles"],
  social: ["/admin/moderation", "/u", "/h", "/embed", "/friends", "/messages", "/groups", "/forum", "/notifications", "/invite"],
};

export function isFeaturePublic(feature: Feature): boolean {
  return (FEATURES[feature] as FeatureMode) === "public";
}

/** Development access = the admin tier. */
export function hasDevAccess(tier: Tier | string | null | undefined): boolean {
  return normalizeTier(tier) === "admin";
}

export function canUseFeature(feature: Feature, tier: Tier | string | null | undefined): boolean {
  return isFeaturePublic(feature) || hasDevAccess(tier);
}

/**
 * The non-public feature a path belongs to, or null. Public SEO lesson pages
 * (`/learn/<lesson>`) are never gated — they stay indexable by decision.
 */
export function gatedFeatureForPath(pathname: string): Feature | null {
  for (const f of Object.keys(FEATURE_ROUTES) as Feature[]) {
    if (isFeaturePublic(f)) continue;
    const owns = FEATURE_ROUTES[f].some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!owns) continue;
    if (f === "learn" && isPublicSeoPath(pathname)) return null;
    return f;
  }
  return null;
}

/**
 * The social layer ships in phases. A phase's UI appears wherever `social`
 * is on (admins now, everyone once `social` is public) as soon as its entry
 * here is true — flip it in the commit that ships the phase. The dashboard's
 * "Share & ask" buttons, "Friends & activity" and "Community" blocks read only
 * this, so they switch themselves on.
 */
export const SOCIAL_PHASES = {
  /** 1: share a hand, guess mode, your shared hands. */
  sharing: true,
  /** 2: public profiles. */
  profiles: false,
  /** 3: friends, friend requests, direct messages, invites. */
  friends: false,
  /** 4: groups. */
  groups: false,
  /** 5: forum, hand of the week. */
  forum: false,
  /** 6: growth: challenges. */
  growth: false,
} as const satisfies Record<string, boolean>;

export type SocialPhase = keyof typeof SOCIAL_PHASES;

/**
 * Dev only: `NEXT_PUBLIC_SOCIAL_PHASES_PREVIEW=all` shows every phase's
 * dashboard UI against fixture data (scripts/dashboard-screens.mjs). Ignored
 * in production builds.
 */
const PREVIEW_ALL_PHASES =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SOCIAL_PHASES_PREVIEW === "all";

export function socialPhaseOn(phase: SocialPhase, tier: Tier | string | null | undefined): boolean {
  return (PREVIEW_ALL_PHASES || SOCIAL_PHASES[phase]) && canUseFeature("social", tier);
}

/**
 * Where "Start learning"-style buttons point while Learn is not public:
 * the Preflop Trainer (works signed out) — or the hand history when the
 * trainer's own flag is off, so the button never leads to a 404.
 */
export const LEARN_CTA = isFeaturePublic("learn")
  ? { href: "/learn", label: "Start learning" }
  : PREFLOP_RANGES_ENABLED
    ? { href: PREFLOP_TRAINER_PATH, label: "Train preflop ranges" }
    : { href: "/hands", label: "Review your hands" };
export const SECONDARY_CTA = { href: "/hands", label: "Review your hands" };

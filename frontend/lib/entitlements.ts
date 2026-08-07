/**
 * The single source of truth for what a subscription tier can access.
 *
 * Every place in the app that used to inline `tier === "pro" || tier === "admin"`
 * (dashboard, settings, pricing, useUsage, the Learn module/lesson locking, the
 * AI Coach quota) should call these instead — see the membership-system plan.
 *
 * DB/Stripe values stay `free` / `pro` / `premium` / `admin` (see
 * supabase_schema.sql). "Plus"/"Elite" are display labels only.
 */

export type Tier = "free" | "pro" | "premium" | "admin";

export interface Subscription {
  tier: Tier;
  label: "Free" | "Plus" | "Elite";
}

const PLAN_LABEL: Record<Tier, Subscription["label"]> = {
  free: "Free",
  pro: "Plus",
  premium: "Elite",
  admin: "Elite",
};

function normalizeTier(tier: Tier | string | null | undefined): Tier {
  return tier === "pro" || tier === "premium" || tier === "admin" ? tier : "free";
}

export function getSubscription(tier: Tier | string | null | undefined): Subscription {
  const t = normalizeTier(tier);
  return { tier: t, label: PLAN_LABEL[t] };
}

/** Plus, Elite, and admin all have full paid access — the one predicate every paid-gate check shares. */
export function isPaidTier(tier: Tier | string | null | undefined): boolean {
  const t = normalizeTier(tier);
  return t === "pro" || t === "premium" || t === "admin";
}

export function canUseUnlimitedAI(tier: Tier | string | null | undefined): boolean {
  return isPaidTier(tier);
}

/** Whole-page premium features: Bankroll Tracker, Community, etc. */
export function canAccessPremium(tier: Tier | string | null | undefined): boolean {
  return isPaidTier(tier);
}

export function aiCoachDailyLimit(tier: Tier | string | null | undefined): number {
  return isPaidTier(tier) ? Infinity : 3;
}

// ── Learn module/lesson access ────────────────────────────────────────────────
// Free tier gets the first two modules (by sort_order) in full, plus the first
// lesson (lowest sort_order) of every other module. Purely positional — a new
// module or lesson added to curriculum.ts is correctly gated with zero changes
// here.

export interface ModuleOrderLike {
  sort_order: number;
}

export interface LessonOrderLike {
  sort_order: number;
}

const FREE_FULL_MODULE_COUNT = 2;

export function canAccessModule(
  tier: Tier | string | null | undefined,
  targetModule: ModuleOrderLike,
  allModulesSorted: ModuleOrderLike[],
): boolean {
  if (isPaidTier(tier)) return true;
  const ranked = [...allModulesSorted].sort((a, b) => a.sort_order - b.sort_order);
  const rank = ranked.findIndex((m) => m.sort_order === targetModule.sort_order);
  return rank >= 0 && rank < FREE_FULL_MODULE_COUNT;
}

export function canAccessLesson(
  tier: Tier | string | null | undefined,
  parentModule: ModuleOrderLike,
  targetLesson: LessonOrderLike,
  allModulesSorted: ModuleOrderLike[],
  moduleLessonsSorted: LessonOrderLike[],
): boolean {
  if (isPaidTier(tier)) return true;
  if (canAccessModule(tier, parentModule, allModulesSorted)) return true;
  if (moduleLessonsSorted.length === 0) return false;
  const firstLessonSortOrder = Math.min(...moduleLessonsSorted.map((l) => l.sort_order));
  return targetLesson.sort_order === firstLessonSortOrder;
}

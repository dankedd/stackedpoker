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

/** Whole-page premium (Plus+) features: Community, etc. */
export function canAccessPremium(tier: Tier | string | null | undefined): boolean {
  return isPaidTier(tier);
}

/** Elite-exclusive features (not even Plus): the Solver Explorer / Solver
 *  Tree Explorer per the pricing page. Kept as its own predicate — not
 *  `isPaidTier` — specifically so Elite can keep gaining exclusive features
 *  over Plus without every other paid-gate check accidentally granting them. */
export function canAccessElite(tier: Tier | string | null | undefined): boolean {
  const t = normalizeTier(tier);
  return t === "premium" || t === "admin";
}

export function aiCoachDailyLimit(tier: Tier | string | null | undefined): number {
  return isPaidTier(tier) ? Infinity : 3;
}

// ── Learn module/lesson access ────────────────────────────────────────────────
// Free tier gets the first two modules in full, plus the first lesson of
// every other module. Purely positional — a new module or lesson added to
// curriculum.ts is correctly gated with zero changes here.
//
// Module ranking uses `order` (LearningModule's global 1-28 Poker Journey
// position), NOT `sort_order` — `sort_order` is only meaningful within the
// 12 currently-built modules; every roadmap-only module in curriculum.ts's
// LEARNING_MODULES array shares `sort_order: 0`, which would make them tie
// for "module 1" if used for cross-module ranking. `order` is the field
// that's actually unique and contiguous across all modules, built or not.
// Lesson ranking still uses `sort_order`, which IS reliably unique within a
// single module's own lesson list.

export interface ModuleOrderLike {
  /** LearningModule.order — defaults to "last" (never free) if unset. */
  order?: number;
}

export interface LessonOrderLike {
  sort_order: number;
}

const FREE_FULL_MODULE_COUNT = 2;

function moduleRankKey(m: ModuleOrderLike): number {
  return m.order ?? Number.POSITIVE_INFINITY;
}

export function canAccessModule(
  tier: Tier | string | null | undefined,
  targetModule: ModuleOrderLike,
  allModulesSorted: ModuleOrderLike[],
): boolean {
  if (isPaidTier(tier)) return true;
  const ranked = [...allModulesSorted].sort((a, b) => moduleRankKey(a) - moduleRankKey(b));
  const rank = ranked.findIndex((m) => moduleRankKey(m) === moduleRankKey(targetModule));
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

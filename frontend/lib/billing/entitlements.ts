/**
 * Free / Pro entitlements as the browser sees them.
 *
 * The numbers come from the database (my_entitlements(), see
 * supabase_subscriptions.sql) — the browser only displays them. Every limit
 * is enforced server-side: the trainer endpoint, the AI Coach endpoints and
 * a trigger on hh_tournaments refuse work past the limit no matter what
 * this file says.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "trial" | "pro";

export type UpgradeSource =
  | "hand_limit"
  | "upload_limit"
  | "ai_limit"
  | "trial_ending"
  | "trial_ended"
  | "pricing_page"
  | "flop_explorer"
  | "tournament_summary"
  | "promo_3m_50";

export const UPGRADE_SOURCES: readonly UpgradeSource[] = [
  "hand_limit",
  "upload_limit",
  "ai_limit",
  "trial_ending",
  "trial_ended",
  "pricing_page",
  "flop_explorer",
  "tournament_summary",
  "promo_3m_50",
];

export const PRO_PRICE_EUR = 7.99;
export const PRO_PRICE_LABEL = "€7.99";

/** The Free plan as advertised. Signed-in limits always come from the database. */
export const FREE_LIMITS = {
  trainerHandsPerDay: 50,
  tournamentsPerWeek: 1,
  aiQuestionsPerDay: 3,
} as const;

export interface Entitlements {
  plan: Plan;
  trialEndsAt: string | null;
  trialEnded: boolean;
  trialEndedSeen: boolean;
  subscription: {
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasCustomer: boolean;
  };
  /** null = unlimited */
  limits: {
    trainerHandsPerDay: number | null;
    tournamentsPerWeek: number | null;
    aiQuestionsPerDay: number | null;
  };
  usage: {
    trainerHandsToday: number;
    aiQuestionsToday: number;
    tournamentsThisWeek: number;
  };
  dailyResetAt: string | null;
  nextUploadAt: string | null;
  hiddenTournaments: number;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Shapes the raw jsonb from my_entitlements(); null when there is nothing usable. */
export function parseEntitlements(raw: unknown): Entitlements | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const plan: Plan = r.plan === "pro" || r.plan === "trial" ? r.plan : "free";
  const sub = (r.subscription ?? {}) as Record<string, unknown>;
  const limits = (r.limits ?? {}) as Record<string, unknown>;
  const usage = (r.usage ?? {}) as Record<string, unknown>;
  return {
    plan,
    trialEndsAt: strOrNull(r.trial_ends_at),
    trialEnded: r.trial_ended === true,
    trialEndedSeen: r.trial_ended_seen === true,
    subscription: {
      status: strOrNull(sub.status),
      currentPeriodEnd: strOrNull(sub.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      hasCustomer: sub.has_customer === true,
    },
    limits: {
      trainerHandsPerDay: numOrNull(limits.trainer_hands_per_day),
      tournamentsPerWeek: numOrNull(limits.tournaments_per_week),
      aiQuestionsPerDay: numOrNull(limits.ai_questions_per_day),
    },
    usage: {
      trainerHandsToday: num(usage.trainer_hands_today),
      aiQuestionsToday: num(usage.ai_questions_today),
      tournamentsThisWeek: num(usage.tournaments_this_week),
    },
    dailyResetAt: strOrNull(r.daily_reset_at),
    nextUploadAt: strOrNull(r.next_upload_at),
    hiddenTournaments: num(r.hidden_tournaments),
  };
}

export async function fetchEntitlements(supabase: SupabaseClient): Promise<Entitlements | null> {
  const { data, error } = await supabase.rpc("my_entitlements");
  if (error) throw error;
  return parseEntitlements(data);
}

/** Pro and trial unlock the same things. */
export function hasProAccess(e: Pick<Entitlements, "plan"> | null | undefined): boolean {
  return e?.plan === "pro" || e?.plan === "trial";
}

export function uploadLimitReached(e: Entitlements | null): boolean {
  return !!e && e.limits.tournamentsPerWeek !== null && e.usage.tournamentsThisWeek >= e.limits.tournamentsPerWeek;
}

export function handLimitReached(e: Entitlements | null): boolean {
  return !!e && e.limits.trainerHandsPerDay !== null && e.usage.trainerHandsToday >= e.limits.trainerHandsPerDay;
}

// ── Trial ───────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** "Your Pro trial ends in X days" shows in the last 3 days (72 hours) of the trial. */
export function trialEndingSoon(e: Entitlements | null, now = Date.now()): boolean {
  if (!e || e.plan !== "trial" || !e.trialEndsAt) return false;
  const left = new Date(e.trialEndsAt).getTime() - now;
  return left > 0 && left <= 72 * HOUR;
}

/** Calendar days (viewer's time zone) until the trial ends: 0 = today, 1 = tomorrow. */
export function trialDaysLeft(trialEndsAt: string, now = Date.now()): number {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  };
  return Math.max(0, day(new Date(trialEndsAt).getTime()) - day(now));
}

/** How long after the trial the "Your Pro trial has ended" banner keeps showing. */
export const TRIAL_ENDED_BANNER_DAYS = 14;

/** On Free after a trial that ended within the last TRIAL_ENDED_BANNER_DAYS. */
export function trialEndedRecently(e: Entitlements | null, now = Date.now()): boolean {
  if (!e || e.plan !== "free" || !e.trialEnded || !e.trialEndsAt) return false;
  const since = now - new Date(e.trialEndsAt).getTime();
  return since >= 0 && since <= TRIAL_ENDED_BANNER_DAYS * DAY;
}

// ── Time formatting ─────────────────────────────────────────────────────────

/** "4h 12m", "12m 05s", "0s". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** "Tue 20 Oct, 14:32" in the viewer's own time zone. */
export function formatDateTime(iso: string, locale?: string): string {
  const d = new Date(iso);
  return d.toLocaleString(locale ?? "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

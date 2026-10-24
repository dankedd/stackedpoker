import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEntitlements, type Entitlements } from "@/lib/billing/entitlements";
import { parseXpProfile, type XpProfile } from "@/lib/levels/api";
import { DASHBOARD_CONFIG } from "./config";
import { parseDashboard, parseStreakRow, type DashboardData } from "./types";

/**
 * Everything /dashboard shows, fetched in parallel in one go: the dashboard
 * read (hands, leaks, skill, social), entitlements (today's spots, plan),
 * the XP profile (level card) and the day streak. Each block awaits only the
 * parts it needs, so it streams in behind its own skeleton.
 *
 * A failing or missing RPC (a migration not run yet) resolves to null, never
 * throws: the block shows its empty state instead of breaking the page.
 */
export interface DashboardLoad {
  data: Promise<DashboardData | null>;
  entitlements: Promise<Entitlements | null>;
  xp: Promise<XpProfile | null>;
  streak: Promise<{ streak: number; activeToday: boolean } | null>;
}

function rpc<T>(supabase: SupabaseClient, fn: string, parse: (raw: unknown) => T | null, args?: Record<string, unknown>): Promise<T | null> {
  return Promise.resolve(supabase.rpc(fn, args))
    .then(({ data, error }) => (error ? null : parse(data)))
    .catch(() => null);
}

export function loadDashboard(supabase: SupabaseClient): DashboardLoad {
  return {
    data: rpc(supabase, "my_dashboard", parseDashboard, { p_skill_days: DASHBOARD_CONFIG.skillDays }),
    entitlements: rpc(supabase, "my_entitlements", parseEntitlements),
    xp: rpc(supabase, "my_xp_profile", parseXpProfile),
    streak: rpc(supabase, "my_streak", parseStreakRow),
  };
}

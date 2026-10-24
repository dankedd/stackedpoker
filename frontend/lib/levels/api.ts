import type { SupabaseClient } from "@supabase/supabase-js";

/** my_xp_profile() / xp_profile() in supabase_xp_rebalance.sql. */
export interface XpProfile {
  totalXp: number;
  preflopXp: number;
  flopXp: number;
  bonusXp: number;
  handReviewXp: number;
  streakDays: number;
  dailyXp: number;
  dailyCap: number;
  levelsNotice: boolean;
}

export function parseXpProfile(raw: unknown): XpProfile | null {
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!r || typeof r.total_xp !== "number") return null;
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : 0);
  return {
    totalXp: n("total_xp"),
    preflopXp: n("preflop_xp"),
    flopXp: n("flop_xp"),
    bonusXp: n("bonus_xp"),
    handReviewXp: n("hand_review_xp"),
    streakDays: n("streak_days"),
    dailyXp: n("daily_xp"),
    dailyCap: n("daily_cap"),
    levelsNotice: r.levels_notice === true,
  };
}

/** null before the migration has run (the function is missing) or when signed out. */
export async function fetchMyXpProfile(sb: SupabaseClient): Promise<XpProfile | null> {
  const { data, error } = await sb.rpc("my_xp_profile");
  return error ? null : parseXpProfile(data);
}

export async function dismissLevelsNotice(sb: SupabaseClient): Promise<void> {
  await sb.rpc("dismiss_levels_notice");
}

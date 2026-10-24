/**
 * Skill card: reads the cached stats from get_profile()
 * (compute_skill_stats() in supabase/migrations/20261025_04_profiles_stats.sql)
 * and decides what may be shown. The database stores raw counts; the
 * minimum sample and the trend rule live here.
 */

/** [n, correct] */
export type Pair = [number, number];

export interface Windows {
  all: Pair;
  d30: Pair;
  p30: Pair;
  d90: Pair;
  p90: Pair;
}

export interface SkillStats {
  v: number;
  computed_at: string;
  preflop: Partial<Record<"overall" | "opens" | "defense" | "pushfold" | "other", Windows>>;
  flop_review: { all?: { n: number; good: number; ok: number; questionable: number }; windows?: Partial<Record<"overall", Windows>> };
  flop_trainer: Partial<Record<"overall", Windows>>;
  weakest_texture: { category: string; n: number; ok: number } | null;
  trainer: { spots: number; accuracy?: Pair; current_streak: number; best_streak: number };
  day_streak: number;
}

/** Below this many decisions a percentage is not shown ("12/30"). */
export const MIN_SAMPLE = 30;
/** Each half of a trend comparison needs at least this many decisions. */
export const MIN_TREND_SAMPLE = 15;

export type SkillKey = "opens" | "defense" | "pushfold" | "flop_play" | "flop_reading";

export const SKILL_LABEL: Record<SkillKey, string> = {
  opens: "Opens",
  defense: "Defense",
  pushfold: "Push/fold",
  flop_play: "Flop play",
  flop_reading: "Flop reading",
};

export function windowsFor(stats: SkillStats, key: SkillKey): Windows | undefined {
  if (key === "flop_play") return stats.flop_review?.windows?.overall;
  if (key === "flop_reading") return stats.flop_trainer?.overall;
  return stats.preflop?.[key];
}

/** Rounded percentage, or null below the minimum sample. */
export function pct(p: Pair | undefined, min = MIN_SAMPLE): number | null {
  if (!p || p[0] < min || p[0] === 0) return null;
  return Math.round((p[1] / p[0]) * 100);
}

export type Period = 30 | 90;

/** Change in accuracy (points) between this period and the one before, or null. */
export function trend(w: Windows | undefined, period: Period): number | null {
  if (!w) return null;
  const [now, before] = period === 30 ? [w.d30, w.p30] : [w.d90, w.p90];
  const a = pct(now, MIN_TREND_SAMPLE);
  const b = pct(before, MIN_TREND_SAMPLE);
  return a == null || b == null ? null : a - b;
}

export interface SkillRow {
  key: SkillKey;
  label: string;
  n: number;
  pct: number | null;
  trend: number | null;
}

export function skillRows(stats: SkillStats, period: Period = 30): SkillRow[] {
  return (Object.keys(SKILL_LABEL) as SkillKey[]).map((key) => {
    const w = windowsFor(stats, key);
    return { key, label: SKILL_LABEL[key], n: w?.all[0] ?? 0, pct: pct(w?.all), trend: trend(w, period) };
  });
}

/** The biggest moves for the headline chips ("Defense +12% this month"), largest first. */
export function headlineTrends(rows: SkillRow[], max = 2): SkillRow[] {
  return rows
    .filter((r) => r.trend != null && r.trend !== 0)
    .sort((a, b) => Math.abs(b.trend!) - Math.abs(a.trend!))
    .slice(0, max);
}

export function flopVerdictShares(stats: SkillStats): { n: number; good: number | null; ok: number | null; questionable: number | null } {
  const f = stats.flop_review?.all;
  const n = f?.n ?? 0;
  const share = (k: number) => (n >= MIN_SAMPLE ? Math.round((k / n) * 100) : null);
  return { n, good: share(f?.good ?? 0), ok: share(f?.ok ?? 0), questionable: share(f?.questionable ?? 0) };
}

/** Public URL of an avatar in the 'avatars' bucket. */
export function avatarUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
}

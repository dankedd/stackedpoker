/**
 * XP → level, tier titles and tier colors.
 *
 * The curve is defined once, in shared/levels.json. shared/generate_levels.py
 * derives the cumulative threshold table and copies the file here (Vercel
 * builds frontend/ only), to the backend (xp_calculator.py) and into SQL
 * (xp_levels). This module only reads the table, so the badge on every
 * screen, the leaderboard and the database agree on every level.
 *
 *   xp to next level = round_half_up(base × level ^ exponent)
 */
import config from "./levels.json";

/** THRESHOLDS[i] = total XP needed to reach level i + 1. */
export const THRESHOLDS: readonly number[] = config.thresholds;
export const MAX_LEVEL: number = config.curve.max_level;

export type TierColor = "slate" | "sky" | "emerald" | "blue" | "violet" | "fuchsia" | "amber" | "legend";

export interface Tier {
  min: number;
  max: number;
  title: string;
  color: TierColor;
}

export const TIERS: readonly Tier[] = config.tiers as Tier[];

/** Daily XP rules (cap and bonuses), for copy in the UI. */
export const XP_RULES = config.xp;

export interface LevelProgress {
  level: number;
  totalXp: number;
  /** XP earned within the current level. */
  currentLevelXp: number;
  /** XP from this level to the next (0 at the max level). */
  xpRequiredForNextLevel: number;
  xpRemaining: number;
  /** 0-100. */
  progressPercent: number;
  currentLevelThreshold: number;
  /** null at the max level. */
  nextLevelThreshold: number | null;
  tier: Tier;
  isMaxLevel: boolean;
}

export function tierForLevel(level: number): Tier {
  const lvl = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return TIERS.find((t) => t.min <= lvl && lvl <= t.max) ?? TIERS[0];
}

export function levelForXP(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (level < MAX_LEVEL && THRESHOLDS[level] <= xp) level += 1;
  return level;
}

/** XP needed to advance from `level` to `level + 1` (0 at the max level). */
export function xpRequiredForLevel(level: number): number {
  const lvl = Math.max(1, level);
  if (lvl >= MAX_LEVEL) return 0;
  return THRESHOLDS[lvl] - THRESHOLDS[lvl - 1];
}

/** Derives level + all display fields from totalXp, the only stored value. */
export function getLevelProgress(totalXpInput: number): LevelProgress {
  const totalXp = Math.max(0, totalXpInput);
  const level = levelForXP(totalXp);
  const isMaxLevel = level >= MAX_LEVEL;
  const threshold = THRESHOLDS[level - 1];
  const required = xpRequiredForLevel(level);
  const current = totalXp - threshold;
  return {
    level,
    totalXp,
    currentLevelXp: current,
    xpRequiredForNextLevel: required,
    xpRemaining: isMaxLevel ? 0 : threshold + required - totalXp,
    progressPercent: isMaxLevel ? 100 : Math.min(100, Math.round((current / required) * 100)),
    currentLevelThreshold: threshold,
    nextLevelThreshold: isMaxLevel ? null : threshold + required,
    tier: tierForLevel(level),
    isMaxLevel,
  };
}

/**
 * Tailwind classes per tier, house style (dark cards, /10 fills, /30 borders).
 * Literal strings so Tailwind keeps them.
 */
export const TIER_STYLES: Record<TierColor, { badge: string; text: string; bar: string; glow: string }> = {
  slate: { badge: "border-slate-400/30 bg-slate-400/10 text-slate-300", text: "text-slate-300", bar: "from-slate-400 to-slate-300", glow: "bg-slate-400/20" },
  sky: { badge: "border-sky-400/30 bg-sky-500/10 text-sky-300", text: "text-sky-300", bar: "from-sky-500 to-cyan-300", glow: "bg-sky-500/20" },
  emerald: { badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300", text: "text-emerald-300", bar: "from-emerald-500 to-teal-300", glow: "bg-emerald-500/20" },
  blue: { badge: "border-blue-400/30 bg-blue-500/10 text-blue-300", text: "text-blue-300", bar: "from-blue-500 to-indigo-300", glow: "bg-blue-500/20" },
  violet: { badge: "border-violet-400/35 bg-violet-500/12 text-violet-300", text: "text-violet-300", bar: "from-violet-500 to-blue-400", glow: "bg-violet-500/25" },
  fuchsia: { badge: "border-fuchsia-400/35 bg-fuchsia-500/12 text-fuchsia-300", text: "text-fuchsia-300", bar: "from-fuchsia-500 to-violet-400", glow: "bg-fuchsia-500/25" },
  amber: { badge: "border-amber-400/40 bg-amber-500/12 text-amber-300", text: "text-amber-300", bar: "from-amber-500 to-yellow-300", glow: "bg-amber-500/25" },
  legend: {
    badge: "border-amber-300/50 bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-violet-500/20 text-amber-200",
    text: "text-amber-200",
    bar: "from-amber-400 via-rose-400 to-violet-400",
    glow: "bg-amber-400/30",
  },
};

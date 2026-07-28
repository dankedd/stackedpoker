/**
 * Single source of truth for the Learn XP → Level curve.
 *
 * Levels are NOT a hardcoded threshold table — they're derived from one
 * deterministic formula, mirrored exactly in
 * `backend/app/engines/learn/xp_calculator.py` (no shared package between
 * the Python backend and this TS frontend, so "shared" means "identical
 * formula, verified by tests in both languages," not literally one file).
 *
 *   xpRequiredForLevel(level) = round(LEVEL_BASE_XP * LEVEL_GROWTH_RATE ** (level - 1))
 *
 * This is the XP needed to advance FROM `level` TO `level + 1` — level 1
 * needs 500 XP to reach level 2, level 2 needs 550 to reach level 3, etc.
 * (+10% per level). Cumulative thresholds are the running sum of these
 * per-level costs, never authored/guessed directly.
 *
 * Every Learn surface (Navbar, Learn page, lesson completion, evaluator)
 * must derive level/progress through this module — never reimplement or
 * duplicate the curve locally.
 */

export const LEVEL_BASE_XP = 500
export const LEVEL_GROWTH_RATE = 1.10

export interface LevelProgress {
  level: number
  totalXp: number
  /** XP earned within the current level (i.e. progress since currentLevelThreshold). */
  currentLevelXp: number
  /** Total XP required to go from `level` to `level + 1`. */
  xpRequiredForNextLevel: number
  /** XP still needed to reach the next level. */
  xpRemaining: number
  /** 0-100, currentLevelXp / xpRequiredForNextLevel. */
  progressPercent: number
  /** Cumulative XP threshold at which `level` was reached. */
  currentLevelThreshold: number
  /** Cumulative XP threshold for the next level. */
  nextLevelThreshold: number
}

/** XP needed to advance from `level` to `level + 1`. */
export function xpRequiredForLevel(level: number): number {
  const lvl = Math.max(1, level)
  return Math.round(LEVEL_BASE_XP * Math.pow(LEVEL_GROWTH_RATE, lvl - 1))
}

/** Single source of truth: derives level + all display fields from totalXp.
 *  Never stores/increments level independently — always recomputed from the
 *  persisted total_xp ledger. */
export function getLevelProgress(totalXpInput: number): LevelProgress {
  const totalXp = Math.max(0, totalXpInput)
  let level = 1
  let threshold = 0
  // O(level) — fine since level grows very slowly against XP under a
  // 10%-compounding curve.
  while (true) {
    const required = xpRequiredForLevel(level)
    if (threshold + required > totalXp) break
    threshold += required
    level += 1
  }

  const requiredForNext = xpRequiredForLevel(level)
  const nextThreshold = threshold + requiredForNext
  const currentLevelXp = totalXp - threshold
  const xpRemaining = nextThreshold - totalXp
  const progressPercent = requiredForNext
    ? Math.min(100, Math.round((currentLevelXp / requiredForNext) * 100))
    : 0

  return {
    level,
    totalXp,
    currentLevelXp,
    xpRequiredForNextLevel: requiredForNext,
    xpRemaining,
    progressPercent,
    currentLevelThreshold: threshold,
    nextLevelThreshold: nextThreshold,
  }
}

export function levelForXP(totalXp: number): number {
  return getLevelProgress(totalXp).level
}

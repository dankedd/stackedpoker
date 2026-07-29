/**
 * Server-confirmed level-up detection — the single place that decides
 * whether newly persisted XP crossed a level boundary.
 *
 * ARCHITECTURE RULE: this only ever compares CONFIRMED totals (the
 * `new_total_xp` a server response actually returned) against the
 * previously-confirmed level already sitting in LearnProgressContext's
 * state — never optimistic/local XP math. It derives level purely through
 * `levelForXP` (lib/learn/levelCurve.ts), the same canonical curve used
 * everywhere else (Navbar, Learn page, leaderboard) — there is no second
 * level system here.
 *
 * Works identically regardless of which award produced the new total (step,
 * lesson, module, achievement, or any future source) because the caller
 * always feeds it "the level/total_xp right before this specific
 * server-confirmed update" vs "what the server just confirmed" — see
 * `mergeLevelUpDetection`'s call sites in LearnProgressContext.tsx.
 */
import { levelForXP } from './levelCurve'

export interface LevelUpEvent {
  previousLevel: number
  newLevel: number
  /** Confirmed total_xp after this transition — feeds getLevelProgress()
   *  for the "progress toward next level" bar, never recomputed locally. */
  totalXp: number
  /** Cumulative XP gained across this detected transition — may span more
   *  than one award if several arrived before the transition was dismissed
   *  (see mergeLevelUpDetection). Used only for the "+123 XP" display. */
  xpAwarded: number
}

/** Pure comparison: previous confirmed level/total vs a newly confirmed
 *  total. Returns null when there's no level increase (same level, or a
 *  replay/failed request where totals didn't move) — never fabricates a
 *  transition from a same-or-lower total. */
export function detectLevelUp(
  previousLevel: number,
  previousTotalXp: number,
  newTotalXp: number,
): LevelUpEvent | null {
  if (newTotalXp <= previousTotalXp) return null
  const newLevel = levelForXP(newTotalXp)
  if (newLevel <= previousLevel) return null
  return {
    previousLevel,
    newLevel,
    totalXp: newTotalXp,
    xpAwarded: newTotalXp - previousTotalXp,
  }
}

/**
 * Merges a freshly detected transition into whatever level-up is already
 * pending (not yet dismissed) — so if a second legitimate award resolves
 * before the user dismisses the first celebration, they see ONE combined
 * event (oldest previousLevel, latest newLevel/totalXp, summed xpAwarded)
 * instead of two overlapping modals. A single award that itself crosses
 * multiple levels is already just one event, by construction of
 * `detectLevelUp` — this only matters for back-to-back award responses.
 */
export function mergeLevelUpDetection(
  pending: LevelUpEvent | null,
  previousLevel: number,
  previousTotalXp: number,
  newTotalXp: number,
): LevelUpEvent | null {
  const detected = detectLevelUp(previousLevel, previousTotalXp, newTotalXp)
  if (!detected) return pending
  if (!pending) return detected
  return {
    previousLevel: pending.previousLevel,
    newLevel: detected.newLevel,
    totalXp: detected.totalXp,
    xpAwarded: pending.xpAwarded + detected.xpAwarded,
  }
}

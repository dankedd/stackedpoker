/**
 * Tests for server-confirmed level-up detection (lib/learn/levelUpDetection.ts) —
 * the single shared layer LearnProgressContext uses for step/lesson/module
 * award responses alike. Uses the real canonical levelForXP curve (500 XP
 * for level 1->2, +10% per level — see levelCurve.ts), never a fabricated one.
 */
import { describe, it, expect } from 'vitest'
import { detectLevelUp, mergeLevelUpDetection } from '../levelUpDetection'
import { getLevelProgress } from '../levelCurve'

// Real thresholds from the canonical curve, used to build unambiguous fixtures.
function thresholdFor(level: number): number {
  // Smallest total_xp at which levelForXP returns exactly `level`.
  let xp = 0
  while (getLevelProgress(xp).level < level) {
    xp = getLevelProgress(xp).nextLevelThreshold
  }
  return xp
}

describe('detectLevelUp', () => {
  it('Level 4 -> Level 4 (XP increased but stayed within the same level): no event', () => {
    const lvl4 = thresholdFor(4)
    const stillLvl4 = lvl4 + 10 // small increase, not enough to cross into level 5
    expect(getLevelProgress(stillLvl4).level).toBe(4)
    const event = detectLevelUp(4, lvl4, stillLvl4)
    expect(event).toBeNull()
  })

  it('Level 4 -> Level 5: one event with correct fields', () => {
    const lvl4 = thresholdFor(4)
    const lvl5 = thresholdFor(5)
    const event = detectLevelUp(4, lvl4, lvl5)
    expect(event).not.toBeNull()
    expect(event?.previousLevel).toBe(4)
    expect(event?.newLevel).toBe(5)
    expect(event?.totalXp).toBe(lvl5)
    expect(event?.xpAwarded).toBe(lvl5 - lvl4)
  })

  it('Level 4 -> Level 6 in one large legitimate award: one event showing the full jump', () => {
    const lvl4 = thresholdFor(4)
    const lvl6 = thresholdFor(6)
    const event = detectLevelUp(4, lvl4, lvl6)
    expect(event).not.toBeNull()
    expect(event?.previousLevel).toBe(4)
    expect(event?.newLevel).toBe(6) // not 5 — the full jump, not an intermediate step
  })

  it('total_xp unchanged (replay / failed request never moved the total): no event', () => {
    const lvl4 = thresholdFor(4)
    expect(detectLevelUp(4, lvl4, lvl4)).toBeNull()
  })

  it('total_xp somehow lower than before: no event (defensive, never fabricates a negative transition)', () => {
    const lvl5 = thresholdFor(5)
    expect(detectLevelUp(5, lvl5, lvl5 - 100)).toBeNull()
  })

  it('XP increased but did not cross the NEXT level boundary from a non-zero previous level: no event', () => {
    const lvl7 = thresholdFor(7)
    const lvl8 = thresholdFor(8)
    const almostLvl8 = lvl8 - 1
    expect(getLevelProgress(almostLvl8).level).toBe(7)
    expect(detectLevelUp(7, lvl7, almostLvl8)).toBeNull()
  })
})

describe('mergeLevelUpDetection', () => {
  it('no pending event, no new transition: stays null', () => {
    const lvl4 = thresholdFor(4)
    expect(mergeLevelUpDetection(null, 4, lvl4, lvl4 + 5)).toBeNull()
  })

  it('no pending event, a fresh transition arrives: becomes that transition', () => {
    const lvl4 = thresholdFor(4)
    const lvl5 = thresholdFor(5)
    const merged = mergeLevelUpDetection(null, 4, lvl4, lvl5)
    expect(merged).toEqual({ previousLevel: 4, newLevel: 5, totalXp: lvl5, xpAwarded: lvl5 - lvl4 })
  })

  it('a level-up is already pending and a second legitimate award arrives before dismissal: combines into ONE event', () => {
    // Simulates: step award crosses into level 5 (pending set), then — before
    // the user dismisses it — a lesson-completion bonus resolves and crosses
    // into level 6. LearnProgressContext always calls this with prev.skill.level
    // already bumped to 5 by the first update, so previousLevel passed in for
    // the SECOND call is 5 — but the merged event must still remember it was
    // originally 4.
    const lvl4 = thresholdFor(4)
    const lvl5 = thresholdFor(5)
    const lvl6 = thresholdFor(6)

    const afterStep = mergeLevelUpDetection(null, 4, lvl4, lvl5)
    expect(afterStep).toEqual({ previousLevel: 4, newLevel: 5, totalXp: lvl5, xpAwarded: lvl5 - lvl4 })

    const afterLesson = mergeLevelUpDetection(afterStep, 5, lvl5, lvl6)
    expect(afterLesson).toEqual({
      previousLevel: 4, // preserved from the FIRST event, not reset to 5
      newLevel: 6,
      totalXp: lvl6,
      xpAwarded: lvl6 - lvl4, // cumulative across both awards
    })
  })

  it('a pending event exists but a subsequent call yields no new transition (e.g. a replay): pending is preserved unchanged', () => {
    const lvl4 = thresholdFor(4)
    const lvl5 = thresholdFor(5)
    const pending = mergeLevelUpDetection(null, 4, lvl4, lvl5)
    // A duplicate/replay response for the same total arrives afterward.
    const stillPending = mergeLevelUpDetection(pending, 5, lvl5, lvl5)
    expect(stillPending).toBe(pending)
  })
})

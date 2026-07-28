/**
 * Tests for the shared Learn XP -> Level curve (lib/learn/levelCurve.ts).
 *
 * Level 1 -> 2 costs 500 XP; each subsequent level costs 10% more than the
 * one before it (round(500 * 1.10 ** (level - 1))), never a hardcoded
 * threshold table. Cumulative thresholds are the running sum of these
 * per-level costs. Mirrors backend/tests/test_xp_calculator.py exactly —
 * same formula, same worked examples.
 */
import { describe, it, expect } from 'vitest'
import {
  xpRequiredForLevel,
  getLevelProgress,
  levelForXP,
} from '../levelCurve'
import { xpToNextLevel } from '../types'

describe('xpRequiredForLevel: per-level requirement formula', () => {
  it('level 1 requires 500 XP to advance', () => {
    expect(xpRequiredForLevel(1)).toBe(500)
  })

  it('grows by 10% per level', () => {
    expect(xpRequiredForLevel(2)).toBe(550)
    expect(xpRequiredForLevel(3)).toBe(605)
    expect(xpRequiredForLevel(4)).toBe(666)
    expect(xpRequiredForLevel(5)).toBe(732)
  })

  it('is strictly increasing level over level', () => {
    let prev = xpRequiredForLevel(1)
    for (let level = 2; level < 30; level++) {
      const current = xpRequiredForLevel(level)
      expect(current).toBeGreaterThan(prev)
      prev = current
    }
  })
})

describe('levelForXP: exact boundaries from the spec', () => {
  it('0 XP is level 1', () => {
    expect(levelForXP(0)).toBe(1)
  })

  it('499 XP is still level 1', () => {
    expect(levelForXP(499)).toBe(1)
  })

  it('500 XP is level 2', () => {
    expect(levelForXP(500)).toBe(2)
  })

  it('1049 XP is still level 2', () => {
    expect(levelForXP(1049)).toBe(2)
  })

  it('1050 XP is level 3', () => {
    expect(levelForXP(1050)).toBe(3)
  })

  it('negative XP floors to level 1', () => {
    expect(levelForXP(-500)).toBe(1)
  })
})

describe('cumulative thresholds for levels 1-15 (derived, not hardcoded)', () => {
  it('matches the running sum of per-level requirements, and levelForXP agrees at every boundary', () => {
    let expectedThreshold = 0
    const thresholds: Record<number, number> = { 1: 0 }
    for (let level = 1; level < 15; level++) {
      expectedThreshold += xpRequiredForLevel(level)
      thresholds[level + 1] = expectedThreshold
    }

    for (const [levelStr, threshold] of Object.entries(thresholds)) {
      const level = Number(levelStr)
      expect(levelForXP(threshold)).toBe(level)
      if (threshold > 0) {
        expect(levelForXP(threshold - 1)).toBe(level - 1)
      }
    }

    // Sanity-check the concrete numbers against the task's worked example.
    expect(thresholds[2]).toBe(500)
    expect(thresholds[3]).toBe(1050)
    expect(thresholds[4]).toBe(1655)
  })
})

describe('getLevelProgress: full derived object', () => {
  it('matches the spec\'s worked example (1,920 total XP -> Level 4, 265/666, 401 remaining)', () => {
    const p = getLevelProgress(1920)
    expect(p.level).toBe(4)
    expect(p.totalXp).toBe(1920)
    expect(p.currentLevelThreshold).toBe(1655)
    expect(p.xpRequiredForNextLevel).toBe(666)
    expect(p.currentLevelXp).toBe(265)
    expect(p.xpRemaining).toBe(401)
    expect(p.nextLevelThreshold).toBe(2321)
  })

  it('progressPercent resets to 0 exactly at a level boundary', () => {
    let threshold = 0
    for (let level = 1; level < 5; level++) threshold += xpRequiredForLevel(level)
    const p = getLevelProgress(threshold)
    expect(p.progressPercent).toBe(0)
    expect(p.currentLevelXp).toBe(0)
  })

  it('progressPercent approaches 100 just before the next level', () => {
    const p = getLevelProgress(xpRequiredForLevel(1) - 1)
    expect(p.level).toBe(1)
    expect(p.progressPercent).toBeGreaterThanOrEqual(99)
  })

  it('progressPercent never exceeds 100', () => {
    const p = getLevelProgress(10 ** 9)
    expect(p.progressPercent).toBeGreaterThanOrEqual(0)
    expect(p.progressPercent).toBeLessThanOrEqual(100)
  })
})

describe('xpToNextLevel back-compat wrapper (types.ts) delegates to the same engine', () => {
  it('returns {current, needed, pct} matching getLevelProgress fields', () => {
    const info = xpToNextLevel(1920)
    const p = getLevelProgress(1920)
    expect(info.current).toBe(p.currentLevelXp)
    expect(info.needed).toBe(p.xpRequiredForNextLevel)
    expect(info.pct).toBe(p.progressPercent)
  })
})

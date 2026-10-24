/**
 * lib/learn/levelCurve.ts is only a re-export of lib/levels (tested in
 * lib/levels/__tests__/levels.test.ts) — Learn and the trainers share one curve.
 */
import { describe, expect, it } from 'vitest'
import * as levels from '@/lib/levels'
import { getLevelProgress, levelForXP, xpRequiredForLevel } from '../levelCurve'
import { xpToNextLevel } from '../types'

describe('levelCurve re-export', () => {
  it('is the lib/levels implementation', () => {
    expect(getLevelProgress).toBe(levels.getLevelProgress)
    expect(levelForXP).toBe(levels.levelForXP)
    expect(xpRequiredForLevel).toBe(levels.xpRequiredForLevel)
  })

  it('xpToNextLevel (types.ts) delegates to the same engine', () => {
    const info = xpToNextLevel(300)
    const p = getLevelProgress(300)
    expect(info).toEqual({ current: p.currentLevelXp, needed: p.xpRequiredForNextLevel, pct: p.progressPercent })
  })
})

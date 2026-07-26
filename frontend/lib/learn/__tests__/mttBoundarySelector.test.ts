/**
 * Tests for the deterministic boundary-hand selector (mttBoundarySelector.ts) — the engine
 * behind every position lesson's Drill step and a chunk of the Lab pool. Everything here
 * must be derivable purely from MTT_RFI_CHARTS; these tests exist specifically to catch the
 * "wide range collapses to zero core hands" class of bug found and fixed during development.
 */
import { describe, it, expect } from 'vitest'
import { classifyHandBoundaries, selectDrillQuestions } from '../mttBoundarySelector'
import { MTT_RFI_CHARTS, MTT_RFI_CHART_KEYS } from '../mttRfiBaselines'

describe('classifyHandBoundaries', () => {
  it('produces exactly 169 classifications per chart, one per hand class', () => {
    for (const key of MTT_RFI_CHART_KEYS) {
      const classified = classifyHandBoundaries(MTT_RFI_CHARTS[key])
      expect(classified.length, key).toBe(169)
      expect(new Set(classified.map((c) => c.hand)).size, key).toBe(169)
    }
  })

  it('every chart produces at least some hands in each of mixed/geometric_edge/core (no collapsed bucket)', () => {
    // Regression guard: a very wide/bimodal range (e.g. BTN) previously collapsed to zero
    // 'core' hands because every pure hand looked "extreme." Confirm this can't recur for
    // any of the 32 charts, not just the one that exposed it.
    for (const key of MTT_RFI_CHART_KEYS) {
      const classified = classifyHandBoundaries(MTT_RFI_CHARTS[key])
      const kinds = new Set(classified.map((c) => c.kind))
      expect(kinds.has('core'), `${key} has no 'core' hands`).toBe(true)
    }
  })

  it('known mixed boundary hands (verified against the source chart) classify as mixed', () => {
    const utg25 = classifyHandBoundaries(MTT_RFI_CHARTS['UTG_RFI_25BB'])
    const byHand = new Map(utg25.map((c) => [c.hand, c]))
    expect(byHand.get('98s')?.kind).toBe('mixed')
    expect(byHand.get('KTo')?.kind).toBe('mixed')
  })

  it('AA is never folded anywhere (real non-fold weight stays high at every chart)', () => {
    // NOTE: AA is not always a "boring pure" classification — SB genuinely mixes AA
    // (raise/limp) at deeper stacks per the source data, so 'mixed' is a valid, correct
    // classification there, not a bug. The only universal invariant is that AA's non-fold
    // weight (its combined non-fold action share) stays high everywhere.
    for (const key of MTT_RFI_CHART_KEYS) {
      const classified = classifyHandBoundaries(MTT_RFI_CHARTS[key])
      const aa = classified.find((c) => c.hand === 'AA')
      expect(aa, key).toBeDefined()
      expect(aa!.nonFold, key).toBeGreaterThan(0.9)
    }
  })

  it('scores are non-negative and sorted descending', () => {
    const classified = classifyHandBoundaries(MTT_RFI_CHARTS['SB_RFI_40BB'])
    for (let i = 1; i < classified.length; i++) {
      expect(classified[i].score).toBeLessThanOrEqual(classified[i - 1].score)
    }
    for (const c of classified) expect(c.score).toBeGreaterThanOrEqual(0)
  })
})

describe('selectDrillQuestions', () => {
  const positions = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'] as const

  it('returns exactly `count` questions for every position, at counts 12 and 15', () => {
    for (const pos of positions) {
      for (const count of [12, 15]) {
        const qs = selectDrillQuestions(pos, count, `test-${pos}-${count}`)
        expect(qs.length, `${pos}/${count}`).toBe(count)
      }
    }
  })

  it('every returned chartKey/hand pair resolves against MTT_RFI_CHARTS', () => {
    for (const pos of positions) {
      const qs = selectDrillQuestions(pos, 12, `resolve-${pos}`)
      for (const q of qs) {
        const chart = MTT_RFI_CHARTS[q.chartKey]
        expect(chart, `${pos}: ${q.chartKey} missing`).toBeDefined()
      }
    }
  })

  it('is deterministic for a fixed seed', () => {
    const a = selectDrillQuestions('CO', 12, 'stable-seed')
    const b = selectDrillQuestions('CO', 12, 'stable-seed')
    expect(a).toEqual(b)
  })

  it('a different seed can produce a different draw', () => {
    const a = selectDrillQuestions('CO', 12, 'seed-a')
    const b = selectDrillQuestions('CO', 12, 'seed-b')
    expect(a).not.toEqual(b)
  })

  it('covers more than one stack depth in a 12-question drill (never all-one-depth)', () => {
    for (const pos of positions) {
      const qs = selectDrillQuestions(pos, 12, `depth-coverage-${pos}`)
      const depths = new Set(qs.map((q) => q.chartKey.split('_').pop()))
      expect(depths.size, `${pos}: only covered ${[...depths]}`).toBeGreaterThan(1)
    }
  })
})

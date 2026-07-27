import { describe, it, expect } from 'vitest'
import { equityBucket } from '../flopClassifier'
import {
  CO_OPEN_RANGE_40BB,
  CO_OPEN_RANGE_40BB_PCT,
  BB_CALL_RANGE_40BB_ILLUSTRATIVE,
  BB_CALL_RANGE_40BB_PCT,
  deriveIllustrativeWidenedRange,
  LESSON1_SCENARIO,
  A76R_SCENARIO,
  CS_654R_SCENARIO,
  BOARD_FAVOR_SPECTRUM,
  BOARD_FAVOR_SPECTRUM_TARGET,
} from '../rangeVsRangeContent'

describe('Equity Bucket boundaries (Modern Poker Theory thresholds)', () => {
  it('75 and above is Strong', () => {
    expect(equityBucket(75)).toBe('strong')
    expect(equityBucket(100)).toBe('strong')
    expect(equityBucket(90)).toBe('strong')
  })
  it('just below 75 is Good, and 50 is Good', () => {
    expect(equityBucket(74.9)).toBe('good')
    expect(equityBucket(50)).toBe('good')
  })
  it('just below 50 is Weak, and 33 is Weak', () => {
    expect(equityBucket(49.9)).toBe('weak')
    expect(equityBucket(33)).toBe('weak')
  })
  it('below 33 is Trash', () => {
    expect(equityBucket(32.9)).toBe('trash')
    expect(equityBucket(0)).toBe('trash')
  })
})

describe('CO_OPEN_RANGE_40BB — real, book-transcribed data', () => {
  it('is non-empty and includes premium hands', () => {
    expect(CO_OPEN_RANGE_40BB.length).toBeGreaterThan(50)
    expect(CO_OPEN_RANGE_40BB).toContain('AA')
    expect(CO_OPEN_RANGE_40BB).toContain('22') // a real mixed-frequency (0.15) raise hand in the transcribed chart
  })
  it('its live-computed combo weight is a real number in a sane RFI range, distinct from the book\'s cited 31.2%', () => {
    expect(CO_OPEN_RANGE_40BB_PCT).toBeGreaterThan(25)
    expect(CO_OPEN_RANGE_40BB_PCT).toBeLessThan(45)
  })
})

describe('BB_CALL_RANGE_40BB_ILLUSTRATIVE — derived + labeled widening', () => {
  it('lands close to the book\'s cited 56.8% (hand-class granularity, not exact)', () => {
    expect(BB_CALL_RANGE_40BB_PCT).toBeGreaterThan(54)
    expect(BB_CALL_RANGE_40BB_PCT).toBeLessThan(60)
  })
  it('is a strict superset of the real 100bb cash BB-vs-CO core (widening only adds hands)', () => {
    // AA/KK/QQ etc and premium suited aces are in the 100bb core — must survive widening.
    expect(BB_CALL_RANGE_40BB_ILLUSTRATIVE).toContain('AA')
    expect(BB_CALL_RANGE_40BB_ILLUSTRATIVE).toContain('AKs')
    expect(BB_CALL_RANGE_40BB_ILLUSTRATIVE).toContain('76s')
  })
  it('deriveIllustrativeWidenedRange is deterministic (same inputs -> same output)', () => {
    const a = deriveIllustrativeWidenedRange(['AA', 'KK'], 10)
    const b = deriveIllustrativeWidenedRange(['AA', 'KK'], 10)
    expect(a).toEqual(b)
  })
  it('deriveIllustrativeWidenedRange never drops a core hand', () => {
    const core = ['AA', 'KK', 'QQ', '72o']
    const widened = deriveIllustrativeWidenedRange(core, 5)
    for (const h of core) expect(widened).toContain(h)
  })
})

describe('Lesson 1 scenario — book-cited numbers copied correctly', () => {
  it('matches the exact figures from the module spec', () => {
    expect(LESSON1_SCENARIO.coOpenPctBook).toBe(31.2)
    expect(LESSON1_SCENARIO.bbCallPctBook).toBe(56.8)
    expect(LESSON1_SCENARIO.preflopEquity).toEqual({ co: 58.5, bb: 41.5 })
    expect(LESSON1_SCENARIO.postflopEquity).toEqual({ co: 49.67, bb: 50.33 })
    expect(LESSON1_SCENARIO.heroHandEquity).toBe(70.83)
    expect(LESSON1_SCENARIO.board).toEqual(['8h', '7s', '5s'])
  })
  it('the flop slightly favors BB (postflop swing vs preflop), matching the book\'s narrative', () => {
    const preflopEdge = LESSON1_SCENARIO.preflopEquity.co - LESSON1_SCENARIO.preflopEquity.bb
    const postflopEdge = LESSON1_SCENARIO.postflopEquity.co - LESSON1_SCENARIO.postflopEquity.bb
    expect(postflopEdge).toBeLessThan(preflopEdge)
    expect(postflopEdge).toBeLessThan(0) // BB is actually ahead on the flop
  })
})

describe('A76r / 654r scenarios — exact figures + strong-bucket-only numeric data', () => {
  it('A76r: IP 62/BB 38, strong bucket IP 31/BB 8', () => {
    expect(A76R_SCENARIO.equity).toEqual({ ip: 62, bb: 38 })
    expect(A76R_SCENARIO.strongBucket).toEqual({ ip: 31, bb: 8 })
  })
  it('654r: BB 51/IP 49, strong bucket BB 7/IP 4', () => {
    expect(CS_654R_SCENARIO.equity).toEqual({ bb: 51, ip: 49 })
    expect(CS_654R_SCENARIO.strongBucket).toEqual({ bb: 7, ip: 4 })
  })
  it('neither scenario claims a Good/Weak/Trash exact number beyond Strong', () => {
    expect((A76R_SCENARIO as Record<string, unknown>).goodBucket).toBeUndefined()
    expect((CS_654R_SCENARIO as Record<string, unknown>).goodBucket).toBeUndefined()
  })
})

describe('BOARD_FAVOR_SPECTRUM — ordering derived strictly from real cited equity', () => {
  it('orders A76r (most IP-favored) -> 875ss -> 654r (most BB-favored)', () => {
    expect(BOARD_FAVOR_SPECTRUM_TARGET).toEqual(['a76r', 'flop_875ss', '654r'])
  })
  it('every entry\'s netIpEdge is strictly descending', () => {
    for (let i = 1; i < BOARD_FAVOR_SPECTRUM.length; i++) {
      expect(BOARD_FAVOR_SPECTRUM[i - 1].netIpEdge).toBeGreaterThan(BOARD_FAVOR_SPECTRUM[i].netIpEdge)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { buildPlaybackSchedule, finalFrameIndex, DEFAULT_PLAYBACK_TIMING } from '../playbackSchedule'

describe('finalFrameIndex — where playback stops (Hero\'s turn)', () => {
  it('is frameCount - 1 for a normal timeline', () => {
    expect(finalFrameIndex(6)).toBe(5)
  })

  it('never goes negative for an empty timeline', () => {
    expect(finalFrameIndex(0)).toBe(0)
  })
})

describe('buildPlaybackSchedule — normal (motion allowed) playback', () => {
  it('steps through every frame in order, ending exactly at the final frame', () => {
    const schedule = buildPlaybackSchedule(4, DEFAULT_PLAYBACK_TIMING, false)
    expect(schedule.map((s) => s.frameIndex)).toEqual([0, 1, 2, 3])
    expect(schedule[schedule.length - 1].frameIndex).toBe(finalFrameIndex(4))
  })

  it('frame 0 is immediate (0ms), every later frame waits actionDelay ms', () => {
    const schedule = buildPlaybackSchedule(3, { ...DEFAULT_PLAYBACK_TIMING, actionDelay: 250 }, false)
    expect(schedule[0].delayMs).toBe(0)
    expect(schedule[1].delayMs).toBe(250)
    expect(schedule[2].delayMs).toBe(250)
  })

  it('a configured actionDelay is honored exactly — no hardcoded magic number', () => {
    const schedule = buildPlaybackSchedule(2, { ...DEFAULT_PLAYBACK_TIMING, actionDelay: 999 }, false)
    expect(schedule[1].delayMs).toBe(999)
  })

  it('never advances past the last frame (Hero\'s turn) even with many frames', () => {
    const schedule = buildPlaybackSchedule(20, DEFAULT_PLAYBACK_TIMING, false)
    expect(Math.max(...schedule.map((s) => s.frameIndex))).toBe(19)
    expect(schedule.length).toBe(20)
  })
})

describe('buildPlaybackSchedule — reduced motion: no intermediate steps', () => {
  it('jumps straight to the final frame with zero delay', () => {
    const schedule = buildPlaybackSchedule(6, DEFAULT_PLAYBACK_TIMING, true)
    expect(schedule).toEqual([{ frameIndex: 5, delayMs: 0 }])
  })
})

describe('buildPlaybackSchedule — degenerate timelines', () => {
  it('a single frame (nothing to animate) schedules exactly one immediate frame', () => {
    expect(buildPlaybackSchedule(1, DEFAULT_PLAYBACK_TIMING, false)).toEqual([{ frameIndex: 0, delayMs: 0 }])
  })

  it('zero frames schedules a single frame at index 0 with no delay', () => {
    expect(buildPlaybackSchedule(0, DEFAULT_PLAYBACK_TIMING, false)).toEqual([{ frameIndex: 0, delayMs: 0 }])
  })
})

describe('buildPlaybackSchedule — determinism (backs "replay reset")', () => {
  it('calling twice with identical input yields deep-equal output', () => {
    const a = buildPlaybackSchedule(9, DEFAULT_PLAYBACK_TIMING, false)
    const b = buildPlaybackSchedule(9, DEFAULT_PLAYBACK_TIMING, false)
    expect(a).toEqual(b)
  })
})

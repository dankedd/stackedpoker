/**
 * Pure, framework-agnostic scheduling policy for the shared Action Playback
 * Engine (see hooks/usePlaybackEngine.ts). Deciding WHEN each precomputed
 * frame should appear is separated from the React hook that actually sets
 * timers, so the policy (order, reduced-motion behavior, where playback
 * stops) is fully unit-testable without a DOM or real timers — mirroring how
 * lib/replay/replayEngine.ts's pure state machine is tested independently of
 * hooks/useReplay.ts's thin timer wrapper.
 *
 * This module knows nothing about poker — it only knows "N precomputed
 * frames, step through them with this timing." Any future feature (Quiz, AI
 * Coach, Hand Review/Replay) that can express its scenario as an ordered
 * frame array reuses this SAME schedule, not a new one.
 */

export interface PlaybackTimingConfig {
  /** Fold dim/fade duration, ms. */
  fadeDuration: number
  /** Chip seat→pot travel duration, ms. */
  chipTravelDuration: number
  /** Gap between scripted events advancing the table, ms. */
  actionDelay: number
  /** Check/action highlight pulse duration, ms. */
  highlightDuration: number
}

export const DEFAULT_PLAYBACK_TIMING: PlaybackTimingConfig = {
  fadeDuration: 300,
  chipTravelDuration: 450,
  actionDelay: 250,
  highlightDuration: 300,
}

export interface ScheduledFrame {
  frameIndex: number
  /** Delay, in ms, from the PREVIOUS scheduled frame (always 0 for the first). */
  delayMs: number
}

/** The engine never advances past this index — this is what "playback stops
 *  on Hero's turn" means structurally: the caller never appends a frame after
 *  it, so the last frame IS Hero's turn (or the scenario's final state, when
 *  there's nothing to animate). */
export function finalFrameIndex(frameCount: number): number {
  return Math.max(0, frameCount - 1)
}

/**
 * Builds the ordered "show frame N after Xms" schedule:
 * - `frameCount <= 1`: nothing to animate, a single immediate frame.
 * - `reducedMotion`: jumps straight to the final frame, no intermediate
 *   steps — "prefers-reduced-motion: direct de eindstaat tonen, geen animaties."
 * - Otherwise: frame 0 immediately, then one frame every `actionDelay` ms,
 *   ending exactly on the final frame.
 */
export function buildPlaybackSchedule(
  frameCount: number,
  timing: PlaybackTimingConfig = DEFAULT_PLAYBACK_TIMING,
  reducedMotion = false,
): ScheduledFrame[] {
  const lastIndex = finalFrameIndex(frameCount)
  if (frameCount <= 1 || reducedMotion) {
    return [{ frameIndex: lastIndex, delayMs: 0 }]
  }

  const schedule: ScheduledFrame[] = [{ frameIndex: 0, delayMs: 0 }]
  for (let i = 1; i <= lastIndex; i++) {
    schedule.push({ frameIndex: i, delayMs: timing.actionDelay })
  }
  return schedule
}

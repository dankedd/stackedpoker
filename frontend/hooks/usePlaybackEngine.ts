'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'
import {
  buildPlaybackSchedule,
  finalFrameIndex,
  DEFAULT_PLAYBACK_TIMING,
  type PlaybackTimingConfig,
} from '@/lib/playback/playbackSchedule'

export type { PlaybackTimingConfig }
export { DEFAULT_PLAYBACK_TIMING }

// Avoids the "useLayoutEffect does nothing on the server" console warning
// during renderToStaticMarkup/SSR while still running synchronously (before
// paint) in the browser — the standard isomorphic-layout-effect pattern.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export interface PlaybackEngineResult<TFrame, TEvent> {
  frameIndex: number
  frame: TFrame | undefined
  /** The event that produced the CURRENT frame (null for frame 0, or when
   *  there's no timeline to play). Drives fold-dim/highlight/chip-travel. */
  event: TEvent | null
  isComplete: boolean
  /** False until the client has taken over and begun stepping frames — false
   *  for the very first (SSR/pre-hydration) render, true from then on. Gates
   *  mount-triggered animations (e.g. chip travel-in) so they only ever fire
   *  during real client playback, never on the static/first-paint render. */
  hasStarted: boolean
  /** The resolved timing config (defaults merged with any override) — the
   *  single source every duration in the visual layer should read from,
   *  instead of a hardcoded number. */
  timing: PlaybackTimingConfig
  /** Jumps straight to the final frame (Hero's turn) and cancels any pending
   *  step — wired to the Skip button, click-on-table, Space, and Escape. */
  skip: () => void
  /** Restarts the SAME timeline from frame 0. */
  reset: () => void
}

/**
 * The one shared "Action Playback Engine." Generic over any precomputed
 * frame array — never poker-specific — so it's the single piece every
 * consumer (today: Learn's PreflopTable; later: Quiz, AI Coach, Hand
 * Review/Replay) reuses instead of managing its own timers. No component
 * using this hook should own a `setTimeout`/`setInterval` of its own; all
 * timing is centralized in `lib/playback/playbackSchedule.ts` and configured
 * here via `timing`.
 *
 * SSR/hydration note: the very FIRST render (before any effect has run)
 * always shows the FINAL frame — matching what a server-rendered or
 * pre-hydration client render must produce (no timers have fired yet), and
 * exactly what this codebase's `renderToStaticMarkup`-based component tests
 * assert. Once mounted, a layout effect synchronously (before the browser
 * paints) rewinds to frame 0 and plays forward, so the user only ever sees
 * the hand start from the beginning — never a flash of the end state.
 */
export function usePlaybackEngine<TFrame, TEvent>(
  frames: TFrame[] | undefined,
  events: TEvent[] | undefined,
  timing?: Partial<PlaybackTimingConfig>,
): PlaybackEngineResult<TFrame, TEvent> {
  const reducedMotion = useReducedMotion()
  const frameCount = frames?.length ?? 0
  const lastIndex = finalFrameIndex(frameCount)

  const fadeDuration = timing?.fadeDuration ?? DEFAULT_PLAYBACK_TIMING.fadeDuration
  const chipTravelDuration = timing?.chipTravelDuration ?? DEFAULT_PLAYBACK_TIMING.chipTravelDuration
  const actionDelay = timing?.actionDelay ?? DEFAULT_PLAYBACK_TIMING.actionDelay
  const highlightDuration = timing?.highlightDuration ?? DEFAULT_PLAYBACK_TIMING.highlightDuration
  const resolvedTiming = useMemo<PlaybackTimingConfig>(
    () => ({ fadeDuration, chipTravelDuration, actionDelay, highlightDuration }),
    [fadeDuration, chipTravelDuration, actionDelay, highlightDuration],
  )

  // SSR-safe initial value: the FINAL frame, matching the pre-effect render
  // this codebase's static-render tests already assert (see PreflopTable's
  // test suite) — never frame 0, which would only ever be visible after the
  // layout effect below has run on a real client mount.
  const [frameIndex, setFrameIndex] = useState(lastIndex)
  const [hasStarted, setHasStarted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearPending = useCallback(() => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  const play = useCallback(() => {
    clearPending()
    if (frameCount === 0) return
    const schedule = buildPlaybackSchedule(frameCount, resolvedTiming, reducedMotion)
    let i = 0
    const step = () => {
      setFrameIndex(schedule[i].frameIndex)
      if (i < schedule.length - 1) {
        const next = schedule[i + 1]
        timerRef.current = setTimeout(() => {
          i += 1
          step()
        }, next.delayMs)
      }
    }
    step()
  }, [frameCount, resolvedTiming, reducedMotion, clearPending])

  // Plays the timeline forward whenever a NEW timeline arrives (a different
  // scenario loaded) or the reduced-motion preference changes.
  useIsomorphicLayoutEffect(() => {
    setHasStarted(true)
    play()
    return clearPending
  }, [frames, play, clearPending])

  const skip = useCallback(() => {
    clearPending()
    setFrameIndex(lastIndex)
  }, [clearPending, lastIndex])

  const reset = useCallback(() => {
    play()
  }, [play])

  const isComplete = frameIndex >= lastIndex

  // Space/Escape skip playback — only listens while there's something left
  // to skip, so it never intercepts keystrokes elsewhere once a hand has
  // finished playing out.
  useEffect(() => {
    if (isComplete) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isComplete, skip])

  return {
    frameIndex,
    frame: frames?.[frameIndex],
    event: frameIndex > 0 ? events?.[frameIndex - 1] ?? null : null,
    isComplete,
    hasStarted,
    timing: resolvedTiming,
    skip,
    reset,
  }
}

'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Brings a trainer back into view each time a new spot is dealt.
 *
 * On a phone the answer screen sits in the page under the table, so "Next"
 * is far down. Dealing the next spot removes that screen, the page gets
 * shorter and the browser clamps the scroll position to the new bottom —
 * the footer. This runs after the new spot has committed (layout effect,
 * before paint) and scrolls the container's top edge back into view; the
 * container's `scroll-margin-top` sets the gap above it.
 *
 * Only scrolls when the top edge is off screen, so dealing from the top of
 * the page never moves it. Focus goes to the first enabled button inside
 * `focusSelector` (without a second scroll), so it never stays on a button
 * that no longer exists. The first deal is skipped.
 */
export function useScrollToSpot<T extends HTMLElement>(
  ref: RefObject<T | null>,
  spotKey: unknown,
  { enabled = true, focusSelector }: { enabled?: boolean; focusSelector?: string } = {},
) {
  const prev = useRef<unknown>(null)
  useLayoutEffect(() => {
    const before = prev.current
    prev.current = spotKey
    if (before == null || spotKey == null || before === spotKey) return
    const el = ref.current
    if (!enabled || !el) return
    const rect = el.getBoundingClientRect()
    if (rect.top < 0 || rect.top > window.innerHeight) {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
      // Top edge just under the margin — or, when the trainer is shorter than
      // the screen, its bottom edge on the screen's, so the footer stays out of view.
      const delta = Math.min(rect.top - margin, rect.bottom - window.innerHeight)
      window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: 'instant' })
    }
    const target = focusSelector ? el.querySelector<HTMLElement>(`${focusSelector} button:not(:disabled)`) : null
    ;(target ?? el).focus({ preventScroll: true })
  }, [spotKey, enabled, focusSelector, ref])
}

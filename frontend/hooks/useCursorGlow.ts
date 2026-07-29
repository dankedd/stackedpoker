'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Writes `--sp-cursor-x`/`--sp-cursor-y` (roughly -1..1, offset from center)
 * onto the ref'd element as the mouse moves over it — rAF-throttled, no
 * React state, so this never triggers a rerender. Desktop/fine-pointer only;
 * a no-op under touch or reduced motion (never attaches a listener). Consume
 * via CSS `var(--sp-cursor-x, 0)` on a descendant, e.g. a small `translate`.
 */
export function useCursorGlow<T extends HTMLElement>(ref: RefObject<T | null>) {
  const reducedMotion = useReducedMotion()
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    let latestX = 0
    let latestY = 0

    function apply() {
      frame.current = null
      el!.style.setProperty('--sp-cursor-x', latestX.toFixed(3))
      el!.style.setProperty('--sp-cursor-y', latestY.toFixed(3))
    }

    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect()
      latestX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      latestY = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      if (frame.current == null) frame.current = requestAnimationFrame(apply)
    }

    el.addEventListener('mousemove', handleMove)
    return () => {
      el.removeEventListener('mousemove', handleMove)
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [ref, reducedMotion])
}

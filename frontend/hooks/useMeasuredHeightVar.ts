'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Measures a ref'd element's real rendered height and writes it to a CSS
 * custom property on the document root (`:root`), so anything on the page —
 * not just descendants of the measured element — can space itself relative
 * to it via `var(--name, <fallback>)` instead of a hardcoded guess.
 *
 * ResizeObserver-driven: tracks the fixed header's own scroll-triggered
 * size change (Navbar.tsx shrinks on scroll), font loading, and viewport
 * resizes automatically — no manual recompute wiring needed at call sites.
 * Always provide a sensible CSS fallback (the `, <fallback>` in `var()`) for
 * the brief pre-hydration window before this has run once.
 */
export function useMeasuredHeightVar<T extends HTMLElement>(ref: RefObject<T | null>, varName: string) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const root = document.documentElement
    function apply() {
      root.style.setProperty(varName, `${el!.getBoundingClientRect().height}px`)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, varName])
}

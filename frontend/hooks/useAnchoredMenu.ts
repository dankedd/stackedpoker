'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Reserved z-index for every header/global-nav overlay menu (dropdowns, popovers)
 *  rendered via portal to `document.body`. Any such menu should use exactly this
 *  value so none of them can end up stacked under page content, or under each
 *  other, regardless of what stacking contexts the current page happens to create. */
export const MENU_Z_INDEX = 9999

export interface AnchoredMenuPosition {
  top: number
  left: number
  originX: string
}

interface UseAnchoredMenuOptions {
  /** Rendered menu width in px — used to align/clamp against the viewport. */
  width: number
  /** Horizontal alignment relative to the trigger. Default 'center'. */
  align?: 'left' | 'center' | 'right'
  /** Estimated menu height in px, used to flip above the trigger when there's no
   *  room below. Doesn't need to be exact — only affects the flip decision. */
  estimatedHeight?: number
  /** Gap between trigger and menu, in px. Default 8. */
  gap?: number
}

/**
 * Computes a viewport-relative (`position: fixed`) top/left for a menu that gets
 * portaled to `document.body` — see `MENU_Z_INDEX`. Portaling + fixed positioning
 * is what makes the menu immune to ancestor `overflow: hidden`, `transform`, or
 * stacking-context tricks a given page happens to use: it never renders inside
 * that page's DOM subtree at all. Handles trigger-relative alignment, viewport
 * clamping, and flipping above the trigger when there isn't room below.
 *
 * Callers own `open` state themselves and should call `computePos()` right before
 * flipping it to `true` (not in an effect after) so the menu never paints at the
 * stale/default position for a frame. Pair with `useRecomputeOnScrollResize` to
 * keep it correct while open and the page scrolls or resizes.
 */
export function useAnchoredMenuPosition({
  width,
  align = 'center',
  estimatedHeight = 280,
  gap = 8,
}: UseAnchoredMenuOptions) {
  const [pos, setPos] = useState<AnchoredMenuPosition>({ top: 0, left: 0, originX: '50%' })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const computePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth

    let left =
      align === 'left' ? r.left
      : align === 'right' ? r.right - width
      : r.left + r.width / 2 - width / 2
    if (left < 8) left = 8
    if (left + width > vw - 8) left = vw - width - 8

    // Bottom-collision: if not enough space below, flip above (fixed, so no
    // scroll offset needed either way).
    const top =
      r.bottom + gap > window.innerHeight - estimatedHeight
        ? r.top - estimatedHeight - gap
        : r.bottom + gap

    setPos({ top, left, originX: `${r.left + r.width / 2 - left}px` })
  }, [width, align, estimatedHeight, gap])

  return { pos, triggerRef, computePos }
}

/** Keeps an anchored menu's position correct while `active` (open) and the page
 *  scrolls or resizes underneath it. */
export function useRecomputeOnScrollResize(active: boolean, recompute: () => void) {
  useEffect(() => {
    if (!active) return
    window.addEventListener('scroll', recompute, { passive: true, capture: true })
    window.addEventListener('resize', recompute, { passive: true })
    return () => {
      window.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [active, recompute])
}

/** Closes an open menu on an outside click or Escape. Pass every ref that counts
 *  as "inside" (trigger button, portaled menu panel, ...). */
export function useDismissOnOutsideOrEscape(
  open: boolean,
  onDismiss: () => void,
  ...refs: RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (refs.some((ref) => ref.current?.contains(t))) return
      onDismiss()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
    // refs are stable ref objects across renders; only their .current mutates,
    // which doesn't need to be tracked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss])
}

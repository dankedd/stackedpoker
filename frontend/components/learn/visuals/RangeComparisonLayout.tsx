'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RangeComparisonLayoutProps {
  /** The two comparison panels (each already containing its own label, grid, and legend) —
   *  rendered in document order, so panel order here is exactly the on-screen order in both
   *  the stacked and side-by-side layouts. */
  children: ReactNode
  /** Overrides the default `gap-4` between panels. */
  gapClassName?: string
  className?: string
  /** Which breakpoint switches from stacked to side-by-side. Default `'sm'` (640px) —
   *  unchanged for every existing consumer. Full 13x13 range grids need real room per
   *  panel (a comfortably readable grid needs ~380-450px), so a two-full-grid comparison
   *  (Module 8's Range Collision Viewer) opts into `'lg'` (1024px) instead — below that,
   *  two shrunk-to-640px grids would either overflow or become illegible, so they stack. */
  sideBySideFrom?: 'sm' | 'lg'
}

/**
 * The one shared layout for every "two range grids compared" spot in the learning modules
 * (RangeCompare, RangeBoardCollision, RangeRevealComparison, MultiActionRangeReveal,
 * RangeCollisionViewer, TableDecision's stack-confusion panel). Stacks the two panels full-width
 * below the side-by-side breakpoint — each grid gets the whole row instead of being squeezed to
 * half-width and shrinking its cells/labels to illegibility — and sits side-by-side once there's
 * real room for both. Do not reimplement this per-lesson; add call sites here instead.
 *
 * NOT used by `ScenarioSideBySide`'s two PreflopTables — a poker table needs more per-panel
 * width than even this component's `sideBySideFrom="lg"` gives a range grid, so that component
 * always stacks unconditionally instead of opting into a side-by-side breakpoint here.
 */
export function RangeComparisonLayout({
  children,
  gapClassName = 'gap-4',
  className,
  sideBySideFrom = 'sm',
}: RangeComparisonLayoutProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 min-w-0',
        sideBySideFrom === 'lg' ? 'lg:grid-cols-2' : 'sm:grid-cols-2',
        gapClassName,
        className,
      )}
    >
      {children}
    </div>
  )
}

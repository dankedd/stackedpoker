'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RangeComparisonLayoutProps {
  /** The two comparison panels (each already containing its own label, grid, and legend) —
   *  rendered in document order, so panel order here is exactly the on-screen order in both
   *  the stacked (mobile) and side-by-side (sm:+) layouts. */
  children: ReactNode
  /** Overrides the default `gap-4` between panels. */
  gapClassName?: string
  className?: string
}

/**
 * The one shared layout for every "two range grids compared" spot in the learning modules
 * (RangeCompare, RangeBoardCollision, RangeRevealComparison, MultiActionRangeReveal,
 * RangeCollisionViewer, TableDecision's stack-confusion panel). Stacks the two panels full-width
 * below `sm` — each grid gets the whole row instead of being squeezed to half-width and
 * shrinking its cells/labels to illegibility — and sits side-by-side from `sm:` up where there's
 * room for both. Do not reimplement this per-lesson; add call sites here instead.
 */
export function RangeComparisonLayout({ children, gapClassName = 'gap-4', className }: RangeComparisonLayoutProps) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 min-w-0', gapClassName, className)}>{children}</div>
}

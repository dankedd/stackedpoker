'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { PokerRangeGrid } from './PokerRangeGrid'
import { RangeComparisonLayout } from './RangeComparisonLayout'
import { classifyRangeVsBoard, type HandBoardCategory } from '@/lib/learn/handBoardInteraction'

export interface RangeCollisionSide {
  label: string
  range: string[]
}

interface RangeCollisionViewerProps {
  a: RangeCollisionSide
  b: RangeCollisionSide
  board: string[]
  /** Which hand-vs-board categories to call out in each grid's legend — a teaching
   *  hint; the classifier itself always runs live over the real range + board. */
  emphasizeCategories?: HandBoardCategory[]
  className?: string
}

/**
 * The Range Collision Viewer — two full 13x13 ranges rendered against a board.
 * The board sits centered on top of the whole comparison (never squeezed between the
 * two grids as a third column — that wasted horizontal width and visually split the
 * comparison in two), with both range grids treated as one symmetric unit below it:
 * side-by-side from `sm:` up, full-width stacked (A then B) on mobile via the shared
 * RangeComparisonLayout. Per-cell "does this hand connect with the board" coloring is
 * always LIVE (handBoardInteraction.ts's deterministic classifier) — categorical, never
 * a fabricated equity number.
 */
export function RangeCollisionViewer({ a, b, board, emphasizeCategories, className }: RangeCollisionViewerProps) {
  const categoryMapA = useMemo(() => classifyRangeVsBoard(a.range, board), [a.range, board])
  const categoryMapB = useMemo(() => classifyRangeVsBoard(b.range, board), [b.range, board])

  const boardPanel = (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/30">Board</p>
      <div className="flex items-center gap-1.5">
        {board.map((c, i) => (
          <PlayingCardMini key={i} card={c} size="lg" />
        ))}
      </div>
    </div>
  )

  const gridA = (
    <div className="min-w-0 space-y-1.5">
      <p className="text-center text-xs font-bold text-violet-300">{a.label}</p>
      <PokerRangeGrid range={a.range} mode="category" categoryMap={categoryMapA} categoryLegend={emphasizeCategories} />
    </div>
  )

  const gridB = (
    <div className="min-w-0 space-y-1.5">
      <p className="text-center text-xs font-bold text-blue-300">{b.label}</p>
      <PokerRangeGrid range={b.range} mode="category" categoryMap={categoryMapB} categoryLegend={emphasizeCategories} />
    </div>
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Board — centered above the entire comparison, on every breakpoint */}
      <div className="flex justify-center">{boardPanel}</div>

      {/*
        One symmetric unit: side-by-side once there's real room for two complete 13x13
        grids (`lg:`, 1024px — see RangeComparisonLayout's doc comment), full-width stacked
        below that. No inner max-width cap here — the outer lesson container (widened for
        this exact step type, see app/learn/lesson/[slug]/page.tsx) is the only width
        constraint, so this can actually use the extra room instead of re-shrinking itself.
      */}
      <RangeComparisonLayout gapClassName="gap-5 lg:gap-4" sideBySideFrom="lg">
        {gridA}
        {gridB}
      </RangeComparisonLayout>
    </div>
  )
}

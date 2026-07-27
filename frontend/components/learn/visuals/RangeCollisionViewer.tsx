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
 * Desktop/tablet (`sm:` and up): three-column composition (range A | board | range B).
 * Mobile: board stays visible up top, then both full-width grids stack vertically via the
 * shared RangeComparisonLayout — each keeps its own label and legend, rather than shrinking
 * both matrices to illegibility side-by-side. Per-cell "does this hand connect with the board"
 * coloring is always LIVE (handBoardInteraction.ts's deterministic classifier) — categorical,
 * never a fabricated equity number.
 */
export function RangeCollisionViewer({ a, b, board, emphasizeCategories, className }: RangeCollisionViewerProps) {
  const categoryMapA = useMemo(() => classifyRangeVsBoard(a.range, board), [a.range, board])
  const categoryMapB = useMemo(() => classifyRangeVsBoard(b.range, board), [b.range, board])

  const boardPanel = (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center gap-1.5">
        {board.map((c, i) => (
          <PlayingCardMini key={i} card={c} size="md" />
        ))}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/30">Board</p>
    </div>
  )

  const gridA = (
    <div className="flex-1 min-w-0 space-y-1.5">
      <p className="text-center text-xs font-bold text-violet-300">{a.label}</p>
      <PokerRangeGrid range={a.range} mode="category" categoryMap={categoryMapA} categoryLegend={emphasizeCategories} />
    </div>
  )

  const gridB = (
    <div className="flex-1 min-w-0 space-y-1.5">
      <p className="text-center text-xs font-bold text-blue-300">{b.label}</p>
      <PokerRangeGrid range={b.range} mode="category" categoryMap={categoryMapB} categoryLegend={emphasizeCategories} />
    </div>
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Desktop / tablet: three-column composition */}
      <div className="hidden sm:flex items-start gap-4">
        {gridA}
        <div className="pt-6">{boardPanel}</div>
        {gridB}
      </div>

      {/* Mobile: board stays visible, both full-width grids stack vertically below it */}
      <div className="sm:hidden space-y-3">
        {boardPanel}
        <RangeComparisonLayout>
          {gridA}
          {gridB}
        </RangeComparisonLayout>
      </div>
    </div>
  )
}

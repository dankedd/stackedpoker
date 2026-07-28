'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { BUCKETS, type Bucket } from '@/components/learn/steps/RangeDistributionBar'
import { PokerRangeGrid } from './PokerRangeGrid'
import { classifyRangeVsBoard, categoriesInTier, type HandBoardCategory } from '@/lib/learn/handBoardInteraction'

export interface RangeXRayEntry {
  label: string
  /** Only set when the source gives an exact figure — never invented. */
  strong?: number
  good_note?: string
  weak_note?: string
  trash_note?: string
}

interface RangeXRayProps {
  entries: RangeXRayEntry[]
  grid?: { label: string; range: string[] }
  board?: string[]
  className?: string
}

/** Illustrative, non-numeric mapping from a VERIFIED equity bucket (this component's own
 *  `Bucket` type — Strong/Good/Weak/Trash, real equity-bucket data) to the qualitative
 *  hand-vs-board interaction categories (handBoardInteraction.ts's own, DELIBERATELY
 *  DIFFERENTLY-NAMED tier taxonomy — made/connected/marginal/unconnected, never "strong"/
 *  "weak") it roughly corresponds to — used ONLY to drive click-a-bucket-to-highlight on
 *  the mini grid. This is a bridge between two distinct measurement systems, never a claim
 *  that the equity bucket's exact composition equals this category set — the caption text
 *  below always says "illustrative." Derived from `categoriesInTier`, not hand-duplicated,
 *  so this can never drift from PokerRangeGrid's own tier coloring. */
const BUCKET_CATEGORY_HINT: Record<Bucket, HandBoardCategory[]> = {
  strong: categoriesInTier('made'),
  good: categoriesInTier('connected'),
  weak: categoriesInTier('marginal'),
  trash: categoriesInTier('unconnected'),
}

function noteFor(entry: RangeXRayEntry, bucket: Bucket): string | undefined {
  if (bucket === 'good') return entry.good_note
  if (bucket === 'weak') return entry.weak_note
  if (bucket === 'trash') return entry.trash_note
  return undefined
}

/**
 * Strong/Good/Weak/Trash equity-bucket bar(s). The STRONG segment is only ever
 * rendered when the source gives an exact number — its width is genuinely
 * proportional. Good/Weak/Trash, when the source gives only directional language
 * (never an invented %), render as three EQUAL, diagonally-hatched bands sharing
 * the remainder — deliberately non-proportional, so the visual never implies a
 * precision the source doesn't support. Tapping/clicking a bucket highlights the
 * hand-vs-board categories it roughly corresponds to on the optional mini grid
 * (see BUCKET_CATEGORY_HINT) — illustrative pattern recognition, not exact
 * per-hand equity-bucket membership.
 */
export function RangeXRay({ entries, grid, board, className }: RangeXRayProps) {
  const [activeBucket, setActiveBucket] = useState<Bucket | null>(null)

  const categoryMap = useMemo(() => {
    if (!grid || !board) return undefined
    return classifyRangeVsBoard(grid.range, board)
  }, [grid, board])

  const emphasized = activeBucket ? BUCKET_CATEGORY_HINT[activeBucket] : undefined

  return (
    <div className={cn('space-y-4', className)}>
      {entries.map((entry) => {
        const strong = entry.strong
        const hasStrong = strong != null
        const remainder = hasStrong ? Math.max(0, 100 - strong) : 100
        const bandWidth = remainder / 3

        return (
          <div key={entry.label} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">{entry.label}</p>
            <div className="h-7 w-full rounded-lg overflow-hidden flex border border-border/30">
              {hasStrong && (
                <button
                  type="button"
                  onClick={() => setActiveBucket((b) => (b === 'strong' ? null : 'strong'))}
                  title={`Strong: ${strong}%`}
                  style={{ width: `${strong}%` }}
                  className={cn(
                    'h-full flex items-center justify-center transition-all',
                    BUCKETS[0].color,
                    activeBucket === 'strong' && 'ring-2 ring-inset ring-white/70',
                  )}
                >
                  {strong >= 10 && <span className="text-[9px] font-bold text-white/90">{strong}%</span>}
                </button>
              )}
              {(['good', 'weak', 'trash'] as Bucket[]).map((bucketKey) => {
                const meta = BUCKETS.find((b) => b.key === bucketKey)!
                return (
                  <button
                    key={bucketKey}
                    type="button"
                    onClick={() => setActiveBucket((b) => (b === bucketKey ? null : bucketKey))}
                    title={`${meta.label}${noteFor(entry, bucketKey) ? `: ${noteFor(entry, bucketKey)}` : ' (exact % not stated by source)'}`}
                    style={{
                      width: `${bandWidth}%`,
                      backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.12) 3px, rgba(255,255,255,0.12) 6px)`,
                    }}
                    className={cn(
                      'h-full flex items-center justify-center transition-all',
                      meta.color,
                      activeBucket === bucketKey && 'ring-2 ring-inset ring-white/70',
                    )}
                  >
                    <span className="text-[8px] font-bold text-white/80 uppercase tracking-wide truncate px-0.5">
                      {meta.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {activeBucket && (
              <p className="text-[10px] text-muted-foreground/60 leading-snug">
                {noteFor(entry, activeBucket) ??
                  (activeBucket === 'strong'
                    ? `Strong: ${strong ?? '—'}% of ${entry.label}'s hands.`
                    : `${BUCKETS.find((b) => b.key === activeBucket)!.label}: exact % not stated by the source — direction only.`)}
              </p>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground/40 pt-1 border-t border-border/20">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex items-center gap-1">
            <div className={cn('h-2 w-2 rounded-[2px]', b.color)} />
            <span>{b.label}</span>
          </div>
        ))}
        <span className="text-muted-foreground/30">— tap a bucket to inspect</span>
      </div>
      <p className="text-center text-[9px] text-muted-foreground/30">
        Only the Strong segment's width is an exact, source-cited figure — Good/Weak/Trash bands (hatched) are
        equal-width placeholders for a direction the source states but doesn't quantify.
      </p>

      {grid && board && categoryMap && (
        <div className="pt-2">
          <PokerRangeGrid
            range={grid.range}
            mode="category"
            categoryMap={categoryMap}
            categoryLegend={emphasized}
          />
          <p className="text-center text-[9px] text-muted-foreground/30 mt-1">
            {activeBucket
              ? `Illustrative — highlighting hand-vs-board categories (not verified equity) typically associated with the ${BUCKETS.find((b) => b.key === activeBucket)!.label} bucket, not a combo-exact accounting of the % above.`
              : `${grid.label} vs this board — tap a bucket above to highlight where its hand types concentrate.`}
          </p>
        </div>
      )}
    </div>
  )
}

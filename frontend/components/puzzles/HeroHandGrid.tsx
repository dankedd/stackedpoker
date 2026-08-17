'use client'

import { HAND_GRID, RANKS } from '@/lib/learn/handGrid'
import { cn } from '@/lib/utils'

/**
 * A 13×13 grid that locates Hero's hand and claims nothing else.
 *
 * This is the honest version of "show the range as a matrix" for a spot where
 * the source prints only a whole-range percentage. Colouring 64% of the cells
 * would require deciding WHICH hands make up that 64% — a decision the book
 * never made and we would be inventing while making it look sourced. So exactly
 * one cell is marked: the hand Hero actually holds, which is a fact about the
 * deal rather than a claim about the range.
 *
 * The headline percentage sits above it, sourced, and the two are kept visually
 * separate so a reader cannot come away thinking the grid depicts the 64%.
 */

/** 'As','Kh' → the grid's notation for that hand class, e.g. 'AKs'. */
export function handClassOf(cards: string[]): string | undefined {
  if (cards.length !== 2) return undefined
  const [a, b] = cards
  const r1 = a[0]?.toUpperCase()
  const r2 = b[0]?.toUpperCase()
  if (!r1 || !r2 || !RANKS.includes(r1) || !RANKS.includes(r2)) return undefined
  if (r1 === r2) return `${r1}${r2}`
  const suited = a[1]?.toLowerCase() === b[1]?.toLowerCase()
  // Higher rank first, matching HAND_GRID's own ordering.
  const [hi, lo] = RANKS.indexOf(r1) < RANKS.indexOf(r2) ? [r1, r2] : [r2, r1]
  return `${hi}${lo}${suited ? 's' : 'o'}`
}

export function HeroHandGrid({
  heroHand,
  label,
  className,
}: {
  heroHand: string[]
  label: string
  className?: string
}) {
  const hero = handClassOf(heroHand)

  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>

      {/* The grid is 13 columns of fixed minimum size; on a narrow phone it
          scrolls inside its own box rather than shrinking cells past legibility
          or pushing the page sideways. */}
      <div className="mt-2 overflow-x-auto">
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: 'repeat(13, minmax(20px, 1fr))', minWidth: '286px' }}
          role="table"
          aria-label={`13 by 13 hand grid with ${hero ?? 'no hand'} highlighted`}
        >
          {HAND_GRID.flat().map((hand) => {
            const isHero = hand === hero
            return (
              <div
                key={hand}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-[3px] text-[8px] font-bold leading-none',
                  isHero
                    ? 'bg-violet-500 text-white ring-2 ring-violet-300'
                    : 'bg-white/[0.04] text-slate-600'
                )}
                title={isHero ? `${hand} — your hand` : hand}
              >
                {hand}
              </div>
            )
          })}
        </div>
      </div>

      {hero && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] bg-violet-500" aria-hidden />
          <span className="font-bold text-violet-300">{hero}</span> is the hand you hold. No frequency is
          claimed for it — the source prints a whole-range percentage, not per-hand data.
        </p>
      )}
    </div>
  )
}

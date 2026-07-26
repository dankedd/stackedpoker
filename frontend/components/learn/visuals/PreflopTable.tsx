'use client'

import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { POSITIONS_BY_SIZE, SEAT_COORDS, normalizePosition } from '@/lib/replay/positions'

export interface SeatLayoutEntry {
  position: string
  x: string
  y: string
  tx: string
  ty: string
}

/**
 * Rotates `POSITIONS_BY_SIZE[tableSize]` (clockwise-from-BTN order) so `heroPosition`'s index
 * lands on slot 0, then zips it index-for-index with `SEAT_COORDS[tableSize]` (which always
 * assumes slot 0 = hero, bottom-center). Exported for unit testing.
 */
export function computeHeroRotatedSeats(tableSize: number, heroPosition: string): SeatLayoutEntry[] {
  const positions = POSITIONS_BY_SIZE[tableSize] ?? POSITIONS_BY_SIZE[9]
  const coords = SEAT_COORDS[tableSize] ?? SEAT_COORDS[9]
  const N = positions.length
  const heroIdx = positions.indexOf(normalizePosition(heroPosition))
  const startIdx = heroIdx >= 0 ? heroIdx : 0

  return coords.map((coord, slot) => {
    const srcIdx = (startIdx + slot) % N
    return { position: positions[srcIdx], x: coord.x, y: coord.y, tx: coord.tx, ty: coord.ty }
  })
}

export interface PreflopTableProps {
  /** 2-9. Module 3 always passes 9 (matches MTT_RFI_CHARTS' 9-max sourceRef). */
  tableSize: number
  /** Any label lib/replay/positions.ts#normalizePosition understands (e.g. 'HJ', 'UTG+1'). */
  heroPosition: string
  /** Hero's 2 concrete cards, e.g. ['As','Kh']. Omit for 2 face-down placeholders. */
  heroHand?: string[]
  effectiveStackBb?: number
  /** Rendered once near table center — antes aren't seat-specific. */
  anteBb?: number
  className?: string
}

/** Visual 9-max poker table for the "action folds to Hero" framing: Hero's seat is
 *  highlighted with cards/stack visible; every other seat is a muted, cardless pod. */
export function PreflopTable({ tableSize, heroPosition, heroHand, effectiveStackBb, anteBb, className }: PreflopTableProps) {
  const seats = computeHeroRotatedSeats(tableSize, heroPosition)
  const cards = heroHand && heroHand.length === 2 ? heroHand : ['', '']

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative mx-auto aspect-[16/11] w-full max-w-md">
        {/* Felt */}
        <div
          className="absolute inset-[10%] rounded-[50%] border border-emerald-500/25"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(16,93,64,0.35) 0%, rgba(8,48,36,0.5) 70%, rgba(4,24,18,0.6) 100%)',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
          }}
        />

        {/* Ante pill, table center */}
        {anteBb != null && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300/80">
              Ante {anteBb % 1 === 0 ? anteBb : anteBb.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}bb
            </span>
          </div>
        )}

        {seats.map((seat, i) => {
          const isHero = i === 0
          return (
            <div
              key={`${seat.position}-${i}`}
              className="absolute z-10"
              style={{ left: seat.x, top: seat.y, transform: `translate(${seat.tx}, ${seat.ty})` }}
            >
              {isHero ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-0.5">
                    <PlayingCardMini card={cards[0]} size="sm" />
                    <PlayingCardMini card={cards[1]} size="sm" />
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-bold',
                      'ring-2 ring-violet-400/70 shadow-lg shadow-violet-500/30',
                      'border-violet-400/40 bg-violet-500/20 text-violet-200',
                    )}
                  >
                    {seat.position}
                  </span>
                  {effectiveStackBb != null && (
                    <span className="text-[9px] font-semibold tabular-nums text-sky-200/70">
                      {effectiveStackBb % 1 === 0 ? effectiveStackBb : effectiveStackBb.toFixed(1)}bb eff
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-40">
                  <div className="flex h-9 w-11 sm:h-10 sm:w-12 items-center justify-center rounded-md border border-border/20 bg-secondary/30">
                    <span className="text-[9px] font-bold text-muted-foreground/60">{seat.position}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

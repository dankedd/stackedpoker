'use client'

import { PlayingCard } from '@/components/poker/PlayingCard'
import { formatBb } from '@/components/poker/tableTokens'
import { cn } from '@/lib/utils'
import type { Street } from '@/lib/puzzles/interactive/types'

/**
 * The puzzle table.
 *
 * Deliberately a felt-free, two-seat layout rather than a miniature casino: this
 * is the only surface in the app where a learner has to read position, stack,
 * pot, board and street in a single glance before making a decision, and every
 * decorative element competes with that. Villain sits top, hero bottom, board
 * between them — the same top-to-bottom reading order on desktop and mobile, so
 * the mobile version is a re-layout rather than a shrink.
 */

interface SeatProps {
  seat: string
  role: string
  stackBb: number
  cards?: string[]
  isHero?: boolean
  isActing?: boolean
  action?: string
}

function Seat({ seat, role, stackBb, cards, isHero, isActing, action }: SeatProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-colors',
        isHero
          ? 'border-violet-500/40 bg-violet-500/[0.07]'
          : 'border-white/10 bg-white/[0.03]',
        isActing && 'ring-1 ring-violet-400/50'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[12px] font-bold tracking-wide',
              isHero ? 'bg-violet-500/20 text-violet-200' : 'bg-white/10 text-slate-200'
            )}
          >
            {seat}
          </span>
          <span className="truncate text-[13px] font-semibold text-white">{role}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-mono tabular-nums">{formatBb(stackBb)} bb</span>
          {action && (
            <>
              <span aria-hidden className="text-slate-600">
                •
              </span>
              <span className="truncate text-slate-300">{action}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1.5">
        {cards ? (
          cards.map((c) => <PlayingCard key={c} card={c} size="sm" />)
        ) : (
          <>
            <FaceDown />
            <FaceDown />
          </>
        )}
      </div>
    </div>
  )
}

function FaceDown() {
  return (
    <div
      className="h-[54px] w-[38px] shrink-0 rounded-[5px] border border-white/10"
      style={{
        background:
          'repeating-linear-gradient(135deg, rgba(139,92,246,0.16) 0 4px, rgba(255,255,255,0.03) 4px 8px)',
      }}
      aria-label="Face-down card"
    />
  )
}

export interface PuzzleTableProps {
  heroSeat: string
  villainSeat: string
  heroCards: string[]
  heroStackBb: number
  villainStackBb: number
  board: string[]
  potBb: number
  street: Street
  villainAction?: string
  className?: string
}

export function PuzzleTable({
  heroSeat,
  villainSeat,
  heroCards,
  heroStackBb,
  villainStackBb,
  board,
  potBb,
  street,
  villainAction,
  className,
}: PuzzleTableProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-3 sm:p-5',
        className
      )}
    >
      <Seat
        seat={villainSeat}
        role="Villain"
        stackBb={villainStackBb}
        action={villainAction}
      />

      {/* Board + pot. On preflop there is no board, so the pot stands alone rather
          than leaving an empty card-shaped hole. */}
      <div className="my-3 flex flex-col items-center gap-3 py-2 sm:my-4">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3.5 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Pot</span>
          <span className="font-mono text-[15px] font-bold tabular-nums text-white">
            {formatBb(potBb)} bb
          </span>
        </div>

        {board.length > 0 ? (
          <div className="flex gap-1.5 sm:gap-2">
            {board.map((c, i) => (
              <PlayingCard key={c} card={c} size="md" animationDelay={i * 90} />
            ))}
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
            {street === 'preflop' ? 'No board yet' : ''}
          </span>
        )}
      </div>

      <Seat
        seat={heroSeat}
        role="You"
        stackBb={heroStackBb}
        cards={heroCards}
        isHero
        isActing
      />
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'
import { CardBack } from '@/components/poker/PlayingCard'

/**
 * Lightweight, self-contained "playable hand" table used by Lesson 1's opening
 * onboarding steps (win-the-pot / hole-vs-community / build-first-hand). Unlike
 * `PokerTable` (components/replay), this has no dependency on SeatDescriptor,
 * ReplayAction, or the replay engine — just a hero + opponents + a pot, built
 * to be reused anywhere a course step wants a quick "here's a table" beat.
 */

export interface OnboardingSeat {
  id: string
  label: string
  isHero: boolean
  stack: number
}

/** Shared felt panel styling — exported so sibling step components (which show
 *  cards without the full seat layout) can visually stay "at the same table". */
export const TABLE_FELT_CLASS = 'relative rounded-[28px] overflow-hidden'
export const TABLE_FELT_STYLE: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 35%, rgba(88,28,163,0.30) 0%, rgba(13,9,32,0.92) 72%)',
  border: '1px solid rgba(139,92,246,0.18)',
  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.45), 0 20px 50px rgba(0,0,0,0.35)',
}

function MiniSeat({ seat }: { seat: OnboardingSeat }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="flex gap-1">
        <CardBack size="xs" />
        <CardBack size="xs" />
      </div>
      <div
        className="flex flex-col items-center rounded-lg px-2.5 py-1 min-w-[58px]"
        style={{
          background: seat.isHero ? 'rgba(16,8,42,0.92)' : 'rgba(28,18,8,0.55)',
          border: seat.isHero ? '1px solid rgba(124,92,255,0.44)' : '1px solid rgba(251,191,36,0.22)',
        }}
      >
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wide leading-tight',
            seat.isHero ? 'text-violet-300' : 'text-amber-300/75',
          )}
        >
          {seat.label}
        </span>
        <span className="text-[11px] font-semibold text-white/70 tabular-nums leading-tight">{seat.stack}bb</span>
      </div>
    </div>
  )
}

function ChipStackIcon() {
  return (
    <div className="relative h-6 w-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-x-0 h-2 rounded-full"
          style={{
            bottom: `${i * 3}px`,
            background: 'linear-gradient(180deg, #FBBF24 0%, #B45309 100%)',
            border: '1px solid rgba(0,0,0,0.3)',
          }}
        />
      ))}
    </div>
  )
}

function PotBadge({
  chips,
  won,
  tappable,
  onClick,
}: {
  chips: number
  won: boolean
  tappable: boolean
  onClick?: () => void
}) {
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        disabled={!tappable}
        onClick={onClick}
        aria-label={tappable ? `Tap to win the ${chips}-chip pot` : `Pot: ${chips} chips`}
        className={cn(
          'relative flex flex-col items-center gap-1 rounded-2xl px-5 py-3 transition-all duration-300',
          tappable && 'cursor-pointer hover:scale-105 active:scale-95',
          won ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100',
        )}
        style={{
          background: 'linear-gradient(160deg, rgba(251,191,36,0.16), rgba(217,119,6,0.06))',
          border: '1px solid rgba(251,191,36,0.35)',
          boxShadow: tappable ? '0 0 24px rgba(251,191,36,0.22)' : undefined,
        }}
      >
        {tappable && !won && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl animate-border-pulse"
            style={{ border: '1px solid rgba(251,191,36,0.6)' }}
          />
        )}
        <ChipStackIcon />
        <span className="text-sm font-bold text-amber-200 tabular-nums">{chips} chips</span>
        {tappable && !won && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">Tap to win</span>
        )}
      </button>

      {/* Flying chips toward Hero */}
      {won && (
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 text-sm font-bold text-amber-300 animate-chip-fly pointer-events-none"
        >
          +{chips}
        </span>
      )}
    </div>
  )
}

interface OnboardingTableProps {
  seats: OnboardingSeat[]
  potChips: number
  /** True once the pot has been won — fades the pot badge and flies "+N" toward Hero. */
  potWon?: boolean
  potTappable?: boolean
  onPotClick?: () => void
  className?: string
}

export function OnboardingTable({
  seats,
  potChips,
  potWon = false,
  potTappable = false,
  onPotClick,
  className,
}: OnboardingTableProps) {
  const hero = seats.find((s) => s.isHero)
  const opponents = seats.filter((s) => !s.isHero)

  return (
    <div className={cn(TABLE_FELT_CLASS, 'p-5 sm:p-7', className)} style={TABLE_FELT_STYLE}>
      <div className="flex justify-center gap-8 sm:gap-14 mb-6">
        {opponents.map((seat) => (
          <MiniSeat key={seat.id} seat={seat} />
        ))}
      </div>

      <div className="flex justify-center mb-6">
        <PotBadge chips={potChips} won={potWon} tappable={potTappable} onClick={onPotClick} />
      </div>

      {hero && (
        <div className="flex justify-center">
          <MiniSeat seat={hero} />
        </div>
      )}
    </div>
  )
}

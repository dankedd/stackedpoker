'use client'

import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { POSITIONS_BY_SIZE, SEAT_COORDS, normalizePosition } from '@/lib/replay/positions'
import {
  buildPreflopTableRenderState,
  deriveCenterStatus,
  type ParsedSeatAction,
  type PreflopSeatState,
} from '@/lib/learn/preflopTableState'

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

function formatBb(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

/** Action verb only — the bet size (if any) is shown separately as an in-table chip marker. */
function actionVerb(action: ParsedSeatAction): string {
  switch (action.kind) {
    case 'fold': return 'FOLD'
    case 'call': return 'CALL'
    case 'check': return 'CHECK'
    case 'limp': return 'LIMP'
    case 'raise': return 'RAISE'
    case 'allin': return 'ALL-IN'
  }
}

/** A point `t` of the way from a seat's percentage coordinate toward table center (50%, 50%) —
 *  used to place blind/bet chip markers just inside the rail, near their seat. */
function towardCenter(xPct: string, yPct: string, t: number): { left: string; top: string } {
  const x = parseFloat(xPct)
  const y = parseFloat(yPct)
  return { left: `${x + (50 - x) * t}%`, top: `${y + (50 - y) * t}%` }
}

function BetChip({ x, y, amount, tone }: { x: string; y: string; amount: number; tone: 'blind' | 'bet' }) {
  const pos = towardCenter(x, y, 0.4)
  return (
    <div
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pos.left, top: pos.top }}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[8px] font-bold tabular-nums whitespace-nowrap shadow-sm',
          tone === 'blind'
            ? 'border-white/15 bg-white/10 text-white/60'
            : 'border-sky-400/30 bg-sky-500/20 text-sky-200',
        )}
      >
        {formatBb(amount)}
      </span>
    </div>
  )
}

export interface PreflopTableProps {
  /** 2-9. */
  tableSize: number
  /** Any label lib/replay/positions.ts#normalizePosition understands (e.g. 'HJ', 'UTG+1'). */
  heroPosition: string
  /** Hero's 2 concrete cards, e.g. ['As','Kh']. Omit for 2 face-down placeholders. */
  heroHand?: string[]
  effectiveStackBb?: number
  /** Rendered once near table center — antes aren't seat-specific. */
  anteBb?: number
  /** The existing action_before_hero field, parsed internally — never fabricated when absent. */
  actionBeforeHero?: string[]
  /** Hero's own action after answering (post-answer table state, spec item 22). */
  heroAction?: { label: string; betBb?: number }
  /** Post-answer correctness badge on Hero's seat. */
  result?: 'correct' | 'incorrect'
  className?: string
}

/**
 * Shared preflop table used by every preflop Learn decision (RFI table decisions, position
 * mastery, facing-open, squeeze, defend). An information visualization, not decorative casino
 * imagery: Hero always anchors bottom-center regardless of real position (camera rotates, real
 * poker order is preserved), other seats show only position/stack/action state, and the center
 * carries a one-line orientation summary — never a hand-history paragraph.
 */
export function PreflopTable({
  tableSize,
  heroPosition,
  heroHand,
  effectiveStackBb,
  anteBb,
  actionBeforeHero,
  heroAction,
  result,
  className,
}: PreflopTableProps) {
  const seats = computeHeroRotatedSeats(tableSize, heroPosition)
  const cards = heroHand && heroHand.length === 2 ? heroHand : ['', '']
  const state = buildPreflopTableRenderState({
    hero_position: heroPosition,
    table_size: tableSize,
    action_before_hero: actionBeforeHero,
  })
  const centerStatus = state ? deriveCenterStatus(state) : undefined
  const seatState = new Map<string, PreflopSeatState>(state?.seats.map((s) => [s.position, s]))

  return (
    <div className={cn('preflop-table-root space-y-2', className)}>
      <div className="relative mx-auto w-full max-w-2xl" style={{ aspectRatio: '16 / 10.5' }}>
        {/* Outer rail — a thin premium border ring, distinct from the inner playing surface */}
        <div
          className="absolute inset-[10%] rounded-[999px]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset',
          }}
        />
        {/* Inner felt — very dark desaturated navy, subtly lighter than the rail */}
        <div
          className="absolute inset-[12.5%] rounded-[999px] border border-white/[0.05]"
          style={{
            background: 'radial-gradient(ellipse at 50% 42%, rgba(42,45,61,0.85) 0%, rgba(23,25,36,0.92) 62%, rgba(15,16,24,0.95) 100%)',
            boxShadow: 'inset 0 0 46px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.025)',
          }}
        />

        {/* Ante — a small independent tag along the top rail, kept out of the main center stack */}
        {anteBb != null && (
          <div className="absolute left-1/2 top-[15%] z-10 -translate-x-1/2">
            <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[8px] font-semibold text-amber-300/70 whitespace-nowrap">
              ANTE {formatBb(anteBb) === String(anteBb) ? anteBb : anteBb.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}BB
            </span>
          </div>
        )}

        {/* Center — large clean empty space, minimal orientation text only */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5 text-center px-3">
          {effectiveStackBb != null && (
            <span className="text-[11px] font-bold tracking-[0.06em] text-white/45 tabular-nums">
              PREFLOP · {formatBb(effectiveStackBb)}BB
            </span>
          )}
          {centerStatus && (
            <span className="text-[10px] font-black tracking-[0.1em] text-violet-300/85">{centerStatus}</span>
          )}
        </div>

        {seats.map((seat, i) => {
          const isHero = i === 0
          const seatInfo = seatState.get(seat.position)
          const isDealer = seatInfo?.isDealer ?? seat.position === 'BTN'
          const action = isHero ? undefined : seatInfo?.action
          const folded = action?.kind === 'fold'

          // Bet/blind chip marker: raises/all-ins show their real size; an un-acted blind
          // seat shows its posted blind. Never both, and never fabricated when absent.
          const markerAmount =
            isHero
              ? heroAction?.betBb
              : action && (action.kind === 'raise' || action.kind === 'allin')
              ? action.betBb
              : !action && seatInfo?.postedBlindBb != null
              ? seatInfo.postedBlindBb
              : undefined
          const markerTone: 'blind' | 'bet' = action ? 'bet' : 'blind'

          return (
            <div key={`${seat.position}-${i}`}>
              {markerAmount != null && (
                <BetChip x={seat.x} y={seat.y} amount={markerAmount} tone={markerTone} />
              )}
              <div
                className="absolute z-10"
                style={{ left: seat.x, top: seat.y, transform: `translate(${seat.tx}, ${seat.ty})` }}
              >
                {isHero ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex gap-1.5">
                      <PlayingCardMini card={cards[0]} size="lg" />
                      <PlayingCardMini card={cards[1]} size="lg" />
                    </div>
                    <div className="flex items-center gap-1">
                      {isDealer && <DealerButton />}
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap',
                          'border-violet-400/40 bg-violet-500/10 text-violet-200',
                        )}
                      >
                        HERO · {seat.position}
                      </span>
                    </div>
                    {effectiveStackBb != null && (
                      <span className="text-[10px] font-semibold tabular-nums text-sky-200/70">
                        {formatBb(effectiveStackBb)} BB
                      </span>
                    )}
                    {heroAction ? (
                      <span className="rounded-full bg-violet-500/20 border border-violet-400/30 px-2 py-0.5 text-[9px] font-bold text-violet-200 whitespace-nowrap">
                        {heroAction.label}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-emerald-300/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                        YOUR TURN
                      </span>
                    )}
                    {result && (
                      <span
                        role="status"
                        className={cn(
                          'text-[10px] font-black tracking-wide',
                          result === 'correct' ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {result === 'correct' ? '✓ CORRECT' : '✕ INCORRECT'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn('flex flex-col items-center gap-0.5 transition-opacity duration-300', folded && 'opacity-35')}
                    aria-label={`${seat.position}${folded ? ', folded' : action ? `, ${actionVerb(action)}` : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {isDealer && <DealerButton />}
                      <span className="text-[11px] font-bold text-foreground/70 whitespace-nowrap">{seat.position}</span>
                    </div>
                    {action ? (
                      <span
                        className={cn(
                          'text-[10px] font-semibold whitespace-nowrap',
                          folded ? 'text-muted-foreground/40' : 'text-sky-300/80',
                        )}
                      >
                        {actionVerb(action)}
                      </span>
                    ) : effectiveStackBb != null ? (
                      <span className="text-[10px] font-medium text-muted-foreground/45 whitespace-nowrap">
                        {formatBb(effectiveStackBb)} BB
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Screen-reader summary — the visual table can be complex; this is concise text. */}
      <p className="sr-only">
        {tableSize}-max table. Hero is {heroPosition}
        {effectiveStackBb != null ? ` with ${formatBb(effectiveStackBb)} big blinds effective` : ''}.
        {centerStatus ? ` ${centerStatus}.` : ''}
        {heroHand && heroHand.length === 2 ? ` Hero holds ${heroHand.join(' and ')}.` : ''}
      </p>
    </div>
  )
}

function DealerButton() {
  return (
    <span
      aria-label="Dealer button"
      title="Dealer"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[8px] font-black text-neutral-800 shadow-sm"
    >
      D
    </span>
  )
}

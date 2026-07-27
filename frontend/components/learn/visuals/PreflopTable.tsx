'use client'

import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { POSITIONS_BY_SIZE, normalizePosition } from '@/lib/replay/positions'
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

// Every seat sits at the same radius from table center — a single symmetrical 9-max
// (and 2-8-max) ellipse instead of hand-tuned per-seat coordinates. This is purely a
// rendering concern local to PreflopTable; it does not touch lib/replay/positions.ts
// (shared with the Replay feature) or any position-ORDER logic.
const ELLIPSE_RADIUS = 42.5

// The rail is the outer ring between the "outer rail" div (inset-[10%], radius 40) and
// the "inner felt" div (inset-[12.5%], radius 37.5) below — its centerline sits exactly
// between those two, at radius 38.75. Non-hero position labels anchor there (see
// `railCenterlinePoint`); this is a plain rescale of the same symmetric seat ellipse,
// so it stays exactly as symmetric and never needs a manually eyeballed per-seat offset.
const RAIL_OUTER_RADIUS = 40
const RAIL_INNER_RADIUS = 37.5
const RAIL_CENTERLINE_RADIUS = (RAIL_OUTER_RADIUS + RAIL_INNER_RADIUS) / 2

/** Rescales a seat's anchor point (on the ELLIPSE_RADIUS circle) onto the rail
 *  centerline circle, preserving its angle exactly — used only for centering the
 *  non-hero position label text. Hero's own anchor, and the bet-chip/dealer-marker
 *  anchors (which still read the original `seat.x`/`seat.y`), are unaffected. */
function railCenterlinePoint(xPct: string, yPct: string): { x: string; y: string } {
  const ratio = RAIL_CENTERLINE_RADIUS / ELLIPSE_RADIUS
  const x = 50 + (parseFloat(xPct) - 50) * ratio
  const y = 50 + (parseFloat(yPct) - 50) * ratio
  return { x: `${x.toFixed(2)}%`, y: `${y.toFixed(2)}%` }
}

/** N points evenly spaced around a symmetrical ellipse, slot 0 at bottom-center, then
 *  proceeding counterclockwise on screen (bottom-left, left, upper-left, ... bottom-right) —
 *  the same visual direction the table has always used. `tx` is always horizontally
 *  centered; `ty` anchors each pod from its top/middle/bottom edge depending on which
 *  third of the ellipse it falls in, so labels never render "inside out". */
function ellipseSeatCoords(totalSeats: number): { x: string; y: string; tx: string; ty: string }[] {
  const coords: { x: string; y: string; tx: string; ty: string }[] = []
  for (let i = 0; i < totalSeats; i++) {
    const angle = (2 * Math.PI * i) / totalSeats
    const xPct = 50 - ELLIPSE_RADIUS * Math.sin(angle)
    const yPct = 50 + ELLIPSE_RADIUS * Math.cos(angle)
    const ty = yPct > 62 ? '-100%' : yPct < 38 ? '0%' : '-50%'
    coords.push({ x: `${xPct.toFixed(2)}%`, y: `${yPct.toFixed(2)}%`, tx: '-50%', ty })
  }
  return coords
}

/**
 * Rotates `POSITIONS_BY_SIZE[tableSize]` (clockwise-from-BTN order) so `heroPosition`'s index
 * lands on slot 0, then zips it index-for-index with a symmetrical ellipse's coordinates
 * (slot 0 = hero, bottom-center). Exported for unit testing.
 */
export function computeHeroRotatedSeats(tableSize: number, heroPosition: string): SeatLayoutEntry[] {
  const positions = POSITIONS_BY_SIZE[tableSize] ?? POSITIONS_BY_SIZE[9]
  const N = positions.length
  const coords = ellipseSeatCoords(N)
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
 *  used to place the dealer button and blind/bet chip markers just inside the rail, near
 *  their seat, using the same seat-to-center positioning system for both. */
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

/** Fixed pixel gap between the BTN position label's own center and the dealer chip's
 *  left edge — "BTN" is always exactly 3 characters, so a constant screen-space offset
 *  (not a radius/angle-dependent one) clears the label at every possible rail position,
 *  robust for BTN sitting anywhere around the ellipse. */
const DEALER_LABEL_GAP_PX = 22

/** Fixed pixel gap between Hero's own seat-rail anchor and the dealer chip's left edge,
 *  used only when Hero is on the button. Hero has no fixed-width label to gap against
 *  (the cards row above it is a constant 114px, centered on the seat), so this is sized
 *  to clear that row's half-width (57px) plus a small margin — large enough that the
 *  chip never overlaps the hole cards, HERO badge, or action pill stacked above it. */
const HERO_DEALER_GAP_PX = 68

function DealerMarker({ style }: { style: React.CSSProperties }) {
  return (
    <div className="absolute z-20" style={style}>
      <span
        aria-label="Dealer button"
        title="Dealer"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[8px] font-black text-neutral-800 shadow-sm"
      >
        D
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

        {/* Center — large clean empty space; the orientation line is subtle, the status
            line (when present) is the more prominent one, and neither competes with the
            hero cards since hero sits near the rail, well clear of dead-center. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 text-center px-3">
          {effectiveStackBb != null && (
            <span className="text-[10px] font-medium tracking-[0.08em] text-white/35 tabular-nums">
              PREFLOP · {formatBb(effectiveStackBb)}BB
            </span>
          )}
          {centerStatus && (
            <span className="text-[12px] font-black tracking-[0.08em] text-violet-300">{centerStatus}</span>
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

          // Non-hero position labels anchor on the rail centerline, not the wider seat
          // ellipse — the label's own geometric center (not the label+stack block's
          // center) lands exactly on the rail. Hero, bet chips, and the dealer marker
          // all keep reading the original seat.x/seat.y anchor, unchanged.
          const railPoint = railCenterlinePoint(seat.x, seat.y)

          return (
            <div key={`${seat.position}-${i}`}>
              {markerAmount != null && (
                <BetChip x={seat.x} y={seat.y} amount={markerAmount} tone={markerTone} />
              )}
              {/* Dealer chip sits beside the seat as its own element — never reads as a
                  single "D BTN"/"D HERO" run-on, never overlaps a label, stack line, or
                  (for Hero) the hole cards/badge/action-pill column. Both branches use the
                  same seat-relative system: anchor on that seat's own rail point, then
                  offset a fixed screen-space gap to the right — Hero just uses a wider gap
                  since it's clearing a 114px card row instead of a 3-character label. */}
              {isDealer && (
                isHero ? (
                  <DealerMarker
                    style={{ left: `calc(${railPoint.x} + ${HERO_DEALER_GAP_PX}px)`, top: railPoint.y, transform: 'translateY(-50%)' }}
                  />
                ) : (
                  <DealerMarker
                    style={{ left: `calc(${railPoint.x} + ${DEALER_LABEL_GAP_PX}px)`, top: railPoint.y, transform: 'translateY(-50%)' }}
                  />
                )
              )}
              {isHero ? (
              <div
                className="absolute z-10"
                style={{ left: seat.x, top: seat.y, transform: `translate(${seat.tx}, ${seat.ty})` }}
              >
                  <div className="flex flex-col items-center gap-2.5">
                    {/* Hero cards — one centered, fixed-width wrapper (2 cards + exact gap,
                        nothing implicit). Its midpoint is mathematically the wrapper's own
                        center, and the wrapper itself is centered by the parent flex column
                        — the same axis the HERO badge below centers on, so cards and badge
                        always share one exact vertical stack, never nudged apart. */}
                    <div className="flex w-[114px] items-center justify-between">
                      <PlayingCardMini card={cards[0]} size="lg" />
                      <PlayingCardMini card={cards[1]} size="lg" />
                    </div>

                    {/* Result badge — directly under the cards, above the HERO box. Always
                        rendered (a non-breaking space in place of real text when there's no
                        result yet) so this row's height never changes between "no answer
                        yet" and "answered" — nothing below it (the HERO box, the action
                        pill) ever shifts when the badge appears. */}
                    <span
                      role="status"
                      className={cn(
                        'text-[10px] font-black tracking-wide',
                        result === 'correct' ? 'text-emerald-400' : result === 'incorrect' ? 'text-red-400' : 'invisible',
                      )}
                    >
                      {result === 'correct' ? '✓ CORRECT' : result === 'incorrect' ? '✕ INCORRECT' : ' '}
                    </span>

                    {/* One compact seat box — not several floating labels. Active Hero is
                        indicated purely through this box's violet styling (no "YOUR TURN" text). */}
                    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1.5">
                      <span className="text-[11px] font-bold text-violet-200 whitespace-nowrap">
                        HERO · {seat.position}
                      </span>
                      {effectiveStackBb != null && (
                        <span className="text-[10px] font-semibold tabular-nums text-violet-200/60">
                          {formatBb(effectiveStackBb)} BB
                        </span>
                      )}
                    </div>

                    {/* Same reserved-space treatment as the result badge above — this pill
                        and the result badge always appear together (both derive from the
                        same post-answer state), so both must be shift-proof. */}
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[9px] font-bold whitespace-nowrap',
                        heroAction ? 'border-violet-400/30 bg-violet-500/20 text-violet-200' : 'invisible border-transparent',
                      )}
                    >
                      {heroAction ? heroAction.label : ' '}
                    </span>
                  </div>
              </div>
              ) : (
                // The position label's own geometric center — not the label+stack block's
                // center — sits on the rail centerline. The stack/action line is a fully
                // independent element rendered directly below it, so its presence or
                // content can never shift where the position label itself sits.
                <div
                  aria-label={`${seat.position}${folded ? ', folded' : action ? `, ${actionVerb(action)}` : ''}`}
                >
                  <span
                    className={cn(
                      'absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center text-[13px] font-extrabold text-foreground whitespace-nowrap transition-opacity duration-300',
                      folded && 'opacity-35',
                    )}
                    style={{ left: railPoint.x, top: railPoint.y }}
                  >
                    {seat.position}
                  </span>
                  {(action || effectiveStackBb != null) && (
                    <span
                      className={cn(
                        'absolute z-10 -translate-x-1/2 text-center whitespace-nowrap transition-opacity duration-300',
                        action
                          ? cn('text-[10px] font-semibold', folded ? 'text-muted-foreground/40' : 'text-sky-300/80')
                          : 'text-[10px] font-medium text-muted-foreground/45',
                        folded && 'opacity-35',
                      )}
                      style={{ left: railPoint.x, top: `calc(${railPoint.y} + 12px)` }}
                    >
                      {action ? actionVerb(action) : `${formatBb(effectiveStackBb!)} BB`}
                    </span>
                  )}
                </div>
              )}
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

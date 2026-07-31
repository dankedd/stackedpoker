'use client'

/**
 * Per-seat rail label (position, fold state, action verb, stack/stack-behind)
 * — extracted out of `PreflopTable`'s per-seat `.map()` body, where this JSX
 * was previously inline, so the playback engine can drive it per-frame
 * without PreflopTable's render function growing further. Rendering is
 * byte-identical to the original inline version when `highlighted` is false
 * and `fadeDurationMs` is omitted (defaults to the original hardcoded 300ms) —
 * this is a pure extraction, not a redesign.
 *
 * Table-geometry-specific (rail-anchor positioning), so this lives alongside
 * PreflopTable rather than in the generic `components/poker/` primitives
 * folder — unlike ChipStack/DealerMarker/PotDisplay, there's no second real
 * consumer for this exact layout yet.
 */
import { cn } from '@/lib/utils'
import { formatBb } from '@/components/poker/tableTokens'

export interface PreflopSeatRowProps {
  position: string
  isHero: boolean
  isMobile: boolean
  folded: boolean
  hasVerb: boolean
  verbText?: string
  seatStackBb?: number
  seatIsShortStack: boolean
  stackBehindBb?: number
  railPoint: { x: string; y: string }
  /** True for the one frame in which this seat just raised/called/checked —
   *  a brief highlight pulse (`.animate-seat-action-in`) so it's visible the
   *  seat just acted, distinct from the fold-dim treatment. Never set for a
   *  fold (folds dim, they don't highlight). */
  highlighted?: boolean
  /** Drives the fold-dim transition's duration — defaults to the original
   *  300ms so omitting it renders identically to before this component existed. */
  fadeDurationMs?: number
}

export function PreflopSeatRow({
  position,
  isHero,
  isMobile,
  folded,
  hasVerb,
  verbText,
  seatStackBb,
  seatIsShortStack,
  stackBehindBb,
  railPoint,
  highlighted = false,
  fadeDurationMs = 300,
}: PreflopSeatRowProps) {
  return (
    <div aria-label={`${position}${folded ? ', folded' : hasVerb ? `, ${verbText}` : ''}`}>
      {/* Row 1 — position label, dead center on the rail. Hero's "HERO ·" prefix
          shares the exact same anchor/baseline as the position itself. */}
      <span
        className={cn(
          'absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center whitespace-nowrap transition-opacity',
          folded && 'opacity-35',
          highlighted && 'animate-seat-action-in',
        )}
        style={{ transitionDuration: `${fadeDurationMs}ms`, left: railPoint.x, top: railPoint.y }}
      >
        {isHero && (
          <span className="mr-[3px] align-middle text-[9px] font-black uppercase tracking-[0.1em] text-violet-300/80">
            HERO ·
          </span>
        )}
        <span
          className={cn(
            'align-middle text-[13px] font-extrabold',
            isHero ? 'text-violet-200' : 'text-foreground',
          )}
        >
          {position}
        </span>
      </span>

      {/* Row 2 — FOLD, the action verb, or (if neither) this seat's own effective
          stack. A short seat gets a compact amber badge instead of the plain
          muted text every other seat uses. Mobile hides a folded seat's row 2
          entirely (dimmed position label only) to cut clutter. */}
      {!(isMobile && folded) && (folded || hasVerb || seatStackBb != null) && (
        <span
          className={cn(
            'absolute z-10 -translate-x-1/2 text-center whitespace-nowrap transition-opacity',
            folded
              ? 'text-[10px] font-semibold text-muted-foreground/40 opacity-35'
              : hasVerb
              ? cn('text-[10px] font-semibold', isHero ? 'text-violet-300/90' : 'text-sky-300/80')
              : !seatIsShortStack && 'text-[10px] font-medium text-muted-foreground/45',
          )}
          style={{ left: railPoint.x, top: `calc(${railPoint.y} + 12px)`, transitionDuration: `${fadeDurationMs}ms` }}
        >
          {folded ? (
            'FOLD'
          ) : hasVerb ? (
            verbText
          ) : seatIsShortStack ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/15 px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide text-amber-300"
              title="Short stack"
            >
              {formatBb(seatStackBb!)} BB · SHORT
            </span>
          ) : (
            `${formatBb(seatStackBb!)} BB`
          )}
        </span>
      )}

      {/* Row 3 — stack BEHIND, only alongside a real action, always labeled
          "behind" so it can never read as the raise/bet amount itself. */}
      {hasVerb && !folded && stackBehindBb != null && (
        <span
          className="absolute z-10 -translate-x-1/2 text-center whitespace-nowrap text-[9px] font-medium text-muted-foreground/40"
          style={{ left: railPoint.x, top: `calc(${railPoint.y} + 24px)` }}
        >
          {formatBb(stackBehindBb)} BB behind
        </span>
      )}
    </div>
  )
}

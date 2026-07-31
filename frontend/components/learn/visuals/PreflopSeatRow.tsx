'use client'

/**
 * Per-seat rail label (position, fold state, action verb, stack/stack-behind)
 * — extracted out of `PreflopTable`'s per-seat `.map()` body, where this JSX
 * was previously inline, so the playback engine can drive it per-frame
 * without PreflopTable's render function growing further. Row 1 (the position
 * label) keeps its original absolute anchor/classes untouched — every
 * existing rail-position test depends on it landing exactly on the rail
 * point regardless of content. Rows 2/3 (action/stack) were re-grouped into
 * one flex column with a real `gap` instead of two independently-guessed
 * pixel offsets, to fix a reported overlap between the position and action
 * labels — see the vertical-rhythm constants below.
 *
 * Table-geometry-specific (rail-anchor positioning), so this lives alongside
 * PreflopTable rather than in the generic `components/poker/` primitives
 * folder — unlike ChipStack/DealerMarker/PotDisplay, there's no second real
 * consumer for this exact layout yet.
 */
import { cn } from '@/lib/utils'
import { formatBb } from '@/components/poker/tableTokens'

// ── Centralized vertical rhythm for the rail label stack ────────────────────
// Row 1 (the position label) is vertically CENTERED on the rail point via
// `-translate-y-1/2`, so its own rendered line box already extends roughly
// this far below the rail point before anything else can safely start —
// half of its ~13px-font/extrabold line height. Row 2 previously started at a
// flat `+ 12px` offset that never accounted for this, leaving only a few
// pixels of real clearance below row 1's actual glyph box — the cause of the
// reported CO overlap (structurally present at EVERY seat, not CO-specific;
// CO's action text just made it visible first). Every gap below is derived
// from ONE shared constant instead of two independently-guessed pixel values,
// so the whole stack can be retuned in one place and never drifts out of sync
// with itself again.
const ROW1_HALF_HEIGHT_PX = 9
/** Minimum breathing room between any two adjacent rows in this stack. */
export const ROW_GAP_PX = 8
export const ROW2_TOP_OFFSET_PX = ROW1_HALF_HEIGHT_PX + ROW_GAP_PX

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

      {/* Rows 2+3 — FOLD/action-verb/stack, then (only alongside a real action)
          the stack BEHIND — grouped into ONE flex column so the gap between
          them is a real, browser-guaranteed `gap`, never a second independently
          -guessed pixel offset. Positioned ONCE, `ROW2_TOP_OFFSET_PX` below the
          rail point (derived from row 1's own half-height, not a flat guess) —
          the actual fix for the reported overlap. A short seat gets a compact
          amber badge instead of the plain muted text every other seat uses.
          Mobile hides a folded seat's row 2 entirely (dimmed position label
          only) to cut clutter. */}
      {(() => {
        const showRow2 = !(isMobile && folded) && (folded || hasVerb || seatStackBb != null)
        const showRow3 = hasVerb && !folded && stackBehindBb != null
        if (!showRow2 && !showRow3) return null
        return (
          <div
            className="absolute z-10 flex -translate-x-1/2 flex-col items-center"
            style={{ left: railPoint.x, top: `calc(${railPoint.y} + ${ROW2_TOP_OFFSET_PX}px)`, gap: `${ROW_GAP_PX}px` }}
          >
            {showRow2 && (
              <span
                className={cn(
                  'text-center whitespace-nowrap transition-opacity',
                  folded
                    ? 'text-[10px] font-semibold text-muted-foreground/40 opacity-35'
                    : hasVerb
                    ? cn('text-[10px] font-semibold', isHero ? 'text-violet-300/90' : 'text-sky-300/80')
                    : !seatIsShortStack && 'text-[10px] font-medium text-muted-foreground/45',
                )}
                style={{ transitionDuration: `${fadeDurationMs}ms` }}
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

            {showRow3 && (
              <span className="text-center whitespace-nowrap text-[9px] font-medium text-muted-foreground/40">
                {formatBb(stackBehindBb!)} BB behind
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}

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
import { StackDepthBadge } from '@/components/poker/StackDepthBadge'
import { InlineDealerMarker } from '@/components/poker/DealerMarker'

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
  stackBehindBb?: number
  /** Mobile: this seat's action verb is rendered on its CHIP instead (see
   *  ChipStack.actionLabel), so the pod drops to two lines — position, then
   *  what the player has left. The verb still reaches assistive tech through
   *  this component's `aria-label`, which is unchanged either way; only the
   *  visible row moves. */
  verbShownOnChip?: boolean
  /** Mobile: stack rows 2/3 ABOVE the position label instead of below it, for
   *  seats in the top half of the table — see PreflopTable's `podAbove`. */
  podAbove?: boolean
  /** Mobile: render the dealer button inline after the position label rather
   *  than positioning it separately on the table — see `InlineDealerMarker`. */
  dealerInline?: boolean
  /** Narrow phones: drop this seat's stack row because it repeats the
   *  table-wide effective stack already printed in the status bar — see
   *  PreflopTable's `suppressStackRow`. */
  suppressStackRow?: boolean
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
  stackBehindBb,
  verbShownOnChip = false,
  podAbove = false,
  dealerInline = false,
  suppressStackRow = false,
  railPoint,
  highlighted = false,
  fadeDurationMs = 300,
}: PreflopSeatRowProps) {
  // With the verb on the chip, row 2 reverts to a stack readout — and the
  // honest number there is what the player has LEFT, not their starting stack,
  // which the raise they just made has already spent.
  const resolvedStackBb = verbShownOnChip ? stackBehindBb ?? seatStackBb : seatStackBb
  const podStackBb = suppressStackRow ? undefined : resolvedStackBb
  return (
    <div aria-label={`${position}${folded ? ', folded' : hasVerb ? `, ${verbText}` : ''}`}>
      {/* Row 1 — position label, dead center on the rail. Hero's "HERO ·" prefix
          shares the exact same anchor/baseline as the position itself. */}
      <span
        data-tt="seat-pos"
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
        {dealerInline && <InlineDealerMarker />}
      </span>

      {/* Rows 2+3 — FOLD/action-verb/stack, then (only alongside a real action)
          the stack BEHIND — grouped into ONE flex column so the gap between
          them is a real, browser-guaranteed `gap`, never a second independently
          -guessed pixel offset. Positioned ONCE, `ROW2_TOP_OFFSET_PX` below the
          rail point (derived from row 1's own half-height, not a flat guess) —
          the actual fix for the reported overlap. Every stack depth (short or
          deep) renders through the SAME `StackDepthBadge` — no per-depth
          styling ever again. Mobile hides a folded seat's row 2 entirely
          (dimmed position label only) to cut clutter. */}
      {(() => {
        const showVerbHere = hasVerb && !verbShownOnChip
        const showRow2 = !(isMobile && folded) && (folded || showVerbHere || podStackBb != null)
        // "N BB behind" only earns its line next to a verb that is actually here;
        // when the verb moved to the chip, row 2 is already showing that number.
        const showRow3 = showVerbHere && !folded && stackBehindBb != null
        if (!showRow2 && !showRow3) return null
        return (
          <div
            data-tt="seat-meta"
            className={cn(
              'absolute z-10 flex -translate-x-1/2 items-center',
              // Growing upward mirrors the whole block: it hangs from its own
              // bottom edge, and the row order reverses so whichever row was
              // nearest the position label stays nearest to it.
              podAbove ? '-translate-y-full flex-col-reverse' : 'flex-col',
            )}
            style={{
              left: railPoint.x,
              top: `calc(${railPoint.y} ${podAbove ? '-' : '+'} ${ROW2_TOP_OFFSET_PX}px)`,
              gap: `${ROW_GAP_PX}px`,
            }}
          >
            {showRow2 && (
              <span
                className={cn(
                  'text-center whitespace-nowrap transition-opacity',
                  folded
                    ? 'text-[10px] font-semibold text-muted-foreground/40 opacity-35'
                    : showVerbHere
                    ? cn('text-[10px] font-semibold', isHero ? 'text-violet-300/90' : 'text-sky-300/80')
                    : undefined, // stack-depth case: StackDepthBadge owns its own styling
                )}
                style={{ transitionDuration: `${fadeDurationMs}ms` }}
              >
                {folded ? (
                  'FOLD'
                ) : showVerbHere ? (
                  verbText
                ) : podStackBb != null ? (
                  <StackDepthBadge stackBb={podStackBb} />
                ) : null}
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

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { POSITIONS_BY_SIZE, normalizePosition } from '@/lib/replay/positions'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine'
import {
  buildPreflopTableRenderState,
  deriveCenterStatus,
  type ParsedSeatAction,
  type PreflopSeatState,
} from '@/lib/learn/preflopTableState'
import { buildPlaybackTimeline, type PlaybackEvent, type PlaybackEventKind } from '@/lib/learn/preflopTablePlayback'
import { ChipStack, type ChipTone } from '@/components/poker/ChipStack'
import { DealerMarker } from '@/components/poker/DealerMarker'
import { PotDisplay } from '@/components/poker/PotDisplay'
import { formatBb, formatAnte } from '@/components/poker/tableTokens'
import { PreflopSeatRow } from './PreflopSeatRow'

/** Events that move a NEW chip pile onto the felt — drives which seat's chip
 *  gets the seat→pot travel-in animation for the frame it fires on. Checks
 *  and folds never move chips (spec: "Checks: geen chipanimatie"). */
const CHIP_EVENT_KINDS = new Set<PlaybackEventKind>(['post_sb', 'post_bb', 'raise', 'allin', 'call', 'limp'])
/** Events that get a brief seat highlight so it's visible the seat just
 *  acted — everything except fold (folds dim instead of highlighting). */
const HIGHLIGHT_EVENT_KINDS = new Set<PlaybackEventKind>(['post_sb', 'post_bb', 'raise', 'allin', 'call', 'limp', 'check'])

export interface SeatLayoutEntry {
  position: string
  x: string
  y: string
  tx: string
  ty: string
}

/**
 * Every geometric constant the table needs, bundled per breakpoint. Desktop and
 * mobile are two independent, hand-tuned maps — mobile is NOT a scaled-down
 * desktop (no transform: scale() anywhere), it has its own radius, rail
 * thickness, and dealer-chip gap. Both breakpoints share the SAME structural
 * principle: every seat (Hero included) anchors its label on the rail
 * centerline, and Hero's cards/pot live in one fixed protected zone at table
 * center — see `ScenarioComparison`/`PreflopTable` below for how that's used.
 */
interface TableLayoutConfig {
  /** CSS `aspect-ratio` (width / height) for the table's outer container. */
  aspectRatio: string
  /** % radius (from table center) at which every seat's anchor point sits —
   *  drives BOTH the label's rail-centerline projection and the chip's
   *  seat-to-center vector. Never changed by this redesign (outer shape). */
  ellipseRadius: number
  /** % radius of the outer rail ring — drives the outer ring's `inset-[]`. */
  railOuterRadius: number
  /** % radius of the inner felt ring — drives the felt's `inset-[]`. */
  railInnerRadius: number
  /** Fixed px gap between a seat's rail point and its dealer chip — the SAME
   *  for every seat, Hero included (no more Hero-only special case). */
  dealerLabelGapPx: number
  /** Extra px added to `dealerLabelGapPx` ONLY when the dealer marker's own
   *  seat is ALSO Hero's seat (i.e. Hero is on the button) — driven purely by
   *  seat ROLE (isHero && isDealer), never by position identity, so it's not
   *  a reintroduction of per-position/BTN-only geometry. Needed because that
   *  seat's label is "HERO · BTN" (wider than every other seat's plain
   *  3-letter label), and the dealer marker used to sit close enough to clip
   *  the position text's own tail end. */
  heroDealerExtraGapPx: number
  /** How far (0-1) a bet/blind chip is pulled from its seat toward table center. */
  chipPullFactor: number
  /** Diameter (px) of a single poker-chip disc — the chip PILE (2 diagonally
   *  overlapping discs) renders somewhat wider/taller than this. Drives sizing
   *  entirely from config, never a per-breakpoint literal scattered in JSX. */
  chipSizePx: number
  /** Vertical center (% of container height) of the pot readout. */
  potYPct: number
  /** Vertical center (% of container height) of Hero's protected card zone. */
  cardZoneYPct: number
  /** A protected rectangle bet/blind chips must never enter — sized and CENTERED
   *  (explicitly — never assumed to be the container's true 50/50 center, since
   *  the pot readout and Hero's card zone don't straddle it symmetrically) to
   *  cover both the pot readout and Hero's card zone with margin. */
  protectedZone: { cxPct: number; cyPct: number; halfWidthPct: number; halfHeightPct: number }
}

export const DESKTOP_LAYOUT: TableLayoutConfig = {
  aspectRatio: '16 / 10.5',
  ellipseRadius: 42.5,
  railOuterRadius: 40,
  railInnerRadius: 37.5,
  dealerLabelGapPx: 22,
  heroDealerExtraGapPx: 30,
  chipPullFactor: 0.4,
  chipSizePx: 20,
  potYPct: 36,
  cardZoneYPct: 59,
  // Covers 30%-74% vertically (pot's own span ~32-40, card zone's own span
  // ~46-72, both comfortably inside) and 34%-66% horizontally (114px card row
  // plus margin). A couple points larger than the bare minimum to also clear
  // the bigger chip-pile glyph (~24px) plus its amount label.
  protectedZone: { cxPct: 50, cyPct: 52, halfWidthPct: 17, halfHeightPct: 23 },
}

/** Mobile: ~92-96% width (see the root div below), a taller/more-oval shape,
 *  a smaller seat radius (more edge clearance for labels at 320-430px), and a
 *  gentler chip-pull factor (keeps blind/bet chips clear of the protected
 *  center column). */
export const MOBILE_LAYOUT: TableLayoutConfig = {
  // Slightly taller than a strict 3:4 — buys the extra vertical clearance the
  // protected center column (pot + hole cards + result badge + action pill)
  // needs between the top/bottom seats.
  aspectRatio: '3 / 4.3',
  ellipseRadius: 38,
  railOuterRadius: 36,
  railInnerRadius: 33.5,
  dealerLabelGapPx: 22,
  heroDealerExtraGapPx: 26,
  // Was 0.2 historically (tuned for the old 13px chip pill) — too shallow for
  // the bigger chip-pile glyph, which visually landed on top of the SB/BB
  // rail labels instead of clearing them (confirmed via screenshot QA). Mobile's
  // rail-band-to-seat-radius ratio (34.75/38 ≈ 0.91) is nearly identical to
  // desktop's (38.75/42.5 ≈ 0.91), so it needs essentially the SAME pull
  // fraction as desktop to clear the rail band by a comparable margin.
  chipPullFactor: 0.38,
  chipSizePx: 15,
  potYPct: 35,
  cardZoneYPct: 57,
  // Narrower than earlier tuning (was halfWidthPct 25/halfHeightPct 29) — that
  // size was safe for the card zone itself (which only needs ~16 halfWidthPct /
  // ~17.5 halfHeightPct) but, for seats near the ellipse's side/bottom (SB/BB
  // especially — BB sits close to the card zone's own corner), clamped the
  // chip's travel-toward-center path SO early that it landed back on top of
  // the seat's own rail label — confirmed via screenshot QA. Shrunk to the
  // smallest size that still comfortably covers pot + cards with margin,
  // freeing up room for chipPullFactor to actually clear the rail band.
  protectedZone: { cxPct: 50, cyPct: 49, halfWidthPct: 19, halfHeightPct: 20 },
}

/** Rescales a seat's anchor point (on the `ellipseRadius` circle) onto the rail
 *  centerline circle, preserving its angle exactly — this is THE generic
 *  seat-anchor system every position label (Hero included) is centered on. The
 *  bet-chip/dealer-marker anchors (which still read the original `seat.x`/
 *  `seat.y`) are unaffected. */
export function railCenterlinePoint(
  xPct: string,
  yPct: string,
  ellipseRadius: number = DESKTOP_LAYOUT.ellipseRadius,
  railCenterlineRadius: number = (DESKTOP_LAYOUT.railOuterRadius + DESKTOP_LAYOUT.railInnerRadius) / 2,
): { x: string; y: string } {
  const ratio = railCenterlineRadius / ellipseRadius
  const x = 50 + (parseFloat(xPct) - 50) * ratio
  const y = 50 + (parseFloat(yPct) - 50) * ratio
  return { x: `${x.toFixed(2)}%`, y: `${y.toFixed(2)}%` }
}

/** N points evenly spaced around a symmetrical ellipse, slot 0 at bottom-center, then
 *  proceeding counterclockwise on screen (bottom-left, left, upper-left, ... bottom-right) —
 *  the same visual direction the table has always used. `tx` is always horizontally
 *  centered; `ty` anchors each pod from its top/middle/bottom edge depending on which
 *  third of the ellipse it falls in, so labels never render "inside out". */
function ellipseSeatCoords(
  totalSeats: number,
  radius: number = DESKTOP_LAYOUT.ellipseRadius,
): { x: string; y: string; tx: string; ty: string }[] {
  const coords: { x: string; y: string; tx: string; ty: string }[] = []
  for (let i = 0; i < totalSeats; i++) {
    const angle = (2 * Math.PI * i) / totalSeats
    const xPct = 50 - radius * Math.sin(angle)
    const yPct = 50 + radius * Math.cos(angle)
    const ty = yPct > 62 ? '-100%' : yPct < 38 ? '0%' : '-50%'
    coords.push({ x: `${xPct.toFixed(2)}%`, y: `${yPct.toFixed(2)}%`, tx: '-50%', ty })
  }
  return coords
}

/**
 * Rotates `POSITIONS_BY_SIZE[tableSize]` (clockwise-from-BTN order) so `heroPosition`'s index
 * lands on slot 0, then zips it index-for-index with a symmetrical ellipse's coordinates
 * (slot 0 = hero, bottom-center). Exported for unit testing. UNCHANGED by this redesign —
 * this is the outer geometry ("de buitenrand blijft hetzelfde") every seat, including Hero,
 * still reads its anchor point from.
 */
export function computeHeroRotatedSeats(
  tableSize: number,
  heroPosition: string,
  ellipseRadius: number = DESKTOP_LAYOUT.ellipseRadius,
): SeatLayoutEntry[] {
  const positions = POSITIONS_BY_SIZE[tableSize] ?? POSITIONS_BY_SIZE[9]
  const N = positions.length
  const coords = ellipseSeatCoords(N, ellipseRadius)
  const heroIdx = positions.indexOf(normalizePosition(heroPosition))
  const startIdx = heroIdx >= 0 ? heroIdx : 0

  return coords.map((coord, slot) => {
    const srcIdx = (startIdx + slot) % N
    return { position: positions[srcIdx], x: coord.x, y: coord.y, tx: coord.tx, ty: coord.ty }
  })
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

export interface PreflopTableProps {
  /** 2-9. */
  tableSize: number
  /** Any label lib/replay/positions.ts#normalizePosition understands (e.g. 'HJ', 'UTG+1'). */
  heroPosition: string
  /** Hero's 2 concrete cards, e.g. ['As','Kh']. Omit for 2 face-down placeholders. */
  heroHand?: string[]
  effectiveStackBb?: number
  /** Per-seat effective-stack override in bb, keyed by position (e.g. `{ BB: 10 }`) — a seat
   *  with an entry here displays ITS OWN stack instead of `effectiveStackBb`, and is flagged
   *  short-stacked (badge highlight) when at or below SHORT_STACK_THRESHOLD_BB. See
   *  `LessonStep.stack_overrides_bb`. */
  stackOverridesBb?: Record<string, number>
  /** Rendered once in the below-table status bar — antes aren't seat-specific. */
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
 * poker order is preserved).
 *
 * Three non-overlapping layers, in the same DOM order they're described here:
 *  1. RAIL    — every seat's position label (Hero included, identical geometry), its
 *               action/stack line, and the dealer button. All anchored on the rail
 *               centerline via `railCenterlinePoint` — never a per-position pixel offset.
 *  2. FIELD   — the green felt itself, chip-stack markers for every seat's current
 *               commitment (derived from `seat.committedBb`, seat-anchor → center vector),
 *               the pot readout, and Hero's protected hole-card zone.
 *  3. STATUS  — a compact bar BELOW the table (street/effective-stack/ante/center-status
 *               text) — nothing that isn't a position, card, chip, pot, or dealer marker
 *               is allowed to render inside the table itself.
 */
export function PreflopTable({
  tableSize,
  heroPosition,
  heroHand,
  effectiveStackBb,
  stackOverridesBb,
  anteBb,
  actionBeforeHero,
  heroAction,
  result,
  className,
}: PreflopTableProps) {
  const isMobile = useIsMobile()
  const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT
  const railCenterlineRadius = (layout.railOuterRadius + layout.railInnerRadius) / 2

  const seats = computeHeroRotatedSeats(tableSize, heroPosition, layout.ellipseRadius)
  const cards = heroHand && heroHand.length === 2 ? heroHand : ['', '']

  // The shared Action Playback Engine: builds a timeline (blinds post, then
  // each parsed action_before_hero entry) and steps through it one frame at a
  // time. `undefined` whenever there's no reliable action data to play back
  // (same "never fabricate" contract buildPreflopTableRenderState already
  // has) — the engine then yields a single, already-complete frame so this
  // component falls back to exactly today's static final-state render below.
  const timeline = useMemo(
    () =>
      buildPlaybackTimeline({
        hero_position: heroPosition,
        table_size: tableSize,
        action_before_hero: actionBeforeHero,
        effective_stack_bb: effectiveStackBb,
        stack_overrides_bb: stackOverridesBb,
        ante_bb: anteBb,
      }),
    [heroPosition, tableSize, actionBeforeHero, effectiveStackBb, stackOverridesBb, anteBb],
  )
  const engine = usePlaybackEngine(timeline?.frames, timeline?.events)

  // No reliable timeline (unparseable/absent action data) — render exactly
  // today's static final state, unchanged.
  const state = timeline
    ? engine.frame
    : buildPreflopTableRenderState({
        hero_position: heroPosition,
        table_size: tableSize,
        action_before_hero: actionBeforeHero,
        effective_stack_bb: effectiveStackBb,
        stack_overrides_bb: stackOverridesBb,
      })
  const centerStatus = state ? deriveCenterStatus(state) : undefined
  const seatState = new Map<string, PreflopSeatState>(state?.seats.map((s) => [s.position, s]))
  const currentEvent = timeline ? engine.event : null

  // ── LAYER 2 (field) content that isn't per-seat: pot + Hero's protected card zone ──
  // Hero's cards/result/own-action pill live in ONE fixed screen position regardless of
  // Hero's actual seat — this is what lets Hero use the exact same rail-anchor geometry
  // as every other seat for their POSITION LABEL (below) without cards dragging that
  // anchor around the table.
  const heroCardZone = (
    <div
      className="absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ top: `${layout.cardZoneYPct}%` }}
    >
      {/* Subtle violet glow — one of Hero's "visueel herkenbaar" accents; purely decorative,
          never shifts layout (absolutely positioned behind the cards). */}
      <div aria-hidden className="pointer-events-none absolute h-16 w-28 rounded-full bg-violet-500/10 blur-xl" />

      <div className="relative flex w-[114px] items-center justify-between">
        <PlayingCardMini card={cards[0]} size="lg" />
        <PlayingCardMini card={cards[1]} size="lg" />
      </div>

      {/* Result badge — always mounted (invisible placeholder when there's no result yet)
          so nothing below it ever shifts when an answer lands. */}
      <span
        role="status"
        className={cn(
          'relative text-[10px] font-black tracking-wide',
          result === 'correct' ? 'text-emerald-400' : result === 'incorrect' ? 'text-red-400' : 'invisible',
        )}
      >
        {result === 'correct' ? '✓ CORRECT' : result === 'incorrect' ? '✕ INCORRECT' : ' '}
      </span>

      {/* Hero's own freshly-chosen action pill — same reserved-space treatment. */}
      <span
        className={cn(
          'relative rounded-full border px-2 py-0.5 text-[9px] font-bold whitespace-nowrap',
          heroAction ? 'border-violet-400/30 bg-violet-500/20 text-violet-200' : 'invisible border-transparent',
        )}
      >
        {heroAction ? heroAction.label : ' '}
      </span>
    </div>
  )

  const potReadout = (
    <PotDisplay potBb={state?.potBb ?? 0} topPct={layout.potYPct} pulse={currentEvent?.kind === 'allin'} />
  )

  // Skip is only ever meaningful once real client playback is underway — on
  // the first (SSR/pre-hydration) render `engine.isComplete` is already true
  // (see usePlaybackEngine's SSR-safe initial state), so this never appears
  // in a static render.
  const showSkip = !!timeline && !engine.isComplete

  return (
    <div className={cn('preflop-table-root space-y-2', className)}>
      <div
        className={cn('relative mx-auto', isMobile ? 'w-[94%]' : 'w-full max-w-2xl')}
        style={{ aspectRatio: layout.aspectRatio }}
        onClick={showSkip ? engine.skip : undefined}
      >
        {showSkip && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              engine.skip()
            }}
            className="absolute right-2 top-2 z-30 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/60 backdrop-blur-sm hover:bg-black/60"
          >
            Skip ▸
          </button>
        )}

        {/* LAYER 1 — rail: a thin premium border ring, distinct from the inner felt */}
        <div
          className={cn('absolute rounded-[999px]', isMobile ? 'inset-[14%]' : 'inset-[10%]')}
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset',
          }}
        />
        {/* LAYER 2 — playing field: dark, professional poker-green felt (not casino-bright) */}
        <div
          className={cn('absolute rounded-[999px] border border-emerald-950/40', isMobile ? 'inset-[16.5%]' : 'inset-[12.5%]')}
          style={{
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)',
            boxShadow: 'inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        />

        {potReadout}
        {heroCardZone}

        {seats.map((seat, i) => {
          const isHero = i === 0
          const seatInfo = seatState.get(seat.position)
          const isDealer = seatInfo?.isDealer ?? seat.position === 'BTN'
          const stateAction = seatInfo?.action
          const folded = !isHero && stateAction?.kind === 'fold'

          // Hero's own already-completed PRIOR action (e.g. an opening raise now facing a
          // 3-bet) reads from table state exactly like any other seat. Hero's FRESH
          // post-answer action (heroAction prop) is a separate, later fact and always wins
          // when present — it hasn't been folded into action_before_hero/committedBb.
          const priorHeroAction = isHero && stateAction && stateAction.kind !== 'fold' ? stateAction : undefined
          const heroFreshAction = isHero ? heroAction : undefined

          const verbText = heroFreshAction
            ? heroFreshAction.label
            : !isHero && stateAction && !folded
            ? actionVerb(stateAction)
            : priorHeroAction
            ? actionVerb(priorHeroAction)
            : undefined
          const hasVerb = verbText != null

          const stackBehindBb = isHero
            ? heroFreshAction || priorHeroAction
              ? seatInfo?.stackBehindBb
              : undefined
            : seatInfo?.stackBehindBb

          // This seat's OWN effective stack — a `stackOverridesBb[position]` entry (e.g. a
          // short-stacked player) always wins over the table-wide `effectiveStackBb`, so a
          // scenario's stack story is visible on the table itself, not just in prose.
          const seatStackBb = seatInfo?.effectiveStackBb ?? effectiveStackBb
          const seatIsShortStack = seatInfo?.isShortStack ?? false

          // Chip in front of the seat: the seat's real current-street commitment — this
          // is what keeps a FOLDED seat's earlier blind/raise visibly in the pot (spec
          // item 8) instead of vanishing, since committedBb is preserved through a fold.
          // Hero's fresh post-answer bet size (not yet reflected in committedBb, a
          // UI-only concern) overrides when present.
          const chipAmount = heroFreshAction?.betBb ?? (seatInfo?.committedBb ? seatInfo.committedBb : undefined)
          const committedBeyondBlind = (seatInfo?.committedBb ?? 0) > (seatInfo?.postedBlindBb ?? 0)
          const chipTone: ChipTone = heroFreshAction
            ? 'bet'
            : stateAction?.kind === 'allin'
            ? 'allin'
            : committedBeyondBlind
            ? 'bet'
            : 'blind'

          // Every label anchors on the SAME rail-centerline point — Hero included. This
          // (not a separate pod) is what makes Hero's position geometrically identical to
          // every other seat's.
          const railPoint = railCenterlinePoint(seat.x, seat.y, layout.ellipseRadius, railCenterlineRadius)

          // Did THIS seat's action just fire, this exact frame? Gates the chip
          // travel-in animation and the brief action highlight — and, via
          // `engine.hasStarted`, never fires during the SSR/pre-hydration
          // render (see hooks/usePlaybackEngine.ts), so static-render output
          // is unaffected by any of this.
          const justActedEvent = engine.hasStarted && currentEvent?.position === seat.position ? currentEvent : null
          const chipAnimatesIn = justActedEvent != null && CHIP_EVENT_KINDS.has(justActedEvent.kind)
          const seatHighlighted = justActedEvent != null && HIGHLIGHT_EVENT_KINDS.has(justActedEvent.kind)

          return (
            <div key={`${seat.position}-${i}`}>
              {chipAmount != null && (
                <ChipStack
                  x={seat.x}
                  y={seat.y}
                  amount={chipAmount}
                  tone={chipTone}
                  pullFactor={layout.chipPullFactor}
                  protectedZone={layout.protectedZone}
                  sizePx={layout.chipSizePx}
                  animateIn={chipAnimatesIn}
                  travelDurationMs={engine.timing.chipTravelDuration}
                />
              )}

              {isDealer && (
                <DealerMarker
                  style={{
                    left: `calc(${railPoint.x} + ${layout.dealerLabelGapPx + (isHero ? layout.heroDealerExtraGapPx : 0)}px)`,
                    top: railPoint.y,
                    transform: 'translateY(-50%)',
                  }}
                />
              )}

              <PreflopSeatRow
                position={seat.position}
                isHero={isHero}
                isMobile={isMobile}
                folded={folded}
                hasVerb={hasVerb}
                verbText={verbText}
                seatStackBb={seatStackBb}
                seatIsShortStack={seatIsShortStack}
                stackBehindBb={stackBehindBb}
                railPoint={railPoint}
                highlighted={seatHighlighted}
                fadeDurationMs={engine.timing.fadeDuration}
              />
            </div>
          )
        })}
      </div>

      {/* LAYER 3 — status: everything that doesn't physically belong ON a poker table
          (street, effective stack, ante, and the abstract action-sequence summary) lives
          in one compact bar BELOW it — same content, same position, on every breakpoint. */}
      {(effectiveStackBb != null || anteBb != null || centerStatus) && (
        <div className="rounded-xl border border-border/20 bg-secondary/10 px-3 py-2 text-center">
          {(effectiveStackBb != null || anteBb != null) && (
            <p className="text-[10px] font-medium tracking-[0.06em] text-white/40 tabular-nums whitespace-nowrap">
              {effectiveStackBb != null && `PREFLOP · ${formatBb(effectiveStackBb)}BB EFFECTIVE`}
              {effectiveStackBb != null && anteBb != null && ' · '}
              {anteBb != null && `ANTE ${formatAnte(anteBb)}BB`}
            </p>
          )}
          {centerStatus && (
            <p className="mt-0.5 text-[11px] font-black tracking-[0.06em] text-violet-300 whitespace-nowrap">
              {centerStatus}
            </p>
          )}
        </div>
      )}

      {/* Screen-reader summary — the visual table can be complex; this is concise text. */}
      <p className="sr-only">
        {tableSize}-max table. Hero is {heroPosition}
        {effectiveStackBb != null ? ` with ${formatBb(effectiveStackBb)} big blinds effective` : ''}.
        {centerStatus ? ` ${centerStatus}.` : ''}
        {heroHand && heroHand.length === 2 ? ` Hero holds ${heroHand.join(' and ')}.` : ''}
        {state?.seats
          .filter((s) => s.isShortStack)
          .map((s) => ` ${s.position} is short-stacked at ${formatBb(s.effectiveStackBb!)} big blinds.`)
          .join('')}
      </p>
    </div>
  )
}

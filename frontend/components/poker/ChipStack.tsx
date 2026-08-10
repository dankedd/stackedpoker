'use client'

/**
 * Poker-chip glyph + chip-pile marker — moved verbatim out of
 * `components/learn/visuals/PreflopTable.tsx` (where it was previously
 * private) so the shared Action Playback Engine can reuse the SAME chip
 * component for every seat's commitment marker, extended with an optional
 * seat→pot travel-in animation instead of a second implementation.
 *
 * `animateIn` must only ever be passed `true` during REAL client-side
 * playback (never on the first/SSR render) — see hooks/usePlaybackEngine.ts's
 * `hasStarted` flag. When false (the default), rendering is byte-identical to
 * the original inline implementation, so every existing static-render test
 * asserting exact chip positions/classes/markup is unaffected.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatBb } from './tableTokens'

export type ChipTone = 'blind' | 'bet' | 'allin'

/** Per-tone palette for the poker-chip glyph — color is supportive only:
 *  shape, amount, and the seat's own action label already carry the meaning
 *  without it. */
export const CHIP_PALETTE: Record<ChipTone, { edgeA: string; edgeB: string; face: string; ringColor: string; text: string }> = {
  blind: {
    edgeA: '#cbd5e1', // slate-300
    edgeB: '#3f4b5f',
    face: 'linear-gradient(155deg, #64748b 0%, #334155 65%, #1e293b 100%)',
    ringColor: 'rgba(226,232,240,0.35)',
    text: 'text-slate-200',
  },
  bet: {
    edgeA: '#bae6fd', // sky-200
    edgeB: '#0c4a6e',
    face: 'linear-gradient(155deg, #38bdf8 0%, #0284c7 65%, #075985 100%)',
    ringColor: 'rgba(224,242,254,0.45)',
    text: 'text-sky-100',
  },
  allin: {
    edgeA: '#fecaca', // red-200
    edgeB: '#7f1d1d',
    face: 'linear-gradient(155deg, #f87171 0%, #dc2626 65%, #7f1d1d 100%)',
    ringColor: 'rgba(254,226,226,0.45)',
    text: 'text-red-100',
  },
}

/** A point `t` of the way from a seat's percentage coordinate toward table
 *  center (50%, 50%) — used to place the dealer button and blind/bet chip
 *  markers just inside the rail, near their seat. Every seat derives its
 *  bet/chip position from this SAME function — there is no separate
 *  per-position pixel coordinate anywhere. */
export function towardCenter(
  xPct: string,
  yPct: string,
  t: number,
  protectedZone?: { cxPct: number; cyPct: number; halfWidthPct: number; halfHeightPct: number },
): { left: string; top: string } {
  const x = parseFloat(xPct)
  const y = parseFloat(yPct)
  const dx = 50 - x
  const dy = 50 - y
  let clampedT = t

  if (protectedZone) {
    // Same seat point → center segment as always, but stopped at the edge of the
    // protected rectangle (a standard ray/AABB slab test) instead of running
    // through it — the segment's t-interval inside the rect is [enter, exit];
    // if that interval falls within [0, t], clamp to its entry point. The
    // rectangle is centered on its OWN cx/cy (the pot/card-zone column), not
    // assumed to be the container's 50/50 center.
    const xLo = protectedZone.cxPct - protectedZone.halfWidthPct
    const xHi = protectedZone.cxPct + protectedZone.halfWidthPct
    const yLo = protectedZone.cyPct - protectedZone.halfHeightPct
    const yHi = protectedZone.cyPct + protectedZone.halfHeightPct

    const txEnter = dx === 0 ? -Infinity : Math.min((xLo - x) / dx, (xHi - x) / dx)
    const txExit = dx === 0 ? Infinity : Math.max((xLo - x) / dx, (xHi - x) / dx)
    const tyEnter = dy === 0 ? -Infinity : Math.min((yLo - y) / dy, (yHi - y) / dy)
    const tyExit = dy === 0 ? Infinity : Math.max((yLo - y) / dy, (yHi - y) / dy)

    const enter = Math.max(txEnter, tyEnter, 0)
    const exit = Math.min(txExit, tyExit, t)

    // Stop noticeably short of the rectangle's exact edge rather than flush against it —
    // otherwise the chip pile's own rendered footprint (not just its anchor point) still
    // visually touches the content it was supposed to clear.
    if (enter <= exit) clampedT = Math.max(0, enter - 0.09)
  }

  return { left: `${x + dx * clampedT}%`, top: `${y + dy * clampedT}%` }
}

/** One poker-chip disc: an alternating-wedge edge band (a
 *  `repeating-conic-gradient` — no extra DOM nodes needed for it), a solid
 *  gradient face, and a thin inner ring — a compact but genuinely chip-shaped
 *  glyph, not a hollow outline. */
export function PokerChip({
  tone,
  sizePx,
  style,
}: {
  tone: ChipTone
  sizePx: number
  style?: React.CSSProperties
}) {
  const p = CHIP_PALETTE[tone]
  const faceInset = Math.max(2, Math.round(sizePx * 0.17))
  return (
    <div
      aria-hidden
      className="absolute rounded-full"
      style={{
        width: sizePx,
        height: sizePx,
        background: `repeating-conic-gradient(${p.edgeA} 0deg 18deg, ${p.edgeB} 18deg 36deg)`,
        boxShadow: '0 2px 3px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.2)',
        ...style,
      }}
    >
      <div
        className="absolute rounded-full border"
        style={{ inset: faceInset, background: p.face, borderColor: p.ringColor }}
      >
        <div className="absolute inset-[2px] rounded-full border border-white/10" />
      </div>
    </div>
  )
}

export interface ChipStackProps {
  x: string
  y: string
  amount: number
  tone: ChipTone
  pullFactor: number
  protectedZone?: { cxPct: number; cyPct: number; halfWidthPct: number; halfHeightPct: number }
  sizePx: number
  /** When true, the pile mounts AT the seat (t=0) and travels to its resting
   *  spot over `travelDurationMs` — the seat→pot chip animation. Must only be
   *  passed `true` during real client playback (see the module doc above);
   *  omitted/false renders exactly as before (resting position, no transition). */
  animateIn?: boolean
  travelDurationMs?: number
  /** Mobile: the already-resolved resting position, in container percentages.
   *  When supplied it wins outright — `pullFactor`/`protectedZone` are not
   *  consulted, because the caller placed this chip on its own geometry band
   *  rather than by pulling it along the seat→center ray. Desktop omits it and
   *  keeps the original ray-and-clamp placement byte for byte. */
  at?: { x: string; y: string }
  /** Mobile: this seat's action verb (OPEN / 3-BET / CALL …), rendered BENEATH
   *  the amount instead of in the seat's own rail pod. On a phone the pod sits
   *  outside the rail where a third line would either collide with a
   *  neighbouring seat or run off the container; attached to the chip it stays
   *  next to the thing it describes and inside the felt. */
  actionLabel?: string
}

/** A small 2-chip pile (a diagonal overlap, not a flat stack) plus the
 *  commitment amount — immediately legible that this player has chips
 *  committed. Positioned purely from the seat-anchor → towardCenter vector
 *  every other geometric element uses; `sizePx` comes from the caller's
 *  layout config, never a hardcoded/per-breakpoint JSX literal. */
export function ChipStack({
  x,
  y,
  amount,
  tone,
  pullFactor,
  protectedZone,
  sizePx,
  animateIn = false,
  travelDurationMs = 450,
  at,
  actionLabel,
}: ChipStackProps) {
  const [settled, setSettled] = useState(!animateIn)

  useEffect(() => {
    if (!animateIn) {
      setSettled(true)
      return
    }
    setSettled(false)
    const raf = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateIn, x, y])

  // `at` is the resolved mobile band position. The seat point stays the
  // travel-in ORIGIN on both layouts, so the chip animation reads identically.
  const resting = at
    ? { left: at.x, top: at.y }
    : towardCenter(x, y, pullFactor, protectedZone)
  const origin = at ? { left: x, top: y } : towardCenter(x, y, 0, protectedZone)
  const pos = settled ? resting : origin
  const spread = Math.max(3, Math.round(sizePx * 0.22))

  return (
    <div
      data-tt="chip"
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-[2px]"
      style={{
        left: pos.left,
        top: pos.top,
        transition: animateIn ? `left ${travelDurationMs}ms ease-out, top ${travelDurationMs}ms ease-out` : undefined,
      }}
    >
      <div className="relative" style={{ width: sizePx + spread, height: sizePx + spread }}>
        <PokerChip tone={tone} sizePx={sizePx} style={{ left: 0, top: spread, opacity: 0.65 }} />
        <PokerChip tone={tone} sizePx={sizePx} style={{ left: spread, top: 0 }} />
      </div>
      <span
        className={cn(
          'text-[10px] font-bold tabular-nums leading-none whitespace-nowrap',
          CHIP_PALETTE[tone].text,
        )}
      >
        {formatBb(amount)}
      </span>
      {actionLabel && (
        <span className="text-[9px] font-bold uppercase leading-none tracking-wide whitespace-nowrap text-sky-300/90">
          {actionLabel}
        </span>
      )}
    </div>
  )
}

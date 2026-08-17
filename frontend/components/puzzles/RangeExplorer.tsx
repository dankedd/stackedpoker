'use client'

import { useState } from 'react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeroHandGrid } from './HeroHandGrid'
import { SourceChips, UnsourcedPanel } from './SourceChip'
import type { RangeExhibit, RangeExhibitKind } from '@/lib/puzzles/interactive/types'

/**
 * The range explorer.
 *
 * What this component does NOT do is the important part. A 13x13 hand grid is
 * the obvious way to render a range, and it is the wrong one here, because
 * Modern Poker Theory does not print a per-hand chart for BB vs BN at 30bb —
 * it prints the 49% and 64% aggregates in prose, with full charts at 25bb and
 * 40bb either side. Drawing a grid would mean deciding which specific hands
 * occupy that 64%, and that decision would be ours while looking like the
 * book's. The repo's own extracted chart data (lib/learn/bbDefenseComplete.ts)
 * is 100bb and states in its file comment that it must not be reused at another
 * depth, so it cannot stand in either.
 *
 * So the explorer renders what the source actually supports, at three different
 * confidence levels made visually distinct by `kind`:
 *   'aggregate'   — a whole-range percentage, shown as one headline figure.
 *   'composition' — a printed breakdown, shown as a stacked bar.
 *   'grid'        — a per-hand chart; supported by the type, unused by this
 *                   puzzle, and reachable the moment a reviewed extraction for
 *                   a spot exists.
 * Every exhibit that is missing something says so through `UnsourcedPanel`.
 */

const KIND_LABEL: Record<RangeExhibitKind, string> = {
  aggregate: 'Whole-range percentage',
  composition: 'Printed breakdown',
  grid: 'Per-hand chart',
}

/** Bucket colours, strongest to weakest. Ordered so the legend reads as a scale. */
const BAR_COLORS = [
  'bg-emerald-500/80',
  'bg-sky-500/70',
  'bg-amber-500/70',
  'bg-slate-500/60',
]

function RangeCard({ range, heroHand }: { range: RangeExhibit; heroHand?: string[] }) {
  const total = range.bars?.reduce((sum, b) => sum + b.pct, 0) ?? 0
  // Bars that don't sum to 100 are a real signal, not a rendering bug — the
  // button's exhibit is two figures from two tables. Show them proportionally
  // against a 100% track so the gap stays visible instead of being normalised away.
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5',
        range.seat === 'hero'
          ? 'border-violet-500/25 bg-violet-500/[0.05]'
          : 'border-white/10 bg-white/[0.025]'
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[14px] font-bold text-white">{range.label}</h4>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {KIND_LABEL[range.kind]}
          </p>
        </div>
        {range.headline && (
          <span className="font-mono text-2xl font-bold tabular-nums text-violet-300">{range.headline}</span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-slate-300">{range.description}</p>

      {range.headline && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
            style={{ width: `${parseFloat(range.headline)}%` }}
          />
        </div>
      )}

      {range.bars && range.bars.length > 0 && (
        <div className="mt-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
            {range.bars.map((bar, i) => (
              <div
                key={bar.label}
                className={cn('h-full', BAR_COLORS[i % BAR_COLORS.length])}
                style={{ width: `${bar.pct}%` }}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {range.bars.map((bar, i) => (
              <li key={bar.label}>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn('mt-1 h-2 w-2 shrink-0 rounded-sm', BAR_COLORS[i % BAR_COLORS.length])}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium text-slate-200">{bar.label}</span>
                  <span className="ml-auto shrink-0 font-mono text-[13px] font-bold tabular-nums text-white">
                    {bar.pct}%
                  </span>
                </div>
                {bar.note && <p className="ml-4 mt-0.5 text-[11px] text-slate-500">{bar.note}</p>}
              </li>
            ))}
          </ul>

          {total < 99.5 && (
            <p className="mt-3 text-[11px] italic text-slate-500">
              These add to {Math.round(total)}%, not 100% — the source prints only these figures for this range.
            </p>
          )}
        </div>
      )}

      {/* Hero's own hand located in the grid — shown only on the range Hero is
          actually in, and only as a position, never as a frequency. */}
      {range.seat === 'hero' && range.kind === 'aggregate' && heroHand && heroHand.length === 2 && (
        <HeroHandGrid heroHand={heroHand} label="Where your hand sits" className="mt-4" />
      )}

      {range.unsourced && <UnsourcedPanel notes={range.unsourced} className="mt-4" />}

      <SourceChips ids={range.sources} />
    </div>
  )
}

export function RangeExplorer({ ranges, heroHand }: { ranges: RangeExhibit[]; heroHand?: string[] }) {
  const [open, setOpen] = useState(false)

  // A puzzle with nothing to show here is a legitimate outcome, not a bug: some
  // claims the source states only in words have no percentage, breakdown or
  // chart behind them. An empty disclosure ("0") would read as a missing
  // exhibit rather than an absent one, so the control simply doesn't appear.
  if (ranges.length === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.06]"
      >
        <span className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
          <span className="text-[13px] font-semibold text-white">
            {open ? 'Hide the ranges' : 'Explore the ranges'}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-slate-500">{ranges.length}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ranges.map((range) => (
            <RangeCard key={range.id} range={range} heroHand={heroHand} />
          ))}
        </div>
      )}
    </div>
  )
}

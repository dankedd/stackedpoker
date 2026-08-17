'use client'

import { cn } from '@/lib/utils'
import { SourceChips } from './SourceChip'
import type { StatExhibit } from '@/lib/puzzles/interactive/types'

/**
 * A labelled set of source figures.
 *
 * The `scope` line is rendered directly under the caption, before any number,
 * and it is not collapsible. That placement is the point: these exhibits mix
 * whole-board averages, per-matchup sims and single-flop tables, and a reader
 * who sees "64%" without seeing what it was measured over has been given a
 * number they cannot use correctly.
 *
 * Rows without a `pct` render as a value only — several source figures are
 * comparisons ("51% vs 49%") or rates ("6.5bb/100") that a 0-100 bar would
 * misrepresent.
 */
export function StatExhibitCard({ exhibit, className }: { exhibit: StatExhibit; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-black/20 p-4', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">{exhibit.caption}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{exhibit.scope}</p>

      <ul className="mt-3.5 space-y-2.5">
        {exhibit.rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-slate-300">{row.label}</span>
              <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-white">{row.value}</span>
            </div>
            {row.pct !== undefined && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
                  style={{ width: `${Math.max(row.pct, 0.6)}%` }}
                />
              </div>
            )}
            {row.note && <p className="mt-1 text-[11px] text-slate-500">{row.note}</p>}
          </li>
        ))}
      </ul>

      <SourceChips ids={exhibit.sources} />
    </div>
  )
}

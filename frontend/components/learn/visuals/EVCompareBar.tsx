'use client'

import { cn } from '@/lib/utils'

export interface EVCompareEntry {
  id: string
  label: string
  ev: number
}

/**
 * Two (or more) labeled EV bars for comparing actions (BET vs CHECK, CALL vs
 * FOLD, a strategy's EV vs an alternative's). Never communicates "which is
 * better" or "indifferent" with color alone — every state carries a text
 * label and an icon glyph, per Module 10's accessibility requirement.
 */
export function EVCompareBar({
  entries,
  indifferent,
  currency = '$',
}: {
  entries: EVCompareEntry[]
  /** Whether the current set of entries counts as indifferent (all EVs equal within tolerance). */
  indifferent?: boolean
  currency?: string
}) {
  const maxAbs = Math.max(1, ...entries.map((e) => Math.abs(e.ev)))
  const best = Math.max(...entries.map((e) => e.ev))

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isBest = indifferent ? false : Math.abs(entry.ev - best) < 1e-9
        const widthPct = Math.min(100, (Math.abs(entry.ev) / maxAbs) * 100)
        return (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground/80">
                {entry.label}
                {isBest && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
                    Higher EV
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'font-black tabular-nums text-sm',
                  entry.ev > 0 ? 'text-emerald-400' : entry.ev < 0 ? 'text-rose-400' : 'text-muted-foreground',
                )}
              >
                {entry.ev >= 0 ? '+' : '−'}
                {currency}
                {Math.abs(entry.ev).toFixed(2)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  entry.ev >= 0
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    : 'bg-gradient-to-r from-rose-600 to-rose-400',
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
      {indifferent && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 py-1.5">
          <span aria-hidden className="text-violet-300">⚖</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-violet-300">Indifferent — equal EV</span>
        </div>
      )}
    </div>
  )
}

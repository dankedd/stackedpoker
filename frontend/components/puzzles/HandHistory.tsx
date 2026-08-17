'use client'

import { cn } from '@/lib/utils'
import { STREET_LABEL, STREET_ORDER, type Street } from '@/lib/puzzles/interactive/types'

/**
 * The action strip.
 *
 * Built from what has actually been played, so it can never describe a street
 * the learner has not reached — the same rule that governs the board itself.
 * Deliberately compact and scrollable rather than expanding: on a four-street
 * hand a full history would push the felt off the screen, and the table is the
 * thing this page exists to show.
 */

export interface HistoryLine {
  street: Street
  actor: string
  text: string
  isHero?: boolean
}

export function HandHistory({ lines, className }: { lines: HistoryLine[]; className?: string }) {
  if (lines.length === 0) return null

  const streets = STREET_ORDER.filter((s) => lines.some((l) => l.street === s))

  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/[0.02] p-4', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">Hand history</p>

      <div className="mt-3 max-h-[240px] space-y-3 overflow-y-auto pr-1">
        {streets.map((street) => (
          <div key={street}>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {STREET_LABEL[street]}
            </p>
            <ul className="mt-1 space-y-0.5">
              {lines
                .filter((l) => l.street === street)
                .map((line, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[12px]">
                    <span
                      className={cn(
                        'w-9 shrink-0 font-bold',
                        line.isHero ? 'text-violet-300' : 'text-slate-500'
                      )}
                    >
                      {line.actor}
                    </span>
                    <span className={cn('tabular-nums', line.isHero ? 'text-slate-200' : 'text-slate-400')}>
                      {line.text}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

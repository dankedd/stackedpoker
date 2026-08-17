'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STREET_LABEL, type Street } from '@/lib/puzzles/interactive/types'

/**
 * The street rail.
 *
 * Shows only the streets this hand actually plays. A rail that always printed
 * PRE-FLOP → FLOP → TURN → RIVER would promise a river that isn't coming: this
 * puzzle ends on the flop because that is where the source's analysis ends, and
 * the rail is the first place a learner would otherwise be misled about how much
 * hand is left.
 */
export function StreetProgress({
  streets,
  currentIndex,
  complete,
}: {
  streets: Street[]
  currentIndex: number
  complete: boolean
}) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Hand progress">
      {streets.map((street, i) => {
        const done = complete || i < currentIndex
        const active = !complete && i === currentIndex
        return (
          <li key={street} className="flex min-w-0 flex-1 items-center gap-1.5">
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors',
                active && 'border-violet-500/50 bg-violet-500/15',
                done && 'border-emerald-500/30 bg-emerald-500/10',
                !active && !done && 'border-white/[0.07] bg-white/[0.02]'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done && <Check className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />}
              <span
                className={cn(
                  'truncate text-[10px] font-bold uppercase tracking-[0.1em]',
                  active && 'text-violet-200',
                  done && 'text-emerald-300',
                  !active && !done && 'text-slate-600'
                )}
              >
                {STREET_LABEL[street]}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

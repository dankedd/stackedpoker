'use client'

/**
 * Pot readout — extracted out of `components/learn/visuals/PreflopTable.tsx`
 * (where it was previously inline) so it's a shared, reusable table
 * primitive. `pulse` drives the existing (previously unused) `.animate-allin-pulse`
 * keyframe from globals.css for an all-in event, instead of a new animation.
 */
import { cn } from '@/lib/utils'
import { formatBb } from './tableTokens'

export interface PotDisplayProps {
  potBb: number
  topPct: number
  pulse?: boolean
}

export function PotDisplay({ potBb, topPct, pulse = false }: PotDisplayProps) {
  if (potBb <= 0) return null
  return (
    <div
      className={cn(
        'absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5',
        pulse && 'animate-allin-pulse',
      )}
      style={{ top: `${topPct}%` }}
    >
      <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-amber-300/50">Pot</span>
      <span className="text-[13px] font-black tabular-nums text-amber-200 whitespace-nowrap">
        {formatBb(potBb)} BB
      </span>
    </div>
  )
}

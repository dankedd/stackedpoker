'use client'

import { cn } from '@/lib/utils'

interface EquityBarProps {
  /** Hero equity (0–100) */
  heroEquity: number
  heroLabel?: string
  villainLabel?: string
  /** Animate in on mount */
  animate?: boolean
  className?: string
}

/**
 * Horizontal split bar showing hero vs villain equity.
 * Used both as a standalone widget and embedded inside ConceptReveal when visual='equity_bar'.
 */
export function EquityBar({
  heroEquity,
  heroLabel = 'Hero',
  villainLabel = 'Villain',
  animate = true,
  className,
}: EquityBarProps) {
  const villainEquity = 100 - heroEquity

  const heroColor =
    heroEquity >= 60
      ? 'from-emerald-600 to-emerald-500'
      : heroEquity >= 40
      ? 'from-amber-600 to-amber-500'
      : 'from-rose-700 to-rose-600'

  const villainColor =
    villainEquity >= 60
      ? 'from-rose-600 to-rose-500'
      : villainEquity >= 40
      ? 'from-amber-700 to-amber-600'
      : 'from-slate-700 to-slate-600'

  return (
    <div className={cn('space-y-2', className)}>
      {/* Labels */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-emerald-400">{heroLabel}</span>
        <span className="text-rose-400/70">{villainLabel}</span>
      </div>

      {/* Bar */}
      <div className="relative h-6 rounded-full overflow-hidden bg-secondary/40 flex">
        {/* Hero segment */}
        <div
          className={cn(
            'h-full rounded-l-full bg-gradient-to-r transition-all',
            heroColor,
            animate && 'duration-700 ease-out',
          )}
          style={{ width: `${heroEquity}%` }}
        />
        {/* Villain segment */}
        <div
          className={cn(
            'h-full rounded-r-full bg-gradient-to-r flex-1 transition-all',
            villainColor,
            animate && 'duration-700 ease-out',
          )}
        />

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-background/50"
          style={{ left: `${heroEquity}%`, transform: 'translateX(-50%)' }}
        />

        {/* Percentage labels inside bar */}
        {heroEquity > 18 && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/90 tabular-nums pointer-events-none">
            {heroEquity.toFixed(1)}%
          </span>
        )}
        {villainEquity > 18 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/90 tabular-nums pointer-events-none">
            {villainEquity.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Equity bucket label */}
      <p className="text-[10px] text-muted-foreground/40 text-center">
        {heroEquity >= 75
          ? 'Strong advantage'
          : heroEquity >= 50
          ? 'Slight edge'
          : heroEquity >= 33
          ? 'Behind but playable'
          : 'Significant underdog'}
      </p>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface EquityBarProps {
  heroEquity: number          // 0–100
  heroLabel?: string
  villainLabel?: string
  heroColor?: string
  villainColor?: string
  animate?: boolean
  showNumbers?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function useCountUp(target: number, animate: boolean, durationMs = 800) {
  const [value, setValue] = useState(animate ? 0 : target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animate) { setValue(target); return }
    const start = performance.now()
    const from = 0
    function step(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / durationMs, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, animate, durationMs])

  return value
}

export function EquityBar({
  heroEquity,
  heroLabel = 'Hero',
  villainLabel = 'Villain',
  heroColor = 'from-emerald-500 to-teal-400',
  villainColor = 'from-red-500 to-rose-400',
  animate = true,
  showNumbers = true,
  size = 'md',
  className,
}: EquityBarProps) {
  const villainEquity = 100 - heroEquity
  const heroDisplay = useCountUp(heroEquity, animate)
  const villainDisplay = useCountUp(villainEquity, animate)

  const barH = size === 'sm' ? 'h-2.5' : size === 'lg' ? 'h-5' : 'h-3.5'
  const textSz = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div className={cn('space-y-2', className)}>
      {showNumbers && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className={cn('font-semibold text-emerald-300', textSz)}>{heroLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('font-semibold text-rose-300', textSz)}>{villainLabel}</span>
            <div className="h-2 w-2 rounded-full bg-red-400" />
          </div>
        </div>
      )}

      {/* Bar */}
      <div className={cn('relative flex w-full rounded-full overflow-hidden bg-secondary/30', barH)}>
        {/* Hero side */}
        <div
          className={cn('h-full rounded-l-full bg-gradient-to-r transition-all duration-700 ease-out', heroColor)}
          style={{ width: `${heroEquity}%` }}
        />
        {/* Gap divider */}
        <div className="w-0.5 bg-background/80 shrink-0 z-10" />
        {/* Villain side */}
        <div
          className={cn('h-full flex-1 rounded-r-full bg-gradient-to-l transition-all duration-700 ease-out', villainColor)}
        />
      </div>

      {showNumbers && (
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'font-black tabular-nums',
              textSz,
              heroEquity > 50 ? 'text-emerald-400' : 'text-emerald-400/60'
            )}
          >
            {heroDisplay}%
          </span>
          <span className={cn('font-medium text-muted-foreground/40', textSz)}>equity split</span>
          <span
            className={cn(
              'font-black tabular-nums',
              textSz,
              villainEquity > 50 ? 'text-rose-400' : 'text-rose-400/60'
            )}
          >
            {villainDisplay}%
          </span>
        </div>
      )}
    </div>
  )
}

// ── Compact inline variant ────────────────────────────────────────────────────

export function EquityBadge({
  heroEquity,
  className,
}: {
  heroEquity: number
  className?: string
}) {
  const color =
    heroEquity >= 65
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : heroEquity >= 50
      ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
      : heroEquity >= 35
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-red-500/30 bg-red-500/10 text-red-300'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums',
        color,
        className
      )}
    >
      {heroEquity}% equity
    </span>
  )
}

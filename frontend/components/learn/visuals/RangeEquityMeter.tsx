'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Range Equity Meter ───────────────────────────────────────────────────────
// A range-vs-range EQUITY split bar — deliberately distinct from NutAdvantageMeter
// (which specifically visualizes "nut advantage," a different poker concept). Two
// arbitrary, caller-labeled sides and a plain equity percentage, no "nuts" framing.

interface RangeEquityMeterProps {
  aLabel: string
  bLabel: string
  /** Side A's equity %, 0-100. Side B is assumed to be 100 - aEquity. */
  aEquity: number
  animate?: boolean
  className?: string
}

export function RangeEquityMeter({ aLabel, bLabel, aEquity, animate = true, className }: RangeEquityMeterProps) {
  const [displayed, setDisplayed] = useState(animate ? 50 : aEquity)

  useEffect(() => {
    if (!animate) { setDisplayed(aEquity); return }
    const duration = 700
    const start = performance.now()
    const from = 50
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (aEquity - from) * eased)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [aEquity, animate])

  const aPct = Math.round(displayed * 10) / 10
  const bPct = Math.round((100 - displayed) * 10) / 10

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-violet-300">{aLabel}</span>
        <span className="font-semibold text-blue-300">{bLabel}</span>
      </div>

      <div className="relative h-5 rounded-full bg-secondary/30 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-violet-500/80 transition-all duration-700 ease-out"
          style={{ width: `${displayed}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-blue-500/70 transition-all duration-700 ease-out"
          style={{ width: `${100 - displayed}%` }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-0.5 bg-background/80 z-10" />
      </div>

      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
        <span className="text-violet-300">{aPct}%</span>
        <span className="text-blue-300">{bPct}%</span>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Nut Advantage Meter ───────────────────────────────────────────────────────
// Visualises which player holds more of the strongest hands on this board

interface NutAdvantageProps {
  /** Positive = IP has nut advantage, negative = OOP has nut advantage */
  advantage: number      // -100 to +100
  ipLabel?: string
  oopLabel?: string
  animate?: boolean
  showInterpretation?: boolean
  className?: string
}

function interpretAdvantage(adv: number): { text: string; detail: string } {
  const abs = Math.abs(adv)
  const side = adv > 0 ? 'IP' : 'OOP'
  if (abs < 10) return { text: 'Balanced', detail: 'Neither player holds a meaningful nut advantage.' }
  if (abs < 30) return { text: `Slight ${side} advantage`, detail: `${side} holds marginally more of the strongest hands on this board.` }
  if (abs < 60) return { text: `${side} nut advantage`, detail: `${side} has a clear nut advantage — larger bets and overbets become available.` }
  return { text: `Strong ${side} nut advantage`, detail: `${side} dominates the nut range here — expect polarized, overbet-heavy strategies.` }
}

export function NutAdvantageMeter({
  advantage,
  ipLabel = 'IP (BTN)',
  oopLabel = 'OOP (BB)',
  animate = true,
  showInterpretation = true,
  className,
}: NutAdvantageProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : advantage)

  useEffect(() => {
    if (!animate) { setDisplayed(advantage); return }
    const duration = 700
    const start = performance.now()
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(advantage * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [advantage, animate])

  const { text, detail } = interpretAdvantage(displayed)
  const centerPct = 50
  const barPct = centerPct + (displayed / 2) // advantage shifts the midpoint

  // Color: blue for IP, amber for OOP
  const ipColor = 'bg-blue-500'
  const oopColor = 'bg-amber-500'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold">{oopLabel}</span>
        <span className="font-semibold text-foreground/70">{text}</span>
        <span className="font-semibold">{ipLabel}</span>
      </div>

      {/* Bi-directional bar */}
      <div className="relative h-4 rounded-full bg-secondary/30 overflow-hidden">
        {/* OOP portion */}
        <div
          className={cn('absolute left-0 top-0 h-full transition-all duration-700 ease-out', oopColor, 'opacity-80')}
          style={{ width: `${100 - barPct}%` }}
        />
        {/* IP portion */}
        <div
          className={cn('absolute right-0 top-0 h-full transition-all duration-700 ease-out', ipColor, 'opacity-80')}
          style={{ width: `${barPct}%` }}
        />
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-0.5 bg-background/80 z-10" />
      </div>

      <div className="flex items-center justify-between">
        <span className={cn(
          'text-[10px] font-bold tabular-nums',
          displayed < 0 ? 'text-amber-400' : 'text-muted-foreground/40'
        )}>
          {displayed < 0 ? `${Math.abs(displayed)}%` : '—'}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full bg-amber-500/70" />
            OOP nuts
          </span>
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full bg-blue-500/70" />
            IP nuts
          </span>
        </div>
        <span className={cn(
          'text-[10px] font-bold tabular-nums',
          displayed > 0 ? 'text-blue-400' : 'text-muted-foreground/40'
        )}>
          {displayed > 0 ? `${displayed}%` : '—'}
        </span>
      </div>

      {showInterpretation && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-3 py-2.5">
          <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        </div>
      )}
    </div>
  )
}

// ── Range Coverage Bar ────────────────────────────────────────────────────────
// Shows how much of the range falls into each equity bucket

interface EquityBucket {
  label: string
  pct: number
  color: string
}

interface RangeCoverageBarProps {
  buckets: EquityBucket[]
  title?: string
  className?: string
}

export function RangeCoverageBar({ buckets, title, className }: RangeCoverageBarProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
          {title}
        </p>
      )}

      <div className="flex h-5 rounded-full overflow-hidden gap-px">
        {buckets.map((b) => (
          <div
            key={b.label}
            className={cn('h-full transition-all duration-500', b.color)}
            style={{ width: `${b.pct}%` }}
            title={`${b.label}: ${b.pct}%`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {buckets.map((b) => (
          <span key={b.label} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <div className={cn('h-1.5 w-3 rounded-full', b.color)} />
            {b.label} ({b.pct}%)
          </span>
        ))}
      </div>
    </div>
  )
}

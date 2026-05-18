'use client'

import { cn } from '@/lib/utils'

type AdvantageLevel = 'hero_large' | 'hero_small' | 'neutral' | 'villain_small' | 'villain_large'

interface NutAdvantageGaugeProps {
  /** -100 (all villain) → 0 (neutral) → +100 (all hero) */
  score: number
  heroLabel?: string
  villainLabel?: string
  caption?: string
  className?: string
}

/**
 * Radial/linear gauge showing nut advantage distribution.
 * score > 0  → hero has more nut combos
 * score < 0  → villain has more nut combos
 * score = 0  → neutral
 */
export function NutAdvantageGauge({
  score,
  heroLabel = 'Hero',
  villainLabel = 'Villain',
  caption,
  className,
}: NutAdvantageGaugeProps) {
  const clamped = Math.max(-100, Math.min(100, score))
  const pct = ((clamped + 100) / 200) * 100  // 0–100% left to right (50 = neutral)

  const level: AdvantageLevel =
    clamped >= 40
      ? 'hero_large'
      : clamped >= 15
      ? 'hero_small'
      : clamped <= -40
      ? 'villain_large'
      : clamped <= -15
      ? 'villain_small'
      : 'neutral'

  const levelMeta: Record<AdvantageLevel, { label: string; color: string; thumbColor: string }> = {
    hero_large:    { label: 'Clear Nut Advantage',   color: 'text-emerald-400', thumbColor: 'bg-emerald-500' },
    hero_small:    { label: 'Slight Nut Advantage',  color: 'text-emerald-400/70', thumbColor: 'bg-emerald-600' },
    neutral:       { label: 'Neutral',               color: 'text-muted-foreground/60', thumbColor: 'bg-slate-500' },
    villain_small: { label: 'Slight Nut Disadvantage', color: 'text-rose-400/70', thumbColor: 'bg-rose-600' },
    villain_large: { label: 'Clear Nut Disadvantage', color: 'text-rose-400', thumbColor: 'bg-rose-500' },
  }

  const meta = levelMeta[level]

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-emerald-400/80">{heroLabel}</span>
        <span className={cn('font-bold', meta.color)}>{meta.label}</span>
        <span className="text-rose-400/60">{villainLabel}</span>
      </div>

      {/* Track */}
      <div className="relative h-4 rounded-full bg-gradient-to-r from-rose-900/60 via-secondary/60 to-emerald-900/60 overflow-visible">
        {/* Centre tick */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/40" />

        {/* Thumb indicator */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-background shadow-lg transition-all duration-500',
            meta.thumbColor,
          )}
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>

      {/* Sub-labels */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/30">
        <span>Villain dominates</span>
        <span>Neutral</span>
        <span>Hero dominates</span>
      </div>

      {/* Caption */}
      {caption && (
        <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">{caption}</p>
      )}
    </div>
  )
}

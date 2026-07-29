'use client'

import { cn } from '@/lib/utils'

/**
 * A 0-100% frequency slider with a native range input (keyboard-operable by
 * default: arrow keys, Home/End, Page Up/Down) PLUS explicit tap +/- buttons,
 * per Module 10's mobile/accessibility requirement that no interaction may
 * require precise dragging. Shared by every Game Theory Foundations (Module
 * 10) interaction that lets the learner adjust a strategy frequency.
 */
export function FrequencySlider({
  label,
  value,
  onChange,
  disabled = false,
  step = 1,
  accent = 'violet',
}: {
  label: string
  /** 0-100 */
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  step?: number
  accent?: 'violet' | 'blue'
}) {
  function clamp(v: number) {
    return Math.max(0, Math.min(100, v))
  }

  const thumbColor = accent === 'blue' ? 'rgb(59,130,246)' : 'rgb(124,58,237)'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground/70 font-medium">{label}</span>
        <span className="font-black text-base tabular-nums text-foreground">{value.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className={cn(
            'shrink-0 h-8 w-8 rounded-full border border-border/40 bg-secondary/30 text-foreground/70',
            'flex items-center justify-center text-sm font-bold hover:border-violet-500/40 hover:text-violet-300 transition-colors',
            disabled && 'opacity-40 cursor-default',
          )}
        >
          −
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          aria-label={label}
          className={cn(
            'w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary/50',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/70',
            '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing',
            disabled && 'opacity-50 cursor-default',
          )}
          style={{
            background: `linear-gradient(to right, ${thumbColor} 0%, ${thumbColor} ${value}%, rgb(30,30,40) ${value}%, rgb(30,30,40) 100%)`,
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className={cn(
            'shrink-0 h-8 w-8 rounded-full border border-border/40 bg-secondary/30 text-foreground/70',
            'flex items-center justify-center text-sm font-bold hover:border-violet-500/40 hover:text-violet-300 transition-colors',
            disabled && 'opacity-40 cursor-default',
          )}
        >
          +
        </button>
      </div>
    </div>
  )
}

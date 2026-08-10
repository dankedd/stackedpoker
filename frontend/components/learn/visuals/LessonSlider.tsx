'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * LessonSlider — the single slider control for the whole Learn platform.
 *
 * WHY THIS EXISTS: sliders had drifted into four separate implementations
 * (bare `accent-violet-500`, two hand-rolled webkit/moz thumb variants, and a
 * `FrequencySlider` flanked by +/- stepper buttons). The stepper variant read
 * as "a number with two buttons" in QA — learners did not realise the control
 * could be dragged at all — and the bare `accent-*` ones inherited the
 * browser's default hairline track and small thumb, which is barely a better
 * signal. This component is the one affordance: big thumb, painted track with
 * a filled portion, and the live value attached to the thumb.
 *
 * The element that is actually dragged stays a native `<input type="range">`,
 * painted transparent and layered over the visual track. That is deliberate —
 * it keeps arrow-key/Home/End/PageUp-Down support, native touch dragging, and
 * `role="slider"` with correct value semantics for screen readers, none of
 * which a div-with-pointer-handlers would give for free. Thumb/track styling
 * lives in `.sp-slider` in globals.css (see the note there for why it cannot
 * be Tailwind arbitrary variants).
 */

const ACCENTS = {
  violet: { css: 'rgb(139, 92, 246)', fill: 'from-violet-600 to-violet-400', bubble: 'border-violet-500/40 bg-violet-500/15 text-violet-200' },
  blue: { css: 'rgb(59, 130, 246)', fill: 'from-blue-600 to-blue-400', bubble: 'border-blue-500/40 bg-blue-500/15 text-blue-200' },
  amber: { css: 'rgb(245, 158, 11)', fill: 'from-amber-600 to-amber-400', bubble: 'border-amber-500/40 bg-amber-500/15 text-amber-200' },
  emerald: { css: 'rgb(16, 185, 129)', fill: 'from-emerald-600 to-emerald-400', bubble: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' },
} as const

export type LessonSliderAccent = keyof typeof ACCENTS

export interface LessonSliderProps {
  /** Screen-reader name, and the visible caption unless `showLabel` is false. */
  label: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  accent?: LessonSliderAccent
  /**
   * Renders the value for the thumb bubble AND for `aria-valuetext`, so a
   * screen reader announces "65%" / "2.5bb" rather than a bare "65".
   */
  format?: (v: number) => string
  /** Evenly-spaced captions under the track. Keep to ~6 or fewer. */
  ticks?: (string | number)[]
  /** Set false when the caller already renders its own header row. */
  showLabel?: boolean
  /** Overrides the filled-track colour, e.g. EquityPredict's red->emerald ramp. */
  trackGradient?: string
  /**
   * Overrides the UNFILLED track colour. Only needed where the remainder is
   * meaningful rather than empty — RangeEquityPredict splits one track between
   * two players, so the right-hand side is "the other player's share", not slack.
   */
  trackBase?: string
  /**
   * Helper text under the track. Defaults to a generic drag hint, shown only
   * until first interaction; pass `null` to suppress it entirely.
   */
  hint?: string | null
  className?: string
}

/** Thumb diameter in px — mirrors `.sp-slider::-webkit-slider-thumb` in globals.css. */
const THUMB_PX = 24

export function LessonSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  accent = 'violet',
  format,
  ticks,
  showLabel = true,
  trackGradient,
  trackBase,
  hint,
  className,
}: LessonSliderProps) {
  const [touched, setTouched] = useState(false)
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const tone = ACCENTS[accent]
  const fmt = format ?? ((v: number) => String(Math.round(v)))
  const display = fmt(value)

  // Guard against a zero-width range (min === max), which would divide by zero
  // and NaN the thumb position rather than simply pinning it.
  const span = max - min
  const pct = span > 0 ? ((value - min) / span) * 100 : 0

  // Keep the bubble centred over the thumb: a range thumb's centre travels
  // only across (trackWidth - thumbWidth), so a naive `left: pct%` drifts by up
  // to half a thumb at the ends. Sign is folded into the operator because
  // `calc(65% + -3.6px)`, while legal, is needlessly hostile to read in devtools.
  const nudgePx = Number(((0.5 - pct / 100) * THUMB_PX).toFixed(2))
  const thumbOffset = `calc(${pct}% ${nudgePx < 0 ? '-' : '+'} ${Math.abs(nudgePx)}px)`

  const showHint = hint !== null && !touched && !disabled
  const hintText = hint ?? 'Drag to adjust'

  function commit(next: number) {
    if (!touched) setTouched(true)
    onChange(next)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/70 font-medium">{label}</span>
          <span className="font-black text-base tabular-nums text-foreground">{display}</span>
        </div>
      )}

      {/* Bubble + track + input share one positioning context. pt-7 reserves the
          bubble's row so it never overlaps whatever sits above the slider. */}
      <div className="relative pt-7">
        {/* Value bubble, pinned to the thumb */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 -translate-x-1/2 transition-[left] duration-75"
          style={{ left: thumbOffset }}
        >
          <span
            className={cn(
              'inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums whitespace-nowrap',
              tone.bubble,
              disabled && 'opacity-50',
            )}
          >
            {display}
          </span>
        </div>

        {/* Painted track (visual only — the input above it is transparent) */}
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-[calc(1.75rem+1.125rem)] -translate-y-1/2 h-2 rounded-full overflow-hidden',
            !trackBase && 'bg-secondary/60',
          )}
          style={trackBase ? { background: trackBase } : undefined}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-75',
              !trackGradient && `bg-gradient-to-r ${tone.fill}`,
              disabled && 'opacity-50',
            )}
            style={{ width: `${pct}%`, ...(trackGradient ? { background: trackGradient } : {}) }}
          />
        </div>

        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => commit(Number(e.target.value))}
          onPointerDown={() => setTouched(true)}
          onKeyDown={() => setTouched(true)}
          aria-label={label}
          aria-valuetext={display}
          aria-describedby={showHint ? hintId : undefined}
          className={cn('sp-slider relative block', showHint && 'sp-slider-nudge')}
          style={{ ['--sp-slider-accent' as string]: tone.css }}
        />

        {ticks && ticks.length > 0 && (
          <div aria-hidden className="flex justify-between text-[9px] text-muted-foreground/30 font-mono -mt-1">
            {ticks.map((t, i) => (
              <span key={`${t}-${i}`}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {showHint && (
        <p id={hintId} className="text-center text-[10px] text-muted-foreground/40 italic">
          {hintText}
        </p>
      )}
    </div>
  )
}

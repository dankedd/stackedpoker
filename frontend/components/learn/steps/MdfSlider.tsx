'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { alpha as engineAlpha, mdf as engineMdf, potOddsRequiredEquity } from '@/lib/learn/gameTheoryEngine'

// ── Math helpers ──────────────────────────────────────────────────────────────
// Delegates to gameTheoryEngine.ts's canonical, tested alpha()/mdf() (pot=1,
// bet=betPct/100) rather than reimplementing the formula locally — closes a
// pre-existing duplication between this file and gameTheoryEngine.ts (Module
// 12 architecture, Section 3.1). Output is numerically identical to the
// previous local implementation; only the source of truth changed.

/** alpha  = bet / (pot + bet)  — fold frequency needed for bluff break-even */
function calcAlpha(betPct: number): number {
  return engineAlpha(1, betPct / 100) * 100
}

/** MDF = 1 - alpha = pot / (pot + bet) */
function calcMdf(betPct: number): number {
  return engineMdf(1, betPct / 100) * 100
}

/** Pot odds a call is getting at this bet-size — distinct from alpha (Module 12, Lesson 2). */
function calcPotOdds(betPct: number): number {
  return potOddsRequiredEquity(1, betPct / 100) * 100
}

/** Value:bluff ratio a polarized range needs at this Alpha — the bluff share IS
 *  the Alpha number (Module 12, Lesson 2), restated as a simplified small-integer
 *  ratio (e.g. 75/25 -> "3 : 1") when the numbers reduce cleanly, otherwise as
 *  plain percentages. */
function valueBluffRatioLabel(alphaPct: number): string {
  const bluffPct = alphaPct
  const valuePct = 100 - bluffPct
  const bluffRounded = Math.round(bluffPct)
  const valueRounded = 100 - bluffRounded
  if (bluffRounded <= 0) return 'All value — no bluffs needed'
  if (valueRounded <= 0) return 'All bluffs'
  // Search small-integer ratios (up to 1:8) for the closest match to the UNROUNDED
  // value:bluff fraction — rounding both sides to whole percent first (e.g. 66.7/33.3
  // -> 67/33) breaks clean book ratios like 2:1, since gcd(67,33) = 1. A half-pot bet
  // must read "2 : 1", not "67% : 33%".
  let best: { v: number; b: number; error: number } | null = null
  for (let b = 1; b <= 8; b++) {
    for (let v = 1; v <= 8; v++) {
      const candidatePct = (b / (v + b)) * 100
      const error = Math.abs(candidatePct - bluffPct)
      if (!best || error < best.error) best = { v, b, error }
    }
  }
  if (best && best.error <= 1.5) return `${best.v} : ${best.b} (value : bluff)`
  return `${valueRounded}% : ${bluffRounded}% (value : bluff)`
}

/** Human-readable bet size label */
function betLabel(pct: number): string {
  if (pct === 33) return '1/3 pot'
  if (pct === 50) return 'Half pot'
  if (pct === 67) return '2/3 pot'
  if (pct === 75) return '3/4 pot'
  if (pct === 100) return 'Pot-sized'
  if (pct === 150) return '1.5× pot'
  if (pct === 200) return '2× pot (overbet)'
  return `${pct}% pot`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GaugeBar({
  value,
  color,
  label,
  sublabel,
}: {
  value: number
  color: string
  label: string
  sublabel: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground/70 font-medium">{label}</span>
        <span className={cn('font-black text-base tabular-nums', color)}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 rounded-full bg-secondary/40 overflow-hidden relative">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-200',
            color === 'text-emerald-400'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
              : 'bg-gradient-to-r from-rose-600 to-rose-400',
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/40">{sublabel}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MdfSliderProps {
  step: LessonStep
  onAnswer: (value: number, timeMs: number) => void
  disabled?: boolean
}

export function MdfSlider({ step, onAnswer, disabled = false }: MdfSliderProps) {
  const mountTime = useRef(Date.now())
  const initialBet = step.mdf_slider_initial_bet_pct ?? 50
  const [betPct, setBetPct] = useState(initialBet)
  const [submitted, setSubmitted] = useState(false)
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setBetPct(step.mdf_slider_initial_bet_pct ?? 50)
    setSubmitted(false)
    setInteracted(false)
  }, [step.id, step.mdf_slider_initial_bet_pct])

  const alpha = calcAlpha(betPct)
  const mdf = calcMdf(betPct)
  const potOdds = calcPotOdds(betPct)
  const variant = step.mdf_slider_variant ?? 'standard'

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled || submitted) return
    setBetPct(Number(e.target.value))
    setInteracted(true)
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current
    // Submit MDF as the answer value
    onAnswer(mdf, elapsed)
  }

  // Common bet size presets
  const PRESETS = [33, 50, 67, 75, 100, 150, 200]

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Question */}
      {step.mdf_slider_question && (
        <div className="text-center space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60">
            Interactive Explorer
          </p>
          <p className="text-base font-semibold text-foreground">
            {step.mdf_slider_question}
          </p>
        </div>
      )}

      {/* Main slider card */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
        {/* Bet size label + value */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bet size</span>
          <span className="text-lg font-black text-foreground tabular-nums">
            {betLabel(betPct)}
          </span>
        </div>

        {/* Slider */}
        <div className="space-y-3">
          <input
            type="range"
            min={10}
            max={200}
            step={1}
            value={betPct}
            disabled={disabled || submitted}
            onChange={handleChange}
            className={cn(
              'w-full h-2 rounded-full appearance-none cursor-pointer',
              'bg-secondary/50',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-violet-500',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-300',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/40',
              '[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing',
              '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
              (disabled || submitted) && 'opacity-50 cursor-default',
            )}
            style={{
              background: `linear-gradient(to right, rgb(124,58,237) 0%, rgb(124,58,237) ${((betPct - 10) / 190) * 100}%, rgb(30,30,40) ${((betPct - 10) / 190) * 100}%, rgb(30,30,40) 100%)`,
            }}
          />

          {/* Preset buttons */}
          <div className="flex gap-1.5 flex-wrap justify-center">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled || submitted}
                onClick={() => {
                  setBetPct(p)
                  setInteracted(true)
                }}
                className={cn(
                  'text-[10px] px-2.5 py-1 rounded-full border transition-all duration-100',
                  betPct === p
                    ? 'border-violet-500/60 bg-violet-500/20 text-violet-300 font-semibold'
                    : 'border-border/40 bg-secondary/30 text-muted-foreground/50 hover:border-violet-500/30 hover:text-violet-400/80',
                  (disabled || submitted) && 'opacity-40 cursor-default',
                )}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

        {/* Live calculations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <GaugeBar
            value={mdf}
            color="text-emerald-400"
            label="MDF (Minimum Defense Frequency)"
            sublabel="Fraction of range you must continue"
          />
          <GaugeBar
            value={alpha}
            color="text-rose-400"
            label="Alpha (Required Fold Frequency)"
            sublabel="How often villain must fold for bluff profit"
          />
        </div>

        {/* Module 12, Lessons 1-2 ("full_cascade" variant) — two more readouts from the SAME
           slider position: pot odds (a genuinely different number from Alpha, Ch.2 Table 14 /
           Ch.10 p.600-602) and the value:bluff ratio a polarized range needs at this size. */}
        {variant === 'full_cascade' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <GaugeBar
              value={potOdds}
              color="text-sky-400"
              label="Pot Odds Offered"
              sublabel="Price a call is getting on this bet"
            />
            <div className="space-y-1.5" role="group" aria-label={`Value to bluff ratio: ${valueBluffRatioLabel(alpha)}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70 font-medium">Value:Bluff Ratio</span>
              </div>
              <div className="h-3 rounded-full bg-secondary/40 overflow-hidden relative flex">
                <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400" style={{ width: `${100 - Math.round(alpha)}%` }} />
                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${Math.round(alpha)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground/40 tabular-nums">{valueBluffRatioLabel(alpha)}</p>
            </div>
          </div>
        )}

        {/* Formula display */}
        <div
          className={cn(
            'rounded-xl bg-secondary/20 border px-4 py-3 space-y-1.5',
            step.mdf_slider_framing === 'flop' ? 'border-dashed border-amber-500/30' : 'border-border/20',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Formula
          </p>
          <div className="flex flex-col sm:flex-row gap-2 text-xs font-mono">
            <span className="text-emerald-400/80">
              MDF = {betPct}% / (100% + {betPct}%) ={' '}
              <strong>{mdf.toFixed(1)}%</strong>
            </span>
            <span className="text-muted-foreground/30 hidden sm:inline">·</span>
            <span className="text-rose-400/80">
              α = 1 − MDF = <strong>{alpha.toFixed(1)}%</strong>
            </span>
          </div>
          {/* Module 11, Lesson 4: on the flop, both of Alpha/MDF's underlying assumptions
             (a checked-back hand's EV is exactly 0; a called bluff always loses everything)
             are only approximately true — a "bluff" often keeps backdoor equity, so this
             number is a well-informed starting point, not a hard target the way it is on
             the river. The dashed border above is the same signal made visual. */}
          {step.mdf_slider_framing === 'flop' && (
            <p className="text-[10px] text-amber-400/70 italic pt-0.5">
              Flop/turn: this line is an estimate, not a hard rule — a real "bluff" here often keeps some
              backdoor equity, so the true number you need is usually a little lower than this.
            </p>
          )}
        </div>
      </div>

      {/* Exploration hint */}
      {!submitted && !interacted && (
        <p className="text-center text-xs text-muted-foreground/40 italic">
          Drag the slider or pick a preset to explore how bet size affects MDF and α
        </p>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={disabled || submitted}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2',
          'rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {!(submitted || disabled) && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
        {submitted ? 'Submitted' : 'Lock In My Answer'}
      </button>
    </div>
  )
}

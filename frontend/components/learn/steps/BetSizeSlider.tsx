'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

// ── Common bet-size anchors ────────────────────────────────────────────────────

const ANCHOR_SIZES = [
  { label: '25%', pct: 25 },
  { label: '33%', pct: 33 },
  { label: '50%', pct: 50 },
  { label: '67%', pct: 67 },
  { label: '75%', pct: 75 },
  { label: 'Pot', pct: 100 },
  { label: '125%', pct: 125 },
  { label: '150%', pct: 150 },
]

function mdfForSize(pct: number): number {
  // MDF = pot / (pot + bet) = 1 / (1 + pct/100)
  return Math.round((1 / (1 + pct / 100)) * 100)
}

function alphaForSize(pct: number): number {
  // alpha = bet / (pot + bet) = (pct/100) / (1 + pct/100)
  return Math.round(((pct / 100) / (1 + pct / 100)) * 100)
}

function sizeLabel(pct: number): string {
  if (pct < 28) return 'Micro bet'
  if (pct < 42) return 'Small bet'
  if (pct < 60) return 'Half-pot'
  if (pct < 80) return 'Medium bet'
  if (pct < 110) return 'Pot-sized'
  return 'Overbet'
}

function sizeColor(pct: number): string {
  if (pct < 42) return 'text-sky-400'
  if (pct < 80) return 'text-emerald-400'
  if (pct < 110) return 'text-amber-400'
  return 'text-orange-400'
}

interface BetSizeSliderProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function BetSizeSlider({ step, onAnswer, disabled = false }: BetSizeSliderProps) {
  const mountTime = useRef(Date.now())
  const [sizePct, setSizePct] = useState(50)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setSizePct(50)
    setSubmitted(false)
  }, [step.id])

  const options = step.options ?? []

  function handleAnchor(pct: number) {
    if (disabled || submitted) return
    setSizePct(pct)
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current

    // Map the chosen size to the closest option by label/quality
    // The option ids should map to recognisable size names like 'small','half','pot','overbet'
    let bestOption = options[0]
    if (options.length > 0) {
      // Find closest match by parsing option label for a pct hint
      let minDelta = Infinity
      for (const opt of options) {
        const match = opt.label.match(/(\d+)/)
        if (match) {
          const delta = Math.abs(parseInt(match[1]) - sizePct)
          if (delta < minDelta) { minDelta = delta; bestOption = opt }
        }
      }
      // Fallback: use option order by size bucket
      if (minDelta === Infinity) {
        const buckets = ['small', 'half', 'medium', 'pot', 'overbet']
        const bucket = sizePct < 42 ? 'small' : sizePct < 60 ? 'half' : sizePct < 80 ? 'medium' : sizePct < 110 ? 'pot' : 'overbet'
        bestOption = options.find(o => buckets.some(b => o.id.includes(b) || o.label.toLowerCase().includes(b))) ?? options[0]
      }
    }

    onAnswer(bestOption?.id ?? 'custom', elapsed)
  }

  const mdf = mdfForSize(sizePct)
  const alpha = alphaForSize(sizePct)
  const potBb = step.pot_bb ?? 10

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Decision label */}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
          Choose sizing
        </p>
        <p className="text-base font-semibold text-foreground">How much do you bet?</p>
      </div>

      {/* Visual result */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        {/* Big number display */}
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-3xl font-black tabular-nums', sizeColor(sizePct))}>
              {sizePct}%
            </p>
            <p className={cn('text-sm font-semibold mt-0.5', sizeColor(sizePct))}>
              {sizeLabel(sizePct)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-muted-foreground/50">
              Bet:{' '}
              <span className="font-bold text-foreground">
                {((sizePct / 100) * potBb).toFixed(1)}bb
              </span>
            </p>
            <p className="text-xs text-muted-foreground/50">
              Total pot:{' '}
              <span className="font-bold text-amber-300/80">
                {(potBb + (sizePct / 100) * potBb * 2).toFixed(1)}bb
              </span>
            </p>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={10}
            max={200}
            step={1}
            value={sizePct}
            disabled={disabled || submitted}
            onChange={e => setSizePct(Number(e.target.value))}
            className={cn(
              'w-full accent-violet-500 cursor-pointer',
              (disabled || submitted) && 'cursor-default opacity-50'
            )}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
            <span>10%</span>
            <span>50%</span>
            <span>Pot</span>
            <span>150%</span>
            <span>200%</span>
          </div>
        </div>

        {/* MDF / Alpha row */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/20">
          <div className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/60 mb-0.5">
              MDF
            </p>
            <p className="text-lg font-black text-violet-300 tabular-nums">{mdf}%</p>
            <p className="text-[9px] text-muted-foreground/40">must defend</p>
          </div>
          <div className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/8 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/60 mb-0.5">
              Alpha
            </p>
            <p className="text-lg font-black text-amber-300 tabular-nums">{alpha}%</p>
            <p className="text-[9px] text-muted-foreground/40">fold needed</p>
          </div>
        </div>
      </div>

      {/* Quick-pick anchors */}
      <div className="grid grid-cols-4 gap-1.5">
        {ANCHOR_SIZES.map(({ label, pct }) => (
          <button
            key={label}
            type="button"
            disabled={disabled || submitted}
            onClick={() => handleAnchor(pct)}
            className={cn(
              'rounded-lg py-2 text-[11px] font-bold border transition-all duration-150',
              sizePct === pct
                ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
                : 'border-border/30 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:border-border/50',
              (disabled || submitted) && 'cursor-default opacity-50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* If the step also has option buttons as alternative UI */}
      {options.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/30 text-center">
            Or select directly
          </p>
          <div className="grid grid-cols-2 gap-2">
            {options.map(opt => {
              const active = submitted

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled || submitted}
                  onClick={() => {
                    if (disabled || submitted) return
                    setSubmitted(true)
                    const elapsed = Date.now() - mountTime.current
                    onAnswer(opt.id, elapsed)
                  }}
                  className={cn(
                    'rounded-xl px-3 py-3 text-xs font-semibold border text-left transition-all duration-150',
                    'border-border/40 bg-secondary/30 text-muted-foreground',
                    'hover:bg-secondary/60 hover:border-violet-500/25 hover:text-foreground',
                    active && 'opacity-50 cursor-default'
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
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
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
        )}
      >
        {!submitted && !disabled && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
        {submitted ? 'Submitted' : `Lock in ${sizePct}% sizing`}
      </button>
    </div>
  )
}

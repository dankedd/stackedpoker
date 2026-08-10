'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { minimumBetToDenyEquity } from '@/lib/learn/gameTheoryEngine'
import { TRAP_CURVE_DATA } from '@/lib/learn/module12Content'
import { LessonSlider } from '@/components/learn/visuals/LessonSlider'

interface RiverSizingCalculatorProps {
  step: LessonStep
  onAnswer: (response: { minimumBetGuessPct: number }, timeMs: number) => void
  disabled?: boolean
}

function fmtBet(fraction: number): string {
  if (!isFinite(fraction)) return 'undefined'
  return `${(fraction * 100).toFixed(1)}%`
}

/**
 * Module 12, Lesson 9 ("The River's Blunt Instruments") — the minimum-bet-to-deny-equity
 * calculator (Ch.14 pp.786-789) plus the trap-capped EV curve (Diagrams 132-133). Pattern
 * reused from PotOddsExplorer's slider convention; the trap-cap curve has no existing analog
 * (no chart-rendering component exists in this codebase) and defaults to an accessible data
 * table, per Part 3A Section 11.6 — never a chart-only presentation.
 */
export function RiverSizingCalculator({ step, onAnswer, disabled = false }: RiverSizingCalculatorProps) {
  const mountTime = useRef(Date.now())
  const fixedEquityPct = step.river_calc_opponent_equity_pct ?? 25
  const trapPct = step.river_calc_trap_pct ?? 0
  const tolerance = step.river_calc_tolerance ?? 0.05

  const correctMinBet = minimumBetToDenyEquity(fixedEquityPct / 100)

  const [guess, setGuess] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [exploreEquity, setExploreEquity] = useState(fixedEquityPct)

  useEffect(() => {
    mountTime.current = Date.now()
    setGuess('')
    setSubmitted(false)
    setExploreEquity(fixedEquityPct)
  }, [step.id, fixedEquityPct])

  function submit() {
    if (disabled || submitted || guess === '') return
    setSubmitted(true)
    onAnswer({ minimumBetGuessPct: Number(guess) }, Date.now() - mountTime.current)
  }

  const withinTolerance = submitted && Math.abs(Number(guess) / 100 - correctMinBet) <= Math.max(0.02, correctMinBet * tolerance)
  const exploreMinBet = minimumBetToDenyEquity(exploreEquity / 100)
  const curve = trapPct === 10 ? TRAP_CURVE_DATA.tenPctTraps : TRAP_CURVE_DATA.noTraps

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.river_calc_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.river_calc_prompt}</p>
      )}

      {/* Minimum-bet-to-deny computation */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Villain&apos;s equity against your range: <span className="font-black text-foreground">{fixedEquityPct}%</span>
        </p>
        <p className="text-center text-[11px] text-muted-foreground/50 font-mono">B = EQ ÷ (1 − 2×EQ)</p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={guess}
            disabled={disabled || submitted}
            onChange={(e) => setGuess(e.target.value)}
            className="flex-1 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-sm tabular-nums text-foreground disabled:opacity-60"
            placeholder="Minimum bet, as % of pot"
          />
          <button
            type="button"
            disabled={disabled || submitted || guess === ''}
            onClick={submit}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              submitted || disabled || guess === ''
                ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white',
            )}
          >
            {submitted ? 'Submitted' : 'Reveal'}
          </button>
        </div>
        {submitted && (
          <p role="status" className={cn('text-center text-xs font-semibold', withinTolerance ? 'text-emerald-400' : 'text-amber-400')}>
            Actual minimum: {fmtBet(correctMinBet)} of the pot {withinTolerance ? '— within tolerance' : `— your guess: ${guess}%`}
          </p>
        )}
      </div>

      {/* Free-exploration slider — feel the formula approach its undefined boundary at 50% */}
      <div className="rounded-2xl border border-border/30 bg-card/60 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/70">Explore: drag opponent equity toward 50%</p>
        <LessonSlider
          label="Villain's equity, as a percentage"
          value={exploreEquity}
          onChange={setExploreEquity}
          min={1}
          max={60}
          step={1}
          disabled={disabled}
          showLabel={false}
          format={(v) => `${v}%`}
          hint="Drag to explore different equities"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/60">Equity: <span className="font-bold text-foreground tabular-nums">{exploreEquity}%</span></span>
          {exploreEquity >= 50 ? (
            <span role="status" className="font-semibold text-rose-400">Undefined past 50% equity — no bet-size can profitably deny a genuine coinflip</span>
          ) : (
            <span className="font-bold text-violet-300 tabular-nums">Min bet: {fmtBet(exploreMinBet)}</span>
          )}
        </div>
      </div>

      {/* Accessible data table — the DEFAULT presentation, per Part 3A Section 11.6, never chart-only */}
      <div className="rounded-2xl border border-border/30 bg-card/60 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/70">
          EV vs. bet-size — {curve.trapPct}% traps in Villain&apos;s range {'peakSPR' in curve ? `(peaks around SPR ${curve.peakSPR}, then declines)` : '(rises then flattens)'}
        </p>
        <table className="w-full text-xs">
          <caption className="sr-only">EV as a percentage of the pot, by bet-size multiple of the pot, at {curve.trapPct}% traps</caption>
          <thead>
            <tr className="text-muted-foreground/50">
              <th scope="col" className="text-left font-semibold py-1">Bet-size (× pot)</th>
              <th scope="col" className="text-right font-semibold py-1">EV (% of pot)</th>
            </tr>
          </thead>
          <tbody>
            {curve.points.map((p) => (
              <tr key={p.betSizeMultiple} className="border-t border-border/20">
                <td className="py-1.5 tabular-nums text-foreground">{p.betSizeMultiple === 0 ? 'Check (0x)' : `${p.betSizeMultiple}x`}</td>
                <td className="py-1.5 tabular-nums text-right font-bold text-foreground">{p.evPctOfPot}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {'peakSPR' in curve && (
          <p className="text-[11px] text-rose-400/80 italic">
            Past SPR {curve.peakSPR}, EV declines — a non-all-in overbet gives Villain&apos;s traps a live check-raise option.
          </p>
        )}
      </div>
    </div>
  )
}
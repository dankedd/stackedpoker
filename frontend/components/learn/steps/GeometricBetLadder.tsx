'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { geometricBetSizing } from '@/lib/learn/gameTheoryEngine'
import { PotDisplay } from '@/components/learn/steps/PotDisplay'

interface GeometricBetLadderProps {
  step: LessonStep
  onAnswer: (response: { rGuess: number; betFractionGuess: number }, timeMs: number) => void
  disabled?: boolean
}

export interface GeometricBetLadderRung {
  street: number
  startPot: number
  bet: number
  endPot: number
}

/** Simulates the street-by-street ladder from a chosen (constant) bet-fraction — used both for
 *  the geometric-sizing rungs and the optional flat-sizing comparison overlay. */
function buildLadder(startingPot: number, betFraction: number, streets: number): GeometricBetLadderRung[] {
  const rungs: GeometricBetLadderRung[] = []
  let pot = startingPot
  for (let s = 1; s <= streets; s++) {
    const bet = pot * betFraction
    const endPot = pot + 2 * bet
    rungs.push({ street: s, startPot: pot, bet, endPot })
    pot = endPot
  }
  return rungs
}

function fmt(n: number): string {
  return n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(0)}`
}

/**
 * Module 12, Lesson 6 ("The Geometry of Maximum Pressure") — builds the book's own multi-street
 * geometric bet-sizing sequence (Ch.10 pp.612-614) from a starting pot, effective (remaining)
 * stack, and street count. Pattern reused from PotOddsExplorer's slider/PotDisplay/numeric-
 * challenge-then-reveal convention — no existing component builds a multi-street bet ladder, so
 * this is one of Module 12's three approved new components (Part 3A, Section 3.3).
 */
export function GeometricBetLadder({ step, onAnswer, disabled = false }: GeometricBetLadderProps) {
  const mountTime = useRef(Date.now())
  const startingPot = step.geometric_ladder_starting_pot ?? 70
  const effectiveStack = step.geometric_ladder_effective_stack ?? 965
  const streets = step.geometric_ladder_streets ?? 3
  const tolerance = step.geometric_ladder_tolerance ?? 0.05

  const { growthRate: correctR, betFraction: correctBetFraction } = geometricBetSizing(startingPot, effectiveStack, streets)

  const [phase, setPhase] = useState<'r' | 'fraction' | 'ladder'>('r')
  const [rGuess, setRGuess] = useState('')
  const [fractionGuess, setFractionGuess] = useState('')
  const [showFlatOverlay, setShowFlatOverlay] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setPhase('r')
    setRGuess('')
    setFractionGuess('')
    setShowFlatOverlay(false)
  }, [step.id])

  function revealR() {
    if (disabled || rGuess === '') return
    setPhase('fraction')
  }

  function revealFraction() {
    if (disabled || fractionGuess === '') return
    setPhase('ladder')
    const rNum = Number(rGuess)
    const fracNum = Number(fractionGuess) / 100
    onAnswer({ rGuess: rNum, betFractionGuess: fracNum }, Date.now() - mountTime.current)
  }

  const rWithinTolerance = phase !== 'r' && Math.abs(Number(rGuess) - correctR) <= correctR * tolerance
  const fractionWithinTolerance = phase === 'ladder' && Math.abs(Number(fractionGuess) / 100 - correctBetFraction) <= Math.max(0.02, correctBetFraction * tolerance)

  const ladder = buildLadder(startingPot, correctBetFraction, streets)
  const flatLadder = buildLadder(startingPot, 0.66, streets)
  const finalStackNeeded = startingPot + 2 * effectiveStack

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.geometric_ladder_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.geometric_ladder_prompt}</p>
      )}

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-4">
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">Starting pot</p>
            <p className="text-base font-black tabular-nums text-foreground">{fmt(startingPot)}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">Effective stack</p>
            <p className="text-base font-black tabular-nums text-foreground">{fmt(effectiveStack)}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">Streets</p>
            <p className="text-base font-black tabular-nums text-foreground">{streets}</p>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/50">
          Final all-in pot: <span className="font-bold text-foreground">{fmt(finalStackNeeded)}</span> (starting pot + 2 × effective stack)
        </p>

        {/* Phase 1: compute R */}
        <div className="space-y-2 pt-2 border-t border-border/20">
          <label htmlFor="r-guess" className="block text-xs font-semibold text-muted-foreground/70">
            R = (Final Pot ÷ Starting Pot)^(1 ÷ Streets) — enter your computed growth rate:
          </label>
          <div className="flex gap-2">
            <input
              id="r-guess"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={rGuess}
              disabled={disabled || phase !== 'r'}
              onChange={(e) => setRGuess(e.target.value)}
              className="flex-1 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-sm tabular-nums text-foreground disabled:opacity-60"
              placeholder="e.g. 3.06"
            />
            {phase === 'r' && (
              <button
                type="button"
                disabled={disabled || rGuess === ''}
                onClick={revealR}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                  rGuess === '' || disabled
                    ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                    : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white',
                )}
              >
                Reveal R
              </button>
            )}
          </div>
          {phase !== 'r' && (
            <p className={cn('text-xs font-semibold', rWithinTolerance ? 'text-emerald-400' : 'text-amber-400')}>
              Actual R ≈ {correctR.toFixed(3)} {rWithinTolerance ? '— within tolerance' : `— your guess: ${rGuess}`}
            </p>
          )}
        </div>

        {/* Phase 2: compute bet-fraction */}
        {phase !== 'r' && (
          <div className="space-y-2 pt-2 border-t border-border/20">
            <label htmlFor="fraction-guess" className="block text-xs font-semibold text-muted-foreground/70">
              Bet-fraction = (R − 1) ÷ 2 — enter your computed per-street bet, as % of pot:
            </label>
            <div className="flex gap-2">
              <input
                id="fraction-guess"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={fractionGuess}
                disabled={disabled || phase !== 'fraction'}
                onChange={(e) => setFractionGuess(e.target.value)}
                className="flex-1 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-sm tabular-nums text-foreground disabled:opacity-60"
                placeholder="e.g. 103"
              />
              {phase === 'fraction' && (
                <button
                  type="button"
                  disabled={disabled || fractionGuess === ''}
                  onClick={revealFraction}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                    fractionGuess === '' || disabled
                      ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                      : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white',
                  )}
                >
                  Reveal Ladder
                </button>
              )}
            </div>
            {phase === 'ladder' && (
              <p className={cn('text-xs font-semibold', fractionWithinTolerance ? 'text-emerald-400' : 'text-amber-400')}>
                Actual bet-fraction ≈ {(correctBetFraction * 100).toFixed(1)}% of pot {fractionWithinTolerance ? '— within tolerance' : `— your guess: ${fractionGuess}%`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* The Growth Ladder */}
      {phase === 'ladder' && (
        <div className="space-y-3">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60">The Growth Ladder</p>
          <ol className="space-y-2">
            {ladder.map((rung, i) => (
              <li key={rung.street} className="rounded-xl border border-border/30 bg-card/60 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">Street {rung.street}{i === ladder.length - 1 ? ' (all-in)' : ''}</span>
                  <span className="text-[10px] text-muted-foreground/50">bet {(correctBetFraction * 100).toFixed(0)}% of pot</span>
                </div>
                <PotDisplay potBefore={rung.startPot} bet={rung.bet} call={rung.bet} finalPotOverride={rung.endPot} />
              </li>
            ))}
          </ol>
          <p className="text-center text-[11px] text-muted-foreground/50">
            Final rung lands at {fmt(ladder[ladder.length - 1]?.endPot ?? 0)}, within a few dollars of the {fmt(finalStackNeeded)} all-in target — by construction, not coincidence.
          </p>

          <button
            type="button"
            onClick={() => setShowFlatOverlay((v) => !v)}
            className="w-full rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-xs font-semibold text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            {showFlatOverlay ? 'Hide' : 'Compare against'} a flat 66%-pot sizing every street
          </button>
          {showFlatOverlay && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/70">Flat 66%-pot (not geometric)</p>
              {flatLadder.map((rung) => (
                <p key={rung.street} className="text-[11px] text-muted-foreground/60 tabular-nums">
                  Street {rung.street}: {fmt(rung.startPot)} → bet {fmt(rung.bet)} → {fmt(rung.endPot)}
                </p>
              ))}
              <p className="text-[11px] font-semibold text-amber-400">
                Falls {fmt(finalStackNeeded - (flatLadder[flatLadder.length - 1]?.endPot ?? 0))} short of the {fmt(finalStackNeeded)} all-in target.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
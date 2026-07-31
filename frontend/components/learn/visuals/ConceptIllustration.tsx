'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ── Concept Illustration ──────────────────────────────────────────────────────
// A generic, non-interactive supporting visual for theory (concept_reveal)
// cards. `ConceptIllustration` is just a spacing wrapper — the bordered card
// chrome around it is already supplied by ConceptReveal.tsx. Specific
// illustrations (like `ConvergenceIllustration` below) render inside it.
// Future theory cards that need a lightweight supporting visual should add a
// new illustration component here rather than building a one-off per lesson.

export function ConceptIllustration({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}

// ── Deterministic PRNG (mulberry32) ───────────────────────────────────────────
// The "random-looking" trial sequences below must be stable across re-renders
// and SSR/CSR hydration, so they're derived from a seed rather than Math.random.
function mulberry32(seed: number) {
  let s = seed | 0
  return function next() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateOutcomes(count: number, winProb: number, seed: number): boolean[] {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => rand() < winProb)
}

/** Cumulative win-rate (0–100) after each trial. */
function cumulativeWinRatePct(outcomes: boolean[]): number[] {
  let wins = 0
  return outcomes.map((won, i) => {
    if (won) wins++
    return (wins / (i + 1)) * 100
  })
}

function buildSparklinePath(values: number[], width: number, height: number, padY = 4): string {
  if (values.length === 0) return ''
  const usableH = height - padY * 2
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * width
      const y = padY + usableH - (v / 100) * usableH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

// ── Convergence Illustration ──────────────────────────────────────────────────
// Contrasts a short, volatile run of trials against a long run that smooths
// out and converges toward a target percentage — the core "variance vs. EV /
// law of large numbers" pattern. Reusable for any future theory card that
// wants to show "a good decision can still lose in the short run, but
// converges toward its true rate over many repetitions."

export interface ConvergenceIllustrationProps {
  /** 0–100 — the long-run rate both panels are trending toward (e.g. required/true EV%). */
  targetPct: number
  shortTrialCount?: number
  longTrialCount?: number
  shortLabel?: string
  longLabel?: string
  shortCaption?: string
  longCaption?: string
  /** Seeds the deterministic pseudo-random trial sequences so they're stable across renders. */
  seed?: number
  className?: string
}

export function ConvergenceIllustration({
  targetPct,
  shortTrialCount = 20,
  longTrialCount = 1000,
  shortLabel = `Short-term (${shortTrialCount} trials)`,
  longLabel = `Long-term (${longTrialCount.toLocaleString()} trials)`,
  shortCaption = 'Variance dominates.',
  longCaption = 'Results converge toward EV.',
  seed = 1,
  className,
}: ConvergenceIllustrationProps) {
  const winProb = Math.min(Math.max(targetPct / 100, 0), 1)

  const shortOutcomes = useMemo(
    () => generateOutcomes(shortTrialCount, winProb, seed),
    [shortTrialCount, winProb, seed]
  )
  const longOutcomes = useMemo(
    () => generateOutcomes(longTrialCount, winProb, seed + 1),
    [longTrialCount, winProb, seed]
  )

  const shortCumulative = useMemo(() => cumulativeWinRatePct(shortOutcomes), [shortOutcomes])
  const longCumulative = useMemo(() => cumulativeWinRatePct(longOutcomes), [longOutcomes])

  const CHART_W = 280
  const CHART_H = 56
  const targetY = CHART_H - 4 - (targetPct / 100) * (CHART_H - 8)

  const shortPath = useMemo(() => buildSparklinePath(shortCumulative, CHART_W, CHART_H), [shortCumulative])
  const longPath = useMemo(() => buildSparklinePath(longCumulative, CHART_W, CHART_H), [longCumulative])

  return (
    <ConceptIllustration className={className}>
      {/* Short-term: volatile win/lose sequence */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          {shortLabel}
        </p>
        <div className="flex flex-wrap gap-1">
          {shortOutcomes.map((won, i) => (
            <span
              key={i}
              title={won ? 'Win' : 'Lose'}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold',
                won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              )}
            >
              {won ? 'W' : 'L'}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: CHART_H }}>
          <line
            x1={0} y1={targetY} x2={CHART_W} y2={targetY}
            stroke="currentColor" strokeDasharray="3 3" strokeWidth={1}
            className="text-muted-foreground/30"
          />
          <path d={shortPath} fill="none" stroke="#fb923c" strokeWidth={1.5} />
        </svg>
        <p className="text-xs text-amber-300/80">
          <span className="font-semibold">Short-term:</span> {shortCaption}
        </p>
      </div>

      <div className="flex justify-center text-muted-foreground/30">
        <span className="text-sm leading-none">↓</span>
      </div>

      {/* Long-term: smooth convergence toward the target line */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          {longLabel}
        </p>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: CHART_H }}>
          <line
            x1={0} y1={targetY} x2={CHART_W} y2={targetY}
            stroke="currentColor" strokeDasharray="3 3" strokeWidth={1}
            className="text-muted-foreground/30"
          />
          <path d={longPath} fill="none" stroke="#34d399" strokeWidth={1.5} />
        </svg>
        <p className="text-xs text-emerald-300/80">
          <span className="font-semibold">Long-term:</span> {longCaption}
        </p>
      </div>
    </ConceptIllustration>
  )
}

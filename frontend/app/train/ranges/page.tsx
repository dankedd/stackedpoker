'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crosshair, ChevronRight, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { RangeBuild } from '@/components/learn/steps/RangeBuild'
import { useAuth } from '@/hooks/useAuth'
import { evaluateRange } from '@/lib/learn/api'
import type { RangeEvaluation } from '@/lib/learn/api'
import type { LessonStep } from '@/lib/learn/types'
import { cn } from '@/lib/utils'

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'BTN_open',
    label: 'BTN Open',
    description: 'Build your BTN opening range at 100bb. The button is the widest position.',
  },
  {
    id: 'CO_open',
    label: 'CO Open',
    description: 'Build your CO opening range at 100bb. Slightly tighter than BTN.',
  },
  {
    id: 'UTG_open',
    label: 'UTG Open',
    description: 'Build your UTG opening range. Under-the-gun requires the strongest hands.',
  },
  {
    id: 'SB_steal',
    label: 'SB Steal',
    description: 'Build your SB stealing range vs BB at 100bb.',
  },
  {
    id: 'BB_vs_BTN_defend',
    label: 'BB vs BTN',
    description: 'Build your BB defense range vs BTN open.',
  },
  {
    id: 'BTN_3bet_call',
    label: 'BTN 3bet Call',
    description: 'Select hands to flat-call a 3-bet IP from BTN.',
  },
]

// ── Score tier helpers ────────────────────────────────────────────────────────

type ScoreTier = { label: string; className: string }

function scoreTier(score: number): ScoreTier {
  if (score >= 90) return { label: 'EXCELLENT', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' }
  if (score >= 75) return { label: 'GOOD', className: 'border-blue-500/40 bg-blue-500/10 text-blue-400' }
  if (score >= 55) return { label: 'OKAY', className: 'border-amber-500/40 bg-amber-500/10 text-amber-400' }
  return { label: 'NEEDS WORK', className: 'border-red-500/40 bg-red-500/10 text-red-400' }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RangeTrainerPage() {
  const { user, session } = useAuth()
  const token = session?.access_token ?? ''

  const [activeIdx, setActiveIdx] = useState(0)
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<RangeEvaluation | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [rangeKey, setRangeKey] = useState(0) // bump to reset RangeBuild

  const scenario = SCENARIOS[activeIdx]

  const step: LessonStep = {
    id: `range-${scenario.id}`,
    type: 'range_build' as const,
    narrative: scenario.description,
    range_hint: 'Select the hands you would play in this spot.',
    xp: 50,
  }

  const handleAnswer = async (combos: string[], _timeMs: number) => {
    if (!token) return
    setEvaluating(true)
    setEvalError(null)
    setResult(null)
    try {
      const res = await evaluateRange(scenario.id, combos, token)
      setResult(res)
    } catch (e) {
      setEvalError(
        e instanceof Error ? e.message : 'Could not evaluate range. Please try again.'
      )
    } finally {
      setEvaluating(false)
    }
  }

  const handleTryAgain = () => {
    setResult(null)
    setEvalError(null)
    setRangeKey((k) => k + 1)
  }

  const handleNextScenario = () => {
    const next = (activeIdx + 1) % SCENARIOS.length
    setActiveIdx(next)
    setResult(null)
    setEvalError(null)
    setRangeKey((k) => k + 1)
  }

  const handleSelectScenario = (idx: number) => {
    if (idx === activeIdx) return
    setActiveIdx(idx)
    setResult(null)
    setEvalError(null)
    setRangeKey((k) => k + 1)
  }

  const tier = result ? scoreTier(result.score) : null

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">

          {/* ── Page header ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500">
                <Crosshair className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-0.5">
                  Training
                </p>
                <h1 className="text-3xl font-bold text-foreground">Range Trainer</h1>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 ml-[52px]">
              Build and defend poker ranges. Instant feedback vs GTO targets.
            </p>
          </div>

          {/* ── Scenario selector ── */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectScenario(idx)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150',
                  idx === activeIdx
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                    : 'border-border/40 bg-card/40 text-muted-foreground hover:border-violet-500/25 hover:text-foreground'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Description card ── */}
          <div className="mb-6 rounded-xl border border-border/40 bg-card/60 px-5 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{scenario.description}</p>
          </div>

          {/* ── Auth gate ── */}
          {!user && (
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-10 text-center">
              <Crosshair className="h-10 w-10 text-violet-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Sign in to train</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Create a free account to build ranges and receive GTO feedback.
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get started free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
                >
                  Sign in <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {/* ── Range grid (logged in) ── */}
          {user && !result && !evaluating && (
            <RangeBuild
              key={rangeKey}
              step={step}
              onAnswer={handleAnswer}
              disabled={false}
            />
          )}

          {/* ── Loading state ── */}
          {evaluating && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
              <p className="text-sm text-muted-foreground">Evaluating your range against GTO targets…</p>
            </div>
          )}

          {/* ── Error state ── */}
          {evalError && !evaluating && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Evaluation failed</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{evalError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTryAgain}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Try Again
              </button>
            </div>
          )}

          {/* ── Results panel ── */}
          {result && !evaluating && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

              {/* Score badge + overlap headline */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  {tier && (
                    <span
                      className={cn(
                        'text-sm font-black tracking-widest px-4 py-1.5 rounded-full border',
                        tier.className
                      )}
                    >
                      {tier.label}
                    </span>
                  )}
                  <p className="text-lg font-bold text-foreground">
                    Score: {result.score}
                    <span className="text-muted-foreground font-normal text-base">/100</span>
                  </p>
                </div>

                {/* Overlap bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">GTO Overlap</span>
                    <span className="font-bold text-foreground">{result.overlap_pct}% match with GTO target</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-700"
                      style={{ width: `${result.overlap_pct}%` }}
                    />
                  </div>
                </div>

                {/* Combo deltas */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Missed combos</span>
                    <span className="font-bold text-red-400">{result.missed_combos.length}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Extra combos</span>
                    <span className="font-bold text-orange-400">{result.extra_combos.length}</span>
                  </div>
                  {result.xp_earned > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">XP earned</span>
                      <span className="font-bold text-amber-400">+{result.xp_earned}</span>
                    </div>
                  )}
                </div>

                {/* Feedback text */}
                {result.feedback && (
                  <div className="rounded-xl border border-border/30 bg-secondary/20 px-5 py-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.feedback}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-semibold hover:bg-card/60 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" /> Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleNextScenario}
                    className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Next Scenario <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  )
}

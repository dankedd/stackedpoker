'use client'

import { useState, useCallback } from 'react'
import {
  CheckCircle2, Clock, Zap, ChevronRight, Trophy, BookOpen, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, LessonStep, StepResult } from '@/lib/learn/types'
import { evaluateStep } from '@/lib/learn/api'
import { PokerContextBar } from '@/components/learn/PokerContextBar'
import { StepFeedback } from '@/components/learn/StepFeedback'
import { XPGain } from '@/components/learn/XPGain'
import { ConceptReveal } from '@/components/learn/steps/ConceptReveal'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { EquityPredict } from '@/components/learn/steps/EquityPredict'
import { RangeBuild } from '@/components/learn/steps/RangeBuild'
import { ClassifyStep } from '@/components/learn/steps/ClassifyStep'

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'step' | 'feedback' | 'summary'

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  current,
  total,
  className,
}: {
  current: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/50">
        <span>
          Step {Math.min(current + 1, total)} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Step dispatcher ───────────────────────────────────────────────────────────

function StepRenderer({
  step,
  lessonId,
  token,
  onResult,
  onConceptComplete,
}: {
  step: LessonStep
  lessonId: string
  token: string
  onResult: (result: StepResult) => void
  onConceptComplete: (result: StepResult) => void
}) {
  async function callEvaluate(userResponse: unknown, timeMs: number) {
    try {
      const result = await evaluateStep(lessonId, step.id, userResponse, timeMs, token)
      onResult(result)
    } catch {
      // Provide graceful fallback result
      onResult({
        score: 50,
        quality: 'acceptable',
        ev_loss_bb: 0,
        feedback: 'Could not reach server — result estimated.',
        xp_earned: Math.floor((step.xp ?? 10) / 2),
        level_before: 1,
        level_after: 1,
        leveled_up: false,
      })
    }
  }

  if (step.type === 'concept_reveal') {
    return (
      <ConceptReveal
        step={step}
        // Concept reveals skip feedback — award fixed 20 XP and move straight to next step
        onComplete={() =>
          onConceptComplete({
            score: 100,
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback: 'Concept reviewed.',
            xp_earned: 20,
            level_before: 1,
            level_after: 1,
            leveled_up: false,
          })
        }
      />
    )
  }

  if (step.type === 'decision_spot' || step.type === 'bet_size_choose') {
    return (
      <DecisionSpot
        step={step}
        onAnswer={(optionId, timeMs) => callEvaluate(optionId, timeMs)}
      />
    )
  }

  if (step.type === 'equity_predict') {
    return (
      <EquityPredict
        step={step}
        onAnswer={(equity, timeMs) => callEvaluate(equity, timeMs)}
      />
    )
  }

  if (step.type === 'range_build') {
    return (
      <RangeBuild
        step={step}
        onAnswer={(combos, timeMs) => callEvaluate(combos, timeMs)}
      />
    )
  }

  // Classify-family: board_classify, nut_advantage, blocker_id, range_identify, bluff_pick
  return (
    <ClassifyStep
      step={step}
      onAnswer={(answer, timeMs) => callEvaluate(answer, timeMs)}
    />
  )
}

// ── Intro screen ──────────────────────────────────────────────────────────────

function IntroScreen({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center animate-in fade-in duration-300">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/25">
        <BookOpen className="h-8 w-8 text-violet-400" />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60">
          {lesson.lesson_type.replace(/_/g, ' ')}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground/50" />
          <span>~{lesson.estimated_min} min</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-400/70" />
          <span className="text-amber-300/80 font-semibold">{lesson.xp_reward} XP</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
          <span>{lesson.steps.length} steps</span>
        </div>
      </div>

      {lesson.concept_ids.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {lesson.concept_ids.map((id) => (
            <span
              key={id}
              className="text-[10px] px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/8 text-violet-400/70"
            >
              {id.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        Start Lesson
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  )
}

// ── Summary screen ────────────────────────────────────────────────────────────

function SummaryScreen({
  lesson,
  results,
  totalXP,
  onContinue,
}: {
  lesson: Lesson
  results: StepResult[]
  totalXP: number
  onContinue: () => void
}) {
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0

  const leveledUp = results.some((r) => r.leveled_up)
  const newLevel = results.findLast?.((r) => r.leveled_up)?.level_after

  const gradeColor =
    avgScore >= 90
      ? 'text-emerald-400'
      : avgScore >= 75
      ? 'text-blue-400'
      : avgScore >= 55
      ? 'text-amber-400'
      : 'text-red-400'

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Score header */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
            <Trophy className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Lesson Complete!</h2>
        <div className="flex items-baseline justify-center gap-1 mb-2">
          <span className={cn('text-5xl font-black', gradeColor)}>{avgScore}</span>
          <span className="text-2xl text-muted-foreground/40">/100</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {results.length} step{results.length !== 1 ? 's' : ''} · {lesson.title}
        </p>
      </div>

      {/* XP gain */}
      <div className="flex justify-center">
        <XPGain xp={totalXP} leveled_up={leveledUp} new_level={newLevel} />
      </div>

      {/* Step breakdown */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-4">
            Step Breakdown
          </p>
          <div className="space-y-2.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground/50 w-16 shrink-0 capitalize">
                  {lesson.steps[i]?.type?.replace(/_/g, ' ') ?? `Step ${i + 1}`}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      r.score >= 80
                        ? 'bg-emerald-500'
                        : r.score >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${r.score}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-bold w-8 text-right',
                    r.score >= 80
                      ? 'text-emerald-400'
                      : r.score >= 60
                      ? 'text-amber-400'
                      : 'text-red-400'
                  )}
                >
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concept links */}
      {lesson.concept_ids.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-semibold text-foreground">Concepts Covered</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lesson.concept_ids.map((id) => (
              <span
                key={id}
                className="text-xs px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/8 text-violet-400/80"
              >
                {id.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="group relative flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
          Continue Learning
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  )
}

// ── Main LessonPlayer ─────────────────────────────────────────────────────────

interface LessonPlayerProps {
  lesson: Lesson
  token: string
  onComplete: (score: number) => void
}

export function LessonPlayer({ lesson, token, onComplete }: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [results, setResults] = useState<StepResult[]>([])
  const [latestResult, setLatestResult] = useState<StepResult | null>(null)
  const [totalXP, setTotalXP] = useState(0)

  const steps = lesson.steps
  const currentStep: LessonStep | undefined = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  const handleStart = useCallback(() => {
    setPhase('step')
  }, [])

  const handleResult = useCallback((result: StepResult) => {
    setLatestResult(result)
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    setPhase('feedback')
  }, [])

  // Concept reveals skip the feedback phase — go straight to next step
  const handleConceptComplete = useCallback((result: StepResult) => {
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    if (isLastStep) {
      setPhase('summary')
    } else {
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPhase('step')
    }
  }, [isLastStep])

  const handleContinue = useCallback(() => {
    if (isLastStep) {
      setPhase('summary')
    } else {
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPhase('step')
    }
  }, [isLastStep])

  const handleSummaryDone = useCallback(() => {
    const avgScore =
      results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
        : 0
    onComplete(avgScore)
  }, [results, onComplete])

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return <IntroScreen lesson={lesson} onStart={handleStart} />
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    return (
      <SummaryScreen
        lesson={lesson}
        results={results}
        totalXP={totalXP}
        onContinue={handleSummaryDone}
      />
    )
  }

  // ── Step / Feedback ────────────────────────────────────────────────────────
  if (!currentStep) return null

  const hasContext =
    currentStep.board?.length ||
    currentStep.hero_position ||
    currentStep.villain_position ||
    currentStep.pot_bb != null

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <ProgressBar current={currentStepIndex} total={steps.length} />

      {/* Context bar */}
      {hasContext && (
        <PokerContextBar
          board={currentStep.board}
          heroPosition={currentStep.hero_position}
          villainPosition={currentStep.villain_position}
          potBb={currentStep.pot_bb}
          effectiveStackBb={currentStep.effective_stack_bb}
          street={currentStep.street}
          heroHand={currentStep.hero_hand}
        />
      )}

      {/* Step card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
        {phase === 'step' && (
          <StepRenderer
            step={currentStep}
            lessonId={lesson.id}
            token={token}
            onResult={handleResult}
            onConceptComplete={handleConceptComplete}
          />
        )}

        {phase === 'feedback' && latestResult && (
          <StepFeedback
            result={latestResult}
            onContinue={handleContinue}
            isLast={isLastStep}
          />
        )}
      </div>
    </div>
  )
}

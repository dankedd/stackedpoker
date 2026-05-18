'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles, Trophy, Star, BookOpen, Zap, ChevronRight,
  RotateCcw, TrendingUp, Brain, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, StepResult } from '@/lib/learn/types'
import { ConceptTagRow } from '@/components/learn/ConceptPopover'

// ── Grade system ──────────────────────────────────────────────────────────────

type Grade = 'perfect' | 'excellent' | 'good' | 'needs_review'

function getGrade(score: number): Grade {
  if (score >= 90) return 'perfect'
  if (score >= 75) return 'excellent'
  if (score >= 55) return 'good'
  return 'needs_review'
}

const GRADE: Record<Grade, {
  label: string
  sublabel: string
  Icon: typeof Trophy
  text: string
  border: string
  heroBg: string
  glowOrb: string
  iconBg: string
  iconRing: string
  glow: string
}> = {
  perfect: {
    label: 'Perfect Play',
    sublabel: 'Every decision was optimal. Elite-level thinking.',
    Icon: Sparkles,
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    heroBg: 'from-emerald-600/10 via-card/70 to-emerald-600/5',
    glowOrb: 'bg-emerald-500/15',
    iconBg: 'bg-emerald-500/15',
    iconRing: 'ring-emerald-500/40',
    glow: 'shadow-emerald-500/15',
  },
  excellent: {
    label: 'Excellent',
    sublabel: 'Sharp thinking with a few spots to refine.',
    Icon: Trophy,
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    heroBg: 'from-blue-600/10 via-card/70 to-blue-600/5',
    glowOrb: 'bg-blue-500/15',
    iconBg: 'bg-blue-500/15',
    iconRing: 'ring-blue-500/40',
    glow: 'shadow-blue-500/15',
  },
  good: {
    label: 'Good Work',
    sublabel: 'Solid foundation — sharpen the weak spots and you\'ll level up fast.',
    Icon: Star,
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    heroBg: 'from-violet-600/10 via-card/70 to-violet-600/5',
    glowOrb: 'bg-violet-500/15',
    iconBg: 'bg-violet-500/15',
    iconRing: 'ring-violet-500/40',
    glow: 'shadow-violet-500/15',
  },
  needs_review: {
    label: 'Keep Practicing',
    sublabel: 'Every rep counts. Review the concepts and try again.',
    Icon: BookOpen,
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    heroBg: 'from-amber-600/8 via-card/70 to-amber-600/5',
    glowOrb: 'bg-amber-500/12',
    iconBg: 'bg-amber-500/15',
    iconRing: 'ring-amber-500/40',
    glow: 'shadow-amber-500/12',
  },
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900, delayMs = 0, active = true) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf = 0
    let startTime: number | null = null
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!startTime) startTime = ts
        const progress = Math.min((ts - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setValue(Math.round(eased * target))
        if (progress < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delayMs)
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delayMs, active])

  return value
}

// ── Animated fill bar ─────────────────────────────────────────────────────────

function FillBar({
  pct,
  active,
  delay = 0,
  colorClass,
}: {
  pct: number
  active: boolean
  delay?: number
  colorClass: string
}) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setWidth(pct), delay)
    return () => clearTimeout(t)
  }, [pct, active, delay])
  return (
    <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-1000 ease-out', colorClass)}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

// ── Mastery segment bar (0–5 segments) ───────────────────────────────────────

function MasterySegments({ filled, color }: { filled: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i < filled ? color : 'bg-secondary/40',
          )}
          style={{ transitionDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

// ── Step mini-bar row ─────────────────────────────────────────────────────────

function StepMiniBar({
  label,
  result,
  isBest,
  isWorst,
  active,
  delay,
}: {
  label: string
  result: StepResult
  isBest: boolean
  isWorst: boolean
  active: boolean
  delay: number
}) {
  const [width, setWidth] = useState(0)
  const invalid = result.evaluation_valid === false

  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setWidth(invalid ? 0 : result.score), delay)
    return () => clearTimeout(t)
  }, [result.score, active, delay, invalid])

  const barColor = invalid
    ? 'bg-secondary/30'
    : result.score >= 80
    ? 'bg-emerald-500'
    : result.score >= 60
    ? 'bg-amber-500'
    : 'bg-rose-500'

  const scoreColor = invalid
    ? 'text-muted-foreground/25'
    : result.score >= 80
    ? 'text-emerald-400'
    : result.score >= 60
    ? 'text-amber-400'
    : 'text-rose-400'

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground/40 w-[5.5rem] shrink-0 truncate capitalize">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary/25 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={cn('text-xs font-bold w-7 text-right tabular-nums', scoreColor)}>
        {invalid ? '—' : result.score}
      </span>
      {isBest && !invalid && (
        <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wide w-8 shrink-0">
          Best
        </span>
      )}
      {isWorst && !invalid && !isBest && (
        <span className="text-[9px] font-bold text-rose-400/60 uppercase tracking-wide w-8 shrink-0">
          Focus
        </span>
      )}
      {!isBest && (invalid || !(isWorst)) && (
        <span className="w-8 shrink-0" />
      )}
    </div>
  )
}

// ── Concept reinforcement card ────────────────────────────────────────────────

function ConceptReinforcementCard({
  conceptId,
  score,
  visible,
  delay,
}: {
  conceptId: string
  score: number
  visible: boolean
  delay: number
}) {
  const [barFilled, setBarFilled] = useState(0)
  const [showBar, setShowBar] = useState(false)

  useEffect(() => {
    if (!visible) return
    const t1 = setTimeout(() => setShowBar(true), delay + 150)
    const t2 = setTimeout(() => setBarFilled(score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1), delay + 300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [visible, delay, score])

  const badge =
    score >= 80
      ? { label: 'Improved', cls: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-400' }
      : score >= 60
      ? { label: 'Reinforced', cls: 'border-blue-500/25 bg-blue-500/8 text-blue-400' }
      : { label: 'Needs Practice', cls: 'border-amber-500/25 bg-amber-500/8 text-amber-400' }

  const segColor =
    score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-blue-500' : 'bg-amber-500'

  const guidance =
    score >= 80
      ? 'Strong performance on this concept.'
      : score >= 60
      ? 'Good exposure — more reps will solidify this.'
      : 'Review this concept before moving on.'

  return (
    <div
      className={cn(
        'rounded-xl border border-border/30 bg-secondary/15 p-3.5 transition-all duration-400',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-foreground capitalize">
          {conceptId.replace(/_/g, ' ')}
        </span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', badge.cls)}>
          {badge.label}
        </span>
      </div>
      <MasterySegments filled={showBar ? barFilled : 0} color={segColor} />
      <p className="text-[10px] text-muted-foreground/40 mt-1.5 leading-relaxed">{guidance}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LessonCompletionScreenProps {
  lesson: Lesson
  results: StepResult[]
  totalXP: number
  onContinue: () => void
  onRetry?: () => void
  onCoachReview?: () => void
}

export function LessonCompletionScreen({
  lesson,
  results,
  totalXP,
  onContinue,
  onRetry,
  onCoachReview,
}: LessonCompletionScreenProps) {

  // ── Reveal phases ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),   // score counts up
      setTimeout(() => setPhase(2), 650),   // reward strip
      setTimeout(() => setPhase(3), 1050),  // step breakdown
      setTimeout(() => setPhase(4), 1450),  // concept mastery
      setTimeout(() => setPhase(5), 1900),  // CTAs
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const validResults = results.filter(r => r.evaluation_valid !== false)
  const avgScore =
    validResults.length > 0
      ? Math.round(validResults.reduce((s, r) => s + r.score, 0) / validResults.length)
      : 0

  const grade = getGrade(avgScore)
  const cfg = GRADE[grade]
  const GradeIcon = cfg.Icon

  const leveledUp = results.some(r => r.leveled_up)
  const newLevel = results.findLast?.(r => r.leveled_up)?.level_after
  const strongDecisions = validResults.filter(r => r.score >= 80).length

  // Best / worst valid step indices
  let bestIdx = -1, worstIdx = -1
  if (validResults.length > 0) {
    let bestScore = -Infinity, worstScore = Infinity
    results.forEach((r, i) => {
      if (r.evaluation_valid === false) return
      if (r.score > bestScore) { bestScore = r.score; bestIdx = i }
      if (r.score < worstScore) { worstScore = r.score; worstIdx = i }
    })
    if (bestIdx === worstIdx) worstIdx = -1
  }

  // Concept average scores (derived from which steps touched each concept)
  const conceptScores: Record<string, number[]> = {}
  lesson.concept_ids.forEach(id => { conceptScores[id] = [] })
  lesson.steps.forEach((step, i) => {
    const r = results[i]
    if (!r || r.evaluation_valid === false) return
    const ids = step.concept_ids?.length ? step.concept_ids : lesson.concept_ids
    ids.forEach(id => {
      if (id in conceptScores) conceptScores[id].push(r.score)
    })
  })
  const conceptAvg = Object.fromEntries(
    Object.entries(conceptScores).map(([id, scores]) => [
      id,
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : avgScore,
    ])
  )

  // Count-up animations
  const animScore = useCountUp(avgScore, 900, 100, phase >= 1)
  const animXP    = useCountUp(totalXP,  800, 300, phase >= 2)

  // Worst-step feedback for focus tip
  const worstResult = worstIdx >= 0 ? results[worstIdx] : null
  const worstFeedback = worstResult?.feedback?.trim()

  return (
    <div className="space-y-4 animate-in fade-in duration-400">

      {/* ── GRADE HERO ── */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-8 text-center bg-gradient-to-br',
          cfg.border, cfg.heroBg,
          'shadow-xl', cfg.glow,
        )}
      >
        {/* Ambient orb */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-3xl',
            cfg.glowOrb,
          )}
        />

        {/* Grade icon */}
        <div
          className={cn(
            'mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border ring-4 shadow-lg',
            cfg.iconBg, cfg.border, cfg.iconRing,
            grade === 'perfect' && 'animate-pulse',
          )}
        >
          <GradeIcon className={cn('h-9 w-9', cfg.text)} />
        </div>

        {/* Score count-up */}
        <div className="flex items-baseline justify-center gap-1.5 mb-2">
          <span className={cn('text-[64px] leading-none font-black tabular-nums', cfg.text)}>
            {phase >= 1 ? animScore : 0}
          </span>
          <span className="text-2xl text-muted-foreground/25 font-bold">/100</span>
        </div>

        {/* Grade label */}
        <p className={cn('text-xl font-bold mb-1', cfg.text)}>{cfg.label}</p>

        {/* Lesson title */}
        <p className="text-sm font-medium text-foreground/70 mb-1">{lesson.title}</p>

        {/* Sublabel */}
        <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto leading-relaxed">
          {cfg.sublabel}
        </p>
      </div>

      {/* ── REWARD STRIP ── */}
      <div
        className={cn(
          'grid grid-cols-2 gap-3 transition-all duration-500',
          phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {/* XP earned */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              XP Earned
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-2.5">
            <span className="text-3xl font-black text-amber-400 tabular-nums">
              +{phase >= 2 ? animXP : 0}
            </span>
            <span className="text-xs text-muted-foreground/40">XP</span>
          </div>
          <FillBar
            pct={Math.min((totalXP / 500) * 100, 100)}
            active={phase >= 2}
            delay={200}
            colorClass="bg-gradient-to-r from-amber-600 to-yellow-400"
          />
        </div>

        {/* Level-up OR stats */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          {leveledUp && newLevel ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Level Up!
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-black text-violet-400 tabular-nums">
                  {newLevel}
                </span>
                <span className="text-xs text-muted-foreground/40">reached</span>
              </div>
              <p className="text-[10px] text-violet-400/60 font-semibold">New level unlocked</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-3.5 w-3.5 text-violet-400/70" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Performance
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-black text-foreground tabular-nums">
                  {strongDecisions}
                </span>
                <span className="text-xs text-muted-foreground/40">/ {validResults.length} strong</span>
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                {strongDecisions === validResults.length && validResults.length > 0
                  ? 'All decisions were strong'
                  : `${validResults.length - strongDecisions} decision${validResults.length - strongDecisions !== 1 ? 's' : ''} to refine`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── STEP BREAKDOWN ── */}
      {results.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border border-border/50 bg-card/60 p-5 transition-all duration-500',
            phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-4">
            Step Breakdown
          </p>
          <div className="space-y-2.5">
            {results.map((r, i) => (
              <StepMiniBar
                key={i}
                label={lesson.steps[i]?.type?.replace(/_/g, ' ') ?? `step ${i + 1}`}
                result={r}
                isBest={i === bestIdx}
                isWorst={i === worstIdx}
                active={phase >= 3}
                delay={80 + i * 70}
              />
            ))}
          </div>

          {/* Focus tip */}
          {worstFeedback && (
            <div className="mt-4 pt-4 border-t border-border/15">
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                <span className="font-semibold text-rose-400/80">Focus area — </span>
                {worstFeedback.length > 120
                  ? worstFeedback.slice(0, 120) + '…'
                  : worstFeedback}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── CONCEPT MASTERY ── */}
      {lesson.concept_ids.length > 0 && (
        <div
          className={cn(
            'transition-all duration-500',
            phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-3 px-0.5">
            Concepts Practiced
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {lesson.concept_ids.map((id, i) => (
              <ConceptReinforcementCard
                key={id}
                conceptId={id}
                score={conceptAvg[id] ?? avgScore}
                visible={phase >= 4}
                delay={i * 100}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── CONCEPT TAGS (review) ── */}
      {lesson.concept_ids.length > 0 && phase >= 4 && (
        <div className="px-0.5">
          <ConceptTagRow conceptIds={lesson.concept_ids} />
        </div>
      )}

      {/* ── CTA SECTION ── */}
      <div
        className={cn(
          'flex flex-col gap-3 transition-all duration-500',
          phase >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {/* Primary */}
        <button
          type="button"
          onClick={onContinue}
          className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
          Continue Learning
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>

        {/* Secondary */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onRetry ?? (() => window.location.reload())}
            className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
          <button
            type="button"
            onClick={onCoachReview}
            className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <Brain className="h-4 w-4" />
            Coach Review
          </button>
        </div>
      </div>
    </div>
  )
}

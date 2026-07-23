'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle, Zap, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Performance tiers ─────────────────────────────────────────────────────────
// Deliberately no red/failure-coded tier — even the lowest bucket reads as
// "keep practicing", never as a penalty. Mirrors the tier-config pattern in
// LessonCompletionScreen.tsx for visual consistency across the two screens.

type Tier = 'perfect' | 'excellent' | 'great' | 'good' | 'building' | 'practicing'

function getTier(score: number): Tier {
  if (score >= 100) return 'perfect'
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'great'
  if (score >= 70) return 'good'
  if (score >= 60) return 'building'
  return 'practicing'
}

const TIER: Record<Tier, {
  label: string
  text: string
  border: string
  heroBg: string
  glow: string
  glowOrb: string
  ring: string
}> = {
  perfect: {
    label: 'Perfect',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    heroBg: 'from-emerald-600/12 via-card/70 to-emerald-600/5',
    glow: 'shadow-emerald-500/20',
    glowOrb: 'bg-emerald-500/20',
    ring: 'ring-emerald-400/40',
  },
  excellent: {
    label: 'Excellent',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    heroBg: 'from-emerald-600/8 via-card/70 to-emerald-600/5',
    glow: 'shadow-emerald-500/10',
    glowOrb: 'bg-emerald-500/12',
    ring: 'ring-emerald-400/25',
  },
  great: {
    label: 'Great work',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    heroBg: 'from-blue-600/8 via-card/70 to-blue-600/5',
    glow: 'shadow-blue-500/10',
    glowOrb: 'bg-blue-500/12',
    ring: 'ring-blue-400/25',
  },
  good: {
    label: 'Good job',
    text: 'text-violet-400',
    border: 'border-violet-500/25',
    heroBg: 'from-violet-600/8 via-card/70 to-violet-600/5',
    glow: 'shadow-violet-500/10',
    glowOrb: 'bg-violet-500/12',
    ring: 'ring-violet-400/25',
  },
  building: {
    label: 'Keep building',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    heroBg: 'from-amber-600/8 via-card/70 to-amber-600/5',
    glow: 'shadow-amber-500/10',
    glowOrb: 'bg-amber-500/12',
    ring: 'ring-amber-400/25',
  },
  practicing: {
    label: 'Keep practicing',
    text: 'text-sky-400',
    border: 'border-sky-500/25',
    heroBg: 'from-sky-600/8 via-card/70 to-sky-600/5',
    glow: 'shadow-sky-500/10',
    glowOrb: 'bg-sky-500/12',
    ring: 'ring-sky-400/25',
  },
}

// ── prefers-reduced-motion ────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// ── Count-up ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration: number, active: boolean): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, active])
  return value
}

// ── Main component ────────────────────────────────────────────────────────────

interface LessonCompletionCardProps {
  lessonTitle: string
  /** 0-100 lesson score */
  score: number
  xpEarned: number
  leveledUp?: boolean
  newLevel?: number
  /** Rendered inside the same card, below a divider, revealed with the final
   *  animation phase — the caller's navigation actions (Next lesson / Back to
   *  module) and any one-off banners (e.g. module-complete). */
  children?: ReactNode
}

/**
 * The single results card shown after every lesson. Score is the hero: one
 * large, unambiguous number plus a plain-language performance tier, never a
 * cramped progress ring. XP lives in the same card instead of a floating pill.
 * See app/learn/lesson/[slug]/page.tsx for the call site and CTA content.
 */
export function LessonCompletionCard({
  lessonTitle,
  score,
  xpEarned,
  leveledUp,
  newLevel,
  children,
}: LessonCompletionCardProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      setPhase(5)
      return
    }
    const timers = [
      setTimeout(() => setPhase(1), 80),   // check + heading
      setTimeout(() => setPhase(2), 260),  // score reveals, count-up starts
      setTimeout(() => setPhase(3), 680),  // performance label
      setTimeout(() => setPhase(4), 820),  // XP reveals
      setTimeout(() => setPhase(5), 980),  // footer (CTAs / banners)
    ]
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  const tier = TIER[getTier(score)]
  const isPerfect = score >= 100

  const animScore = useCountUp(score, 650, !reducedMotion && phase >= 2)
  const scoreDisplay = reducedMotion ? score : animScore
  const animXP = useCountUp(xpEarned, 550, !reducedMotion && phase >= 4)
  const xpDisplay = reducedMotion ? xpEarned : animXP

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 sm:p-8 text-center bg-gradient-to-br shadow-xl',
        tier.border,
        tier.heroBg,
        tier.glow,
      )}
    >
      {/* Ambient glow orb */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-3xl',
          tier.glowOrb,
          isPerfect && !reducedMotion && 'animate-pulse',
        )}
      />

      <div className="relative">
        {/* Check + heading */}
        <div
          className={cn(
            'transition-all duration-300',
            phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1',
          )}
        >
          <div
            className={cn(
              'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ring-4 shadow-lg',
              tier.border,
              tier.ring,
              'bg-card/60',
            )}
          >
            <CheckCircle className={cn('h-8 w-8', tier.text)} />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1.5">Lesson complete!</h1>
          <p className="text-sm text-muted-foreground/70 leading-snug max-w-xs mx-auto line-clamp-2 break-words">
            {lessonTitle}
          </p>
        </div>

        {/* Score hero */}
        <div
          className={cn(
            'mt-6 transition-all duration-500',
            phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/40 mb-1.5">
            Lesson Score
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={cn(
                'font-black tabular-nums leading-none text-[3.25rem] sm:text-[4rem]',
                tier.text,
              )}
            >
              {scoreDisplay}
            </span>
            <span className="text-lg sm:text-xl font-bold text-muted-foreground/30">%</span>
          </div>
          <p
            className={cn(
              'mt-2 text-sm sm:text-base font-bold uppercase tracking-wide transition-opacity duration-300',
              tier.text,
              phase >= 3 ? 'opacity-100' : 'opacity-0',
            )}
          >
            {tier.label}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/25 my-6" />

        {/* XP row */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-x-2 gap-y-2 transition-all duration-400',
            phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          <Zap className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-2xl font-black text-amber-300 tabular-nums">+{xpDisplay}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/40">
            XP earned
          </span>
          {leveledUp && newLevel != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-300">
              <Star className="h-3 w-3 fill-violet-400/40" />
              Level {newLevel}
            </span>
          )}
        </div>

        {/* Footer slot — CTAs / banners, passed in by the caller */}
        {children && (
          <div
            className={cn(
              'transition-all duration-400',
              phase >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            )}
          >
            <div className="h-px bg-border/15 my-6" />
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { CheckCircle2, AlertTriangle, XCircle, ChevronRight, Trophy, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepResult } from '@/lib/learn/types'
import { QUALITY_LABELS, QUALITY_COLORS } from '@/lib/learn/types'
import { XPGain } from './XPGain'

interface StepFeedbackProps {
  result: StepResult
  onContinue: () => void
  isLast: boolean
}

const QUALITY_BG: Record<string, string> = {
  perfect: 'border-emerald-500/30 bg-emerald-500/8',
  good: 'border-blue-500/30 bg-blue-500/8',
  acceptable: 'border-amber-500/30 bg-amber-500/8',
  mistake: 'border-orange-500/30 bg-orange-500/8',
  punt: 'border-red-500/30 bg-red-500/8',
}

const QUALITY_BADGE: Record<string, string> = {
  perfect: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  good: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  acceptable: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  mistake: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  punt: 'bg-red-500/15 text-red-400 border-red-500/30',
}

function QualityIcon({ quality }: { quality: string }) {
  if (quality === 'perfect' || quality === 'good') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
      </div>
    )
  }
  if (quality === 'acceptable') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
      </div>
    )
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
      <XCircle className="h-6 w-6 text-red-400" />
    </div>
  )
}

export function StepFeedback({ result, onContinue, isLast }: StepFeedbackProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header card */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          QUALITY_BG[result.quality]
        )}
      >
        <div className="flex items-start gap-4">
          <QualityIcon quality={result.quality} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                  QUALITY_BADGE[result.quality]
                )}
              >
                {QUALITY_LABELS[result.quality]}
              </span>
              {result.ev_loss_bb > 0 && (
                <span className="text-xs text-orange-400/80 font-semibold">
                  −{result.ev_loss_bb.toFixed(1)} BB EV
                </span>
              )}
            </div>
            <p className={cn('text-sm font-semibold mb-1', QUALITY_COLORS[result.quality])}>
              Score: {result.score}/100
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.feedback}</p>
          </div>
        </div>
      </div>

      {/* Concept explanation if provided */}
      {result.concept_explanation && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
              {result.concept_triggered ?? 'Concept'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.concept_explanation}
          </p>
        </div>
      )}

      {/* XP gain */}
      <div className="flex justify-center">
        <XPGain
          xp={result.xp_earned}
          leveled_up={result.leveled_up}
          new_level={result.leveled_up ? result.level_after : undefined}
        />
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={onContinue}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        {isLast ? (
          <>
            <Trophy className="h-4 w-4 shrink-0" />
            Finish Lesson
          </>
        ) : (
          <>
            Continue
            <ChevronRight className="h-4 w-4 shrink-0" />
          </>
        )}
      </button>
    </div>
  )
}

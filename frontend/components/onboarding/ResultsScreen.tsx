'use client'

import { Sparkles, TrendingUp, TrendingDown, Clock, BookOpen, ChevronRight } from 'lucide-react'
import { LEAGUE_META, topicLabel } from '@/lib/learn/leagueMeta'
import type { AssessmentResults } from '@/lib/learn/assessmentEngine'

export function ResultsScreen({
  results,
  moduleTitle,
  onContinue,
  continueLabel = 'Continue',
}: {
  results: AssessmentResults
  /** Human title for results.recommendedModuleId, resolved by the caller (page.tsx has curriculum access). */
  moduleTitle: string
  onContinue: () => void
  continueLabel?: string
}) {
  const meta = LEAGUE_META[results.estimatedLeague]

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/80 to-blue-950/20 px-6 py-8 sm:px-10 text-center">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/25">
            <Sparkles className="h-6 w-6 text-violet-400" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400/60 mb-2">
            Your Poker Profile
          </p>
          <p className="text-xs text-muted-foreground/60 mb-2">Current Skill Level</p>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-bold ${meta.classes}`}>
            <span>{meta.emoji}</span>
            {meta.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.strongestTopics.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400/70 mb-3">
              <TrendingUp className="h-3.5 w-3.5" />
              Strengths
            </div>
            <ul className="space-y-1.5">
              {results.strongestTopics.map((t) => (
                <li key={t} className="text-sm text-foreground/85">{topicLabel(t)}</li>
              ))}
            </ul>
          </div>
        )}

        {results.weakestTopics.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400/70 mb-3">
              <TrendingDown className="h-3.5 w-3.5" />
              Weakest Topics
            </div>
            <ul className="space-y-1.5">
              {results.weakestTopics.map((t) => (
                <li key={t} className="text-sm text-foreground/85">{topicLabel(t)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">
          Recommended Starting Point
        </p>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
            <BookOpen className="h-5 w-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{moduleTitle}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              ~{results.estimatedStudyHours === 0 ? '<1' : results.estimatedStudyHours} hr estimated study time
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          {continueLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

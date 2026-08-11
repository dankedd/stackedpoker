'use client'

import { CheckCircle2, ChevronRight, Clock, Wrench, Info } from 'lucide-react'
import { EXPERIENCE_LEVEL_META } from '@/lib/learn/experienceLevel'
import type { Recommendation } from '@/lib/learn/experienceLevel'

// The user should never finish onboarding without guidance — this screen is
// always shown immediately after a level is picked, with a concrete module,
// a short progression, tools, and a time estimate. No score, no quiz result.
export function RecommendationScreen({
  recommendation,
  onStartLearning,
}: {
  recommendation: Recommendation
  onStartLearning: () => void
}) {
  const meta = EXPERIENCE_LEVEL_META[recommendation.level]

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/80 to-blue-950/20 px-6 py-8 sm:px-10 text-center">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="relative">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold mb-3 ${meta.classes}`}>
            {meta.label}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
            You&apos;re best starting as {recommendation.level === 'advanced' ? 'an' : 'a'} {meta.label} player
          </h1>
        </div>
      </div>

      {recommendation.downgradeReason && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
          <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-200/80 leading-relaxed">{recommendation.downgradeReason}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-6 space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
            We recommend beginning with
          </p>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-base font-semibold text-foreground">{recommendation.startModuleTitle}</p>
          </div>
        </div>

        {recommendation.progression.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
              Then continue with
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/80">
              {recommendation.progression.map((m, i) => (
                <span key={m.id} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  {m.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
              <Wrench className="h-3 w-3" />
              Recommended tools
            </div>
            <ul className="space-y-1">
              {recommendation.tools.map((t) => (
                <li key={t} className="text-xs text-foreground/80">{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
              <Clock className="h-3 w-3" />
              Estimated time
            </div>
            <p className="text-xs text-foreground/80">Approximately {recommendation.studyHours} of study.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartLearning}
          className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          Start Learning
        </button>
      </div>
    </div>
  )
}

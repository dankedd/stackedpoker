'use client'

import { Rocket, BookOpen } from 'lucide-react'
import { LEAGUE_META } from '@/lib/learn/leagueMeta'
import type { AssessmentLeague } from '@/lib/learn/assessmentQuestions'

// Never auto-skips content: a recommended league beyond Foundation always
// presents an explicit choice rather than silently unlocking anything.
export function FastTrackChoice({
  recommendedLeague,
  onStartAtFoundation,
  onTakeFinalChallenge,
}: {
  recommendedLeague: AssessmentLeague
  onStartAtFoundation: () => void
  onTakeFinalChallenge: () => void
}) {
  const meta = LEAGUE_META[recommendedLeague]

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 p-6 sm:p-8">
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        We think you&apos;re already familiar with{' '}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${LEAGUE_META.foundation.classes}`}>
          {LEAGUE_META.foundation.emoji} Foundation
        </span>
        . Choose how you&apos;d like to continue:
      </p>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onStartAtFoundation}
          className="w-full flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/15 px-4 py-3.5 text-left hover:border-violet-500/30 hover:bg-violet-500/[0.05] transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/40 shrink-0">
            <BookOpen className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Start at Foundation</p>
            <p className="text-xs text-muted-foreground/60">Review the fundamentals from the beginning</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onTakeFinalChallenge}
          className="w-full flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] px-4 py-3.5 text-left hover:border-violet-500/50 hover:bg-violet-500/[0.1] transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25 shrink-0">
            <Rocket className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Take the Foundation Final Challenge</p>
            <p className="text-xs text-muted-foreground/60">
              Pass it to unlock {meta.label} immediately
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

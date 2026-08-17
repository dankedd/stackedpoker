'use client'

import Link from 'next/link'
import { Flag, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SourceChips } from './SourceChip'
import { RangeExplorer } from './RangeExplorer'
import type { InteractivePuzzle } from '@/lib/puzzles/interactive/types'

/**
 * The end screen.
 *
 * `endsEarlyBecause` is rendered as a first-class panel rather than a caption.
 * A hand that stops on the flop looks unfinished unless you are told why, and
 * "the source has no turn strategy for this spot, so we are not inventing one"
 * is a thing worth a learner reading — it is the same discipline the rest of the
 * puzzle is built on, stated once at the end where it lands hardest.
 */
export function CompletionCard({
  puzzle,
  correct,
  total,
  onRestart,
}: {
  puzzle: InteractivePuzzle
  correct: number
  total: number
  onRestart: () => void
}) {
  const perfect = correct === total

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-500/[0.12] to-transparent p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-violet-300" aria-hidden />
        <h2 className="mt-3 text-xl font-bold text-white">Hand complete</h2>

        <div className="mt-5 flex items-center justify-center gap-8">
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-violet-300">+{puzzle.xp} XP</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Earned</p>
          </div>
          <div className="h-9 w-px bg-white/10" aria-hidden />
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-white">
              {correct} / {total}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Decision accuracy
            </p>
          </div>
        </div>

        {!perfect && (
          <p className="mt-4 text-[12px] text-slate-400">
            Worth replaying — the theory reads differently once you know where it lands.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">
          What you should remember
        </h3>
        <p className="mt-2.5 text-[15px] font-semibold leading-relaxed text-white">{puzzle.takeawayHeadline}</p>
        <SourceChips ids={puzzle.headlineSources} />

        <ul className="mt-4 space-y-3">
          {puzzle.takeaways.map((t, i) => (
            <li key={i} className="border-l-2 border-violet-500/25 pl-3">
              <p className="text-[13px] leading-relaxed text-slate-300">{t.text}</p>
              <SourceChips ids={t.sources} />
            </li>
          ))}
        </ul>
      </div>

      {puzzle.endsEarlyBecause && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Why the hand stops here
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{puzzle.endsEarlyBecause}</p>
        </div>
      )}

      <RangeExplorer ranges={puzzle.ranges} />

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button variant="outline" size="lg" className="w-full sm:flex-1" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Play again
        </Button>
        <Button variant="poker" size="lg" className="w-full sm:flex-1" asChild>
          <Link href="/puzzles">Back to puzzles</Link>
        </Button>
      </div>
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'
import type { LessonStep, StepResult } from '@/lib/learn/types'

interface TendencySummaryProps {
  step: LessonStep
  /** Every step in the current lesson (to look up `summary_source_step_ids`' tags/labels). */
  steps: LessonStep[]
  /** This playthrough's REAL results, keyed by step id — never a canned/simulated readout. */
  resultsByStepId: Map<string, StepResult>
  onComplete: () => void
}

/**
 * A genuinely personalized capstone: reads the actual StepResult.quality for a
 * named list of earlier steps in THIS playthrough (`summary_source_step_ids`),
 * grouped by whichever `tendency_tag`/`tendency_tag_label`/`tendency_tag_leak_hint`
 * each source step authored, and synthesizes a "here's the pattern in what you
 * just did" message — never a hardcoded string dressed up to look personalized.
 * Fully domain-agnostic: the vocabulary (tag labels, leak hints) lives on the
 * SOURCE steps, not in this component, so any future lesson can reuse it.
 */
export function TendencySummary({ step, steps, resultsByStepId, onComplete }: TendencySummaryProps) {
  const stepById = new Map(steps.map((s) => [s.id, s]))
  const sourceIds = step.summary_source_step_ids ?? []

  const entries = sourceIds
    .map((id) => ({ id, srcStep: stepById.get(id), result: resultsByStepId.get(id) }))
    .filter((e): e is { id: string; srcStep: LessonStep; result: StepResult } => !!e.srcStep && !!e.result)

  const total = entries.length
  const correctCount = entries.filter((e) => e.result.quality === 'perfect' || e.result.quality === 'good').length
  const pct = total > 0 ? correctCount / total : 0
  const wrongEntries = entries.filter((e) => !(e.result.quality === 'perfect' || e.result.quality === 'good'))

  const tier =
    total === 0
      ? null
      : pct >= 0.85
      ? { label: 'Strong overall.', color: 'text-emerald-400' }
      : pct >= 0.6
      ? { label: 'Solid, with real gaps.', color: 'text-amber-400' }
      : { label: 'This is exactly the pattern to drill next.', color: 'text-orange-400' }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.tendency_summary_intro && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.tendency_summary_intro}</p>
        </div>
      )}

      {total > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 text-center space-y-1.5">
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {correctCount}<span className="text-muted-foreground/40">/{total}</span>
          </p>
          {tier && <p className={cn('text-sm font-semibold', tier.color)}>{tier.label}</p>}
        </div>
      )}

      {wrongEntries.length > 0 ? (
        <div className="rounded-xl border border-border/40 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
          {wrongEntries.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground/90">
                {e.srcStep.tendency_tag_label ?? e.srcStep.tendency_tag ?? 'This hand'}
              </p>
              {e.srcStep.tendency_tag_leak_hint && (
                <p className="mt-0.5 text-xs text-muted-foreground/70 leading-relaxed">{e.srcStep.tendency_tag_leak_hint}</p>
              )}
            </div>
          ))}
        </div>
      ) : total > 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-300">
            You correctly read every category here — clear value, playable hands, and the ones that just have to fold.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onComplete}
        className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden bg-gradient-to-r from-violet-600 to-blue-500"
      >
        Continue
      </button>
    </div>
  )
}

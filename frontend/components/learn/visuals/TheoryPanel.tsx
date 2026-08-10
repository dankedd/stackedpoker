'use client'

import { BookOpen, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TheoryPanelData, TheoryPanelFactor } from '@/lib/learn/types'
import { TermDescriptionRow } from '@/components/ui/TermDescriptionRow'

interface TheoryPanelProps {
  panel: TheoryPanelData
}

/** Per-factor accent — whether the concept argues FOR the verdict, AGAINST it, or
 *  is context that cuts neither way. Deliberately three quiet accents rather than a
 *  red/green verdict scoreboard: several of these factors genuinely pull in opposite
 *  directions, and flattening that into "good/bad" is what makes boundary hands look
 *  like they have obvious answers when they don't. */
const WEIGHT_STYLES: Record<NonNullable<TheoryPanelFactor['weight']>, {
  chip: string
  icon: typeof TrendingUp
  iconColor: string
}> = {
  for:     { chip: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300', icon: TrendingUp,   iconColor: 'text-emerald-400/70' },
  against: { chip: 'border-orange-500/30 bg-orange-500/12 text-orange-300',    icon: TrendingDown, iconColor: 'text-orange-400/70' },
  context: { chip: 'border-violet-500/30 bg-violet-500/12 text-violet-300',    icon: Minus,        iconColor: 'text-violet-400/60' },
}

function FactorRow({ factor }: { factor: TheoryPanelFactor }) {
  const style = WEIGHT_STYLES[factor.weight ?? 'context']
  const Icon = style.icon
  return (
    <TermDescriptionRow
      badge={
        <span
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
            'text-[10px] font-bold uppercase tracking-wider leading-4',
            style.chip
          )}
        >
          <Icon className={cn('h-3 w-3 shrink-0', style.iconColor)} aria-hidden />
          {factor.term}
        </span>
      }
      description={factor.description}
    />
  )
}

/** Post-answer THEORY panel — the honest alternative to a range chart for spots the
 *  canonical data doesn't cover (see `TheoryPanelData` in types.ts for why this
 *  exists). Shape mirrors `RangeRevealCard`: one eyebrow-labelled card, mounted by
 *  `StepFeedback` only once a graded `result` exists, so it can never surface before
 *  the learner has answered.
 *
 *  Reading order is the same one the learner needs at the moment they see it:
 *  VERDICT (what the hand does) -> FACTORS (why, concept by concept) -> TAKEAWAY
 *  (what generalizes to the next spot of this shape). The sourcing caption sits last
 *  and smallest — present so a claim is never louder than its evidence. */
export function TheoryPanel({ panel }: TheoryPanelProps) {
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-500/8 to-card/60 p-5 space-y-4">
      {/* Eyebrow */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">
          {panel.label}
        </p>
      </div>

      {/* Verdict */}
      <div className="rounded-xl border border-violet-500/20 bg-secondary/30 px-4 py-3.5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="font-mono text-lg font-bold tracking-tight text-foreground">{panel.hand}</span>
          <span aria-hidden className="text-muted-foreground/30">&rarr;</span>
          <span className="text-lg font-bold text-violet-300">{panel.verdict}</span>
        </div>
        {panel.verdict_note && (
          <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed">{panel.verdict_note}</p>
        )}
      </div>

      {/* Concept breakdown */}
      {panel.factors.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
          {panel.factors.map((factor, i) => (
            <FactorRow key={i} factor={factor} />
          ))}
        </div>
      )}

      {/* Key takeaway */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80 mb-1">
            Key takeaway
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{panel.takeaway}</p>
        </div>
      </div>

      {panel.caption && (
        <p className="text-[9px] text-muted-foreground/30 leading-relaxed">{panel.caption}</p>
      )}
    </div>
  )
}

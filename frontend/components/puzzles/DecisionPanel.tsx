'use client'

import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SourceChips, UnsourcedPanel } from './SourceChip'
import { TheoryBlockCard } from './TheoryBlockCard'
import type { OptionVerdict, PuzzleDecision, PuzzleOption } from '@/lib/puzzles/interactive/types'

/**
 * The answer step and its feedback.
 *
 * Progressive disclosure is enforced structurally rather than by discipline:
 * nothing about the correct answer exists in the DOM until `chosen` is set, so
 * a learner cannot reveal it by inspecting the page, and the full theory stays
 * behind a second, explicit "See the theory" toggle after that. The order is
 * always answer → short verdict → why → deep theory.
 *
 * Verdicts are three-valued (see `OptionVerdict`). Rendering 'defensible' as a
 * neutral amber state rather than a red ✕ is a content decision, not a visual
 * one: on this flop the source has the big blind checking good hands 36% of the
 * time, so marking a check "wrong" would teach something the book contradicts.
 */

const VERDICT_STYLE: Record<
  OptionVerdict,
  { icon: typeof Check; label: string; chip: string; ring: string; text: string }
> = {
  best: {
    icon: Check,
    label: 'Correct',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    ring: 'border-emerald-500/50 bg-emerald-500/[0.07]',
    text: 'text-emerald-300',
  },
  defensible: {
    icon: Minus,
    label: 'Playable, but not the primary line',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    ring: 'border-amber-500/50 bg-amber-500/[0.07]',
    text: 'text-amber-300',
  },
  mistake: {
    icon: X,
    label: 'Not quite',
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
    ring: 'border-red-500/50 bg-red-500/[0.07]',
    text: 'text-red-300',
  },
}

function OptionButton({
  option,
  index,
  chosen,
  isBest,
  onChoose,
}: {
  option: PuzzleOption
  index: number
  chosen?: string
  isBest: boolean
  onChoose: (id: string) => void
}) {
  const answered = chosen !== undefined
  const isChosen = chosen === option.id
  const style = VERDICT_STYLE[option.verdict]

  // Once answered, reveal the grade on the chosen option and highlight the best
  // one if it was missed. Untouched non-best options stay neutral — greying out
  // every alternative implies they were all equally wrong, which they are not.
  const revealed = answered && (isChosen || isBest)

  return (
    <button
      type="button"
      disabled={answered}
      onClick={() => onChoose(option.id)}
      className={cn(
        'group relative flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-3 py-4 text-center transition-all duration-150',
        'min-h-[76px]',
        !answered &&
          'border-white/12 bg-white/[0.04] hover:border-violet-500/50 hover:bg-violet-500/[0.10] active:scale-[0.98]',
        answered && !revealed && 'border-white/[0.07] bg-white/[0.015] opacity-50',
        revealed && (isChosen ? style.ring : VERDICT_STYLE.best.ring)
      )}
    >
      {/* Grade marker sits in the corner so it never displaces the action label —
          the buttons must not reflow when the answer is revealed. */}
      {revealed && (
        <span
          className={cn(
            'absolute left-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md border',
            isChosen ? style.chip : VERDICT_STYLE.best.chip
          )}
        >
          {isChosen ? (
            <style.icon className="h-3 w-3" aria-hidden />
          ) : (
            <Check className="h-3 w-3" aria-hidden />
          )}
        </span>
      )}

      {!answered && (
        <span className="absolute left-2 top-2 text-[10px] font-bold text-slate-600 group-hover:text-violet-400">
          {String.fromCharCode(65 + index)}
        </span>
      )}

      <span className="text-[14px] font-bold uppercase tracking-wide text-white">{option.label}</span>
      {option.detail && <span className="text-[11px] tabular-nums text-slate-400">{option.detail}</span>}

      {revealed && !isChosen && (
        <span className="absolute right-2 top-2 text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">
          Best
        </span>
      )}
    </button>
  )
}

export interface DecisionPanelProps {
  decision: DecisionPanelDecision
  chosen?: string
  showTheory: boolean
  onChoose: (id: string) => void
  onToggleTheory: () => void
  onNext: () => void
  nextLabel: string
}

type DecisionPanelDecision = PuzzleDecision

export function DecisionPanel({
  decision,
  chosen,
  showTheory,
  onChoose,
  onToggleTheory,
  onNext,
  nextLabel,
}: DecisionPanelProps) {
  const chosenOption = decision.options.find((o) => o.id === chosen)
  const bestOption = decision.options.find((o) => o.id === decision.bestOptionId)!
  const style = chosenOption ? VERDICT_STYLE[chosenOption.verdict] : undefined

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="mx-auto max-w-2xl text-[13px] leading-relaxed text-slate-400">{decision.situation}</p>
        <h2 className="mt-3 text-[17px] font-bold text-white sm:text-lg">{decision.question}</h2>
      </div>

      {/* An action bar, not a list of radio choices. Three or four abreast reads
          as a poker client's button row; five would squeeze past legibility on a
          phone, so that case wraps to two columns instead. */}
      <div
        className={cn(
          'grid gap-2.5',
          decision.options.length >= 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-3',
          decision.options.length === 4 && 'sm:grid-cols-4'
        )}
      >
        {decision.options.map((option, i) => (
          <OptionButton
            key={option.id}
            option={option}
            index={i}
            chosen={chosen}
            isBest={option.id === decision.bestOptionId}
            onChoose={onChoose}
          />
        ))}
      </div>

      {chosenOption && style && (
        <div className="space-y-4">
          <div className={cn('rounded-xl border p-4', style.ring)}>
            <p className={cn('flex items-center gap-2 text-[13px] font-bold', style.text)}>
              <style.icon className="h-4 w-4 shrink-0" aria-hidden />
              {style.label}
            </p>

            {chosenOption.verdict !== 'best' && (
              <p className="mt-2 text-[13px] text-slate-300">
                <span className="font-semibold text-white">Best action: </span>
                {bestOption.label}
              </p>
            )}

            <p className="mt-2.5 text-[13px] leading-relaxed text-slate-300">{chosenOption.shortWhy}</p>
            <SourceChips ids={chosenOption.sources} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">Why</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{decision.explanation}</p>
          </div>

          {decision.unsourced && <UnsourcedPanel notes={decision.unsourced} />}

          <button
            type="button"
            onClick={onToggleTheory}
            aria-expanded={showTheory}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.06]"
          >
            <span className="text-[13px] font-semibold text-white">
              {showTheory ? 'Hide the theory' : 'See the theory'}
            </span>
            <ChevronRight
              className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', showTheory && 'rotate-90')}
              aria-hidden
            />
          </button>

          {showTheory && (
            <div className="space-y-3">
              {decision.theory.map((block) => (
                <TheoryBlockCard key={block.id} block={block} />
              ))}
            </div>
          )}

          <Button variant="poker" size="lg" className="w-full" onClick={onNext}>
            {nextLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

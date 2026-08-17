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
        'group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150',
        !answered &&
          'border-white/10 bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/[0.07] active:scale-[0.99]',
        answered && !revealed && 'border-white/[0.07] bg-white/[0.015] opacity-55',
        revealed && (isChosen ? style.ring : VERDICT_STYLE.best.ring)
      )}
    >
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold',
          revealed
            ? isChosen
              ? style.chip
              : VERDICT_STYLE.best.chip
            : 'border-white/10 bg-white/[0.05] text-slate-400 group-hover:border-violet-500/40 group-hover:text-violet-300'
        )}
      >
        {revealed ? (
          isChosen ? (
            <style.icon className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          String.fromCharCode(65 + index)
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-white">{option.label}</span>
        {option.detail && <span className="mt-0.5 block text-[11px] text-slate-400">{option.detail}</span>}
      </span>

      {revealed && !isChosen && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Best</span>
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
      <div>
        <p className="text-[13px] leading-relaxed text-slate-400">{decision.situation}</p>
        <h2 className="mt-3 text-[17px] font-bold text-white sm:text-lg">{decision.question}</h2>
      </div>

      <div className="space-y-2.5">
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

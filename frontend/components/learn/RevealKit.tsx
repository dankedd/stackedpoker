'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Small shared UI pieces for the "Submit -> reveal correct answer -> Continue"
 * flow used by every multi-item classify/sort/match step (RangeBucketSort,
 * BoardRankSort, StraightDetective, BoardAutopsy, HandRankingOrder). Keeping
 * these here means every new step type that follows the same interaction
 * pattern gets the same look for free instead of re-inventing it.
 */

export function CorrectnessIcon({ correct, className }: { correct: boolean; className?: string }) {
  return correct ? (
    <CheckCircle2 className={cn('h-4 w-4 shrink-0 text-emerald-400', className)} aria-label="Correct" />
  ) : (
    <XCircle className={cn('h-4 w-4 shrink-0 text-red-400', className)} aria-label="Incorrect" />
  )
}

/** Palette used to color named categories consistently (bucket sorts, morphology tabs). */
export const CATEGORY_COLORS = [
  { text: 'text-violet-300', bg: 'bg-violet-500/20', border: 'border-violet-500/40', chip: 'bg-violet-500/70' },
  { text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/40', chip: 'bg-blue-500/70' },
  { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/40', chip: 'bg-amber-500/70' },
  { text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/40', chip: 'bg-rose-500/70' },
]

export function ReviewSummaryLine({ correctCount, total }: { correctCount: number; total: number }) {
  const allCorrect = total > 0 && correctCount === total
  return (
    <p
      className={cn(
        'text-center text-sm font-semibold',
        allCorrect ? 'text-emerald-400' : 'text-amber-400',
      )}
    >
      {allCorrect
        ? `Perfect — all ${total} correct.`
        : `${correctCount} of ${total} correct — review what changed below.`}
    </p>
  )
}

export function ReviewContinueButton({
  onClick,
  disabled = false,
  label = 'Continue',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
    >
      {label}
    </button>
  )
}

'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviousButtonProps {
  onClick: () => void
  /** Hide the "Previous" label below the `sm` breakpoint, keeping just the
   *  icon — for tight 3-button rows (e.g. Previous / Retry / Continue). */
  compact?: boolean
  className?: string
}

/** Secondary, subtle back-navigation control — intentionally lower-emphasis
 *  than the gradient Continue button next to it. Shared by StepFeedback,
 *  EvaluationFailed, and LessonPlayer's step-phase nav row so "Previous"
 *  looks and behaves identically everywhere in the lesson flow. */
export function PreviousButton({ onClick, compact = false, className }: PreviousButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Previous step"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors',
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      <span className={compact ? 'hidden sm:inline' : undefined}>Previous</span>
    </button>
  )
}

'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AskCoachTriggerProps {
  onClick: () => void
  /** Compact variant for embedding inline (e.g. inside StepFeedback) instead
   *  of the default standalone pill near the step card. */
  variant?: 'standalone' | 'inline'
  label?: string
  className?: string
}

/** The closed-state affordance (spec §3/§4) — subtle by design: no glow, no
 *  animation, no auto-opening. The learner opts in. */
export function AskCoachTrigger({
  onClick,
  variant = 'standalone',
  label = 'Ask Coach',
  className,
}: AskCoachTriggerProps) {
  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'text-xs font-medium text-violet-400/80 hover:text-violet-300 underline-offset-2 hover:underline transition-colors',
          className,
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask Coach for help with this question"
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-lg border border-border/40',
        'bg-secondary/20 px-3 py-1.5 text-xs font-medium text-muted-foreground/70',
        'hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300',
        'transition-colors duration-150',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-violet-400/70" />
      {label}
    </button>
  )
}

'use client'

import { cn } from '@/lib/utils'

interface ConfidencePromptProps {
  onSelect: (level: 'low' | 'medium' | 'high') => void
}

const LEVELS: { id: 'low' | 'medium' | 'high'; label: string; hint: string }[] = [
  { id: 'low', label: 'Low', hint: 'Guessing' },
  { id: 'medium', label: 'Medium', hint: 'Fairly sure' },
  { id: 'high', label: 'High', hint: 'Confident' },
]

/** Shown before a flagged step is answered — captures a self-reported confidence
 *  rating the adaptive engine uses to calibrate remediation/reinforcement afterward. */
export function ConfidencePrompt({ onSelect }: ConfidencePromptProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 text-center">
      <p className="text-sm font-semibold text-foreground">How confident are you before you answer?</p>
      <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelect(level.id)}
            className={cn(
              'rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-center',
              'border-border/50 bg-secondary/40 text-foreground',
              'hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
            )}
          >
            <span className="block">{level.label}</span>
            <span className="block text-[10px] font-normal text-muted-foreground/50 mt-0.5">{level.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

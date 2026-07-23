'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import type { FlopDimensionKey } from '@/lib/learn/flopClassifier'

interface BoardAutopsyProps {
  step: LessonStep
  onAnswer: (flaggedKeys: string[], timeMs: number) => void
  disabled?: boolean
}

const DIMENSION_LABEL: Record<FlopDimensionKey, string> = {
  structure: 'Structure',
  texture: 'Texture',
  two_tone_subtype: 'Two-Tone Subtype',
  highest_rank_family: 'Highest Rank Family',
  straight_count: 'Possible Straights',
}

const VALUE_LABEL: Record<string, string> = {
  trips: 'Trips', paired: 'Paired', unpaired: 'Unpaired',
  monotone: 'Monotone', two_tone: 'Two-Tone', rainbow: 'Rainbow',
  high_mid: 'High-Mid', mid_low: 'Mid-Low', high_low: 'High-Low', 'n/a': 'N/A',
  A: 'A', H: 'H (K-Q-J-T)', M: 'M (9-8-7-6)', L: 'L (5-4-3-2)',
}

/**
 * A board plus an intentionally flawed classification. The learner flags
 * which claims are wrong — ground truth is derived live from `classifyFlop`
 * in the evaluator (comparing each claim to the real value), never a
 * hand-authored "errors" list, so an authoring slip can't create an
 * unfixable claim.
 */
export function BoardAutopsy({ step, onAnswer, disabled = false }: BoardAutopsyProps) {
  const mountTime = useRef(Date.now())
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setFlagged(new Set())
    setSubmitted(false)
  }, [step.id])

  const board = step.board_autopsy_board ?? step.board ?? []
  const claimed = step.board_autopsy_claimed ?? {}
  const entries = Object.entries(claimed) as [FlopDimensionKey, string][]

  function toggle(key: string) {
    if (disabled || submitted) return
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer([...flagged], Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
      </div>

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_autopsy_prompt ?? 'This analysis has at least one mistake. Flag every claim that is wrong.'}
      </p>

      <div className="space-y-2">
        {entries.map(([key, value]) => {
          const isFlagged = flagged.has(key)
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || submitted}
              onClick={() => toggle(key)}
              className={cn(
                'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-150',
                isFlagged
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-border/40 bg-secondary/30 hover:border-violet-500/20 hover:bg-secondary/50',
              )}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">{DIMENSION_LABEL[key]}</p>
                <p className="text-sm font-semibold text-foreground">{VALUE_LABEL[value] ?? value}</p>
              </div>
              <Flag className={cn('h-4 w-4 shrink-0', isFlagged ? 'text-red-400' : 'text-muted-foreground/25')} />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled || submitted}
        onClick={handleSubmit}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Submit Findings
      </button>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { equityBucket, type EquityBucketId } from '@/lib/learn/flopClassifier'

interface EquityBucketProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

const BUCKETS: { id: EquityBucketId; label: string; range: string; color: string }[] = [
  { id: 'strong', label: 'Strong', range: '≥75%', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' },
  { id: 'good', label: 'Good', range: '50–75%', color: 'border-sky-500/50 bg-sky-500/10 text-sky-200' },
  { id: 'weak', label: 'Weak', range: '33–50%', color: 'border-amber-500/50 bg-amber-500/10 text-amber-200' },
  { id: 'trash', label: 'Trash', range: '<33%', color: 'border-red-500/50 bg-red-500/10 text-red-200' },
]

/**
 * Equity buckets — exact source thresholds (Strong>=75, Good 50-75, Weak
 * 33-50, Trash<33 hand-vs-range equity). 'threshold': place an abstract %
 * into its bucket. 'scenario': a hand-derived, combo-counted % (never
 * fabricated) with its derivation shown after answering. 'distribution':
 * a range's precomputed bucket mass, then an `options`-based question.
 */
export function EquityBucket({ step, onAnswer, disabled = false }: EquityBucketProps) {
  const mountTime = useRef(Date.now())
  const [picked, setPicked] = useState<string | null>(null)
  const mode = step.equity_bucket_mode ?? 'threshold'

  useEffect(() => {
    mountTime.current = Date.now()
    setPicked(null)
  }, [step.id])

  const options = useMemo(() => shuffleBySeed(step.options ?? [], step.id), [step.options, step.id])

  function pick(id: string) {
    if (disabled || picked) return
    setPicked(id)
    onAnswer(id, Date.now() - mountTime.current)
  }

  if (mode === 'distribution') {
    const range = step.equity_bucket_distribution_range ?? []
    const data = step.equity_bucket_distribution_data ?? {}
    const counts: Record<EquityBucketId, number> = { strong: 0, good: 0, weak: 0, trash: 0 }
    for (const h of range) {
      const pct = data[h]
      if (pct != null) counts[equityBucket(pct)]++
    }
    const total = Math.max(1, Object.values(counts).reduce((s, n) => s + n, 0))
    const hasSelected = picked !== null

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}
        {step.board && step.board.length > 0 && (
          <div className="flex items-center justify-center gap-2">
            {step.board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
        )}
        {range.length > 0 && <PokerRangeGrid range={range} />}

        <div className="flex h-6 rounded-full overflow-hidden border border-border/30">
          {BUCKETS.map((b) => (
            <div
              key={b.id}
              className={cn('flex items-center justify-center text-[9px] font-bold', b.color)}
              style={{ width: `${(counts[b.id] / total) * 100}%` }}
              title={`${b.label}: ${counts[b.id]}`}
            >
              {counts[b.id] > 0 && `${Math.round((counts[b.id] / total) * 100)}%`}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3 text-[10px] text-muted-foreground/50">
          {BUCKETS.map((b) => <span key={b.id}>{b.label}: {counts[b.id]}</span>)}
        </div>

        {step.equity_bucket_prompt && (
          <p className="text-center text-sm font-semibold text-foreground">{step.equity_bucket_prompt}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const isSelected = picked === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => pick(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                    : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // threshold / scenario modes
  const value = mode === 'scenario' ? step.equity_bucket_scenario_actual ?? 0 : step.equity_bucket_value ?? 0

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {mode === 'scenario' && step.equity_bucket_scenario_hero_hand && (
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero</span>
            <div className="flex gap-1">{step.equity_bucket_scenario_hero_hand.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
          </div>
          {step.board && step.board.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Board</span>
              <div className="flex gap-1">{step.board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
            </div>
          )}
        </div>
      )}

      {mode === 'threshold' && (
        <div className="text-center">
          <p className="text-4xl font-extrabold text-foreground">{value}%</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">equity vs. the stated range</p>
        </div>
      )}

      <p className="text-center text-sm font-semibold text-foreground">
        {step.equity_bucket_prompt ?? 'Which bucket does this belong in?'}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {BUCKETS.map((b) => {
          const isSelected = picked === b.id
          const hasSelected = picked !== null
          return (
            <button
              key={b.id}
              type="button"
              disabled={disabled || (hasSelected && !isSelected)}
              onClick={() => pick(b.id)}
              className={cn(
                'rounded-xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.97]',
                isSelected ? b.color : hasSelected ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 opacity-50' : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70',
              )}
            >
              <p className="text-sm font-bold">{b.label}</p>
              <p className="text-[11px] opacity-70">{b.range}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

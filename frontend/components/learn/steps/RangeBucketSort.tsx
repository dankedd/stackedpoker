'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface RangeBucketSortProps {
  step: LessonStep
  onAnswer: (assignments: Record<string, string>, timeMs: number) => void
  disabled?: boolean
}

const CATEGORY_COLORS = [
  { text: 'text-violet-300', bg: 'bg-violet-500/20', border: 'border-violet-500/40', chip: 'bg-violet-500/70' },
  { text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/40', chip: 'bg-blue-500/70' },
  { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/40', chip: 'bg-amber-500/70' },
  { text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/40', chip: 'bg-rose-500/70' },
]

/**
 * Sort a small pool of hands into named buckets (e.g. VALUE 3-BET / BLUFF 3-BET / CALL / FOLD).
 * Pick a bucket "palette" first, then tap hands to assign them to whichever bucket is active —
 * tapping an already-assigned hand cycles it to the next bucket instead of a drag interaction.
 */
export function RangeBucketSort({ step, onAnswer, disabled = false }: RangeBucketSortProps) {
  const mountTime = useRef(Date.now())
  const categories = step.range_bucket_categories ?? []
  const pool = step.range_bucket_pool ?? []

  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? '')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setAssignments({})
    setActiveCategory(categories[0]?.id ?? '')
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function categoryIndex(id: string | undefined) {
    return categories.findIndex((c) => c.id === id)
  }

  function handleHandClick(hand: string) {
    if (disabled || submitted) return
    setAssignments((prev) => ({ ...prev, [hand]: activeCategory }))
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(assignments, Date.now() - mountTime.current)
  }

  const allAssigned = pool.length > 0 && pool.every((h) => assignments[h])

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.range_bucket_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.range_bucket_prompt}</p>
      )}

      {/* Bucket palette — pick the active bucket, then tap hands below to assign them to it */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat, i) => {
          const colors = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled || submitted}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide border transition-all duration-150',
                isActive
                  ? `${colors.bg} ${colors.border} ${colors.text} shadow-md`
                  : 'border-border/40 bg-secondary/30 text-muted-foreground/50 hover:text-muted-foreground',
              )}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Hand pool */}
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-border/40 bg-card/40 p-4">
        {pool.map((hand) => {
          const assignedId = assignments[hand]
          const idx = categoryIndex(assignedId)
          const colors = idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : null
          return (
            <button
              key={hand}
              type="button"
              disabled={disabled || submitted}
              onClick={() => handleHandClick(hand)}
              className={cn(
                'min-w-[3.25rem] rounded-lg px-2.5 py-2 text-xs font-bold transition-all duration-150 active:scale-95 border',
                colors
                  ? `${colors.chip} text-white border-transparent shadow-sm`
                  : 'border-border/40 bg-secondary/50 text-foreground hover:bg-secondary/80',
              )}
            >
              {hand}
            </button>
          )
        })}
      </div>

      {/* Legend of current assignment state */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground/50">
        {categories.map((cat, i) => {
          const colors = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
          const count = pool.filter((h) => assignments[h] === cat.id).length
          return (
            <div key={cat.id} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-[2px]', colors.chip)} />
              <span>{cat.label}: {count}</span>
            </div>
          )
        })}
        <span>Unassigned: {pool.filter((h) => !assignments[h]).length}</span>
      </div>

      <button
        type="button"
        disabled={disabled || submitted || !allAssigned}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled || !allAssigned
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {submitted ? 'Submitted' : allAssigned ? 'Submit sort' : 'Assign every hand'}
      </button>
    </div>
  )
}

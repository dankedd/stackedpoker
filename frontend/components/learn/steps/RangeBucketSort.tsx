'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { CATEGORY_COLORS, CorrectnessIcon, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeBucketReveal, explainHandNotation, isPairSuitedOffsuit } from '@/lib/learn/revealHelpers'

interface RangeBucketSortProps {
  step: LessonStep
  onAnswer: (assignments: Record<string, string>, timeMs: number) => void
  disabled?: boolean
  /** Forces the post-submit reveal phase without requiring a real submission — used by tests. */
  reviewMode?: boolean
}

/**
 * Sort a small pool of hands into named buckets (Pair/Suited/Offsuit,
 * VALUE 3-BET / BLUFF 3-BET / CALL / FOLD, etc.). Pick a bucket "palette"
 * first, then tap hands to assign them to whichever bucket is active.
 *
 * Two phases before `onAnswer` fires: 'assign' (freely reassign, nothing
 * scored yet) -> 'reviewed' (frozen; every hand recolors to its CORRECT
 * category, incorrect hands get a red border + "Your answer: X" caption).
 * `onAnswer` only fires once the learner clicks Continue out of the reviewed
 * state, using the assignments exactly as they stood when "Submit sort" was
 * pressed — the reveal is purely a read of that frozen state, so it can never
 * change what gets scored.
 */
export function RangeBucketSort({ step, onAnswer, disabled = false, reviewMode = false }: RangeBucketSortProps) {
  const mountTime = useRef(Date.now())
  const categories = step.range_bucket_categories ?? []
  const pool = step.range_bucket_pool ?? []

  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? '')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [phase, setPhase] = useState<'assign' | 'reviewed'>(reviewMode ? 'reviewed' : 'assign')

  useEffect(() => {
    mountTime.current = Date.now()
    setAssignments({})
    setActiveCategory(categories[0]?.id ?? '')
    setPhase(reviewMode ? 'reviewed' : 'assign')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function categoryIndex(id: string | undefined) {
    return categories.findIndex((c) => c.id === id)
  }

  function categoryLabel(id: string | undefined) {
    return categories.find((c) => c.id === id)?.label ?? 'Unassigned'
  }

  function handleHandClick(hand: string) {
    if (disabled || phase === 'reviewed') return
    setAssignments((prev) => ({ ...prev, [hand]: activeCategory }))
  }

  const allAssigned = pool.length > 0 && pool.every((h) => assignments[h])

  function handleSubmit() {
    if (disabled || phase === 'reviewed' || !allAssigned) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(assignments, Date.now() - mountTime.current)
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeBucketReveal(step, assignments) : []),
    [phase, step, assignments],
  )
  const correctCount = reveal.filter((r) => r.correct).length
  const showExplanations = isPairSuitedOffsuit(categories)
  const mistakes = reveal.filter((r) => !r.correct)

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

      {phase === 'assign' && (
        <>
          {/* Bucket palette — pick the active bucket, then tap hands below to assign them to it */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat, i) => {
              const colors = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={disabled}
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
                  data-hand={hand}
                  disabled={disabled}
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
            disabled={disabled || !allAssigned}
            onClick={handleSubmit}
            className={cn(
              'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
              disabled || !allAssigned
                ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
            )}
          >
            {allAssigned ? 'Submit sort' : 'Assign every hand'}
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          <div className="space-y-1.5">
            {reveal.map((r) => {
              const idx = categoryIndex(r.correctCategoryId)
              const colors = idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : null
              return (
                <div
                  key={r.hand}
                  data-hand={r.hand}
                  data-correct={r.correct}
                  className={cn(
                    'flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2.5',
                    r.correct ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10',
                  )}
                >
                  <span className="w-14 shrink-0 text-sm font-bold text-foreground">{r.hand}</span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                      colors ? `${colors.chip} text-white` : 'bg-secondary/50 text-foreground',
                    )}
                  >
                    {categoryLabel(r.correctCategoryId)}
                  </span>
                  {!r.correct && (
                    <span className="text-[11px] text-muted-foreground/60">
                      Your answer: <span className="font-semibold text-red-300">{categoryLabel(r.yourCategoryId)}</span>
                    </span>
                  )}
                  <CorrectnessIcon correct={r.correct} className="ml-auto" />
                </div>
              )
            })}
          </div>

          {showExplanations && mistakes.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-1.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Why</p>
              {mistakes.map((r) => (
                <p key={r.hand} className="text-xs text-muted-foreground">{explainHandNotation(r.hand)}</p>
              ))}
            </div>
          )}

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

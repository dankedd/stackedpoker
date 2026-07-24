'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { SortableRankingList } from '@/components/learn/SortableRankingList'

interface HandRankingOrderProps {
  step: LessonStep
  onAnswer: (order: string[], timeMs: number) => void
  disabled?: boolean
}

/**
 * True sortable drag-and-drop (desktop pointer, touch, or keyboard — see
 * SortableRankingList) to reorder all 10 standard hand categories from
 * strongest to weakest.
 *
 * Two local phases before handing off to the generic evaluate()/StepFeedback
 * flow: 'arrange' (freely reorder, nothing scored yet) and 'reviewed' (frozen,
 * per-slot correct/incorrect highlighting plus the full correct hierarchy
 * shown below) — `onAnswer` (which drives scoring/XP) only fires once the
 * learner clicks Continue out of the reviewed state, so nothing is scored
 * before an actual submitted answer.
 */
export function HandRankingOrder({ step, onAnswer, disabled = false }: HandRankingOrderProps) {
  const mountTime = useRef(Date.now())
  const items = step.hand_ranking_order_items ?? []
  const correctOrder = useMemo(() => items.map((i) => i.id), [items])

  const initialOrder = useMemo(() => {
    const shuffled = shuffleBySeed(correctOrder, step.id)
    // Deterministic shuffle could, in principle, land on the exact correct
    // order — guarantee it never ships pre-solved by swapping the first two
    // slots in that (astronomically unlikely) case.
    const isAlreadyCorrect = shuffled.length > 1 && shuffled.every((id, i) => id === correctOrder[i])
    if (isAlreadyCorrect) {
      const swapped = [...shuffled]
      ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
      return swapped
    }
    return shuffled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const [order, setOrder] = useState<string[]>(initialOrder)
  const [phase, setPhase] = useState<'arrange' | 'reviewed'>('arrange')

  useEffect(() => {
    mountTime.current = Date.now()
    setOrder(initialOrder)
    setPhase('arrange')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const arranging = phase === 'arrange' && !disabled

  function handleCheckOrder() {
    if (!arranging) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(order, Date.now() - mountTime.current)
  }

  const allCorrect = phase === 'reviewed' && order.every((id, i) => id === correctOrder[i])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.hand_ranking_order_prompt && (
        <p className="text-center text-base font-semibold text-foreground">
          {step.hand_ranking_order_prompt}
        </p>
      )}

      <SortableRankingList
        ids={order}
        onReorder={setOrder}
        disabled={!arranging}
        ariaLabel="Hand ranking order, strongest to weakest"
        className="space-y-2"
        renderItem={(id, i, { isDragging, attributes, listeners }) => {
          const item = itemById.get(id)
          if (!item) return null
          const isCorrectSlot = phase === 'reviewed' ? id === correctOrder[i] : null
          const positionLabel = i === 0 ? 'Strongest' : i === order.length - 1 ? 'Weakest' : null

          return (
            <div
              data-category-id={id}
              {...attributes}
              {...(arranging ? listeners : {})}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-shadow duration-150',
                arranging && 'cursor-grab select-none active:cursor-grabbing',
                phase === 'reviewed'
                  ? isCorrectSlot
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-red-500/40 bg-red-500/10'
                  : isDragging
                  ? 'border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/20 scale-[1.02]'
                  : 'border-border/50 bg-secondary/40',
              )}
            >
              {/* Position badge */}
              <div className="flex w-12 shrink-0 flex-col items-center">
                <span className="text-base font-black text-foreground/80 tabular-nums">{i + 1}</span>
                {positionLabel && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                    {positionLabel}
                  </span>
                )}
              </div>

              {/* Drag handle — visual affordance; the whole row is draggable */}
              {arranging && (
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" aria-hidden />
              )}

              {/* Category label + example hand */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-sm font-semibold text-foreground truncate">{item.label}</span>
                <div className="flex shrink-0 gap-0.5">
                  {item.example.map((card, ci) => (
                    <PlayingCardMini key={ci} card={card} size="xs" />
                  ))}
                </div>
              </div>

              {/* Review-state correctness icon */}
              {phase === 'reviewed' && (
                isCorrectSlot
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Correct position" />
                  : <XCircle className="h-4 w-4 shrink-0 text-red-400" aria-label="Incorrect position" />
              )}
            </div>
          )
        }}
      />

      {phase === 'arrange' && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleCheckOrder}
          className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
        >
          Check order
        </button>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p
            className={cn(
              'text-center text-sm font-semibold',
              allCorrect ? 'text-emerald-400' : 'text-amber-400',
            )}
          >
            {allCorrect
              ? 'Every category is in the right order.'
              : `${order.filter((id, i) => id === correctOrder[i]).length} of ${order.length} in the right spot — review the full hierarchy below.`}
          </p>

          {!allCorrect && (
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Correct order — strongest to weakest
              </p>
              <ol className="space-y-1.5">
                {correctOrder.map((id, i) => {
                  const item = itemById.get(id)
                  if (!item) return null
                  return (
                    <li key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-4 shrink-0 text-right font-bold tabular-nums">{i + 1}</span>
                      <span className="font-medium text-foreground/80">{item.label}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={handleContinue}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { SortableRankingList } from '@/components/learn/SortableRankingList'
import { CorrectnessIcon, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeOrderReveal } from '@/lib/learn/revealHelpers'

interface BoardSortingPuzzleProps {
  step: LessonStep
  onAnswer: (order: string[], timeMs: number) => void
  disabled?: boolean
  reviewMode?: boolean
}

/**
 * Drag boards onto a horizontal IP-favor <-> BB-favor spectrum. Same step type,
 * data (`board_rank_sort_boards`/`_target`), and evaluator (`evalBoardRankSort`)
 * as `BoardRankSort.tsx`'s tap-to-reorder list — this is purely a different,
 * presentational front-end for `board_rank_sort_layout: 'spectrum'`.
 *
 * Drag is via `SortableRankingList`'s horizontal axis (pointer, touch, AND
 * keyboard sensors). Per-tile move-left/move-right buttons are an explicit,
 * always-visible non-drag alternative — not just the less-discoverable keyboard
 * drag-and-drop path.
 */
export function BoardSortingPuzzle({ step, onAnswer, disabled = false, reviewMode = false }: BoardSortingPuzzleProps) {
  const mountTime = useRef(Date.now())
  const boards = useMemo(
    () => shuffleBySeed(step.board_rank_sort_boards ?? [], step.id),
    [step.board_rank_sort_boards, step.id],
  )
  const target = step.board_rank_sort_target ?? []
  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])
  const lowLabel = step.board_rank_sort_spectrum_low_label ?? 'IP FAVOR'
  const highLabel = step.board_rank_sort_spectrum_high_label ?? 'BB FAVOR'

  const [order, setOrder] = useState<string[]>(() => boards.map((b) => b.id))
  const [phase, setPhase] = useState<'arrange' | 'reviewed'>(reviewMode ? 'reviewed' : 'arrange')

  useEffect(() => {
    mountTime.current = Date.now()
    setOrder(boards.map((b) => b.id))
    setPhase(reviewMode ? 'reviewed' : 'arrange')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function moveTile(id: string, direction: -1 | 1) {
    if (disabled || phase === 'reviewed') return
    setOrder((prev) => {
      const idx = prev.indexOf(id)
      const nextIdx = idx + direction
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const next = prev.slice()
      ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
      return next
    })
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(order, Date.now() - mountTime.current)
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeOrderReveal(order, target) : []),
    [phase, order, target],
  )
  const correctCount = reveal.filter((r) => r.correct).length

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_rank_sort_prompt ?? 'Drag the boards onto the spectrum — most IP-favored to most BB-favored.'}
      </p>

      {phase === 'arrange' && (
        <>
          <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
            <span>{lowLabel}</span>
            <span className="flex-1 mx-3 h-px bg-gradient-to-r from-violet-500/30 via-border/30 to-blue-500/30" />
            <span>{highLabel}</span>
          </div>

          <SortableRankingList
            id={`board-sort-${step.id}`}
            ids={order}
            onReorder={setOrder}
            disabled={disabled}
            axis="horizontal"
            ariaLabel="Boards on the IP-to-BB favor spectrum"
            className="flex items-stretch gap-2 overflow-x-auto pb-1"
            renderItem={(id, index, drag) => {
              const b = boardById.get(id)
              if (!b) return null
              return (
                <div
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2.5 min-w-[92px] transition-all',
                    drag.isDragging ? 'border-violet-500/60 bg-violet-500/15 shadow-lg' : 'border-border/40 bg-secondary/30',
                  )}
                >
                  <div className="flex items-center gap-1 w-full">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => moveTile(id, -1)}
                      aria-label={`Move ${b.label ?? id} toward ${lowLabel}`}
                      className="rounded p-0.5 text-muted-foreground/40 hover:text-violet-300 disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span
                      {...drag.attributes}
                      {...drag.listeners}
                      className="flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
                      aria-label={`Drag ${b.label ?? id} to reorder`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/25" />
                    </span>
                    <button
                      type="button"
                      disabled={disabled || index === order.length - 1}
                      onClick={() => moveTile(id, 1)}
                      aria-label={`Move ${b.label ?? id} toward ${highLabel}`}
                      className="rounded p-0.5 text-muted-foreground/40 hover:text-blue-300 disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {b.label && <p className="text-center text-[9px] font-semibold text-muted-foreground/50">{b.label}</p>}
                  <div className="flex items-center justify-center gap-1">
                    {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-violet-300/70">{index + 1}</span>
                </div>
              )
            }}
          />

          <button
            type="button"
            disabled={disabled || order.length === 0}
            onClick={() => setPhase('reviewed')}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            Check order
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          <div className="space-y-2">
            {reveal.map((r) => {
              const b = boardById.get(r.id)
              if (!b) return null
              return (
                <div
                  key={r.id}
                  data-board-id={r.id}
                  data-correct={r.correct}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                    r.correct ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10',
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-base font-black tabular-nums text-foreground/80">
                    {r.position + 1}
                  </span>
                  {b.label && (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                      {b.label}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1">
                    {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
                  </div>
                  <CorrectnessIcon correct={r.correct} className="ml-auto" />
                </div>
              )
            })}
          </div>

          {correctCount < reveal.length && (
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Correct order — {lowLabel.toLowerCase()} to {highLabel.toLowerCase()}
              </p>
              <ol className="space-y-1.5">
                {target.map((id, i) => {
                  const b = boardById.get(id)
                  if (!b) return null
                  return (
                    <li key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-4 shrink-0 text-right font-bold tabular-nums">{i + 1}</span>
                      {b.label && <span className="font-medium text-foreground/80">{b.label}</span>}
                      <div className="flex shrink-0 gap-0.5">
                        {b.board.map((c, ci) => <PlayingCardMini key={ci} card={c} size="xs" />)}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

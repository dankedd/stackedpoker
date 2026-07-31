'use client'

import { ArrowDown, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'

/**
 * Small shared UI pieces for the "Submit -> reveal correct answer -> Continue"
 * flow used by every multi-item classify/sort/match step (RangeBucketSort,
 * BoardRankSort, StraightDetective, BoardAutopsy, HandRankingOrder, and
 * board_volatility's continuum_sort). Keeping these here means every new step
 * type that follows the same interaction pattern gets the same look for free
 * instead of re-inventing it.
 */

type MiniCardSize = 'xs' | 'sm' | 'md' | 'lg'

/** One item in a board-ordering exercise — a board plus an optional caption
 *  shown above it (e.g. BoardRankSort's "Dry Ace-high"; continuum_sort has none). */
export interface OrderedBoardItem {
  board: string[]
  label?: string
}

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

// ── Board-ordering reveal (BoardRankSort, board_volatility continuum_sort) ───
// Every "order these boards" exercise reveals the same two things: how the
// learner's own submitted order scored slot-by-slot, and what the actual
// correct order looks like — always as real board cards via PlayingCardMini,
// never as a joined text string. Shared here so a future ordering step gets
// this reveal for free instead of a new bespoke one.

/** One row of "your order" — position number, optional label, the board's
 *  cards, and a correct/incorrect indicator for that slot. `id` is stamped on
 *  as `data-board-id`/`data-correct` so per-row assertions in tests keep working
 *  regardless of which step type is rendering the row. */
export function OrderedBoardRow({
  id,
  position,
  item,
  correct,
  cardSize = 'sm',
}: {
  id: string
  position: number
  item: OrderedBoardItem
  correct: boolean
  cardSize?: MiniCardSize
}) {
  return (
    <div
      data-board-id={id}
      data-correct={correct}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        correct ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10',
      )}
    >
      <span className="w-6 shrink-0 text-center text-base font-black tabular-nums text-foreground/80">
        {position + 1}
      </span>
      {item.label && (
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
          {item.label}
        </span>
      )}
      <div className="flex shrink-0 gap-1">
        {item.board.map((c, i) => <PlayingCardMini key={i} card={c} size={cardSize} />)}
      </div>
      <CorrectnessIcon correct={correct} className="ml-auto" />
    </div>
  )
}

/** The canonical "here's the correct solution" spectrum for a board-ordering
 *  exercise: boards stacked in their correct sequence with an arrow between
 *  each, bracketed by end-of-spectrum captions (e.g. "LOW VOLATILITY" /
 *  "HIGH VOLATILITY", or "BETS MOST" / "BETS LEAST"). Always real board
 *  cards — the thing this component exists to replace is a plain joined
 *  text string like "K♣K♥K♦ → A♠K♦4♣ → ...".*/
export function BoardOrderSpectrum({
  order,
  itemsById,
  startLabel,
  endLabel,
  cardSize = 'sm',
}: {
  order: string[]
  itemsById: Map<string, OrderedBoardItem>
  startLabel: string
  endLabel: string
  cardSize?: MiniCardSize
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {startLabel}
      </p>
      <div className="my-2.5 border-t border-border/30" />
      <div className="flex flex-col items-center gap-1">
        {order.map((id, i) => {
          const item = itemsById.get(id)
          if (!item) return null
          const isLast = i === order.length - 1
          return (
            <div key={id} className="flex flex-col items-center">
              {item.label && (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                  {item.label}
                </p>
              )}
              <div className="flex items-center gap-1">
                {item.board.map((c, ci) => <PlayingCardMini key={ci} card={c} size={cardSize} />)}
              </div>
              {!isLast && <ArrowDown className="my-1.5 h-4 w-4 shrink-0 text-muted-foreground/30" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
      <div className="my-2.5 border-t border-border/30" />
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {endLabel}
      </p>
    </div>
  )
}

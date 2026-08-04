'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { estimateVolatility, turnImpact } from '@/lib/learn/flopClassifier'
import { BoardOrderSpectrum, CorrectnessIcon, OrderedBoardRow, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeFlagReveal, computeOrderReveal, type FlagRevealItem } from '@/lib/learn/revealHelpers'

interface BoardVolatilityProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
  /** Forces continuum_sort's post-submit reveal phase without a real submission — used by tests. */
  reviewMode?: boolean
}

/**
 * Three sub-modes sharing one static/dynamic-reading interaction:
 * 'runout_storm' — tap the turn cards that meaningfully change the board
 *   (graded live via `turnImpact`, a labeled heuristic, never solver-exact).
 * 'compare' — which of two boards is more dynamic (uses `options`).
 * 'continuum_sort' — order several boards from most static to most dynamic.
 */
export function BoardVolatility({ step, onAnswer, disabled = false, reviewMode = false }: BoardVolatilityProps) {
  const mountTime = useRef(Date.now())
  const mode = step.board_volatility_mode ?? 'runout_storm'

  useEffect(() => {
    mountTime.current = Date.now()
  }, [step.id])

  if (mode === 'compare') {
    return <CompareMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
  }
  if (mode === 'continuum_sort') {
    return <ContinuumSortMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} reviewMode={reviewMode} />
  }
  return <RunoutStormMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
}

/** Why a card that DOESN'T change the board was still a reasonable guess to
 *  consider — kept generic (true for any card here by construction, since
 *  `turnImpact` already ruled out pairing/flush/straight impact) rather than
 *  invented per-card, so it never overclaims a specific mechanism that isn't
 *  actually present. */
const NO_IMPACT_EXPLANATION =
  "This card doesn't pair the board, complete a flush, or complete one of the board's possible straights — the two ranges' relative strength barely moves. Not every card that looks scary actually shifts who's ahead."

/**
 * Two phases before `onAnswer` fires — same "select -> reviewed -> Continue"
 * contract as StraightDetective/BoardRankSort: 'select' (freely retoggle,
 * unscored) -> 'reviewed' (frozen; every candidate card shows correct/
 * incorrect via the shared `computeFlagReveal`, plus a `turnImpact`-derived
 * explanation for anything the learner got wrong — never just "close, missed
 * 1 card"). `onAnswer` only fires on Continue, using the selection exactly as
 * submitted — the reveal never changes what gets scored, which still lives
 * entirely in `evalIdSetSelection` (evaluator.ts).
 */
function RunoutStormMode({ step, onAnswer, disabled, mountTime }: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'select' | 'reviewed'>('select')
  const board = step.board_volatility_board ?? step.board ?? []
  const pool = useMemo(() => shuffleBySeed(step.board_volatility_storm_pool ?? [], step.id), [step.board_volatility_storm_pool, step.id])

  const correctIds = useMemo(() => {
    if (board.length !== 3) return new Set<string>()
    const flop: [string, string, string] = [board[0], board[1], board[2]]
    return new Set(pool.filter((card) => turnImpact(flop, card).changesBoard))
  }, [board, pool])

  useEffect(() => {
    setSelected(new Set())
    setPhase('select')
  }, [step.id])

  function toggle(card: string) {
    if (disabled || phase === 'reviewed') return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(card)) next.delete(card)
      else next.add(card)
      return next
    })
  }

  function handleCheck() {
    if (disabled || phase === 'reviewed') return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer([...selected], Date.now() - (mountTime.current ?? Date.now()))
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeFlagReveal(pool, selected, correctIds) : []),
    [phase, pool, selected, correctIds],
  )
  const correctCount = reveal.filter((r) => r.correct).length

  function explanationFor(r: FlagRevealItem): string | null {
    if (r.correct) return null
    if (r.shouldBeSelected) {
      // Missed — the card DOES change the board; explain why, via the exact
      // same live-computed reasons `evalIdSetSelection` scored against.
      if (board.length !== 3) return null
      const flop: [string, string, string] = [board[0], board[1], board[2]]
      return turnImpact(flop, r.id).reasons.join(' ')
    }
    // Wrongly flagged — the card does NOT change the board.
    return NO_IMPACT_EXPLANATION
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {board.map((card, i) => <PlayingCardMini key={i} card={card} size="md" />)}
      </div>

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_volatility_prompt ?? 'Which turn cards would meaningfully change this board?'}
      </p>

      {phase === 'select' && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {pool.map((card) => {
              const isSelected = selected.has(card)
              return (
                <button
                  key={card}
                  type="button"
                  data-card={card}
                  disabled={disabled}
                  onClick={() => toggle(card)}
                  className={cn(
                    'rounded-lg transition-all duration-150 active:scale-[0.95] p-0.5',
                    isSelected ? 'ring-2 ring-violet-500/60' : '',
                  )}
                >
                  <PlayingCardMini card={card} size="sm" />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleCheck}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Check cards
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          <div className="space-y-2">
            {reveal.map((r) => {
              const explanation = explanationFor(r)
              return (
                <div
                  key={r.id}
                  data-card={r.id}
                  data-correct={r.correct}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3 py-2.5',
                    r.correct
                      ? r.selected
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border/30 bg-secondary/20'
                      : r.selected
                      ? 'border-red-500/40 bg-red-500/10'
                      : 'border-amber-500/40 bg-amber-500/10',
                  )}
                >
                  <PlayingCardMini card={r.id} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">
                        {r.correct
                          ? r.selected ? 'Correctly flagged' : 'Correctly left out'
                          : r.selected ? "Doesn't actually change the board" : 'Missed'}
                      </span>
                      <CorrectnessIcon correct={r.correct} />
                    </div>
                    {explanation && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

/** Strips a trailing "(cards)" parenthetical from an option label — e.g.
 *  "Board A (8♥7♥3♦)" -> "Board A". Once the button sits directly under its
 *  own board (see CompareMode below), repeating the card text in the button
 *  itself is just noise; the cards are already right there. */
function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '')
}

/**
 * Two boards, pick one (plus optionally a non-board option like "About the
 * same"). Answer buttons are deliberately NEVER shuffled and NEVER run
 * through `orderStepOptions` — the 'a' option always renders directly under
 * Board A (left) and the 'b' option directly under Board B (right), so the
 * challenge is judging the boards, not remembering which button maps to
 * which side. Any option that isn't 'a'/'b' (e.g. "about the same") renders
 * as its own full-width choice below both boards.
 */
function CompareMode({ step, onAnswer, disabled, mountTime }: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [selected, setSelected] = useState<string | null>(null)
  const a = step.board_volatility_compare_a ?? []
  const b = step.board_volatility_compare_b ?? []
  const options = step.options ?? []
  const optionA = options.find((o) => o.id === 'a')
  const optionB = options.find((o) => o.id === 'b')
  const otherOptions = options.filter((o) => o.id !== 'a' && o.id !== 'b')

  useEffect(() => setSelected(null), [step.id])

  function handleSelect(id: string) {
    if (disabled || selected) return
    setSelected(id)
    onAnswer(id, Date.now() - (mountTime.current ?? Date.now()))
  }

  const hasSelected = selected !== null

  function buttonClass(id: string) {
    const isSelected = selected === id
    return cn(
      'relative w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border overflow-hidden',
      isSelected
        ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
        : hasSelected
        ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
        : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.board_volatility_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.board_volatility_prompt}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board A</p>
          <div className="flex items-center justify-center gap-1.5">{a.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
          {optionA && (
            <button
              type="button"
              disabled={disabled || (hasSelected && selected !== optionA.id)}
              onClick={() => handleSelect(optionA.id)}
              className={buttonClass(optionA.id)}
            >
              {shortLabel(optionA.label)}
            </button>
          )}
        </div>
        <div className="space-y-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board B</p>
          <div className="flex items-center justify-center gap-1.5">{b.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
          {optionB && (
            <button
              type="button"
              disabled={disabled || (hasSelected && selected !== optionB.id)}
              onClick={() => handleSelect(optionB.id)}
              className={buttonClass(optionB.id)}
            >
              {shortLabel(optionB.label)}
            </button>
          )}
        </div>
      </div>

      {otherOptions.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {otherOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || (hasSelected && selected !== opt.id)}
              onClick={() => handleSelect(opt.id)}
              className={cn(buttonClass(opt.id), 'text-left')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Two phases before `onAnswer` fires — same "arrange -> reviewed -> Continue"
 * contract as `BoardRankSort`/`StraightDetective`: 'arrange' (freely retap,
 * unscored) -> 'reviewed' (frozen; every slot shows correct/incorrect plus
 * the full correct order as a real low-to-high volatility spectrum, via the
 * shared `OrderedBoardRow`/`BoardOrderSpectrum` from RevealKit — never a
 * joined text string). `onAnswer` only fires on Continue, using the order
 * exactly as submitted — the reveal never changes what gets scored, which
 * still lives entirely in `evalBoardVolatility`'s inversion-count grading.
 */
function ContinuumSortMode({
  step, onAnswer, disabled, mountTime, reviewMode = false,
}: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [order, setOrder] = useState<string[]>([])
  const [phase, setPhase] = useState<'arrange' | 'reviewed'>(reviewMode ? 'reviewed' : 'arrange')
  const boards = useMemo(() => shuffleBySeed(step.board_volatility_continuum_boards ?? [], step.id), [step.board_volatility_continuum_boards, step.id])
  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])

  // Same ground truth `evalBoardVolatility` scores against — live-derived from
  // `estimateVolatility`, never a hand-authored key, so this can't drift from
  // what actually gets graded.
  const correctOrder = useMemo(() => {
    const scoreById = new Map(boards.map((b) => [b.id, estimateVolatility([b.board[0], b.board[1], b.board[2]]).score]))
    return [...boards].sort((a, b) => (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0)).map((b) => b.id)
  }, [boards])

  useEffect(() => {
    setOrder([])
    setPhase(reviewMode ? 'reviewed' : 'arrange')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function handleTap(id: string) {
    if (disabled || phase === 'reviewed') return
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCheckOrder() {
    if (disabled || phase === 'reviewed' || order.length !== boards.length) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(order, Date.now() - (mountTime.current ?? Date.now()))
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeOrderReveal(order, correctOrder) : []),
    [phase, order, correctOrder],
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
        {step.board_volatility_prompt ?? 'Tap the boards in order, from most static to most dynamic.'}
      </p>

      {phase === 'arrange' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {boards.map((b) => {
              const position = order.indexOf(b.id)
              const isPicked = position >= 0
              return (
                <button
                  key={b.id}
                  type="button"
                  data-board-id={b.id}
                  disabled={disabled}
                  onClick={() => handleTap(b.id)}
                  className={cn(
                    'relative rounded-xl border p-2.5 transition-all duration-150',
                    isPicked ? 'border-violet-500/50 bg-violet-500/10' : 'border-border/40 bg-secondary/30 hover:border-violet-500/20',
                  )}
                >
                  {isPicked && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                      {position + 1}
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1">
                    {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[9px] text-muted-foreground/40">
            <span>1 = most static</span>
            <span>{boards.length} = most dynamic</span>
          </div>

          <button
            type="button"
            disabled={disabled || order.length !== boards.length}
            onClick={handleCheckOrder}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Check order
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          {correctCount < reveal.length && (
            <div className="space-y-2">
              {reveal.map((r) => {
                const b = boardById.get(r.id)
                if (!b) return null
                return <OrderedBoardRow key={r.id} id={r.id} position={r.position} item={b} correct={r.correct} />
              })}
            </div>
          )}

          <BoardOrderSpectrum
            order={correctOrder}
            itemsById={boardById}
            startLabel="LOW VOLATILITY"
            endLabel="HIGH VOLATILITY"
          />

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

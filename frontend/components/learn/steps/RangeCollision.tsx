'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { orderStepOptions } from '@/lib/learn/interactionSafety'
import { RangeCollisionViewer } from '@/components/learn/visuals/RangeCollisionViewer'
import { RangeEquityMeter } from '@/components/learn/visuals/RangeEquityMeter'
import { ShowMeWhy } from '@/components/learn/ShowMeWhy'
import { ReviewContinueButton } from '@/components/learn/RevealKit'

interface RangeCollisionProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

/**
 * The Range Collision Viewer step — four modes sharing one component:
 *  - 'reveal': show both ranges + board, then the preflop -> postflop equity
 *    shift (Lesson 1's central book scenario). Unscored (no `options`).
 *  - 'predict': ranges + board are visible; the EQUITY is hidden until the
 *    learner commits to a favor-scale guess (Lesson 2). Scored via `options`.
 *  - 'morph': switch between curated board states with the same two ranges,
 *    watching the grids/meter update live (Lesson 3). Unscored.
 *  - 'archaeology': anonymized ranges; guess which side is the preflop raiser,
 *    then reveal real identities (Lesson 5). Scored via `options`.
 */
export function RangeCollision({ step, onAnswer, disabled = false }: RangeCollisionProps) {
  const mountTime = useRef(Date.now())
  const mode = step.range_collision_mode ?? 'reveal'
  const a = step.range_collision_a
  const b = step.range_collision_b
  const boards = step.range_collision_boards
  const [activeBoardId, setActiveBoardId] = useState<string | undefined>(boards?.[0]?.id)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setActiveBoardId(boards?.[0]?.id)
    setSelected(null)
    setRevealed(mode === 'reveal') // reveal mode has nothing to gate; predict/archaeology/morph start hidden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const rawOptions = step.options ?? []
  const options = useMemo(() => orderStepOptions(rawOptions, step.id), [rawOptions, step.id])

  const activeBoard = useMemo(
    () => boards?.find((bd) => bd.id === activeBoardId) ?? boards?.[0],
    [boards, activeBoardId],
  )

  const board = mode === 'morph' ? activeBoard?.board ?? step.board ?? [] : step.board ?? []
  const preflopEquity = mode === 'morph' ? activeBoard?.preflop_equity : step.range_collision_preflop_equity
  const postflopEquity = mode === 'morph' ? activeBoard?.postflop_equity : step.range_collision_postflop_equity

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    setRevealed(true)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(null, Date.now() - mountTime.current)
  }

  if (!a || !b || board.length === 0) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Range collision data missing.</p>
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Prose/controls stay at a normal reading width even though this step type widens
       *  the outer lesson container — only RangeCollisionViewer (below) needs the room. */}
      <div className="max-w-2xl mx-auto w-full space-y-5">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}

        {mode === 'morph' && boards && boards.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {boards.map((bd) => (
              <button
                key={bd.id}
                type="button"
                onClick={() => setActiveBoardId(bd.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors border',
                  bd.id === activeBoardId
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                    : 'border-border/40 bg-secondary/30 text-muted-foreground/50 hover:text-muted-foreground',
                )}
              >
                {bd.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <RangeCollisionViewer
        a={a}
        b={b}
        board={board}
        emphasizeCategories={step.range_collision_emphasize_categories}
      />

      <div className="max-w-2xl mx-auto w-full space-y-5">
        {mode === 'predict' && !revealed && (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
            <p className="text-center text-xs font-semibold text-foreground">
              {step.range_collision_prompt ?? 'Which range does this flop favor?'}
            </p>
            <div className={cn('grid gap-2', options.length > 3 ? 'grid-cols-5' : 'grid-cols-3')}>
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className="rounded-lg border border-border/40 bg-secondary/30 px-2 py-2.5 text-[10px] font-semibold text-foreground hover:border-violet-500/40 hover:bg-violet-500/10 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'archaeology' && !revealed && (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
            <p className="text-center text-xs font-semibold text-foreground">
              {step.range_collision_prompt ?? 'Which range is more likely to belong to the preflop raiser?'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className="rounded-xl border border-border/50 bg-secondary/40 px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/70 hover:border-violet-500/30 transition-all text-left"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {revealed && (preflopEquity || postflopEquity) && (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4 animate-in fade-in duration-300">
            {preflopEquity && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/40">Preflop</p>
                <RangeEquityMeter aLabel={a.label} bLabel={b.label} aEquity={preflopEquity.a} />
              </div>
            )}
            {postflopEquity && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/40">
                  On this board
                </p>
                <RangeEquityMeter aLabel={a.label} bLabel={b.label} aEquity={postflopEquity.a} />
              </div>
            )}
          </div>
        )}

        {mode === 'archaeology' && revealed && step.range_collision_reveal_labels && (
          <p className="text-center text-sm text-foreground">
            <span className="font-bold text-violet-300">{a.label}</span> is actually{' '}
            <span className="font-bold">{step.range_collision_reveal_labels.a}</span>
            {' · '}
            <span className="font-bold text-blue-300">{b.label}</span> is actually{' '}
            <span className="font-bold">{step.range_collision_reveal_labels.b}</span>
          </p>
        )}

        {revealed && step.range_collision_show_me_why && (
          <ShowMeWhy layers={step.range_collision_show_me_why} />
        )}

        {(mode === 'reveal' || mode === 'morph') && (
          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        )}
      </div>
    </div>
  )
}

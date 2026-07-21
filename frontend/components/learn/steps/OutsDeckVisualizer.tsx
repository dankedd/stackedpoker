'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import {
  drawProbabilityNextCard,
  drawProbabilityByRiver,
  outsToEquityFlop,
  outsToEquityTurn,
  BACKDOOR_EQUITY,
} from '@/lib/theory/math'

// ── Deck helpers (rank+suit convention matches ComboVisualizer: e.g. 'Ah') ────

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const SUITS = ['s', 'h', 'd', 'c']

function fullDeck(): string[] {
  const deck: string[] = []
  for (const s of SUITS) for (const r of RANKS) deck.push(`${r}${s}`)
  return deck
}

function norm(card: string): string {
  return card.length >= 2 ? `${card[0].toUpperCase()}${card[1].toLowerCase()}` : card
}

function buildUnseenDeck(known: string[]): string[] {
  const knownSet = new Set(known.map(norm))
  return fullDeck().filter((c) => !knownSet.has(c))
}

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const RED_SUITS = new Set(['h', 'd'])

function DeckTile({ card, state }: { card: string; state: 'neutral' | 'out' | 'dead' }) {
  const suit = card[1]
  const isRed = RED_SUITS.has(suit)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border aspect-[3/4] text-[10px] font-bold leading-none',
        'animate-in fade-in zoom-in-95 duration-300 fill-mode-both',
        state === 'out'
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
          : state === 'dead'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300/80 border-dashed'
          : 'border-border/25 bg-secondary/20 text-muted-foreground/30',
      )}
    >
      <span>{card[0]}</span>
      <span className={cn(state === 'neutral' && (isRed ? 'text-red-500/30' : 'text-foreground/20'))}>
        {SUIT_SYMBOL[suit]}
      </span>
    </div>
  )
}

function StatTile({ label, value, color = 'slate' }: { label: string; value: string; color?: 'slate' | 'amber' | 'violet' | 'emerald' }) {
  const colorClasses = {
    slate:   'border-border/30 bg-secondary/20 text-foreground',
    amber:   'border-amber-500/20 bg-amber-500/8 text-amber-300',
    violet:  'border-violet-500/20 bg-violet-500/8 text-violet-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300',
  }[color]
  return (
    <div className={cn('flex-1 rounded-xl border p-2.5 text-center', colorClasses)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-60 mb-0.5">{label}</p>
      <p className="text-base font-black tabular-nums">{value}</p>
    </div>
  )
}

interface OutsDeckVisualizerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

export function OutsDeckVisualizer({ step, onAnswer, disabled = false }: OutsDeckVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)

  const mode = step.outs_deck_mode ?? 'count_outs'
  const heroHand = step.hero_hand ?? []
  const board = step.board ?? []
  const knownCards = step.outs_deck_known_cards ?? [...heroHand, ...board]
  const outCards = step.outs_deck_out_cards ?? []
  const deadOutCards = step.outs_deck_dead_out_cards ?? []
  const unseen = step.outs_deck_unseen_count ?? (knownCards.length > 0 ? 52 - knownCards.length : 47)

  const nominalOuts = outCards.length > 0 ? outCards.length : step.outs_deck_outs_count ?? 0
  const cleanOuts = nominalOuts - deadOutCards.length

  const isChallenge = step.outs_deck_correct != null
  const maxAnswer = mode === 'clean_dirty' ? Math.max(nominalOuts, 1) : 100
  const [answer, setAnswer] = useState(mode === 'clean_dirty' ? Math.round(maxAnswer / 2) : 25)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setAnswer(mode === 'clean_dirty' ? Math.round(maxAnswer / 2) : 25)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const deck = useMemo(
    () => (knownCards.length > 0 ? buildUnseenDeck(knownCards) : []),
    [knownCards],
  )
  const outSet = useMemo(() => new Set(outCards.map(norm)), [outCards])
  const deadSet = useMemo(() => new Set(deadOutCards.map(norm)), [deadOutCards])

  const nextCardPct = drawProbabilityNextCard(nominalOuts, unseen) * 100
  const riverPct = drawProbabilityByRiver(nominalOuts, unseen) * 100
  const quickFlop = outsToEquityFlop(nominalOuts) * 100
  const quickTurn = outsToEquityTurn(nominalOuts) * 100

  function submitReveal() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(null, Date.now() - mountTime.current)
  }

  function submitAnswer() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(answer, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {(heroHand.length > 0 || board.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {heroHand.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero</span>
              <div className="flex gap-1">{heroHand.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
            </div>
          )}
          {board.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Board</span>
              <div className="flex gap-1">{board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
            </div>
          )}
        </div>
      )}

      {deck.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
            {deck.map((card, i) => {
              const isOut = outSet.has(card)
              const isDead = isOut && mode === 'clean_dirty' && deadSet.has(card)
              return (
                <div key={card} style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }}>
                  <DeckTile card={card} state={isDead ? 'dead' : isOut ? 'out' : 'neutral'} />
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-[10px] text-muted-foreground/40">
            {unseen} unseen cards
            {nominalOuts > 0 && <> · <span className="text-emerald-400/80 font-semibold">{nominalOuts} outs</span> highlighted</>}
          </p>
        </div>
      )}

      {/* Mode-specific stat panels */}
      {mode === 'count_outs' && nominalOuts > 0 && (
        <div className="flex items-center gap-2.5">
          <StatTile label="Suit total" value="13" />
          <StatTile label="Already seen" value={String(13 - nominalOuts)} />
          <StatTile label="Remaining outs" value={String(nominalOuts)} color="emerald" />
        </div>
      )}

      {mode === 'next_card' && (
        <div className="flex items-center gap-2.5">
          <StatTile label="Outs" value={String(nominalOuts)} color="emerald" />
          <StatTile label="Unseen" value={String(unseen)} />
          <StatTile label="Next-card %" value={`${nextCardPct.toFixed(1)}%`} color="violet" />
        </div>
      )}

      {mode === 'turn_river' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <StatTile label="Miss turn" value={`${(100 - nextCardPct).toFixed(1)}%`} />
            <StatTile label="× Miss river" value={`${(100 - drawProbabilityNextCard(nominalOuts, unseen - 1) * 100).toFixed(1)}%`} />
          </div>
          <div className="flex items-center gap-2.5">
            <StatTile label="Hit by river (exact)" value={`${riverPct.toFixed(1)}%`} color="emerald" />
            <StatTile label="Next card alone" value={`${nextCardPct.toFixed(1)}%`} color="slate" />
          </div>
        </div>
      )}

      {mode === 'quick_estimate' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <StatTile label="Exact (1 card)" value={`${nextCardPct.toFixed(1)}%`} />
            <StatTile label="Quick est. ×2" value={`${quickTurn.toFixed(0)}%`} color="amber" />
          </div>
          <div className="flex items-center gap-2.5">
            <StatTile label="Exact (2 cards)" value={`${riverPct.toFixed(1)}%`} />
            <StatTile label="Quick est. ×4" value={`${quickFlop.toFixed(0)}%`} color="amber" />
          </div>
          <p className="text-center text-[10px] text-muted-foreground/40">
            Quick Table Estimate — a fast approximation, not the exact probability.
          </p>
        </div>
      )}

      {mode === 'clean_dirty' && (
        <div className="flex items-center gap-2.5">
          <StatTile label="Nominal outs" value={String(nominalOuts)} />
          <StatTile label="Dirty" value={String(deadOutCards.length)} color="amber" />
          <StatTile label="Clean outs" value={String(cleanOuts)} color="emerald" />
        </div>
      )}

      {mode === 'backdoor' && (
        <div className="flex items-center gap-2.5">
          <StatTile label="Turn cooperates" value="AND" color="slate" />
          <StatTile label="River cooperates" value="→" color="slate" />
          <StatTile label="Backdoor equity" value={`~${(BACKDOOR_EQUITY * 100).toFixed(1)}%`} color="violet" />
        </div>
      )}

      {mode === 'speed_round' && nominalOuts > 0 && (
        <div className="flex items-center gap-2.5">
          <StatTile label="Outs" value={String(nominalOuts)} color="emerald" />
          <StatTile label="Unseen" value={String(unseen)} />
        </div>
      )}

      {(step.outs_deck_question || isChallenge) && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.outs_deck_question ?? 'How many clean outs does Hero have?'}</p>
        </div>
      )}

      {isChallenge ? (
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-black tabular-nums text-violet-300">
              {answer}{mode === 'clean_dirty' ? '' : '%'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxAnswer}
            step={mode === 'clean_dirty' ? 1 : 0.5}
            value={answer}
            disabled={disabled || submitted}
            onChange={(e) => setAnswer(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
          />
          <button
            type="button"
            disabled={disabled || submitted}
            onClick={submitAnswer}
            className={cn(
              'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
              submitted || disabled
                ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
            )}
          >
            {submitted ? 'Submitted' : `Lock in ${answer}${mode === 'clean_dirty' ? '' : '%'}`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || submitted}
          onClick={submitReveal}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            submitted || disabled
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          Continue
        </button>
      )}
    </div>
  )
}

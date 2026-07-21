'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

// ── Seat layout (9-max, clockwise) ────────────────────────────────────────────

const SEAT_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const

const SEAT_POSITIONS: Record<string, { top: string; left: string }> = {
  'UTG+1': { top: '3%', left: '32%' },
  'UTG+2': { top: '3%', left: '68%' },
  LJ:      { top: '18%', left: '90%' },
  HJ:      { top: '50%', left: '97%' },
  CO:      { top: '80%', left: '84%' },
  BTN:     { top: '92%', left: '50%' },
  SB:      { top: '80%', left: '16%' },
  BB:      { top: '50%', left: '3%' },
  UTG:     { top: '18%', left: '10%' },
}

type Group = 'early' | 'middle' | 'late' | 'blinds'

const SEAT_GROUP: Record<string, Group> = {
  UTG: 'early', 'UTG+1': 'early', 'UTG+2': 'early',
  LJ: 'middle', HJ: 'middle',
  CO: 'late', BTN: 'late',
  SB: 'blinds', BB: 'blinds',
}

const GROUP_STYLE: Record<Group, string> = {
  early:  'border-sky-500/40 bg-sky-500/10 text-sky-300',
  middle: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  late:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  blinds: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
}

const DEFAULT_DEFINITIONS: Record<string, string> = {
  UTG: 'First player to act before the flop.',
  'UTG+1': 'Second player to act preflop.',
  'UTG+2': 'Third player to act preflop.',
  LJ: 'First middle-position seat.',
  HJ: 'Second middle-position seat.',
  CO: 'Seat immediately before the Button.',
  BTN: 'Acts last postflop and usually has the strongest positional advantage.',
  SB: 'Posts the small blind. Acts near the end preflop but first postflop in a heads-up pot against most positions.',
  BB: 'Posts the big blind. Acts last preflop when facing no further action, but generally plays out of position postflop against non-blind positions.',
}

// ── Component ──────────────────────────────────────────────────────────────────

interface PositionTableProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

export function PositionTable({ step, onAnswer, disabled = false }: PositionTableProps) {
  const mountTime = useRef(Date.now())
  const [activeSeat, setActiveSeat] = useState<string | null>(null)
  const [explored, setExplored] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setActiveSeat(null)
    setExplored(new Set())
    setSelected(null)
  }, [step.id])

  const isQuiz = step.position_table_mode === 'quiz' || (step.options?.length ?? 0) > 0
  const definitions = step.position_table_definitions ?? DEFAULT_DEFINITIONS
  const highlight = new Set(step.position_table_highlight ?? SEAT_ORDER)
  const heroSeat = step.hero_position

  function handleSeatTap(seat: string) {
    if (disabled) return
    if (isQuiz) {
      if (selected || !highlight.has(seat)) return
      setSelected(seat)
      const elapsed = Date.now() - mountTime.current
      onAnswer(seat, elapsed)
      return
    }
    setActiveSeat(seat)
    setExplored((prev) => new Set(prev).add(seat))
  }

  function handleContinue() {
    if (disabled) return
    const elapsed = Date.now() - mountTime.current
    onAnswer(Array.from(explored), elapsed)
  }

  const option = selected ? step.options?.find((o) => o.id === selected) : null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {(step.position_table_mode === 'quiz' || isQuiz) && (
        <p className="text-center text-base font-semibold text-foreground">
          {step.position_table_prompt ?? 'Tap the correct seat.'}
        </p>
      )}

      {/* Table */}
      <div className="relative mx-auto aspect-[16/11] w-full max-w-md">
        <div
          className="absolute inset-[10%] rounded-[50%] border border-emerald-500/25"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(16,93,64,0.35) 0%, rgba(8,48,36,0.5) 70%, rgba(4,24,18,0.6) 100%)',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
          }}
        />

        {SEAT_ORDER.map((seat) => {
          const pos = SEAT_POSITIONS[seat]
          const group = SEAT_GROUP[seat]
          const isHero = heroSeat === seat
          const isActive = activeSeat === seat
          const isSelected = selected === seat
          const isTappable = !disabled && (isQuiz ? highlight.has(seat) && !selected : true)
          const isCorrectReveal = isQuiz && selected && option?.quality && (option.quality === 'perfect' || option.quality === 'good') && isSelected

          return (
            <button
              key={seat}
              type="button"
              disabled={!isTappable}
              onClick={() => handleSeatTap(seat)}
              style={{ top: pos.top, left: pos.left }}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 z-10',
                'flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border text-[10px] font-black',
                'transition-all duration-150 active:scale-95',
                GROUP_STYLE[group],
                isHero && 'ring-2 ring-violet-400/70 shadow-lg shadow-violet-500/30 animate-pulse',
                isActive && 'ring-2 ring-white/50 scale-110',
                isSelected && 'ring-2 ring-violet-400 scale-110',
                isQuiz && selected && !isSelected && 'opacity-30',
                isCorrectReveal && 'ring-emerald-400 bg-emerald-500/20',
                isQuiz && isSelected && option && option.quality !== 'perfect' && option.quality !== 'good' && 'ring-red-400 bg-red-500/20',
                isTappable ? 'cursor-pointer hover:scale-105' : 'cursor-default',
                isQuiz && !highlight.has(seat) && 'opacity-25',
              )}
            >
              {seat}
            </button>
          )
        })}
      </div>

      {/* Group legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400/70" />Early</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400/70" />Middle</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400/70" />Late</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400/70" />Blinds</span>
      </div>

      {/* Explore-mode definition panel */}
      {!isQuiz && (
        <div className="min-h-[64px] rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3.5">
          {activeSeat ? (
            <>
              <p className="text-xs font-bold text-violet-300 mb-0.5">{activeSeat}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {definitions[activeSeat] ?? DEFAULT_DEFINITIONS[activeSeat]}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground/40 italic">Tap a seat to learn what it means.</p>
          )}
        </div>
      )}

      {/* Quiz feedback preview happens via StepFeedback after evaluate — no inline continue needed */}
      {!isQuiz && (
        <button
          type="button"
          disabled={disabled || explored.size === 0}
          onClick={handleContinue}
          className={cn(
            'w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200',
            explored.size === 0
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          {explored.size === 0 ? 'Tap every seat to continue' : `Continue (${explored.size}/9 explored)`}
        </button>
      )}
    </div>
  )
}

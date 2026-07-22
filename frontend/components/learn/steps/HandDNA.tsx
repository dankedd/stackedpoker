'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { classifyHandDNA, type DNALevel } from '@/lib/learn/handDNA'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface HandDNAProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

const LEVEL_COLOR: Record<DNALevel, string> = {
  low: 'text-muted-foreground/50 bg-secondary/30 border-border/30',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  high: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
}

function DNARow({ label, value, level }: { label: string; value: string; level?: DNALevel }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/15 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">{label}</span>
      <span
        className={cn(
          'rounded-md border px-2 py-0.5 text-xs font-bold capitalize',
          level ? LEVEL_COLOR[level] : 'text-foreground bg-secondary/30 border-border/30',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Renders a hand notation, e.g. 'A5s', as two representative playing cards. */
function handToCards(hand: string): string[] {
  const r1 = hand[0]
  const r2 = hand[1]
  const suffix = hand[2]
  if (suffix === 's') return [`${r1}s`, `${r2}s`]
  if (suffix === 'o') return [`${r1}s`, `${r2}h`]
  return [`${r1}s`, `${r2}h`]
}

export function HandDNA({ step, onAnswer, disabled = false }: HandDNAProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  const hand = step.hand_dna_subject ?? step.hero_hand?.join('') ?? 'A5s'
  const dna = classifyHandDNA(hand)
  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-1.5">
            {handToCards(hand).map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
          <span className="text-lg font-black text-foreground">{hand}</span>
        </div>

        <div className="space-y-0.5">
          <DNARow label="High-card value" value={dna.highCardValue} level={dna.highCardValue} />
          <DNARow label="Suitedness" value={dna.isPair ? 'paired' : dna.isSuited ? 'suited' : 'offsuit'} />
          <DNARow label="Connectedness" value={dna.connectedness} level={dna.connectedness} />
          <DNARow label="Nut potential" value={dna.nutPotential} />
          <DNARow label="Blocker value" value={dna.blockerValue} />
          <DNARow label="Playability" value={dna.playability} level={dna.playability} />
        </div>
      </div>

      {step.hand_dna_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.hand_dna_prompt}</p>
        </div>
      )}

      {options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                    : [
                        'border-border/50 bg-secondary/40 text-foreground',
                        'hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                      ].join(' ')
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || selected !== null}
          onClick={() => handleSelect('__continue__')}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            selected !== null || disabled
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

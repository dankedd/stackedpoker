'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import {
  RFI_SHALLOW, RFI_MEDIUM, RFI_DEEP, RFI_SHALLOW_ACTIONS,
  entriesToHandList, entriesToFrequencyMap, type StackWorld, type RangeEntry,
} from '@/lib/learn/preflopBaselines'
import { THREEBET_DEEP, THREEBET_MEDIUM, THREEBET_SHALLOW, type ThreebetMatchup } from '@/lib/learn/threebetBaselines'
import { DEFEND_DEEP, DEFEND_MEDIUM, DEFEND_SHALLOW, type DefendMatchup } from '@/lib/learn/defendBaselines'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface StackDepthRangeMorphProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

const WORLDS: { world: StackWorld; label: string; bb: string }[] = [
  { world: 'shallow', label: 'Shallow', bb: '~15bb' },
  { world: 'medium', label: 'Medium', bb: '~25-40bb' },
  { world: 'deep', label: 'Deep', bb: '~60-100bb' },
]

export function StackDepthRangeMorph({ step, onAnswer, disabled = false }: StackDepthRangeMorphProps) {
  const mountTime = useRef(Date.now())
  const [worldIndex, setWorldIndex] = useState(2)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setWorldIndex(2)
    setSelected(null)
  }, [step.id])

  const position = step.stack_depth_morph_position ?? 'BTN'
  const dataset = step.stack_depth_morph_dataset ?? 'rfi'
  const world = WORLDS[worldIndex].world
  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  function handleContinue() {
    handleSelect('__continue__')
  }

  const showActions = dataset === 'rfi' && step.stack_depth_morph_show_actions && world === 'shallow' && RFI_SHALLOW_ACTIONS[position]

  const threebetKey = step.stack_depth_morph_key as ThreebetMatchup | undefined
  const defendKey = step.stack_depth_morph_key as DefendMatchup | undefined

  const entries: RangeEntry[] =
    dataset === 'threebet_defense'
      ? (world === 'shallow' ? (threebetKey && THREEBET_SHALLOW[threebetKey]) ?? (threebetKey && THREEBET_MEDIUM[threebetKey]) ?? []
        : world === 'medium' ? (threebetKey && THREEBET_MEDIUM[threebetKey]) ?? []
        : (threebetKey && THREEBET_DEEP[threebetKey]) ?? [])
      : dataset === 'defend'
      ? (world === 'shallow' ? (defendKey && DEFEND_SHALLOW[defendKey]) ?? (defendKey && DEFEND_MEDIUM[defendKey]) ?? []
        : world === 'medium' ? (defendKey && DEFEND_MEDIUM[defendKey]) ?? []
        : (defendKey && DEFEND_DEEP[defendKey]) ?? [])
      : (world === 'shallow' ? RFI_SHALLOW[position] ?? RFI_MEDIUM[position] ?? []
        : world === 'medium' ? RFI_MEDIUM[position] ?? []
        : RFI_DEEP[position] ?? [])

  const headerLabel =
    dataset === 'threebet_defense' ? `${threebetKey ?? position} 3-bet range`
    : dataset === 'defend' ? `${defendKey ?? position} defend range`
    : `${position} opening range`

  const combos = entries.reduce((sum, e) => sum + (e.hand.length === 2 ? 6 : e.hand.endsWith('s') ? 4 : 12) * e.freq, 0)
  const pct = ((combos / 1326) * 100).toFixed(1)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
            {headerLabel}
          </p>
          <p className="text-lg font-black text-violet-300">
            {WORLDS[worldIndex].label} <span className="text-xs font-semibold text-muted-foreground/40">({WORLDS[worldIndex].bb})</span>
          </p>
          <p className="text-[11px] text-muted-foreground/50">~{pct}% of hands</p>
        </div>

        {showActions ? (
          <PokerRangeGrid range={[]} mode="three_action" actionMap={RFI_SHALLOW_ACTIONS[position]} />
        ) : (
          <PokerRangeGrid range={entriesToHandList(entries)} mode="frequency" frequencies={entriesToFrequencyMap(entries)} />
        )}

        <div className="space-y-1.5 pt-2 border-t border-border/20">
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={worldIndex}
            disabled={disabled || selected !== null}
            onChange={(e) => setWorldIndex(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || selected !== null) && 'opacity-50')}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
            {WORLDS.map((w) => <span key={w.world}>{w.label}</span>)}
          </div>
        </div>
        <p className="text-center text-[9px] text-muted-foreground/30">
          Deep is ported from the app&apos;s baseline range data; medium/shallow are simplified, clearly pedagogical reductions — not solver output.
        </p>
      </div>

      {step.stack_depth_morph_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.stack_depth_morph_prompt}</p>
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
          onClick={handleContinue}
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

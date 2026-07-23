'use client'

import { useState } from 'react'
import { Eye, ChevronRight, Coins, MapPin, Users, Layers, Spade } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface DefenseLensProps {
  step: LessonStep
  onComplete: () => void
}

const LENS_ORDER = ['opener', 'price', 'position', 'players_behind', 'stack', 'hand'] as const

const LENS_META: Record<(typeof LENS_ORDER)[number], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  opener: { label: 'Opener', icon: Spade },
  price: { label: 'Price', icon: Coins },
  position: { label: 'Position', icon: MapPin },
  players_behind: { label: 'Players Behind', icon: Users },
  stack: { label: 'Stack', icon: Layers },
  hand: { label: 'Hand', icon: Eye },
}

/**
 * The module's reusable six-factor framework: OPENER → PRICE → POSITION →
 * PLAYERS BEHIND → STACK → HAND. Tapping a card reveals one sentence.
 * Unscored — a thinking framework, not a quiz.
 */
export function DefenseLens({ step, onComplete }: DefenseLensProps) {
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const facts = step.defense_lens_facts ?? {}

  function toggle(key: string) {
    setOpened((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {LENS_ORDER.map((key) => {
          const meta = LENS_META[key]
          const Icon = meta.icon
          const isOpen = opened.has(key)
          const fact = facts[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={!fact}
              className={cn(
                'rounded-xl border p-3 text-left transition-all duration-200',
                isOpen
                  ? 'border-violet-500/40 bg-violet-500/10 shadow-md shadow-violet-900/10'
                  : 'border-border/40 bg-secondary/30 hover:bg-secondary/50 hover:border-violet-500/20',
                !fact && 'opacity-40 cursor-default',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('h-3.5 w-3.5', isOpen ? 'text-violet-400' : 'text-muted-foreground/50')} />
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', isOpen ? 'text-violet-300' : 'text-muted-foreground/60')}>
                  {meta.label}
                </span>
              </div>
              {isOpen && fact && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 animate-in fade-in duration-200">
                  {fact}
                </p>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        Continue
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  )
}

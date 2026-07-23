'use client'

import { useState } from 'react'
import { ChevronRight, Layers, Palette, Hash, Crown, Boxes, GitBranch, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { classifyFlop, estimateVolatility } from '@/lib/learn/flopClassifier'

interface FlopScannerProps {
  step: LessonStep
  onComplete: () => void
}

type Dimension = NonNullable<LessonStep['flop_scanner_dimensions']>[number]

const DIMENSION_META: Record<Dimension, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  structure: { label: 'Structure', icon: Layers },
  texture: { label: 'Texture', icon: Palette },
  two_tone_subtype: { label: 'Two-Tone Subtype', icon: GitBranch },
  highest_rank: { label: 'Highest Rank', icon: Crown },
  rank_family: { label: 'Rank Family', icon: Hash },
  possible_straights: { label: 'Possible Straights', icon: Boxes },
  volatility: { label: 'Volatility', icon: Waves },
}

const TEXT: Record<string, string> = {
  trips: 'Trips', paired: 'Paired', unpaired: 'Unpaired',
  monotone: 'Monotone', two_tone: 'Two-Tone', rainbow: 'Rainbow',
  high_mid: 'High-Mid', mid_low: 'Mid-Low', high_low: 'High-Low',
  low: 'Low', medium: 'Medium', high: 'High',
}

/**
 * BoardDNA-style multi-panel scanner. Always unscored — a tap-to-reveal
 * inspection tool, not a quiz. Which panels appear is config-driven via
 * `flop_scanner_dimensions`, so the same component serves Lesson 1's
 * structure-only intro through Lesson 8's full 7-panel scanner.
 */
export function FlopScanner({ step, onComplete }: FlopScannerProps) {
  const [opened, setOpened] = useState<Set<Dimension>>(new Set())
  const board = step.board ?? []
  const dims = step.flop_scanner_dimensions ?? []

  if (board.length !== 3) {
    return (
      <div className="text-center text-sm text-muted-foreground/50 italic py-6">
        This scanner needs a 3-card board configured.
      </div>
    )
  }

  const c = classifyFlop([board[0], board[1], board[2]])
  const vol = estimateVolatility([board[0], board[1], board[2]])

  function toggle(d: Dimension) {
    setOpened((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function valueFor(d: Dimension): { headline: string; detail?: string } {
    switch (d) {
      case 'structure':
        return { headline: TEXT[c.structure] }
      case 'texture':
        return { headline: TEXT[c.texture] }
      case 'two_tone_subtype':
        return c.twoToneSubtype
          ? { headline: TEXT[c.twoToneSubtype] }
          : { headline: 'N/A', detail: 'Only defined for unpaired two-tone flops.' }
      case 'highest_rank':
        return { headline: c.highestRank === 'T' ? '10' : c.highestRank }
      case 'rank_family':
        return { headline: c.family, detail: `${c.ranks.join('-')} → ${c.rankFamilies.join('-')}` }
      case 'possible_straights':
        return {
          headline: String(c.possibleFloppedStraights.count),
          detail: c.possibleFloppedStraights.combos.length > 0
            ? `Needs: ${c.possibleFloppedStraights.combos.map((p) => p.join('-')).join(', ')}`
            : 'No possible flopped straight on this board.',
        }
      case 'volatility':
        return { headline: TEXT[vol.level], detail: vol.reasons[0] }
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {board.map((card, i) => (
          <PlayingCardMini key={i} card={card} size="md" />
        ))}
      </div>

      {step.flop_scanner_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.flop_scanner_prompt}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {dims.map((d) => {
          const meta = DIMENSION_META[d]
          const Icon = meta.icon
          const isOpen = opened.has(d)
          const value = valueFor(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all duration-200',
                isOpen
                  ? 'border-violet-500/40 bg-violet-500/10 shadow-md shadow-violet-900/10'
                  : 'border-border/40 bg-secondary/30 hover:bg-secondary/50 hover:border-violet-500/20',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('h-3.5 w-3.5', isOpen ? 'text-violet-400' : 'text-muted-foreground/50')} />
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', isOpen ? 'text-violet-300' : 'text-muted-foreground/60')}>
                  {meta.label}
                </span>
              </div>
              {isOpen && (
                <div className="mt-1.5 animate-in fade-in duration-200">
                  <p className="text-sm font-bold text-foreground">{value.headline}</p>
                  {value.detail && <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{value.detail}</p>}
                </div>
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

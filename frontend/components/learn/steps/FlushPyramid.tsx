'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { flushTiers, getBlockedCombos, comboKey } from '@/lib/learn/combos'

interface FlushPyramidProps {
  step: LessonStep
  onAnswer: (markedTiers: string[], timeMs: number) => void
  disabled?: boolean
}

const TIER_COLORS = [
  'bg-emerald-500/70', 'bg-emerald-400/60', 'bg-sky-500/60', 'bg-sky-400/50', 'bg-blue-400/50',
  'bg-indigo-400/50', 'bg-violet-400/50', 'bg-fuchsia-400/50', 'bg-rose-400/50',
]

/** The Module 9 "Range Pyramid" — a monotone-heavy board's flush combos split
 *  into tiers by high card (Modern Poker Theory's Blocker Effects example:
 *  9/8/7/6/5/4/3/2/1 = 45). Every number here comes from `flushTiers` (pure
 *  card removal), never hand-authored. The learner taps which tiers a known
 *  card (Hero's nut blocker) actually affects — tiers can be expanded to
 *  inspect their concrete combos before answering. */
export function FlushPyramid({ step, onAnswer, disabled = false }: FlushPyramidProps) {
  const mountTime = useRef(Date.now())
  const suit = step.flush_pyramid_suit ?? 'h'
  const deadRanks = step.flush_pyramid_dead_ranks ?? []
  const known = step.flush_pyramid_known_cards ?? []

  const tiers = useMemo(() => flushTiers(suit, deadRanks), [suit, deadRanks])
  const total = useMemo(() => tiers.reduce((s, t) => s + t.combos.length, 0), [tiers])
  const blockedByTier = useMemo(
    () => new Map(tiers.map((t) => [t.tierLabel, new Set(getBlockedCombos(t.combos, known).map(comboKey))])),
    [tiers, known],
  )

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setExpanded(new Set())
    setMarked(new Set())
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function toggleExpand(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function toggleMark(label: string) {
    if (disabled || submitted) return
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function submit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(Array.from(marked), Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {known.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero holds</span>
          <div className="flex gap-1">{known.map((c) => <PlayingCardMini key={c} card={c} size="sm" />)}</div>
        </div>
      )}

      {step.flush_pyramid_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.flush_pyramid_prompt}</p>
      )}

      {/* Proportional stacked bar — every width is exact, never hedged */}
      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-border/30" role="group" aria-label="Villain's flush combos by strength">
        {tiers.map((tier, i) => (
          <button
            key={tier.tierLabel}
            type="button"
            style={{ width: `${(tier.combos.length / total) * 100}%` }}
            onClick={() => toggleMark(tier.tierLabel)}
            disabled={disabled || submitted}
            aria-pressed={marked.has(tier.tierLabel)}
            aria-label={`${tier.tierLabel === 'nut' ? 'Nut flush' : `${tier.tierLabel}-high flush`}, ${tier.combos.length} combos${marked.has(tier.tierLabel) ? ', marked as affected' : ''}`}
            title={`${tier.tierLabel === 'nut' ? 'Nut flush' : `${tier.tierLabel}-high`}: ${tier.combos.length}`}
            className={cn(
              'h-full flex items-center justify-center text-[8px] font-bold text-white/90 transition-all border-r border-black/10 last:border-r-0',
              TIER_COLORS[i % TIER_COLORS.length],
              marked.has(tier.tierLabel) && 'ring-2 ring-inset ring-white/80',
              submitted && blockedByTier.get(tier.tierLabel)!.size > 0 && marked.has(tier.tierLabel) && 'ring-emerald-300',
              submitted && blockedByTier.get(tier.tierLabel)!.size > 0 && !marked.has(tier.tierLabel) && 'ring-2 ring-inset ring-amber-400',
              submitted && blockedByTier.get(tier.tierLabel)!.size === 0 && marked.has(tier.tierLabel) && 'ring-2 ring-inset ring-rose-400',
            )}
          >
            {tier.combos.length >= 4 && <span>{tier.combos.length}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground/40">
        {tiers.map((tier) => (
          <span key={tier.tierLabel}>{tier.tierLabel === 'nut' ? 'Nut' : `${tier.tierLabel}-hi`}: {tier.combos.length}</span>
        ))}
        <span className="font-bold text-foreground/60">= {total} total</span>
      </div>

      {/* Tier drill-down */}
      <div className="space-y-2">
        {tiers.map((tier) => {
          const isExpanded = expanded.has(tier.tierLabel)
          const blocked = blockedByTier.get(tier.tierLabel)!
          return (
            <div key={tier.tierLabel} className="rounded-lg border border-border/30 bg-secondary/10">
              <button
                type="button"
                onClick={() => toggleExpand(tier.tierLabel)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-foreground/80"
              >
                <span>{tier.tierLabel === 'nut' ? 'Nut flush' : `${tier.tierLabel}-high flush`} ({tier.combos.length})</span>
                <span className="text-muted-foreground/40">{isExpanded ? '−' : '+'}</span>
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {tier.combos.map((combo) => {
                    const key = comboKey(combo)
                    const isBlocked = submitted && blocked.has(key)
                    return (
                      <div key={key} className={cn('relative flex gap-0.5 rounded-md border px-1 py-1', isBlocked ? 'border-rose-500/50 bg-rose-500/10 opacity-50' : 'border-border/30 bg-secondary/20')}>
                        <PlayingCardMini card={combo[0]} size="xs" />
                        <PlayingCardMini card={combo[1]} size="xs" />
                        {isBlocked && (
                          <div aria-hidden className="absolute inset-0 flex items-center justify-center">
                            <div className="h-[2px] w-[120%] rotate-45 bg-rose-500/70" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!submitted && (
        <button
          type="button"
          disabled={disabled || marked.size === 0}
          onClick={submit}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
        >
          Submit
        </button>
      )}
    </div>
  )
}

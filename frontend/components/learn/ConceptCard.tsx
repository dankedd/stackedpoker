'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/lib/learn/types'

// Static concept lookup — placeholder data shaped by concept id
const CONCEPT_DATA: Record<string, {
  title: string
  domain: string
  summary: string
  full: Record<Difficulty, string>
}> = {
  pot_odds: {
    title: 'Pot Odds',
    domain: 'Math & Equity',
    summary: 'The ratio of the current pot size to the cost of a call.',
    full: {
      beginner: 'Pot odds tell you how much you need to win vs how much you need to call. If the pot is $100 and you need to call $25, your pot odds are 4:1, meaning you only need to win 20% of the time to break even.',
      intermediate: 'Express pot odds as a percentage: call / (pot + call). Compare this to your equity. If your equity exceeds this break-even %, calling is profitable. Implied odds extend this by factoring future street value.',
      advanced: 'In multiway pots, pot odds scale with each additional caller. Realize equity adjustments must account for reverse implied odds, fold equity, and SPR constraints when deciding between a call and a semi-bluff raise.',
    },
  },
  continuation_bet: {
    title: 'Continuation Betting',
    domain: 'Bet Sizing & Strategy',
    summary: 'Betting on the flop after raising pre-flop to maintain aggression.',
    full: {
      beginner: 'A c-bet is when you raised before the flop and then bet on the flop regardless of whether you hit. It pressures opponents who missed and represents strength.',
      intermediate: 'C-bet frequency and sizing depend on board texture and position. Bet larger on dry boards where you can polarize, smaller on wet boards to balance range and control SPR.',
      advanced: 'GTO c-bet strategies require a mixed approach: betting with value hands and selected bluffs, checking back hands that perform well as bluff-catchers. Board coverage analysis determines which combos benefit most from protection vs deception.',
    },
  },
  position: {
    title: 'Positional Advantage',
    domain: 'Fundamentals',
    summary: 'Acting after opponents gives you more information to make better decisions.',
    full: {
      beginner: 'Position means where you sit relative to the dealer. Acting last (in position) is a major advantage because you see what others do before making your choice.',
      intermediate: 'In-position players can bluff more effectively, control pot size, and extract more value. OOP players must tighten ranges and defend more carefully to compensate for the information disadvantage.',
      advanced: 'Positional equity impacts range construction on every street. IP players realize more of their theoretical equity due to better bluff efficiency and the ability to deny equity cheaply. Factor position into MDF calculations and nash equilibrium approximations.',
    },
  },
  range_advantage: {
    title: 'Range Advantage',
    domain: 'Range Analysis',
    summary: "When one player's range connects better with the board than the other's.",
    full: {
      beginner: 'Range advantage means you have more strong hands on a given board than your opponent. This lets you bet more often and with larger sizes.',
      intermediate: 'Measure range advantage by counting nut combos and equity distribution. The aggressor typically has more nut hands on boards that favor their opening range.',
      advanced: 'Range advantage is quantified through range-vs-range equity analysis. A player with both nut and equity advantage can construct highly polarized bets. Symmetrical ranges on connected boards shift toward merged, protective sizing strategies.',
    },
  },
  bluff_to_value: {
    title: 'Bluff-to-Value Ratio',
    domain: 'Bet Sizing & Strategy',
    summary: 'Balancing how many bluffs to include for each value combo in your betting range.',
    full: {
      beginner: 'For every value hand you bet, you should also bet some bluffs. This stops opponents from always folding to your bets or always calling.',
      intermediate: 'The ideal bluff-to-value ratio depends on pot odds offered. If you bet half-pot (33% pot odds), opponents break even calling with 33% equity, so your range needs ~2 value combos for each bluff combo.',
      advanced: 'Optimal bluff frequency derives from the indifference principle. At equilibrium, the bluff/value ratio matches the pot odds offered: ratio = call/(pot+call). Deviating creates exploitative counter-strategies, so ranges must be balanced near this theoretical target.',
    },
  },
}

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  advanced: 'bg-red-500/10 text-red-400 border-red-500/20',
}

interface ConceptCardProps {
  conceptId: string
  difficulty?: Difficulty
  className?: string
}

export function ConceptCard({ conceptId, difficulty = 'intermediate', className }: ConceptCardProps) {
  const [expanded, setExpanded] = useState(false)

  const data = CONCEPT_DATA[conceptId] ?? {
    title: conceptId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    domain: 'Poker Theory',
    summary: 'A foundational poker concept that improves decision making at the table.',
    full: {
      beginner: 'This concept forms a key building block of solid poker fundamentals.',
      intermediate: 'Understanding this at an intermediate level involves range thinking and pot-odds analysis.',
      advanced: 'At an advanced level, this concept integrates with GTO strategy and exploitative adjustments.',
    },
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card/60 overflow-hidden transition-all duration-200',
        className
      )}
    >
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 shrink-0 mt-0.5">
          <BookOpen className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-foreground">{data.title}</span>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                DIFFICULTY_STYLES[difficulty]
              )}
            >
              {difficulty}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
            {data.domain}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.summary}</p>
        </div>
        <div className="shrink-0 text-muted-foreground/40 mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30">
          <div className="mt-3 rounded-xl bg-secondary/20 border border-border/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
              {difficulty} explanation
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.full[difficulty]}
            </p>
          </div>
          {/* Difficulty switcher */}
          <div className="flex gap-1.5 mt-3">
            {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
              <button
                key={d}
                type="button"
                className={cn(
                  'flex-1 text-[10px] font-semibold py-1.5 rounded-lg border capitalize transition-colors',
                  d === difficulty
                    ? DIFFICULTY_STYLES[d]
                    : 'border-border/30 bg-secondary/20 text-muted-foreground/40 hover:text-muted-foreground/70'
                )}
                disabled
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

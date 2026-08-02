'use client'

import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { StackDepthBadge } from '@/components/poker/StackDepthBadge'
import { formatBb } from '@/components/poker/tableTokens'

export interface PostflopScenarioCardProps {
  step: LessonStep
}

/**
 * Compact postflop scene card — position, stack, pot, board, Hero's hand and
 * the action history leading to the decision. Deliberately NOT a fork of
 * `PreflopTable`: that component's seat geometry and action parsing
 * (`preflopTableState.ts`) are preflop-only by construction. This is the
 * postflop equivalent for the (until now unrendered) `board`/`pot_bb`/
 * `effective_stack_bb`/`action_before_hero` fields steps already carry —
 * see `ConceptReveal.tsx`/`DecisionSpot.tsx` for the gates that mount it.
 */
export function PostflopScenarioCard({ step }: PostflopScenarioCardProps) {
  const board = step.board ?? []
  const heroHand = step.hero_hand ?? []
  const actionHistory = step.action_before_hero ?? []

  return (
    <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {step.hero_position && (
            <span className="text-[11px] font-extrabold text-violet-200">
              <span className="mr-1 text-[9px] font-black uppercase tracking-[0.1em] text-violet-300/80">
                HERO ·
              </span>
              {step.hero_position}
            </span>
          )}
          {step.villain_position && (
            <span className="text-[11px] font-semibold text-muted-foreground/60">
              vs {step.villain_position}
            </span>
          )}
        </div>
        {step.effective_stack_bb != null && <StackDepthBadge stackBb={step.effective_stack_bb} />}
      </div>

      {(board.length > 0 || step.pot_bb != null) && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {board.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Board</span>
              <div className="flex gap-1">
                {board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
              </div>
            </div>
          )}
          {step.pot_bb != null && (
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Pot</span>
              <span className="text-[13px] font-black tabular-nums text-amber-200">
                {formatBb(step.pot_bb)} BB
              </span>
            </div>
          )}
        </div>
      )}

      {heroHand.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero holds</span>
          <div className="flex gap-1">
            {heroHand.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
        </div>
      )}

      {actionHistory.length > 0 && (
        <div className="space-y-1 border-t border-border/20 pt-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Action so far</p>
          <ul className="space-y-0.5">
            {actionHistory.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground/70 leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

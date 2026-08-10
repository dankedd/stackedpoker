'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { orderStepOptions, isPokerActionSet } from '@/lib/learn/interactionSafety'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { PostflopScenarioCard } from '@/components/learn/visuals/PostflopScenarioCard'
import { canRenderPostflopTable } from '@/lib/learn/postflopTableState'
import { ScenarioComparison } from '@/components/learn/visuals/ScenarioComparison'
import { ScenarioSideBySide } from '@/components/learn/visuals/ScenarioSideBySide'
import { BoardScenarioComparison, isBoardOnlyScenarioPair } from '@/components/learn/visuals/BoardScenarioComparison'

interface DecisionSpotProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function DecisionSpot({ step, onAnswer, disabled = false }: DecisionSpotProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  // Reset when step changes
  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  // A comparison needs BOTH scenarios to render — one alone falls back to the
  // normal single-table branch below rather than guessing the other half.
  const hasFullScenarioComparison = !!step.scenario_a && !!step.scenario_b
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    if ((step.scenario_a || step.scenario_b) && !hasFullScenarioComparison) {
      // eslint-disable-next-line no-console
      console.warn(`[DecisionSpot] step "${step.id}" has only one of scenario_a/scenario_b — both are required for a comparison; rendering the single-table fallback instead.`)
    }
  }, [step.id, step.scenario_a, step.scenario_b, hasFullScenarioComparison])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    const elapsed = Date.now() - mountTime.current
    onAnswer(optionId, elapsed)
  }

  const rawOptions = step.options ?? []
  // bet_size_choose options are a natural small-to-large spectrum — shuffling
  // that ordering would hurt usability without closing any real leak, so only
  // reorder the free-form decision_spot choices. `orderStepOptions` enforces the
  // global Fold->Check->Call->Raise->All-in order whenever the choices ARE a
  // clean poker-action set, falling back to the existing seeded shuffle otherwise.
  const options = useMemo(
    () => (step.type === 'bet_size_choose' ? rawOptions : orderStepOptions(rawOptions, step.id)),
    [rawOptions, step.id, step.type],
  )
  const gridCols =
    options.length === 2
      ? 'grid-cols-2'
      : options.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2'

  // The visible heading must describe the actual cognitive task, never a
  // generic action label slapped over non-action answers. Precedence:
  // 1. An explicit authored question always wins.
  // 2. If `narrative` already ends in a question, it IS the question — don't
  //    render a second, possibly-mismatched one underneath it.
  // 3. Only fall back to an action-style heading when every option genuinely
  //    is a poker action (Fold/Call/Raise/...).
  // 4. Otherwise render nothing here rather than a misleading generic label.
  // See LEARN_QUESTION_QA.md "QUESTION–INTERACTION ALIGNMENT".
  const narrativeIsQuestion = !!step.narrative && /\?\s*$/.test(step.narrative.trim())
  const questionHeading =
    step.type === 'bet_size_choose'
      ? 'Choose your bet size:'
      : step.decision_spot_question
      ? step.decision_spot_question
      : narrativeIsQuestion
      ? null
      : isPokerActionSet(options.map((o) => o.label))
      ? 'What is your action?'
      : null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Comparative questions (two positions/stacks/action-sequences/ranges) get a
          ONE-table scenario switcher instead of a single static table — see
          ScenarioComparison.tsx. Both scenario_a and scenario_b must be authored
          together; a step with only one silently falls through to the normal
          single-table branch below (dev-only warning above, never a guessed table).
          A step can opt into `scenario_layout: 'side_by_side'` instead, mounting
          BOTH tables at once via ScenarioSideBySide — for a question whose point
          is seeing the two states simultaneously, where toggling would hide the
          exact comparison being tested. When the two scenarios share the exact
          same preflop situation and differ ONLY in `board` (see
          isBoardOnlyScenarioPair), BoardScenarioComparison replaces
          ScenarioSideBySide's two full tables with ONE shared table plus two
          compact board cards — the comparison is about board texture, not two
          different hand histories, so the UI shouldn't imply otherwise. Default
          (omitted/'switch') is unchanged. */}
      {hasFullScenarioComparison && (
        step.scenario_layout === 'side_by_side' ? (
          isBoardOnlyScenarioPair(step.scenario_a!, step.scenario_b!) ? (
            <BoardScenarioComparison
              scenarioA={step.scenario_a!}
              scenarioB={step.scenario_b!}
              comparisonContext={step.scenario_comparison_context}
            />
          ) : (
            <ScenarioSideBySide
              scenarioA={step.scenario_a!}
              scenarioB={step.scenario_b!}
              comparisonContext={step.scenario_comparison_context}
            />
          )
        ) : (
          <ScenarioComparison
            scenarioA={step.scenario_a!}
            scenarioB={step.scenario_b!}
            comparisonContext={step.scenario_comparison_context}
          />
        )
      )}

      {/* Shared preflop table — replaces the old text-pill context bar for any
          PREFLOP decision spot (RFI, facing-open, squeeze, defend). The table alone
          communicates position/cards/stack/action-before-Hero, so the narrative
          below can stay focused on genuine reasoning rather than restating facts
          already visible on the table. Gated on the absence of `board`: steps that
          also carry a flop/turn board are postflop spots (this codebase reuses
          hero_position there for framing) and must never show a preflop table.
          Also gated on the absence of a full scenario comparison — handled above. */}
      {!hasFullScenarioComparison && step.hero_position && !step.board?.length && (
        <PreflopTable
          tableSize={step.table_size ?? 9}
          heroPosition={step.hero_position}
          heroHand={step.hero_hand}
          effectiveStackBb={step.effective_stack_bb}
          stackOverridesBb={step.stack_overrides_bb}
          anteBb={step.ante_bb}
          actionBeforeHero={step.action_before_hero}
        />
      )}

      {/* Postflop spot — the SAME table, switched into postflop mode by the
          board (community cards on the felt, street-aware status bar, dead pot
          carried forward). A postflop scene that can't be drawn as a table —
          no parseable action history to place seats from — still falls back to
          the compact scenario card rather than rendering a half-empty table. */}
      {!hasFullScenarioComparison && step.hero_position && !!step.board?.length && (
        canRenderPostflopTable(step) ? (
          <PreflopTable
            tableSize={step.table_size ?? 9}
            heroPosition={step.hero_position}
            heroHand={step.hero_hand}
            effectiveStackBb={step.effective_stack_bb}
            stackOverridesBb={step.stack_overrides_bb}
            anteBb={step.ante_bb}
            actionBeforeHero={step.action_before_hero}
            board={step.board}
            postflopAction={step.postflop_action}
            street={step.street === 'preflop' ? undefined : step.street}
            potBb={step.pot_bb}
          />
        ) : (
          <PostflopScenarioCard step={step} />
        )
      )}

      {/* Narrative / context */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Question */}
      {questionHeading && (
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
            {step.type === 'bet_size_choose' ? 'Your decision' : 'Question'}
          </p>
          <p className="text-base font-semibold text-foreground">{questionHeading}</p>
        </div>
      )}

      {/* Action buttons */}
      {options.length > 0 ? (
        <div className={cn('grid gap-3', gridCols)}>
          {options.map(opt => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null

            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-4 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
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
                {/* Selection highlight */}
                {isSelected && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent"
                  />
                )}

                <span className="relative">{opt.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground/40 italic">No options available.</p>
      )}
    </div>
  )
}

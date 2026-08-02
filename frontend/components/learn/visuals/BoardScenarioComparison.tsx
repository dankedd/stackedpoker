'use client'

import { cn } from '@/lib/utils'
import type { ComparisonScenario } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'

/** Fields that must match between `a`/`b` for the two scenarios to describe
 *  the SAME preflop situation with only the flop differing — the same set of
 *  facts `scenarioValidator.ts`'s check #0 already treats as "the poker
 *  situation," compared the same way (`JSON.stringify` for array/object
 *  fields, matching that file's own idiom). */
function samePreflopSituation(a: ComparisonScenario, b: ComparisonScenario): boolean {
  return (
    a.hero_position === b.hero_position &&
    a.villain_position === b.villain_position &&
    a.table_size === b.table_size &&
    a.effective_stack_bb === b.effective_stack_bb &&
    a.ante_bb === b.ante_bb &&
    JSON.stringify(a.hero_hand) === JSON.stringify(b.hero_hand) &&
    JSON.stringify(a.stack_overrides_bb) === JSON.stringify(b.stack_overrides_bb) &&
    JSON.stringify(a.action_before_hero) === JSON.stringify(b.action_before_hero)
  )
}

/** True when `a`/`b` are a "board-only" comparison — every preflop fact is
 *  identical and both carry a real flop/board, so a learner is being asked
 *  purely about board-texture effect, not about two different hand
 *  histories. Gates `BoardScenarioComparison` vs. the general-purpose
 *  `ScenarioSideBySide` (which still handles genuinely different preflop
 *  situations, e.g. players-behind or position comparisons). */
export function isBoardOnlyScenarioPair(a: ComparisonScenario, b: ComparisonScenario): boolean {
  return !!a.board?.length && !!b.board?.length && samePreflopSituation(a, b)
}

export interface BoardScenarioComparisonProps {
  scenarioA: ComparisonScenario
  scenarioB: ComparisonScenario
  /** Authored-only context line — see `LessonStep.scenario_comparison_context`. */
  comparisonContext?: string
  className?: string
}

function BoardCard({ label, scenario }: { label: string; scenario: ComparisonScenario }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/25 px-3 py-3 text-center space-y-2">
      <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
        {label}
      </span>
      <div className="flex items-center justify-center gap-1">
        {scenario.board!.map((card, i) => (
          <PlayingCardMini key={i} card={card} size="md" />
        ))}
      </div>
      <div>
        <span className="block text-sm font-semibold text-foreground">{scenario.label}</span>
        {scenario.short_description && (
          <span className="block text-[11px] font-medium text-muted-foreground/60">{scenario.short_description}</span>
        )}
      </div>
    </div>
  )
}

/**
 * ONE shared `PreflopTable` for the identical preflop situation both scenarios
 * describe, plus two compact board cards for the one thing that actually
 * differs. Only used when `isBoardOnlyScenarioPair` confirms the two
 * scenarios really do share every preflop fact — otherwise `DecisionSpot.tsx`
 * falls back to `ScenarioSideBySide`'s two-full-table rendering, which is
 * still correct for genuinely different preflop situations.
 *
 * Fixes a real gap along the way: `PreflopTable` has no board-rendering
 * capability, and neither did `ScenarioComparison`/`ScenarioSideBySide` — so
 * a board-only comparison's boards previously never appeared as cards
 * anywhere on screen, only in narrative prose and option text. This is the
 * first (and only) place `scenario.board` actually gets rendered.
 */
export function BoardScenarioComparison({ scenarioA, scenarioB, comparisonContext, className }: BoardScenarioComparisonProps) {
  // Never render a fabricated table — matches ScenarioComparison/ScenarioSideBySide's
  // own "no hero_position, no table" contract.
  if (!scenarioA.hero_position) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[BoardScenarioComparison] scenario_a must carry hero_position — refusing to render a guessed table.')
    }
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      <PreflopTable
        tableSize={scenarioA.table_size ?? 9}
        heroPosition={scenarioA.hero_position}
        heroHand={scenarioA.hero_hand}
        effectiveStackBb={scenarioA.effective_stack_bb}
        stackOverridesBb={scenarioA.stack_overrides_bb}
        anteBb={scenarioA.ante_bb}
        actionBeforeHero={scenarioA.action_before_hero}
      />

      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
        Compare Boards
      </p>

      <div className="grid grid-cols-2 gap-3">
        <BoardCard label="Scenario A" scenario={scenarioA} />
        <BoardCard label="Scenario B" scenario={scenarioB} />
      </div>

      {comparisonContext && (
        <p className="text-center text-[11px] text-muted-foreground/50">{comparisonContext}</p>
      )}
    </div>
  )
}

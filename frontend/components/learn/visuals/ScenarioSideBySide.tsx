'use client'

import { cn } from '@/lib/utils'
import type { ComparisonScenario } from '@/lib/learn/types'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { RangeComparisonLayout } from '@/components/learn/visuals/RangeComparisonLayout'

export interface ScenarioSideBySideProps {
  scenarioA: ComparisonScenario
  scenarioB: ComparisonScenario
  /** Authored-only context line — see `LessonStep.scenario_comparison_context`. */
  comparisonContext?: string
  className?: string
}

/**
 * TWO independent PreflopTables, mounted simultaneously — the side-by-side
 * counterpart to `ScenarioComparison`'s one-table switcher. Use this instead of
 * the switcher only when the question's whole point is seeing both table states
 * at once (e.g. "how many players remain behind at UTG vs. SB") — toggling back
 * and forth would hide the exact comparison the question is testing. Everything
 * else about how a scenario becomes a table is identical to `ScenarioComparison`:
 * same `ComparisonScenario` shape, same `PreflopTable`, same "never fabricate a
 * table" refusal when `hero_position` is missing.
 *
 * Layout: stacked full-width on narrow screens, side-by-side once there's real
 * room for two tables — reuses `RangeComparisonLayout`'s shared two-panel grid
 * rather than a bespoke one, so this stays the same responsive behavior every
 * other "two panels compared" spot in the learning modules already uses.
 */
export function ScenarioSideBySide({ scenarioA, scenarioB, comparisonContext, className }: ScenarioSideBySideProps) {
  // Never render a fabricated table — a scenario without hero_position simply
  // isn't renderable, matching ScenarioComparison's own contract.
  if (!scenarioA.hero_position || !scenarioB.hero_position) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[ScenarioSideBySide] scenario_a/scenario_b must both carry hero_position — refusing to render a guessed table.')
    }
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
        Compare Scenarios
      </p>

      <RangeComparisonLayout gapClassName="gap-5">
        {[scenarioA, scenarioB].map((scenario, i) => (
          <div key={i} className="space-y-2">
            <div className="text-center">
              <span className="block text-sm font-semibold text-foreground">{scenario.label}</span>
              {scenario.short_description && (
                <span className="block text-[11px] font-medium text-muted-foreground/60">{scenario.short_description}</span>
              )}
            </div>
            <PreflopTable
              tableSize={scenario.table_size ?? 9}
              heroPosition={scenario.hero_position!}
              heroHand={scenario.hero_hand}
              effectiveStackBb={scenario.effective_stack_bb}
              stackOverridesBb={scenario.stack_overrides_bb}
              anteBb={scenario.ante_bb}
              actionBeforeHero={scenario.action_before_hero}
            />
          </div>
        ))}
      </RangeComparisonLayout>

      {comparisonContext && (
        <p className="text-center text-[11px] text-muted-foreground/50">{comparisonContext}</p>
      )}
    </div>
  )
}

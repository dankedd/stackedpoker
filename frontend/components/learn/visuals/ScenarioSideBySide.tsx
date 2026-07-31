'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import type { ComparisonScenario } from '@/lib/learn/types'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'

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
 * Layout: the two scenarios ALWAYS stack vertically (Scenario A, then Scenario
 * B), on every breakpoint — never side by side. A poker table needs real width
 * per seat label/stack/blind to stay readable (unlike a 13x13 range grid, which
 * is why `RangeComparisonLayout`'s side-by-side breakpoint is right for THAT
 * content but wrong here); halving a PreflopTable's width on an ordinary desktop
 * viewport was confirmed to make positions/blinds/Hero hard to read. Stacking
 * unconditionally lets each `PreflopTable` render at its own natural single-table
 * size (it already caps itself at `max-w-2xl` — see PreflopTable.tsx) instead of
 * being squeezed into half a column.
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

      <div className="flex flex-col items-stretch">
        {[scenarioA, scenarioB].map((scenario, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div aria-hidden className="flex justify-center py-2 text-lg leading-none text-muted-foreground/30">
                ↓
              </div>
            )}
            <div className="space-y-2">
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
          </Fragment>
        ))}
      </div>

      {comparisonContext && (
        <p className="text-center text-[11px] text-muted-foreground/50">{comparisonContext}</p>
      )}
    </div>
  )
}

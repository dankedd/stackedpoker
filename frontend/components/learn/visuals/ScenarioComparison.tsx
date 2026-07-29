'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ComparisonScenario } from '@/lib/learn/types'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'

export interface ScenarioComparisonProps {
  scenarioA: ComparisonScenario
  scenarioB: ComparisonScenario
  /** Authored-only context line — see `LessonStep.scenario_comparison_context`. */
  comparisonContext?: string
  className?: string
  /** Testing/SSR only — forces the initially active scenario. Learner-facing
   *  behavior always defaults to 'a' (spec: "default to Scenario 1"). */
  initialScenario?: 'a' | 'b'
}

/**
 * ONE shared PreflopTable plus a segmented control that swaps which authored
 * `ComparisonScenario` feeds it — never two tables, never a second table-state
 * engine. Both scenarios flow through the exact same PreflopTable component
 * (and therefore the same buildPreflopTableRenderState derivation) every other
 * preflop decision_spot uses; only the props passed to it change on toggle, so
 * the table itself never remounts.
 */
export function ScenarioComparison({
  scenarioA,
  scenarioB,
  comparisonContext,
  className,
  initialScenario = 'a',
}: ScenarioComparisonProps) {
  const [active, setActive] = useState<'a' | 'b'>(initialScenario)

  // Never render a fabricated table — a scenario without hero_position simply
  // isn't renderable, matching buildPreflopTableRenderState's own contract.
  if (!scenarioA.hero_position || !scenarioB.hero_position) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[ScenarioComparison] scenario_a/scenario_b must both carry hero_position — refusing to render a guessed table.')
    }
    return null
  }

  const scenario = active === 'a' ? scenarioA : scenarioB

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') setActive('a')
    else if (e.key === 'ArrowRight') setActive('b')
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">
          Compare Scenarios
        </p>
        <div
          role="tablist"
          aria-label="Compare scenarios"
          onKeyDown={handleKeyDown}
          className="grid grid-cols-2 gap-2"
        >
          {(['a', 'b'] as const).map((key) => {
            const s = key === 'a' ? scenarioA : scenarioB
            const isActive = active === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(key)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-center transition-colors duration-150 active:scale-[0.98]',
                  isActive
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : 'border-border/40 bg-secondary/25 text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground/80',
                )}
              >
                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] opacity-60">
                  Scenario {key === 'a' ? '1' : '2'}
                </span>
                <span className="block text-sm font-semibold">{s.label}</span>
                {s.short_description && (
                  <span className="block text-[11px] font-medium opacity-70">{s.short_description}</span>
                )}
              </button>
            )
          })}
        </div>
        {comparisonContext && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground/50">{comparisonContext}</p>
        )}
      </div>

      <PreflopTable
        tableSize={scenario.table_size ?? 9}
        // Guarded above: both scenarioA/scenarioB.hero_position are non-empty here,
        // but TS can't carry that narrowing through the `active`-keyed ternary.
        heroPosition={scenario.hero_position!}
        heroHand={scenario.hero_hand}
        effectiveStackBb={scenario.effective_stack_bb}
        anteBb={scenario.ante_bb}
        actionBeforeHero={scenario.action_before_hero}
      />
    </div>
  )
}

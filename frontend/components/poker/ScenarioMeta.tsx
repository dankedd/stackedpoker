import { cn } from '@/lib/utils'
import { formatBb } from '@/components/poker/tableTokens'

export interface ScenarioMetaProps {
  heroPosition?: string
  effectiveStackBb?: number
  className?: string
}

/**
 * The one shared "POSITION · NNBB EFFECTIVE" line for any range-construction
 * exercise (RangeBuild, MultiActionRangeBuild, and future range-building step
 * types) — same terminology PreflopTable's own status bar uses
 * (`${formatBb(n)}BB EFFECTIVE`), so a learner never has to guess the stack
 * depth an opening/defending range assumes. Renders nothing when neither field
 * is authored — never fabricated, matching every other preflop-context field's
 * "only show what's actually authored" contract.
 */
export function ScenarioMeta({ heroPosition, effectiveStackBb, className }: ScenarioMetaProps) {
  if (!heroPosition && effectiveStackBb == null) return null
  return (
    <div className={cn('flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-300/80', className)}>
      {heroPosition && <span>{heroPosition}</span>}
      {heroPosition && effectiveStackBb != null && (
        <span aria-hidden className="text-muted-foreground/30">·</span>
      )}
      {effectiveStackBb != null && <span>{formatBb(effectiveStackBb)}BB EFFECTIVE</span>}
    </div>
  )
}

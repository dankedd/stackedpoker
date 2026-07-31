import { formatBb } from './tableTokens'

export interface StackDepthBadgeProps {
  stackBb: number
}

/**
 * The ONE way a stack depth (15bb, 20bb, 40bb, 60bb, 100bb, or any other
 * value) is ever displayed on a poker table — plain text, no badge chrome,
 * no per-depth styling. A short stack must be exactly as visually
 * unremarkable as a deep one: this is enforced by construction (every stack
 * depth renders through this single component with no branching inside it),
 * not by convention, so a "15bb looks different" regression can't creep back
 * in through a single call site.
 */
export function StackDepthBadge({ stackBb }: StackDepthBadgeProps) {
  return (
    <span className="text-[10px] font-medium text-muted-foreground/45 whitespace-nowrap">
      {formatBb(stackBb)} BB
    </span>
  )
}

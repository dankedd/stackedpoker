export interface RangeExplanationCalloutProps {
  children: React.ReactNode
}

/**
 * The ONE compact callout used to explain a range grid (or grid comparison)
 * — always rendered AFTER the grid(s), never beside or above them. Range
 * grids are the primary visual focus of every screen that uses this; text
 * is secondary support, never competing for first attention or pushing a
 * grid off-center. Only ever holds text that adds real value beyond what
 * the grid itself already shows (a scenario fact not visible elsewhere, or
 * theory — blockers, frequencies, EV/equity deltas, a Modern Poker Theory
 * citation) — purely descriptive text ("this shows Hero's range") is
 * deleted at the content level, never routed through this component.
 */
export function RangeExplanationCallout({ children }: RangeExplanationCalloutProps) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border/30 bg-secondary/20 px-4 py-3 text-center">
      <p className="text-[13px] leading-relaxed text-muted-foreground/80">{children}</p>
    </div>
  )
}

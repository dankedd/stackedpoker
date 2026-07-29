import { cn } from "@/lib/utils";

interface MarketingGridBackgroundProps {
  /** Show the top-anchored conic spotlight halo. Only one per composition — see DESIGN.md's "one dominant light source" rule. */
  spotlight?: boolean;
  className?: string;
}

/** Ambient atmosphere layer — subtle blueprint grid + (optionally) a single
 *  top-anchored spotlight glow. Absolutely positioned; mount once inside a
 *  `relative` section wrapper. Purely decorative — aria-hidden, no pointer
 *  events, so it never interferes with focus order or hit-testing. */
export function MarketingGridBackground({ spotlight = false, className }: MarketingGridBackgroundProps) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="sp-grid-bg absolute inset-0" />
      {spotlight && <div className="sp-spotlight absolute inset-x-0 top-0 h-[520px]" />}
    </div>
  );
}

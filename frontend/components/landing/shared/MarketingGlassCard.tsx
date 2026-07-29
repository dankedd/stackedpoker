import { cn } from "@/lib/utils";

interface MarketingGlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  as?: "div" | "article";
  /** Opt-in hover depth (translateY lift + stronger border/shadow) — only
   *  for genuinely card-like items (a feature card, a module tile). Large
   *  section-wrapper cards should NOT lift while a user clicks a button
   *  inside them, so this defaults to `false`. */
  interactive?: boolean;
}

/** The one shared glass-surface treatment for marketing cards — low-opacity
 *  fill, inset top highlight, cool hairline edge, soft outer shadow. Use
 *  `elevated` for a section's primary/centerpiece card; the default is for
 *  supporting cards. Do not build a second glass treatment per section. */
export function MarketingGlassCard({
  children,
  className,
  elevated = false,
  as = "div",
  interactive = false,
}: MarketingGlassCardProps) {
  const Comp = as;
  return (
    <Comp
      className={cn("rounded-2xl", elevated ? "sp-glass-elevated" : "sp-glass", interactive && "sp-glass-interactive", className)}
    >
      {children}
    </Comp>
  );
}

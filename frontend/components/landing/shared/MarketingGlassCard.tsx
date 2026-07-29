import { cn } from "@/lib/utils";

interface MarketingGlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  as?: "div" | "article";
}

/** The one shared glass-surface treatment for marketing cards — low-opacity
 *  fill, inset top highlight, cool hairline edge, soft outer shadow. Use
 *  `elevated` for a section's primary/centerpiece card; the default is for
 *  supporting cards. Do not build a second glass treatment per section. */
export function MarketingGlassCard({ children, className, elevated = false, as = "div" }: MarketingGlassCardProps) {
  const Comp = as;
  return (
    <Comp className={cn("rounded-2xl", elevated ? "sp-glass-elevated" : "sp-glass", className)}>
      {children}
    </Comp>
  );
}

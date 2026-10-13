import { Zap, Crown } from "lucide-react";
import { getSubscription, type Tier } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

export interface PlanBadgeProps {
  tier: Tier | string | null | undefined;
  className?: string;
}

/**
 * The one "which plan is active" badge — dashboard, settings, and the nav
 * all render this instead of formatting subscription_tier themselves.
 * Pro is violet (the pricing page's accent), the admin account amber.
 * Free shows "Free Plan"; the others show just the plan name.
 */
export function PlanBadge({ tier, className }: PlanBadgeProps) {
  const { tier: normalized, label } = getSubscription(tier);

  const style =
    normalized === "admin"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : normalized === "pro" || normalized === "premium"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
      : "border-border/50 bg-secondary/30 text-muted-foreground";

  const Icon = normalized === "admin" ? Crown : normalized === "pro" || normalized === "premium" ? Zap : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        style,
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {normalized === "free" ? "Free Plan" : label}
    </span>
  );
}

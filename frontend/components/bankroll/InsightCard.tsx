import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}

/**
 * Matches the small sidebar-card pattern from app/coach/page.tsx (icon +
 * uppercase tiny label header, rounded-2xl border-border/40 bg-card/60) —
 * the "same style as the existing AI Coach" this feature was asked to use,
 * as distinct from BankrollStatCard's bigger stagger-animated dashboard
 * numbers used elsewhere in /bankroll.
 */
export function InsightCard({ icon: Icon, label, value, caption, valueClassName, children }: InsightCardProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-violet-400/70" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">{label}</p>
      </div>
      <p className={cn("text-lg font-bold text-foreground", valueClassName)}>{value}</p>
      {caption && <p className="text-xs text-muted-foreground/50 mt-1">{caption}</p>}
      {children}
    </div>
  );
}

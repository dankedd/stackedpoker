import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BankrollStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  valueClassName?: string;
  delayMs?: number;
}

// Mirrors the stat-tile markup in app/dashboard/page.tsx exactly (same
// border/bg/hover treatment, same card-lift + stagger-item animation) so the
// bankroll dashboard reads as the same product, not a new visual style.
export function BankrollStatCard({
  icon: Icon,
  label,
  value,
  caption,
  valueClassName,
  delayMs = 0,
}: BankrollStatCardProps) {
  return (
    <div
      className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-2.5 card-lift stagger-item"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-2 text-muted-foreground/70">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-3xl font-black text-foreground truncate", valueClassName)}>{value}</p>
      {caption && <p className="text-xs text-muted-foreground/50 truncate">{caption}</p>}
    </div>
  );
}

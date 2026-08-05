import { ShieldCheck, TrendingUp, TrendingDown, HelpCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankrollStatus } from "@/lib/bankroll/management";

const STATUS_META: Record<BankrollStatus, { label: string; icon: LucideIcon; cls: string; glow: string }> = {
  safe: {
    label: "Safe",
    icon: ShieldCheck,
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    glow: "shadow-emerald-900/20",
  },
  move_up: {
    label: "Move Up",
    icon: TrendingUp,
    cls: "border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-blue-500/15 text-violet-300",
    glow: "shadow-violet-900/30",
  },
  move_down: {
    label: "Move Down",
    icon: TrendingDown,
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    glow: "shadow-amber-900/20",
  },
  unknown: {
    label: "Not set up",
    icon: HelpCircle,
    cls: "border-border/50 bg-secondary/30 text-muted-foreground/60",
    glow: "",
  },
};

export function BankrollStatusBadge({ status, className }: { status: BankrollStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm",
        meta.cls,
        meta.glow,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

import { VERDICT_LABEL, type PreflopVerdict } from "@/lib/handHistory/preflop";
import { cn } from "@/lib/utils";

export const VERDICT_STYLE: Record<PreflopVerdict, string> = {
  te_los: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  te_strak: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  verkeerde_actie: "border-yellow-400/40 bg-yellow-400/15 text-yellow-200",
  gemengd: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  correct: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  niet_beoordeeld: "border-border/50 bg-transparent text-muted-foreground",
};

/** Preflop-check label. Correct and not-graded stay quiet unless `showAll`. */
export function PreflopBadge({ verdict, showAll = false, className }: { verdict: PreflopVerdict | null; showAll?: boolean; className?: string }) {
  if (!verdict) return null;
  if (!showAll && (verdict === "correct" || verdict === "niet_beoordeeld")) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        VERDICT_STYLE[verdict],
        className,
      )}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

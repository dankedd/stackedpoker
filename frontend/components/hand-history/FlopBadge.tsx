import type { FlopVerdict } from "@/lib/handHistory/flopCheck";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

export const FLOP_VERDICT_STYLE: Record<FlopVerdict, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  ok: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  questionable: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  not_evaluated: "border-border/50 bg-transparent text-muted-foreground",
};

/** Flop-check label. Like PreflopBadge, only "questionable" shows unless `showAll`. */
export function FlopBadge({ verdict, showAll = false, className }: { verdict: FlopVerdict | null; showAll?: boolean; className?: string }) {
  if (!verdict) return null;
  if (!showAll && verdict !== "questionable") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        FLOP_VERDICT_STYLE[verdict],
        className,
      )}
      title={t.flop.badgeTitle}
    >
      {t.flop.verdict[verdict]}
    </span>
  );
}

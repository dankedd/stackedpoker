"use client";

import { PenLine } from "lucide-react";
import { fmtPct } from "@/lib/handHistory/format";
import { potOddsDecisions } from "@/lib/handHistory/potOdds";
import { t } from "@/lib/handHistory/strings";
import type { ParsedHand } from "@/lib/handHistory/types";
import { cn } from "@/lib/utils";

/** Small "Manual" label: the data comes from the user, not a hand history. */
export function ManualBadge({ className }: { className?: string }) {
  return (
    <span
      title={t.manual.badgeTitle}
      className={cn("inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200", className)}
    >
      <PenLine aria-hidden="true" className="h-3 w-3" />
      {t.manual.badge}
    </span>
  );
}

/**
 * What the analysis of a manual hand is based on: equal stacks when the user
 * did not enter them, and for cash hands (no tournament ranges) the pot odds
 * on their own.
 */
export function ManualAnalysisNotes({ hand, fmt }: { hand: ParsedHand; fmt: (chips: number) => string }) {
  if (!hand.manual) return null;
  const assumed = hand.manual.assumedStacks.length > 0;
  const cash = hand.format === "cash";
  const decisions = cash ? potOddsDecisions(hand) : [];
  if (!assumed && !cash) return null;
  return (
    <div className="mt-4 space-y-2">
      {assumed && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">{t.manual.assumedStacks}</p>}
      {cash && (
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs text-muted-foreground">{t.manual.cashNote}</p>
          {decisions.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {decisions.map((d, i) => (
                <li key={i}>
                  {t.street[d.street]} · {t.equity.heroAction[d.action]}: {t.equity.need(fmt(d.toCall), fmt(d.pot), fmtPct(d.required, 0))}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

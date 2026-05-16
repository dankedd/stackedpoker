"use client";

import type { StreetMistakes } from "@/lib/types";
import { cn } from "@/lib/utils";

const STREETS = [
  { key: "preflop" as const, label: "Preflop", color: "bg-violet-500" },
  { key: "flop"    as const, label: "Flop",    color: "bg-blue-500"   },
  { key: "turn"    as const, label: "Turn",     color: "bg-amber-500"  },
  { key: "river"   as const, label: "River",    color: "bg-red-500"    },
];

interface Props {
  streetMistakes: StreetMistakes;
  totalHands: number;
}

export function StreetBreakdown({ streetMistakes, totalHands }: Props) {
  const total = STREETS.reduce((s, st) => s + streetMistakes[st.key], 0);
  if (total === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">No street mistake data yet.</p>
      </div>
    );
  }

  const worst = STREETS.reduce((best, st) =>
    streetMistakes[st.key] > streetMistakes[best.key] ? st : best,
    STREETS[0],
  );

  return (
    <div className="space-y-4">
      {STREETS.map((st) => {
        const count = streetMistakes[st.key];
        const pct   = total > 0 ? (count / total) * 100 : 0;
        const perHand = totalHands > 0 ? count / totalHands : 0;
        const isWorst = st.key === worst.key && count > 0;

        return (
          <div key={st.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-medium", isWorst ? "text-red-400" : "text-foreground")}>
                {st.label}
                {isWorst && <span className="ml-1.5 text-[10px] text-red-400">(biggest leak)</span>}
              </span>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{count} mistakes</span>
                <span className="tabular-nums">{perHand.toFixed(2)}/hand</span>
                <span className="w-8 text-right tabular-nums">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-background/60 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", st.color)}
                style={{ width: `${pct}%`, opacity: isWorst ? 1 : 0.55 }}
              />
            </div>
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground pt-1">
        Total: {total} mistakes across {totalHands} analysed hands.
        {total > 0 && ` Your highest-error street is ${worst.label} — prioritise this in your study plan.`}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import { CATEGORY_LABEL, fmt, GOOD_WITHIN, type Category, type CategoryStats } from "@/lib/flopTrainer/logic";
import { weakestCategory, type CategoryRow } from "@/lib/flopTrainer/phase3";
import { cn } from "@/lib/utils";

/**
 * Accuracy per board type (texture category) — from the server signed in
 * (last 200 answers), from this browser otherwise — with the weakest one
 * up front and a button to train only that kind of flop.
 */
export function TextureTracker({
  stats,
  focus,
  onFocus,
}: {
  stats: CategoryStats;
  focus: Category | null;
  onFocus: (c: Category | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const weakest = weakestCategory(stats);
  const rows = (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => [c, stats[c] as CategoryRow | undefined] as const);
  const answered = rows.reduce((s, [, r]) => s + (r?.[0] ?? 0), 0);

  if (focus) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm">
        <Target aria-hidden="true" className="h-4 w-4 text-violet-300" />
        <span className="text-foreground">
          Training: <b>{CATEGORY_LABEL[focus]}</b>
        </span>
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="ml-auto text-xs font-medium text-violet-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to all boards
        </button>
      </div>
    );
  }
  if (answered < 10) return null;

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-card/30 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {weakest ? (
          <>
            <span className="text-muted-foreground">
              Your weakest: <b className="text-foreground">{CATEGORY_LABEL[weakest.category]}</b>
              {weakest.row[2] !== undefined && (
                <span className="text-xs"> · {Math.round(weakest.row[2])}% within {GOOD_WITHIN} points</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onFocus(weakest.category)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-violet-500/20 px-3 text-xs font-semibold text-violet-100 hover:bg-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Target aria-hidden="true" className="h-3.5 w-3.5" />
              Train this
            </button>
          </>
        ) : (
          <span className="text-muted-foreground">Answer a few more flops of each kind to see your weakest board type.</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          By board type
          <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <table className="mt-2 w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Board type</th>
              <th className="py-1 text-right font-medium">Flops</th>
              <th className="py-1 text-right font-medium">Avg. off</th>
              <th className="py-1 text-right font-medium">Within {GOOD_WITHIN}</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map(([c, r]) => (
              <tr key={c} className="border-t border-border/40">
                <td className="py-1.5 text-foreground">{CATEGORY_LABEL[c]}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{r?.[0] ?? 0}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{r ? fmt(r[1]) : "–"}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{r?.[2] !== undefined ? `${Math.round(r[2])}%` : "–"}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onFocus(c)}
                    className="text-violet-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Train
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

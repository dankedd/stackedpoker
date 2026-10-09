"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { CASH_OPEN_CHARTS, MTT_OPEN_CHARTS } from "@/lib/ranges/data";
import { parseRangesQuery, rangesQuery, type RangesQuery, type RangesView } from "@/lib/ranges/urlState";
import { cn } from "@/lib/utils";
import { DefenseView, OpenRangesView, PushFoldView } from "./RangeViews";

const TABS: { id: RangesView; label: string }[] = [
  { id: "mtt", label: "Open · MTT 12–60bb" },
  { id: "def", label: "Defense" },
  { id: "pf", label: "Push/fold · ≤10bb" },
  { id: "cash", label: "Cash 6-max · 100bb" },
];

/**
 * The range charts. Everything that picks a chart — tab, position, stack,
 * situation — lives in the query string (lib/ranges/urlState.ts), so any chart
 * can be linked to directly, including from the trainer's result modal.
 */
export function RangesBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = parseRangesQuery(params);
  // On a phone the tab row scrolls; keep the selected tab (e.g. from a deep link) in view.
  const selectedTab = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [state.view]);

  // replace, not push: picking a stack is not a page you want to step back through.
  const update = useCallback(
    (next: RangesQuery) => router.replace(`${pathname}${rangesQuery(next)}`, { scroll: false }),
    [router, pathname],
  );

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Chart type"
        className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-border/50 bg-background/40 p-1 sm:w-max"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            ref={state.view === t.id ? selectedTab : undefined}
            aria-selected={state.view === t.id}
            onClick={() => update({ ...state, view: t.id })}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              state.view === t.id ? "bg-violet-500/20 text-violet-100 shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {state.view === "mtt" && (
          <OpenRangesView
            charts={MTT_OPEN_CHARTS}
            positions={["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB"]}
            pos={state.mtt.pos}
            stack={state.mtt.stack}
            onChange={(mtt) => update({ ...state, mtt })}
            showStacks
            note="MTT ranges with antes (chapter 7, Hand Ranges 96–139). The button also has limping variants at 12, 20 and 30bb (Hand Ranges 109–111). Raise sizes as in the book: 2x at 15–25bb, 2.3x from 40bb (UTG/UTG+1: 2x). Per-hand frequencies are read from the charts and can be 1–2 points off; the totals on the right are the book's exact figures."
          />
        )}
        {state.view === "def" && <DefenseView value={state.def} onChange={(def) => update({ ...state, def })} />}
        {state.view === "pf" && (
          <PushFoldView pos={state.pf.pos} bb={state.pf.stack} onChange={(pf) => update({ ...state, pf })} />
        )}
        {state.view === "cash" && (
          <OpenRangesView
            charts={CASH_OPEN_CHARTS}
            positions={["LJ", "HJ", "CO", "BN", "SB"]}
            pos={state.cash.pos}
            stack={100}
            onChange={({ pos }) => update({ ...state, cash: { pos } })}
            showStacks={false}
            note="6-max cash game, 100bb, GTO raise-first-in (chapter 5, Hand Ranges 32–47). The small blind mixes a 3x raise with limping."
          />
        )}
      </div>
    </div>
  );
}

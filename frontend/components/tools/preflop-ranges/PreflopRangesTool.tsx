"use client";

import { useState } from "react";
import { ToolPanel } from "@/components/tools/ToolPanel";
import { CASH_OPEN_CHARTS, MTT_OPEN_CHARTS, SOURCE_CREDIT } from "@/lib/ranges/data";
import { cn } from "@/lib/utils";
import { DefenseView, OpenRangesView, PushFoldView } from "./RangeViews";
import { TOOL_SLUG } from "./shared";
import { Trainer } from "./Trainer";

const TABS = [
  { id: "trainer", label: "Trainer" },
  { id: "mtt", label: "MTT · 12–60bb" },
  { id: "def", label: "Defense" },
  { id: "pf", label: "Push/fold · ≤10bb" },
  { id: "cash", label: "Cash 6-max · 100bb" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Preflop ranges and trainer. All numbers come from data/ranges/*.json via
 * lib/ranges — this component only renders them. Inactive tabs stay mounted
 * (hidden) so the trainer keeps its hand and score when you peek at a chart.
 */
export function PreflopRangesTool() {
  const [tab, setTab] = useState<TabId>("trainer");

  return (
    <ToolPanel
      toolSlug={TOOL_SLUG}
      title="Preflop ranges & trainer"
      description="Open, defend and shove ranges by position and stack depth — then drill them hand by hand."
      footer={
        <p className="border-t border-border/50 pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
          Source: {SOURCE_CREDIT}. Each chart names its Hand Range and page. Per-hand frequencies are read from the
          book&apos;s charts; the totals are the book&apos;s own printed figures.
        </p>
      }
    >
      <div
        role="tablist"
        aria-label="Range views"
        className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-border/50 bg-background/40 p-1 sm:w-max"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`pr-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`pr-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id
                ? "bg-violet-500/20 text-violet-100 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Panel id="trainer" tab={tab}>
        <Trainer active={tab === "trainer"} />
      </Panel>
      <Panel id="mtt" tab={tab}>
        <OpenRangesView
          charts={MTT_OPEN_CHARTS}
          positions={["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB"]}
          initialPos="BN"
          initialStack={15}
          showStacks
          note="MTT ranges with antes (chapter 7, Hand Ranges 96–139). The button also has limping variants at 12, 20 and 30bb (Hand Ranges 109–111). Raise sizes as in the book: 2x at 15–25bb, 2.3x from 40bb (UTG/UTG+1: 2x). Per-hand frequencies are read from the charts and can be 1–2 points off; the totals on the right are the book's exact figures."
        />
      </Panel>
      <Panel id="def" tab={tab}>
        <DefenseView />
      </Panel>
      <Panel id="pf" tab={tab}>
        <PushFoldView />
      </Panel>
      <Panel id="cash" tab={tab}>
        <OpenRangesView
          charts={CASH_OPEN_CHARTS}
          positions={["LJ", "HJ", "CO", "BN", "SB"]}
          initialPos="BN"
          initialStack={100}
          showStacks={false}
          note="6-max cash game, 100bb, GTO raise-first-in (chapter 5, Hand Ranges 32–47). The small blind mixes a 3x raise with limping."
        />
      </Panel>
    </ToolPanel>
  );
}

function Panel({ id, tab, children }: { id: TabId; tab: TabId; children: React.ReactNode }) {
  return (
    <div id={`pr-panel-${id}`} role="tabpanel" aria-labelledby={`pr-tab-${id}`} hidden={tab !== id}>
      {children}
    </div>
  );
}

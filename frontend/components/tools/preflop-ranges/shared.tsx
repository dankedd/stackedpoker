"use client";

import { useState, type ReactNode } from "react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { ChoiceGroup } from "@/components/tools/ToolFields";
import { actionCssColor } from "@/lib/learn/actionStyles";
import type { RangeStrategyMap } from "@/lib/learn/rangeStrategy";
import { combos } from "@/lib/ranges/logic";
import type { ChartAction, RangeActionKey } from "@/lib/ranges/types";
import { cn } from "@/lib/utils";

export const TOOL_SLUG = "preflop-ranges";

/** Left-to-right segment order inside a mixed cell. */
export const ACTION_ORDER: RangeActionKey[] = ["allin", "raise", "limp", "call", "fold"];

/** Source labels carry a Dutch suffix ("met limp"); translated for display only. */
export const sourceLabel = (hr: string) => hr.replace("(met limp)", "(with limp)");

export const fmtPct = (x: number) => (Math.round(x * 10) / 10).toString();

/** Chart grid → the strategy map PokerRangeGrid renders, plus hands that never reach the spot. */
export function toStrategies(
  grid: Record<string, number[] | null>,
  actions: ChartAction[],
): { strategies: RangeStrategyMap; absent: string[] } {
  const strategies: RangeStrategyMap = {};
  const absent: string[] = [];
  for (const [hand, row] of Object.entries(grid)) {
    if (row === null) {
      absent.push(hand);
      continue;
    }
    const mix: Record<string, number> = {};
    actions.forEach((a, i) => {
      mix[a.key] = (mix[a.key] ?? 0) + row[i];
    });
    strategies[hand] = mix;
  }
  return { strategies, absent };
}

/** Actions in display order (all-in first, fold last). */
export function orderedActions<T extends ChartAction>(actions: T[]): T[] {
  return ACTION_ORDER.flatMap((k) => actions.filter((a) => a.key === k));
}

export function Swatch({ action, className }: { action: RangeActionKey | "absent"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]",
        action === "absent" && "border border-dashed border-slate-500/50",
        className,
      )}
      // Same literal color as the grid cell, so the legend matches what you see
      // (fold's Tailwind swatch is nearly invisible on the dark background).
      style={action === "absent" ? undefined : { background: actionCssColor(action) }}
    />
  );
}

/** Pill selector in the site's ChoiceGroup style. */
export function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
  format = (v) => v,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <ChoiceGroup
      toolSlug={TOOL_SLUG}
      label={label}
      value={value}
      options={options.map((o) => ({ value: o, label: format(o) }))}
      onChange={onChange}
    />
  );
}

/** Legend with the source's own printed percentages — never recomputed. */
export function SourceLegend({ actions, showAbsent }: { actions: ChartAction[]; showAbsent?: boolean }) {
  const ordered = orderedActions(actions);
  const played = ordered.filter((a) => a.key !== "fold");
  return (
    <div>
      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-secondary/40" aria-hidden="true">
        {played.map((a) => (
          <span key={a.key + a.label} style={{ width: `${a.pct}%`, background: actionCssColor(a.key) }} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {ordered.map((a) => (
          <li key={a.key + a.label} className="flex items-center gap-2.5 text-sm text-foreground">
            <Swatch action={a.key} />
            {a.label}
            <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{fmtPct(a.pct)}%</span>
          </li>
        ))}
        {showAbsent && (
          <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Swatch action="absent" />
            Never reaches this spot
          </li>
        )}
      </ul>
    </div>
  );
}

/** Exact distribution for one hand. */
export function HandBreakdown({
  hand,
  row,
  actions,
  labelFor,
  chosen,
}: {
  hand: string;
  row: number[] | null;
  actions: ChartAction[];
  labelFor?: (a: ChartAction) => string;
  chosen?: RangeActionKey;
}) {
  if (row === null) {
    return (
      <div>
        <p className="font-mono text-xl font-semibold text-foreground">{hand}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This hand never reaches this spot — it was played differently earlier in the hand.
        </p>
      </div>
    );
  }
  const idx = new Map(actions.map((a, i) => [a, i]));
  return (
    <div>
      <p className="font-mono text-xl font-semibold text-foreground">{hand}</p>
      <p className="mb-2 text-xs text-muted-foreground">{combos(hand)} combos</p>
      <ul className="space-y-1">
        {orderedActions(actions).map((a) => (
          <li
            key={a.key + a.label}
            className={cn(
              "flex items-center gap-2 text-[13px]",
              chosen === a.key ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            <Swatch action={a.key} className="h-2.5 w-2.5" />
            {labelFor ? labelFor(a) : a.label}
            {chosen === a.key && <span className="text-violet-300">← your choice</span>}
            <span className="ml-auto font-mono tabular-nums">{Math.round(row[idx.get(a)!] * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Grid + side panel with legend, source and hover/tap detail. */
export function ChartPanel({
  heading,
  source,
  grid,
  actions,
  highlight,
  children,
}: {
  heading: string;
  source: string;
  grid: Record<string, number[] | null>;
  actions: ChartAction[];
  highlight?: string;
  children?: ReactNode;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const { strategies, absent } = toStrategies(grid, actions);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <PokerRangeGrid
        range={[]}
        mode="strategy"
        strategies={strategies}
        strategyActionOrder={ACTION_ORDER}
        absentHands={absent}
        highlightHand={highlight}
        onHandFocus={setFocus}
        hideLegend
      />
      <aside className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{heading}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{source}</p>
        </div>
        <SourceLegend actions={actions} showAbsent={absent.length > 0} />
        <div className="min-h-[7.5rem] border-t border-border/50 pt-3">
          {focus ? (
            <HandBreakdown hand={focus} row={grid[focus]} actions={actions} />
          ) : (
            <p className="text-xs text-muted-foreground">Hover or tap a hand for its exact distribution.</p>
          )}
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-xs leading-relaxed text-muted-foreground/80">{children}</p>;
}

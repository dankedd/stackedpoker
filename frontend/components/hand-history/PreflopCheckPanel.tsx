"use client";

import { useMemo } from "react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { ChartPanel, sourceLabel } from "@/components/preflop-trainer/shared";
import { MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { displayPos, pushValue } from "@/lib/ranges/logic";
import { fmtNum } from "@/lib/handHistory/format";
import { describeCheck, type PreflopCheck } from "@/lib/handHistory/preflop";
import { t } from "@/lib/handHistory/strings";
import { PreflopBadge } from "./PreflopBadge";

/**
 * The preflop check for one hand, with the trainer's own chart for the spot
 * and Hero's hand highlighted. Charts come from lib/ranges/data — the same
 * files the Preflop Trainer shows.
 */
export function PreflopCheckPanel({ check, active }: { check: PreflopCheck; active: boolean }) {
  const { range, spot } = check.detail;
  const text = describeCheck(check);
  const mapped = range && displayPos(range.position) !== spot.tablePosition;

  return (
    <section
      aria-labelledby="pf-check"
      className={`mt-4 rounded-2xl border p-4 transition-colors ${active ? "border-violet-500/50 bg-violet-500/[0.06]" : "border-border/60 bg-card/40"}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="pf-check" className="text-sm font-semibold">
          {t.preflop.title}
        </h2>
        <PreflopBadge verdict={check.verdict} showAll />
        <span className="text-xs text-muted-foreground">{t.preflop.spotKind}</span>
      </div>
      <p className="text-sm">
        {text.range} <span className="font-semibold">{text.hero}</span>
      </p>
      {text.mix && <p className="mt-1 text-xs text-muted-foreground">{t.preflop.rangeFor(spot.hand, text.mix)}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {t.preflop.effStack(fmtNum(spot.effStackBb, 1))}
        {range ? t.preflop.bucket(range.bucket) : ""}
        {mapped ? t.preflop.mapped(spot.tablePosition, spot.playersBehind, displayPos(range!.position)) : ""}
      </p>

      {range && (
        <div className="mt-4">
          {range.kind === "open" ? <OpenChart position={range.position} bucket={range.bucket} hand={spot.hand} /> : (
            <PushFoldChart position={range.position} bucket={range.bucket} hand={spot.hand} />
          )}
        </div>
      )}
    </section>
  );
}

function OpenChart({ position, bucket, hand }: { position: string; bucket: number; hand: string }) {
  const chart = MTT_OPEN_CHARTS.find((c) => c.pos === position && c.stack === bucket);
  if (!chart) return null;
  return (
    <ChartPanel
      heading={`${displayPos(chart.pos)} · ${chart.stack}bb`}
      source={`${sourceLabel(chart.hr)} · p. ${chart.page}`}
      grid={chart.grid}
      actions={chart.actions}
      highlight={hand}
    />
  );
}

function PushFoldChart({ position, bucket, hand }: { position: string; bucket: number; hand: string }) {
  const chart = PUSH_FOLD_CHARTS.find((c) => c.pos === position);
  const values = useMemo(
    () => (chart ? Object.fromEntries(Object.entries(chart.grid).map(([h, cell]) => [h, pushValue(cell)])) : {}),
    [chart],
  );
  if (!chart) return null;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <PokerRangeGrid range={[]} mode="pushfold" pushValues={values} pushThreshold={bucket} highlightHand={hand} />
      <aside className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">
          {displayPos(chart.pos)} · push/fold {bucket}bb
        </h3>
        <p>
          {chart.hr} · p. {chart.page}
        </p>
        <p>
          {t.preflop.pushFoldNote(hand, values[hand] ?? 0)}
        </p>
      </aside>
    </div>
  );
}

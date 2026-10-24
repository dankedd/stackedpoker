"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Dumbbell, Table2 } from "lucide-react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { ChartPanel } from "@/components/preflop-trainer/shared";
import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { PREFLOP_RANGES_ENABLED, PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { cardsFor, chartName, displayPos, pushValue } from "@/lib/ranges/logic";
import { chartHrefForDeal, trainerQuery } from "@/lib/ranges/urlState";
import { fmtNum } from "@/lib/handHistory/format";
import { describeCheck, scenarioFor, type PreflopCheck, type RangeRef } from "@/lib/handHistory/preflop";
import { t } from "@/lib/handHistory/strings";
import { PreflopBadge } from "./PreflopBadge";

/**
 * The preflop check for one hand, with the trainer's own chart for the spot
 * and Hero's hand highlighted. Charts come from lib/ranges/data — the same
 * files the Preflop Trainer shows: open / push-fold charts first in, the
 * defense charts when Hero faced an open, shove, limp, 4-bet or limp-raise.
 */
export function PreflopCheckPanel({ check, active }: { check: PreflopCheck; active: boolean }) {
  const { range, spot } = check.detail;
  const text = describeCheck(check);
  const defense = spot.kind !== "rfi";
  const mapped = range && displayPos(range.position) !== spot.tablePosition;
  const villainMapped = defense && spot.villain?.position && displayPos(spot.villain.position) !== spot.villain.tablePosition;

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
        <span className="text-xs text-muted-foreground">{text.title}</span>
      </div>

      {defense && text.withHand ? (
        <>
          <p className="text-sm">
            {text.withHand} <span className="font-semibold">{text.hero}</span>
          </p>
          {text.explain && <p className="mt-1 text-sm text-foreground/80">{text.explain}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{text.range}</p>
        </>
      ) : (
        <>
          <p className="text-sm">
            {text.range} <span className="font-semibold">{text.hero}</span>
          </p>
          {text.mix && <p className="mt-1 text-xs text-muted-foreground">{t.preflop.rangeFor(spot.hand, text.mix)}</p>}
          {!defense && text.explain && check.verdict !== "correct" && <p className="mt-1 text-xs text-foreground/80">{text.explain}</p>}
        </>
      )}
      {text.also && <p className="mt-1 text-xs text-muted-foreground">{text.also}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {t.preflop.effStack(fmtNum(spot.effStackBb, 1))}
        {range ? t.preflop.bucket(range.bucket) : ""}
        {mapped ? t.preflop.mapped(spot.tablePosition, spot.playersBehind, displayPos(range!.position)) : ""}
        {villainMapped ? t.preflop.mappedVillain(spot.villain!.tablePosition, displayPos(spot.villain!.position!)) : ""}
      </p>

      {range && (
        <div className="mt-4">
          {range.kind === "defense" ? (
            <DefenseChartView refInfo={range} hand={spot.hand} />
          ) : range.kind === "open" ? (
            <OpenChart position={range.position} bucket={range.bucket} hand={spot.hand} />
          ) : (
            <PushFoldChart position={range.position} bucket={range.bucket} hand={spot.hand} />
          )}
        </div>
      )}

      {range && PREFLOP_RANGES_ENABLED && <TrainLinks check={check} />}
    </section>
  );
}

/** "Train this spot" (the trainer can only pre-select open vs defense) and "Open this chart" (exact chart). */
function TrainLinks({ check }: { check: PreflopCheck }) {
  const sc = scenarioFor(check.detail);
  if (!sc) return null;
  const train = `${PREFLOP_TRAINER_PATH}${trainerQuery({ type: sc.type === "def" ? "def" : "open", game: sc.kind === "pf" ? "pf" : sc.fmt, fewerFolds: true })}`;
  // The chart link only needs the scenario; any two cards of the hand class do (a cycling rng, so suits differ).
  let i = 0;
  const chart = chartHrefForDeal({ ...sc, hand: check.detail.spot.hand, cards: cardsFor(check.detail.spot.hand, () => (i++ % 4) / 4) });
  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold transition hover:border-violet-500/50 hover:bg-violet-500/10";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link href={train} className={btn} title={t.preflop.trainSpotHint}>
        <Dumbbell aria-hidden="true" className="h-3.5 w-3.5 text-violet-300" /> {t.preflop.trainSpot}
      </Link>
      <Link href={chart} className={btn}>
        <Table2 aria-hidden="true" className="h-3.5 w-3.5 text-violet-300" /> {t.preflop.openChart}
      </Link>
    </div>
  );
}

function DefenseChartView({ refInfo, hand }: { refInfo: RangeRef; hand: string }) {
  const chart = DEFENSE_CHARTS.find((c) => c.id === refInfo.chart);
  if (!chart) return null;
  return (
    <ChartPanel
      heading={chartName(chart)}
      grid={chart.grid}
      actions={chart.actions}
      highlight={hand}
    />
  );
}

function OpenChart({ position, bucket, hand }: { position: string; bucket: number; hand: string }) {
  const chart = MTT_OPEN_CHARTS.find((c) => c.pos === position && c.stack === bucket);
  if (!chart) return null;
  return (
    <ChartPanel
      heading={`${displayPos(chart.pos)} · ${chart.stack}bb`}
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
          {t.preflop.pushFoldNote(hand, values[hand] ?? 0)}
        </p>
      </aside>
    </div>
  );
}

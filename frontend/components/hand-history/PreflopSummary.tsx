"use client";

import type { PreflopSummaryRow } from "@/lib/handHistory/api";
import { PREFLOP_ERRORS, SPOT_GROUPS, VERDICT_LABEL, spotGroup, type PreflopSpotKind, type PreflopVerdict, type SpotGroup } from "@/lib/handHistory/preflop";
import { t } from "@/lib/handHistory/strings";
import { displayPos } from "@/lib/ranges/logic";
import { cn } from "@/lib/utils";
import { VERDICT_STYLE } from "./PreflopBadge";

const POSITION_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB", "BB"];

/**
 * Preflop check at a glance: spots checked, % correct, errors per type,
 * correct % per spot type (opens vs the defense spots — where the leak is)
 * and per position. Positions are the trainer's 9-max chart positions.
 */
export function PreflopSummary({
  rows,
  onPick,
  onPickSpot,
  flop,
  onPickFlop,
}: {
  rows: PreflopSummaryRow[];
  onPick: (verdicts: PreflopVerdict[]) => void;
  onPickSpot?: (groups: SpotGroup[]) => void;
  /** Flop decision check counts (null until loaded / signed out). */
  flop?: { analysed: number; questionable: number } | null;
  onPickFlop?: () => void;
}) {
  const by = (v: PreflopVerdict) => rows.filter((r) => r.preflop_check === v).reduce((a, r) => a + r.n, 0);
  const graded = rows.filter((r) => r.preflop_check !== "not_evaluated").reduce((a, r) => a + r.n, 0);
  if (!graded && !by("not_evaluated")) return null;
  const correct = by("correct");
  const errors = PREFLOP_ERRORS.reduce((a, v) => a + by(v), 0);

  // Per spot type — only once the database reports the spot kind (preflop_defense migration).
  const hasSpots = rows.some((r) => r.preflop_spot);
  const byGroup = (g: SpotGroup | "defense") => {
    const mine = rows.filter((r) => {
      const grp = spotGroup(r.preflop_spot as PreflopSpotKind | null);
      return r.preflop_check !== "not_evaluated" && (g === "defense" ? grp !== null && grp !== "open" : grp === g);
    });
    const total = mine.reduce((a, r) => a + r.n, 0);
    const ok = mine.filter((r) => r.preflop_check === "correct").reduce((a, r) => a + r.n, 0);
    return { total, pct: total ? Math.round((ok / total) * 100) : null };
  };
  const groups = hasSpots ? SPOT_GROUPS.map((g) => ({ g, ...byGroup(g) })).filter((x) => x.total > 0) : [];
  const defense = hasSpots ? byGroup("defense") : null;

  const positions = POSITION_ORDER.map((pos) => {
    const mine = rows.filter((r) => r.preflop_position === pos);
    const count = (v: PreflopVerdict) => mine.filter((r) => r.preflop_check === v).reduce((a, r) => a + r.n, 0);
    return { pos, total: mine.filter((r) => r.preflop_check !== "not_evaluated").reduce((a, r) => a + r.n, 0), count };
  }).filter((p) => p.total > 0);

  return (
    <section aria-labelledby="pf-summary" className="mb-4 rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pf-summary" className="text-sm font-semibold">
          {t.preflop.title} <span className="font-normal text-muted-foreground">· {t.preflop.summarySubtitle}</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          {t.preflop.spotsChecked(graded)}
          {by("not_evaluated") ? t.preflop.notEvaluatedCount(by("not_evaluated")) : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2">
          <p className="font-mono text-2xl font-bold">{graded ? Math.round((correct / graded) * 100) : 0}%</p>
          <p className="text-[11px] text-muted-foreground">{t.preflop.correct}</p>
        </div>
        {(["too_loose", "too_tight", "wrong_action", "mixed"] as PreflopVerdict[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick([v])}
            disabled={!by(v)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-left transition hover:brightness-125 disabled:opacity-40",
              VERDICT_STYLE[v],
            )}
            title={t.preflop.showHands(VERDICT_LABEL[v])}
          >
            <span className="block font-mono text-lg font-bold leading-tight">{by(v)}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide">{VERDICT_LABEL[v]}</span>
          </button>
        ))}
        {errors > 0 && (
          <button
            type="button"
            onClick={() => onPick(PREFLOP_ERRORS)}
            className="ml-auto rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-card"
          >
            {t.preflop.showAllMistakes(errors)}
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="mt-4" data-tour="preflop-by-spot">
          <p className="text-sm">
            <span className="font-semibold">{t.preflop.groupShort.open}</span>{" "}
            <span className="font-mono">{byGroup("open").pct ?? "–"}%</span>
            {defense && defense.total > 0 && (
              <>
                <span className="text-muted-foreground"> · </span>
                <span className="font-semibold">{t.preflop.defense}</span> <span className="font-mono">{defense.pct}%</span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t.preflop.byType}>
            {groups.map(({ g, total, pct }) => (
              <button
                key={g}
                type="button"
                data-spot-summary={g}
                onClick={() => onPickSpot?.([g])}
                disabled={!onPickSpot}
                title={t.preflop.showHands(t.preflop.group[g])}
                className="rounded-xl border border-border/60 px-3 py-1.5 text-left transition hover:border-violet-500/50 hover:bg-violet-500/10 disabled:cursor-default"
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.preflop.group[g]}</span>
                <span className="block font-mono text-sm font-bold leading-tight">
                  {pct}% <span className="text-[11px] font-normal text-muted-foreground">· {total}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {flop && flop.analysed > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">{t.flop.summary(flop.analysed, flop.questionable)}</span>
          {flop.questionable > 0 && onPickFlop && (
            <button type="button" onClick={onPickFlop} data-flop-summary="questionable" className="ml-2 text-xs font-semibold text-amber-200 underline-offset-2 hover:underline">
              {t.preflop.showHands(t.flop.verdict.questionable)}
            </button>
          )}
        </p>
      )}

      {positions.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-semibold">{t.preflop.position}</th>
                <th className="py-1 pr-3 text-right font-semibold">{t.preflop.spots}</th>
                <th className="py-1 pr-3 text-right font-semibold">{VERDICT_LABEL.too_loose}</th>
                <th className="py-1 pr-3 text-right font-semibold">{VERDICT_LABEL.too_tight}</th>
                <th className="py-1 pr-3 text-right font-semibold">{VERDICT_LABEL.wrong_action}</th>
                <th className="py-1 text-right font-semibold">{VERDICT_LABEL.mixed}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {positions.map((p) => (
                <tr key={p.pos}>
                  <td className="py-1 pr-3 font-sans font-semibold text-violet-300">{displayPos(p.pos)}</td>
                  <td className="py-1 pr-3 text-right">{p.total}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("too_loose") && "text-rose-300")}>{p.count("too_loose")}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("too_tight") && "text-orange-300")}>{p.count("too_tight")}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("wrong_action") && "text-yellow-200")}>
                    {p.count("wrong_action")}
                  </td>
                  <td className="py-1 text-right text-slate-300">{p.count("mixed")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t.preflop.positionsNote}
          </p>
        </div>
      )}
    </section>
  );
}

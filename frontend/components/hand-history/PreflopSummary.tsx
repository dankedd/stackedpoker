"use client";

import type { PreflopSummaryRow } from "@/lib/handHistory/api";
import { PREFLOP_ERRORS, VERDICT_LABEL, type PreflopVerdict } from "@/lib/handHistory/preflop";
import { displayPos } from "@/lib/ranges/logic";
import { cn } from "@/lib/utils";
import { VERDICT_STYLE } from "./PreflopBadge";

const POSITION_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB"];

/**
 * Preflop check at a glance: spots checked, % correct, errors per type and
 * per position. Positions are the trainer's 9-max chart positions.
 */
export function PreflopSummary({
  rows,
  onPick,
}: {
  rows: PreflopSummaryRow[];
  onPick: (verdicts: PreflopVerdict[]) => void;
}) {
  const by = (v: PreflopVerdict) => rows.filter((r) => r.preflop_check === v).reduce((a, r) => a + r.n, 0);
  const graded = rows.filter((r) => r.preflop_check !== "niet_beoordeeld").reduce((a, r) => a + r.n, 0);
  if (!graded && !by("niet_beoordeeld")) return null;
  const correct = by("correct");
  const errors = PREFLOP_ERRORS.reduce((a, v) => a + by(v), 0);

  const positions = POSITION_ORDER.map((pos) => {
    const mine = rows.filter((r) => r.preflop_position === pos);
    const count = (v: PreflopVerdict) => mine.filter((r) => r.preflop_check === v).reduce((a, r) => a + r.n, 0);
    return { pos, total: mine.filter((r) => r.preflop_check !== "niet_beoordeeld").reduce((a, r) => a + r.n, 0), count };
  }).filter((p) => p.total > 0);

  return (
    <section aria-labelledby="pf-summary" className="mb-4 rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pf-summary" className="text-sm font-semibold">
          Preflop-controle <span className="font-normal text-muted-foreground">· raise first in, volgens de ranges van de trainer</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          {graded} spots gecontroleerd
          {by("niet_beoordeeld") ? ` · ${by("niet_beoordeeld")} niet beoordeeld` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2">
          <p className="font-mono text-2xl font-bold">{graded ? Math.round((correct / graded) * 100) : 0}%</p>
          <p className="text-[11px] text-muted-foreground">correct</p>
        </div>
        {(["te_los", "te_strak", "verkeerde_actie", "gemengd"] as PreflopVerdict[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick([v])}
            disabled={!by(v)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-left transition hover:brightness-125 disabled:opacity-40",
              VERDICT_STYLE[v],
            )}
            title={`Toon handen: ${VERDICT_LABEL[v]}`}
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
            Toon alle {errors} fouten
          </button>
        )}
      </div>

      {positions.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-semibold">Positie</th>
                <th className="py-1 pr-3 text-right font-semibold">Spots</th>
                <th className="py-1 pr-3 text-right font-semibold">Te los</th>
                <th className="py-1 pr-3 text-right font-semibold">Te strak</th>
                <th className="py-1 pr-3 text-right font-semibold">Verkeerde actie</th>
                <th className="py-1 text-right font-semibold">Gemengd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {positions.map((p) => (
                <tr key={p.pos}>
                  <td className="py-1 pr-3 font-sans font-semibold text-violet-300">{displayPos(p.pos)}</td>
                  <td className="py-1 pr-3 text-right">{p.total}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("te_los") && "text-rose-300")}>{p.count("te_los")}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("te_strak") && "text-orange-300")}>{p.count("te_strak")}</td>
                  <td className={cn("py-1 pr-3 text-right", p.count("verkeerde_actie") && "text-yellow-200")}>
                    {p.count("verkeerde_actie")}
                  </td>
                  <td className="py-1 text-right text-slate-300">{p.count("gemengd")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Posities volgens de 9-max ranges van de trainer: aan een 8-handed tafel speelt UTG de UTG+1-range.
          </p>
        </div>
      )}
    </section>
  );
}

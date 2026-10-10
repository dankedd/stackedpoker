"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Loader2, SlidersHorizontal } from "lucide-react";
import { equityOnBoards } from "@/lib/equity/client";
import type { RangeEquity, WeightedRange } from "@/lib/equity/rangeEquity";
import { fmtNum, fmtPct } from "@/lib/handHistory/format";
import { potOddsDecisions } from "@/lib/handHistory/potOdds";
import { t } from "@/lib/handHistory/strings";
import type { AmountFormatter, TimelineStep } from "@/lib/handHistory/timeline";
import type { ParsedHand, Street } from "@/lib/handHistory/types";
import { findVillain, villainRange } from "@/lib/handHistory/villain";
import { cn } from "@/lib/utils";
import { RangeEditor, rangePct } from "./RangeEditor";

const pct = fmtPct;

/**
 * Hero's equity against villain's range on every street, plus the pot odds
 * at each decision where Hero faced a bet. Equity runs in a Web Worker
 * (lib/equity); the range comes from the Preflop Trainer (lib/handHistory/villain).
 */
export function EquityPanel({ hand, step, fmt }: { hand: ParsedHand; step: TimelineStep; fmt: AmountFormatter }) {
  const villain = useMemo(() => findVillain(hand), [hand]);
  const initial = useMemo(() => (villain ? villainRange(hand, villain) : null), [hand, villain]);
  const [range, setRange] = useState<WeightedRange | null>(initial?.range ?? null);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [editing, setEditing] = useState(false);
  const [results, setResults] = useState<(RangeEquity | null)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRange(initial?.range ?? null);
    setLabel(initial?.label ?? "");
  }, [initial]);

  const streets = useMemo(() => {
    const b = hand.board;
    const out: { street: Street; board: string[] }[] = [{ street: "preflop", board: [] }];
    if (b.flop.length === 3) out.push({ street: "flop", board: [...b.flop] });
    if (b.flop.length === 3 && b.turn) out.push({ street: "turn", board: [...b.flop, b.turn] });
    if (b.flop.length === 3 && b.turn && b.river) out.push({ street: "river", board: [...b.flop, b.turn, b.river] });
    return out;
  }, [hand]);

  useEffect(() => {
    if (!range || !hand.heroCards || hand.heroCards.length !== 2) return;
    let stale = false;
    setResults(null);
    setError(null);
    const timer = setTimeout(() => {
      equityOnBoards(hand.heroCards as [string, string], range, streets.map((s) => s.board))
        .then((r) => !stale && setResults(r))
        .catch((e: Error) => !stale && setError(e.message || t.equity.failed));
    }, 120);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [range, hand, streets]);

  const decisions = useMemo(() => potOddsDecisions(hand), [hand]);
  if (!villain || !initial || !range || !hand.heroCards) return null;

  const eqOn = (s: Street) => results?.[streets.findIndex((x) => x.street === s)] ?? null;
  const edited = label !== initial.label;

  return (
    <section aria-labelledby="eq-title" className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="eq-title" className="text-sm font-semibold">
          {t.equity.title(villain)}
        </h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {t.equity.editRange}
        </button>
      </div>

      <p className="text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">
          {" "}
          · {t.equity.ofHands(fmtNum(rangePct(range), 1))}
          {!edited && initial.source ? ` · ${t.equity.source(initial.source.hr, initial.source.page)}` : ""}
        </span>
      </p>
      {!edited && initial.approximation && (
        <p className="mt-1.5 flex gap-1.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {initial.approximation}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t.equity.preflopOnly}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center">
        <table className="w-full text-sm">
          <tbody>
            {streets.map((s, i) => {
              const r = eqOn(s.street);
              const prev = i > 0 ? eqOn(streets[i - 1].street) : null;
              const delta = r && prev ? r.equity - prev.equity : null;
              return (
                <tr key={s.street} className={cn(step.street === s.street && "bg-violet-500/[0.08]")}>
                  <td className="rounded-l-lg py-1 pl-2 pr-3 text-muted-foreground">{t.street[s.street]}</td>
                  <td className="py-1 pr-3 text-right font-mono font-semibold">
                    {results ? (r ? pct(r.equity) : "—") : <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono text-xs text-muted-foreground">{r ? t.equity.tie(pct(r.tie)) : ""}</td>
                  <td
                    className={cn(
                      "rounded-r-lg py-1 pr-2 text-right font-mono text-xs",
                      delta == null ? "" : delta > 0.0005 ? "text-emerald-400" : delta < -0.0005 ? "text-rose-400" : "text-muted-foreground",
                    )}
                  >
                    {delta == null ? "" : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${pct(Math.abs(delta))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Sparkline values={streets.map((s) => eqOn(s.street)?.equity ?? null)} labels={streets.map((s) => t.street[s.street])} />
      </div>
      {results && results.some((r) => r === null) && (
        <p className="mt-1 text-xs text-muted-foreground">{t.equity.allBlocked}</p>
      )}

      {decisions.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.equity.potOdds}
            <span className="group relative inline-flex" tabIndex={0} aria-label={t.equity.icmAria}>
              <Info className="h-3.5 w-3.5" />
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-[11px] normal-case tracking-normal text-foreground opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">
                {t.equity.icmTooltip}
              </span>
            </span>
          </h3>
          {decisions.map((d, i) => {
            const r = eqOn(d.street);
            const ok = r ? r.equity >= d.required : null;
            const current = step.events[0] === d.event;
            return (
              <p
                key={i}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  ok == null ? "border-border/60" : ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10",
                  current && "ring-2 ring-violet-400/60",
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {t.street[d.street]} · {t.equity.heroAction[d.action]}:{" "}
                </span>
                {t.equity.need(fmt(d.toCall), fmt(d.pot), pct(d.required))}{" "}
                {r && <span className={cn("font-semibold", ok ? "text-emerald-300" : "text-rose-300")}>{t.equity.had(pct(r.equity))}</span>}
                {d.stillToAct > 0 && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.equity.stillToAct(d.stillToAct, villain)}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}

      <RangeEditor
        open={editing}
        onClose={() => setEditing(false)}
        range={range}
        label={label}
        position={initial.position}
        original={{ range: initial.range, label: initial.label }}
        onChange={(r, l) => {
          setRange(r);
          setLabel(l);
        }}
      />
    </section>
  );
}

function Sparkline({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const pts = values.map((v, i) => (v == null ? null : { x: values.length === 1 ? 50 : (i / (values.length - 1)) * 100, y: 100 - v * 100 }));
  const line = pts.filter(Boolean).map((p) => `${p!.x},${p!.y}`).join(" ");
  return (
    <svg viewBox="-6 -6 112 112" className="h-24 w-full" role="img" aria-label={t.equity.sparkline(values.map((v, i) => `${labels[i]} ${v == null ? "—" : Math.round(v * 100) + "%"}`).join(", "))}>
      <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 3" />
      {line && <polyline points={line} fill="none" stroke="rgb(167,139,250)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="4" fill="rgb(167,139,250)" />)}
    </svg>
  );
}

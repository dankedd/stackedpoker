"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { handRanking } from "@/lib/equity/client";
import { topPercent } from "@/lib/equity/ranking";
import type { WeightedRange } from "@/lib/equity/rangeEquity";
import { fmtNum } from "@/lib/handHistory/format";
import { t } from "@/lib/handHistory/strings";
import { rangePresets, type RangePreset } from "@/lib/handHistory/villain";
import { combos, handAt } from "@/lib/ranges/logic";
import { cn } from "@/lib/utils";

/** Weighted share of all 1,326 combos. */
export function rangePct(range: WeightedRange): number {
  let n = 0;
  for (const [h, w] of Object.entries(range)) n += combos(h) * w;
  return (n / 1326) * 100;
}

/**
 * Villain's range, editable: click hands on or off, take the top X% of hands,
 * or switch to another Preflop Trainer range. Every change is applied at once.
 */
export function RangeEditor({
  open,
  onClose,
  range,
  label,
  position,
  original,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  range: WeightedRange;
  label: string;
  position: string | null;
  original: { range: WeightedRange; label: string };
  onChange: (range: WeightedRange, label: string) => void;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [pct, setPct] = useState(() => Math.round(rangePct(range)));
  const presets = useMemo(() => (open ? rangePresets(position) : []), [open, position]);
  const groups = useMemo(() => {
    const g = new Map<string, RangePreset[]>();
    for (const p of presets) g.set(p.group, [...(g.get(p.group) ?? []), p]);
    return [...g];
  }, [presets]);

  useEffect(() => {
    if (open && !order) handRanking().then(setOrder).catch(() => setOrder([]));
  }, [open, order]);

  const toggle = (h: string) => {
    const next = { ...range };
    if ((next[h] ?? 0) > 0) delete next[h];
    else next[h] = 1;
    onChange(next, t.range.custom);
  };

  const applyTop = (p: number) => {
    setPct(p);
    if (!order?.length) return;
    const next: WeightedRange = {};
    for (const h of topPercent(order, p)) next[h] = 1;
    onChange(next, t.range.top(p));
  };

  return (
    <Modal open={open} onClose={onClose} title={t.range.title} maxWidthClassName="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            <span className="font-semibold">{label}</span>
            <span className="text-muted-foreground"> · {t.range.ofCombos(fmtNum(rangePct(range), 1))}</span>
          </p>
          <button
            type="button"
            onClick={() => onChange(original.range, original.label)}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-xs hover:bg-card"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t.range.resetTo(original.label)}
          </button>
        </div>

        <div>
          <label htmlFor="preset" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.range.otherRange}
          </label>
          <select
            id="preset"
            value=""
            onChange={(e) => {
              const p = presets.find((x) => x.id === e.target.value);
              if (p) onChange(p.range, p.label);
            }}
            className="w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
          >
            <option value="">{t.range.pickRange}</option>
            {groups.map(([g, items]) => (
              <optgroup key={g} label={g}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.source})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="toppct" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.range.topPct} {order === null && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="toppct"
              type="range"
              min={1}
              max={100}
              value={pct}
              disabled={!order?.length}
              onChange={(e) => applyTop(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <output className="w-12 text-right font-mono text-sm">{pct}%</output>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t.range.rankedBy}</p>
        </div>

        <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
          {Array.from({ length: 169 }, (_, i) => {
            const h = handAt(Math.floor(i / 13), i % 13);
            const w = range[h] ?? 0;
            return (
              <button
                key={h}
                type="button"
                aria-pressed={w > 0}
                onClick={() => toggle(h)}
                title={w > 0 && w < 1 ? `${h}: ${Math.round(w * 100)}%` : h}
                className={cn(
                  "aspect-square rounded-[3px] text-[9px] font-semibold leading-none transition sm:text-[11px]",
                  w > 0 ? "text-white" : "bg-white/[0.04] text-muted-foreground/60 hover:bg-white/10",
                )}
                style={w > 0 ? { background: `rgba(139,92,246,${0.25 + 0.7 * w})` } : undefined}
              >
                {h}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t.range.help}
        </p>
      </div>
    </Modal>
  );
}

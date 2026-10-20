"use client";

import { useMemo, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { checkPreflop } from "@/lib/handHistory/preflop";
import { amountFormatter, fmtChips, fmtPlayedAt, type AmountUnit } from "@/lib/handHistory/format";
import { t } from "@/lib/handHistory/strings";
import { buildTimeline, describeStep } from "@/lib/handHistory/timeline";
import type { ParsedHand } from "@/lib/handHistory/types";
import { cn } from "@/lib/utils";
import { EquityPanel } from "../EquityPanel";
import { FavoriteStar } from "../FavoriteStar";
import { PreflopCheckPanel } from "../PreflopCheckPanel";
import { ReplayTable } from "../ReplayTable";
import { ManualAnalysisNotes, ManualBadge } from "./ManualNotes";

/** The hand in the same replayer pieces as a saved hand, before it is saved. */
export function ReviewStep({
  hand,
  note,
  onNote,
  starred,
  onStar,
  saving,
  error,
  onBack,
  onSave,
}: {
  hand: ParsedHand;
  note: string;
  onNote: (s: string) => void;
  starred: boolean;
  onStar: (v: boolean) => void;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  const steps = useMemo(() => buildTimeline(hand), [hand]);
  const [index, setIndex] = useState(steps.length - 1);
  const [unit, setUnit] = useState<AmountUnit>("bb");
  const fmt = amountFormatter(unit, hand.bigBlind);
  const preflop = useMemo(() => checkPreflop(hand), [hand]);
  const last = steps.length - 1;
  const step = steps[Math.min(index, last)];
  const preflopStep = steps.findIndex((s) => s.kind === "action" && s.street === "preflop" && s.player === hand.heroName);
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));
  const ctrl = "flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card/50 disabled:opacity-30";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {hand.tournamentName ?? (hand.format === "cash" ? t.manual.cash : t.manual.tournament)}
            <ManualBadge />
          </h2>
          <p className="text-xs text-muted-foreground">
            {fmtPlayedAt(hand.playedAt)}
            {hand.level ? ` · Level ${hand.level}` : ""} · <span className="font-mono">{fmtChips(hand.smallBlind)}/{fmtChips(hand.bigBlind)}</span>
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-white/10 p-0.5 text-[11px] font-semibold">
          {(["bb", "chips"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn("rounded-md px-2 py-1", unit === u ? "bg-violet-500/25 text-white" : "text-slate-400")}>
              {u === "bb" ? t.manual.unitBb : t.manual.unitChips}
            </button>
          ))}
        </div>
      </div>

      <ReplayTable hand={hand} step={step} fmt={fmt} />
      <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2" aria-live="polite">
        <span className="text-sm font-medium">{describeStep(step, fmt)}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {index}/{last}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button type="button" aria-label={t.replayer.toStart} className={ctrl} onClick={() => go(0)} disabled={index === 0}>
          <ChevronFirst className="h-5 w-5" />
        </button>
        <button type="button" aria-label={t.replayer.prevAction} className={ctrl} onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" aria-label={t.replayer.nextAction} className={ctrl} onClick={() => go(index + 1)} disabled={index >= last}>
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" aria-label={t.replayer.toEnd} className={ctrl} onClick={() => go(last)} disabled={index >= last}>
          <ChevronLast className="h-5 w-5" />
        </button>
      </div>

      {preflop && <PreflopCheckPanel check={preflop} active={index === preflopStep} />}
      <EquityPanel hand={hand} step={step} fmt={fmt} />
      <ManualAnalysisNotes hand={hand} fmt={fmt} />

      <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FavoriteStar on={starred} onToggle={() => onStar(!starred)} />
          {t.manual.star}
        </div>
        <label htmlFor="mh-note" className="mb-1 mt-3 block text-sm font-semibold">
          {t.manual.noteLabel}
        </label>
        <textarea
          id="mh-note"
          rows={3}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={t.manual.notePlaceholder}
          className="w-full resize-y rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-violet-500/60"
        />
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} disabled={saving} className="h-12 flex-1 rounded-xl border border-white/15 text-sm font-semibold">
          {t.manual.back}
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? t.manual.saving : t.manual.save}
        </button>
      </div>
    </div>
  );
}

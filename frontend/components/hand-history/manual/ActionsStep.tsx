"use client";

import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { resolveShowdown, type ShowdownInput } from "@/lib/handHistory/manual/build";
import {
  foldToHeroSteps,
  HERO,
  legalActions,
  ManualHandError,
  replay,
  usedCards,
  type DealStreet,
  type ManualSetup,
  type ManualState,
  type ManualStep,
} from "@/lib/handHistory/manual/engine";
import { amountFormatter, type AmountUnit } from "@/lib/handHistory/format";
import { t } from "@/lib/handHistory/strings";
import type { HandEvent } from "@/lib/handHistory/types";
import { cn } from "@/lib/utils";
import { CardPick } from "./CardPick";

const btn = "h-12 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40";

export function ActionsStep({
  setup,
  steps,
  onSteps,
  showdown,
  onShowdown,
  onBack,
  onNext,
}: {
  setup: ManualSetup;
  steps: ManualStep[];
  onSteps: (steps: ManualStep[]) => void;
  showdown: ShowdownInput;
  onShowdown: (s: ShowdownInput) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sizing, setSizing] = useState<"bet" | "raise" | null>(null);
  const [unit, setUnit] = useState<AmountUnit>("bb");
  const [dealCards, setDealCards] = useState<string[]>([]);

  const state = useMemo<ManualState | null>(() => {
    try {
      return replay(setup, steps);
    } catch {
      return null;
    }
  }, [setup, steps]);
  const fmt = amountFormatter(unit, setup.bigBlind);

  const apply = (more: ManualStep[]) => {
    try {
      replay(setup, [...steps, ...more]);
      setError(null);
      setSizing(null);
      setDealCards([]);
      onSteps([...steps, ...more]);
    } catch (e) {
      setError(e instanceof ManualHandError ? e.message : String(e));
    }
  };
  const undo = () => {
    setError(null);
    setSizing(null);
    setDealCards([]);
    onSteps(steps.slice(0, -1));
  };

  if (!state) {
    // Should not happen (every step is validated before it is added); offer a way out.
    return (
      <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        Something in this hand doesn&apos;t add up.{" "}
        <button type="button" onClick={undo} className="font-semibold underline">
          {t.manual.undo}
        </button>
      </div>
    );
  }

  const legal = legalActions(state, setup.bigBlind);
  const pot = state.seats.reduce((a, s) => a + s.committed, 0);
  const used = usedCards(setup, state, showdown.shown);
  const resolution = state.finished ? resolveShowdown(setup, state, showdown) : null;

  return (
    <div className="space-y-4">
      {/* Street, board, pot */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-200">{t.street[state.street]}</span>
          <span className="font-mono text-sm font-semibold">{t.manual.pot(fmt(pot))}</span>
          <div className="ml-auto inline-flex rounded-lg border border-white/10 p-0.5 text-[11px] font-semibold">
            {(["bb", "chips"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn("rounded-md px-2 py-1", unit === u ? "bg-violet-500/25 text-white" : "text-slate-400")}>
                {u === "bb" ? t.manual.unitBb : t.manual.unitChips}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex min-h-[70px] items-center gap-1.5">
          {state.board.map((c) => (
            <FourColorCard key={c} card={c} size="sm" />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {state.seats.map((s) => (
            <li
              key={s.name}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-center",
                s.name === state.toAct ? "border-[#7C5CFF] bg-[#7C5CFF]/15" : "border-white/10 bg-white/[0.03]",
                s.folded && "opacity-40",
              )}
            >
              <p className="text-[11px] font-semibold">{s.name === HERO ? `${HERO} · ${s.position}` : s.position}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{s.allIn ? t.manual.allIn : fmt(s.behind)}</p>
              {s.streetBet > 0 && <p className="font-mono text-[11px] text-violet-200">{fmt(s.streetBet)}</p>}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {/* Whose turn */}
      {legal && !sizing && (
        <section className="rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.06] p-4">
          <p className="mb-3 text-sm font-semibold">{t.manual.toAct(legal.player === HERO ? `${HERO} (${state.seats.find((s) => s.name === HERO)?.position})` : legal.player)}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {legal.canCall && (
              <button type="button" onClick={() => apply([{ kind: "action", player: legal.player, action: "fold" }])} className={cn(btn, "border border-white/15 bg-white/[0.04]")}>
                {t.manual.fold}
              </button>
            )}
            {legal.canCheck && (
              <button type="button" onClick={() => apply([{ kind: "action", player: legal.player, action: "check" }])} className={cn(btn, "border border-white/15 bg-white/[0.04]")}>
                {t.manual.check}
              </button>
            )}
            {legal.canCall && (
              <button type="button" onClick={() => apply([{ kind: "action", player: legal.player, action: "call" }])} className={cn(btn, "bg-emerald-600 text-white")}>
                {t.manual.call(fmt(legal.callAmount))}
              </button>
            )}
            {legal.canBet && legal.maxTo > legal.minTo && (
              <button type="button" onClick={() => setSizing("bet")} className={cn(btn, "bg-violet-600 text-white")}>
                {t.manual.bet}
              </button>
            )}
            {legal.canRaise && legal.maxTo > legal.minTo && (
              <button type="button" onClick={() => setSizing("raise")} className={cn(btn, "bg-violet-600 text-white")}>
                {t.manual.raise}
              </button>
            )}
            {(legal.canBet || legal.canRaise) && (
              <button type="button" onClick={() => apply([{ kind: "action", player: legal.player, action: "allin" }])} className={cn(btn, "bg-red-600 text-white")}>
                {t.manual.allIn} {fmt(legal.maxTo)}
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {legal.player !== HERO && (
              <button type="button" onClick={() => apply(foldToHeroSteps(setup, state))} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
                {t.manual.everyoneFolds}
              </button>
            )}
          </div>
        </section>
      )}

      {legal && sizing && <SizePanel kind={sizing} legal={legal} currentBet={state.currentBet} bigBlind={setup.bigBlind} street={state.street} unit={unit} fmt={fmt} onCancel={() => setSizing(null)} onConfirm={(to) => apply([{ kind: "action", player: legal.player, action: sizing, to }])} />}

      {/* Board cards */}
      {state.needsDeal && (
        <section className="rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.06] p-4">
          <p className="mb-1 text-sm font-semibold">{t.manual.dealTitle(t.street[state.needsDeal].toLowerCase())}</p>
          <p className="mb-3 text-xs text-muted-foreground">{t.manual.pickCards(state.needsDeal === "flop" ? 3 : 1)}</p>
          <CardPick value={dealCards} onChange={setDealCards} count={state.needsDeal === "flop" ? 3 : 1} blocked={used} label={t.street[state.needsDeal]} />
          <button
            type="button"
            disabled={dealCards.length !== (state.needsDeal === "flop" ? 3 : 1)}
            onClick={() => apply([{ kind: "deal", street: state.needsDeal as DealStreet, cards: dealCards }])}
            className={cn(btn, "mt-3 w-full bg-[#7C5CFF] text-white")}
          >
            {t.manual.confirmDeal}
          </button>
        </section>
      )}

      {/* Showdown */}
      {state.finished && state.showdown && (
        <section className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
          <div>
            <h2 className="text-sm font-semibold">{t.manual.showdownTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t.manual.showdownHint}</p>
          </div>
          {state.seats
            .filter((s) => !s.folded && s.name !== HERO)
            .map((s) => (
              <div key={s.name}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t.manual.cardsOf(s.position)}</p>
                <CardPick
                  value={showdown.shown[s.name] ?? []}
                  onChange={(cards) => {
                    const shown = { ...showdown.shown };
                    if (cards.length) shown[s.name] = cards;
                    else delete shown[s.name];
                    onShowdown({ ...showdown, shown });
                  }}
                  count={2}
                  blocked={new Set([...used].filter((c) => !(showdown.shown[s.name] ?? []).includes(c)))}
                  label={t.manual.cardsOf(s.position)}
                />
              </div>
            ))}
          {resolution?.pots.map((pot, i) => {
            if (pot.eligible.length === 1) return null;
            const byCards = resolution.undecided.includes(i) ? null : resolution.winners[i];
            if (byCards && !showdown.potWinners[i]) {
              return (
                <p key={i} className="text-sm text-emerald-300">
                  {t.manual.wonByCards(byCards.join(" & "))} · {fmt(pot.amount)}
                </p>
              );
            }
            const picked = showdown.potWinners[i] ?? [];
            const choose = (w: string[]) => onShowdown({ ...showdown, potWinners: { ...showdown.potWinners, [i]: w } });
            return (
              <div key={i}>
                <p className="mb-2 text-sm font-medium">{t.manual.whoWon(fmt(pot.amount))}</p>
                <div className="flex flex-wrap gap-2">
                  {pot.eligible.map((p) => (
                    <button key={p} type="button" aria-pressed={picked.length === 1 && picked[0] === p} onClick={() => choose([p])} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", picked.length === 1 && picked[0] === p ? "border-[#7C5CFF] bg-[#7C5CFF]/25" : "border-white/15")}>
                      {p === HERO ? HERO : p}
                    </button>
                  ))}
                  <button type="button" aria-pressed={picked.length > 1} onClick={() => choose([...pot.eligible])} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", picked.length > 1 ? "border-[#7C5CFF] bg-[#7C5CFF]/25" : "border-white/15")}>
                    {t.manual.split}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <ActionLog events={state.events} fmt={fmt} />

      <div className="flex gap-2">
        <button type="button" onClick={steps.length ? undo : onBack} className={cn(btn, "flex flex-1 items-center justify-center gap-1.5 border border-white/15")}>
          {steps.length ? (
            <>
              <Undo2 className="h-4 w-4" /> {t.manual.undo}
            </>
          ) : (
            t.manual.back
          )}
        </button>
        <button
          type="button"
          disabled={!state.finished || Boolean(resolution?.undecided.length)}
          onClick={onNext}
          className={cn(btn, "flex-[2] bg-[#7C5CFF] text-white")}
        >
          {t.manual.toReview}
        </button>
      </div>
    </div>
  );
}

function SizePanel({
  kind,
  legal,
  currentBet,
  bigBlind,
  street,
  unit,
  fmt,
  onCancel,
  onConfirm,
}: {
  kind: "bet" | "raise";
  legal: NonNullable<ReturnType<typeof legalActions>>;
  currentBet: number;
  bigBlind: number;
  street: string;
  unit: AmountUnit;
  fmt: (chips: number) => string;
  onCancel: () => void;
  onConfirm: (to: number) => void;
}) {
  const [to, setTo] = useState(legal.minTo);
  const clamp = (x: number) => Math.min(legal.maxTo, Math.max(legal.minTo, Math.round(x)));
  // Pot-sized: the pot after calling, on top of the call.
  const potAfterCall = legal.pot + legal.toCall;
  const presets: { label: string; to: number }[] = [
    ...(kind === "raise" || street === "preflop"
      ? [2, 2.5, 3].map((m) => ({ label: `${m}x`, to: (currentBet || bigBlind) * m }))
      : []),
    { label: t.manual.halfPot, to: currentBet + potAfterCall / 2 },
    { label: t.manual.twoThirdsPot, to: currentBet + (potAfterCall * 2) / 3 },
    { label: t.manual.fullPot, to: currentBet + potAfterCall },
    { label: t.manual.allIn, to: legal.maxTo },
  ];
  const shown = unit === "bb" ? String(Math.round((to / bigBlind) * 100) / 100) : String(to);
  const what = kind === "bet" ? t.manual.bet : t.manual.raise;

  return (
    <section className="rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.06] p-4">
      <p className="mb-3 text-sm font-semibold">{t.manual.sizeTitle(what)}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setTo(clamp(p.to))} className={cn("h-10 rounded-lg border text-xs font-semibold", to === clamp(p.to) ? "border-[#7C5CFF] bg-[#7C5CFF]/25" : "border-white/15")}>
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor="mh-size" className="mb-1 mt-3 block text-xs text-muted-foreground">
        {t.manual.sizeTo} ({unit === "bb" ? t.manual.unitBb : t.manual.unitChips})
      </label>
      <input
        id="mh-size"
        inputMode="decimal"
        value={shown}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (Number.isFinite(n) && n >= 0) setTo(Math.round(unit === "bb" ? n * bigBlind : n));
        }}
        className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 font-mono text-sm outline-none focus:border-[#7C5CFF]/70"
      />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className={cn(btn, "flex-1 border border-white/15")}>
          {t.manual.cancel}
        </button>
        <button type="button" onClick={() => onConfirm(to)} className={cn(btn, "flex-[2] bg-violet-600 text-white")}>
          {t.manual.confirmSize(what, fmt(to))}
        </button>
      </div>
    </section>
  );
}

function ActionLog({ events, fmt }: { events: HandEvent[]; fmt: (c: number) => string }) {
  const lines = events
    .filter((e) => e.kind === "action" || e.kind === "deal" || e.kind === "uncalled")
    .map((e) => {
      if (e.kind === "deal") return `— ${t.street[e.street]} ${e.cards.join(" ")}`;
      if (e.kind === "uncalled") return `${fmt(e.amount)} returned to ${e.player}`;
      if (e.kind !== "action") return "";
      const who = e.player;
      const amt = e.action === "raise" ? `to ${fmt(e.toAmount ?? e.amount)}` : e.amount ? fmt(e.amount) : "";
      return `${who} ${e.action === "fold" ? "folds" : e.action === "check" ? "checks" : e.action === "call" ? "calls" : e.action === "bet" ? "bets" : "raises"} ${amt}${e.allIn ? " (all-in)" : ""}`.trim();
    });
  if (!lines.length) return null;
  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm" open>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{t.manual.log}</summary>
      <ol className="mt-2 space-y-0.5 font-mono text-xs text-white/80">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </details>
  );
}

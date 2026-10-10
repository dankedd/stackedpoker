"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getHand, neighbours } from "@/lib/handHistory/api";
import { readQueryState, writeQueryState } from "@/lib/handHistory/filters";
import { HANDS_PATH } from "@/lib/handHistory/feature";
import { amountFormatter, fmtBb, fmtChips, fmtPlayedAt, fmtSignedBb, fmtSignedChips, type AmountUnit } from "@/lib/handHistory/format";
import { deriveHand } from "@/lib/handHistory/derive";
import type { HandDetailRow } from "@/lib/handHistory/rows";
import { buildTimeline, describeStep, nextStreetIndex, prevStreetIndex } from "@/lib/handHistory/timeline";
import type { Street } from "@/lib/handHistory/types";
import { cn } from "@/lib/utils";
import { checkPreflop } from "@/lib/handHistory/preflop";
import { MiniCards } from "./MiniCards";
import { PreflopBadge } from "./PreflopBadge";
import { PreflopCheckPanel } from "./PreflopCheckPanel";
import { NotesPanel } from "./NotesPanel";
import { ReplayTable } from "./ReplayTable";

const STREET_COLOR: Record<Street, string> = {
  preflop: "#38BDF8",
  flop: "#34D399",
  turn: "#FBBF24",
  river: "#F87171",
};
const STREET_NL: Record<Street, string> = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };
const UNIT_KEY = "hh-replayer-unit";

export function HandReplayer({ id }: { id: string }) {
  const params = useSearchParams();
  const query = useMemo(() => readQueryState(new URLSearchParams(params.toString())), [params]);
  const suffix = writeQueryState(query, false);
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const [row, setRow] = useState<HandDetailRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<{ prevId: string | null; nextId: string | null }>({ prevId: null, nextId: null });
  const [index, setIndex] = useState(0);
  const [unit, setUnit] = useState<AmountUnit>("chips");
  const [hasNote, setHasNote] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNIT_KEY);
      if (saved === "bb" || saved === "chips") setUnit(saved);
    } catch {
      /* storage unavailable — keep chips */
    }
  }, []);
  const changeUnit = (u: AmountUnit) => {
    setUnit(u);
    try {
      localStorage.setItem(UNIT_KEY, u);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    setRow(null);
    setError(null);
    setIndex(0);
    getHand(supabase, id)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          setError("Deze hand bestaat niet of is niet van jou.");
          return;
        }
        setRow(r);
        setHasNote(r.has_note);
        neighbours(supabase, r as unknown as Record<string, unknown>, query)
          .then((n) => !cancelled && setNav(n))
          .catch(() => {});
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // `query` only changes together with the URL, which also changes `id` or is the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, id]);

  const hand = row?.data ?? null;
  const steps = useMemo(() => (hand ? buildTimeline(hand) : []), [hand]);
  const derived = useMemo(() => (hand ? deriveHand(hand) : null), [hand]);
  // Computed live from the trainer's current ranges (the stored copy is for filtering).
  const preflop = useMemo(() => (hand ? checkPreflop(hand) : null), [hand]);
  // The step where Hero makes the decision the check is about.
  const preflopStep = useMemo(
    () => steps.findIndex((s) => s.kind === "action" && s.street === "preflop" && s.player === hand?.heroName),
    [steps, hand],
  );
  const last = Math.max(0, steps.length - 1);
  const step = steps[Math.min(index, last)];
  const fmt = useMemo(() => amountFormatter(unit, hand?.bigBlind ?? 1), [unit, hand]);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "ArrowDown") go(nextStreetIndex(steps, index));
      else if (e.key === "ArrowUp") go(prevStreetIndex(steps, index));
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, last, steps]);

  const onHasNoteChange = useCallback((v: boolean) => setHasNote(v), []);

  if (error) {
    return (
      <div className="page-enter">
        <BackLink suffix={suffix} />
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      </div>
    );
  }
  if (!row || !hand || !step || !derived) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Hand laden…
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <BackLink suffix={suffix} />
        <div className="flex items-center gap-2">
          <HandNavLink id={nav.prevId} suffix={suffix} label="Vorige hand" dir="prev" />
          <HandNavLink id={nav.nextId} suffix={suffix} label="Volgende hand" dir="next" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">{row.hh_tournaments?.name ?? hand.tournamentName ?? `Toernooi #${hand.tournamentId}`}</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {fmtPlayedAt(hand.playedAt)} · Level {hand.level} · {fmtChips(hand.smallBlind)}/{fmtChips(hand.bigBlind)}
                {hand.ante ? ` (ante ${fmtChips(hand.ante)})` : ""}
              </p>
            </div>
            <UnitToggle unit={unit} onChange={changeUnit} />
          </div>

          <ReplayTable hand={hand} step={step} fmt={fmt} />

          <div className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2" aria-live="polite">
            <span
              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black"
              style={{ background: STREET_COLOR[step.street] }}
            >
              {STREET_NL[step.street]}
            </span>
            <span className="text-sm font-medium">{describeStep(step, fmt)}</span>
            {preflop && index === preflopStep && <PreflopBadge verdict={preflop.verdict} showAll />}
            <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
              {index}/{last}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-2">
            <CtrlButton label="Naar begin (Home)" onClick={() => go(0)} disabled={index === 0}>
              <ChevronFirst className="h-5 w-5" />
            </CtrlButton>
            <CtrlButton label="Vorige actie (←)" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft className="h-5 w-5" />
            </CtrlButton>
            <CtrlButton label="Volgende actie (→)" onClick={() => go(index + 1)} disabled={index >= last} primary>
              <ChevronRight className="h-5 w-5" />
            </CtrlButton>
            <CtrlButton label="Volgende straat (↓)" onClick={() => go(nextStreetIndex(steps, index))} disabled={index >= last}>
              <ChevronsRight className="h-5 w-5" />
              <span className="hidden text-xs font-semibold sm:inline">Straat</span>
            </CtrlButton>
            <CtrlButton label="Naar einde (End)" onClick={() => go(last)} disabled={index >= last}>
              <ChevronLast className="h-5 w-5" />
            </CtrlButton>
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
            Toetsen: ← → actie · ↑ ↓ straat · Home/End begin/einde
          </p>
          {preflop && <PreflopCheckPanel check={preflop} active={index === preflopStep} />}
        </div>

        <aside className="space-y-4">
          {user && <NotesPanel key={row.id} handRef={row.id} userId={user.id} onHasNoteChange={onHasNoteChange} />}
          <HandFacts row={row} derived={derived} unit={unit} hasNote={hasNote} />
        </aside>
      </div>
    </div>
  );
}

function HandFacts({
  row,
  derived,
  unit,
  hasNote,
}: {
  row: HandDetailRow;
  derived: ReturnType<typeof deriveHand>;
  unit: AmountUnit;
  hasNote: boolean;
}) {
  const hand = row.data;
  const net = derived.heroNetChips;
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm">
      <h2 className="mb-3 text-sm font-semibold">Deze hand</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Kaarten</dt>
        <dd>
          <MiniCards cards={hand.heroCards} /> <span className="ml-1 text-xs text-violet-300">{derived.heroPosition}</span>
        </dd>
        <dt className="text-muted-foreground">Board</dt>
        <dd>
          <MiniCards cards={row.board} />
        </dd>
        <dt className="text-muted-foreground">Pot</dt>
        <dd className="font-mono">{unit === "bb" ? fmtBb(derived.potBb) : fmtChips(hand.totalPot)}</dd>
        <dt className="text-muted-foreground">Mijn inzet</dt>
        <dd className="font-mono">{unit === "bb" ? fmtBb(derived.heroInvestedBb) : fmtChips(derived.heroInvested)}</dd>
        <dt className="text-muted-foreground">Resultaat</dt>
        <dd className={cn("font-mono font-semibold", net > 0 ? "text-emerald-400" : net < 0 ? "text-rose-400" : "")}>
          {unit === "bb" ? fmtSignedBb(derived.heroNetBb) : fmtSignedChips(net)}
          {derived.heroWon && net <= 0 ? " (pot gedeeld)" : ""}
        </dd>
        <dt className="text-muted-foreground">Showdown</dt>
        <dd>{derived.wentToShowdown ? "Ja" : "Nee"}</dd>
        <dt className="text-muted-foreground">Notitie</dt>
        <dd>{hasNote ? "Ja" : "Nee"}</dd>
        <dt className="text-muted-foreground">Hand-ID</dt>
        <dd className="truncate font-mono text-xs">{hand.handId}</dd>
        <dt className="text-muted-foreground">Tafel</dt>
        <dd className="text-xs">
          {hand.tableName} · {hand.maxSeats}-max
        </dd>
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Originele tekst</summary>
        <RawText id={row.id} />
      </details>
    </section>
  );
}

/** Loaded on demand — raw_text is not part of the hand query. */
function RawText({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from("hh_hands")
      .select("raw_text")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setText((data as { raw_text: string } | null)?.raw_text ?? ""));
  }, [supabase, id]);
  return (
    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
      {text ?? "Laden…"}
    </pre>
  );
}

function UnitToggle({ unit, onChange }: { unit: AmountUnit; onChange: (u: AmountUnit) => void }) {
  return (
    <div role="group" aria-label="Bedragen tonen in" className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs font-semibold">
      {(["chips", "bb"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => onChange(u)}
          className={cn("rounded-md px-3 py-1 transition-colors", unit === u ? "bg-violet-500/25 text-violet-100" : "text-slate-400 hover:text-white")}
        >
          {u === "chips" ? "Chips" : "BB"}
        </button>
      ))}
    </div>
  );
}

function CtrlButton({
  label,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3 transition disabled:opacity-35",
        primary ? "border-violet-500/60 bg-violet-600 text-white hover:bg-violet-500" : "border-border/60 bg-card/60 hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}

function BackLink({ suffix }: { suffix: string }) {
  return (
    <Link href={`${HANDS_PATH}${suffix}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Terug naar overzicht
    </Link>
  );
}

function HandNavLink({ id, suffix, label, dir }: { id: string | null; suffix: string; label: string; dir: "prev" | "next" }) {
  const cls = "inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-sm";
  const content =
    dir === "prev" ? (
      <>
        <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
      </>
    ) : (
      <>
        <span className="hidden sm:inline">{label}</span> <ChevronRight className="h-4 w-4" />
      </>
    );
  if (!id) {
    return (
      <span aria-disabled className={cn(cls, "opacity-35")} title={label}>
        {content}
      </span>
    );
  }
  return (
    <Link href={`${HANDS_PATH}/${id}${suffix}`} className={cn(cls, "hover:bg-card")} title={label} aria-label={label}>
      {content}
    </Link>
  );
}

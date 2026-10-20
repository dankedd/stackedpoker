"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, Minus, Plus } from "lucide-react";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { ChoiceGroup } from "@/components/tools/ToolFields";
import { LevelUpModal } from "@/components/learn/LevelUpModal";
import { TrainerLimitGate, useTrainerLimit } from "@/components/preflop-trainer/TrainerLimit";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { trackCustom } from "@/lib/metaPixel";
import { fetchFlopTrainerState, submitAnswer, type AnswerResult, type FlopTrainerState } from "@/lib/flopTrainer/api";
import { fetchDetail, fetchIndex, fetchSpots, MVP_SPOTS } from "@/lib/flopTrainer/data";
import { localCategoryStats, localRecentError, readLocalBest, recordLocalAnswer, recordLocalBest } from "@/lib/flopTrainer/history";
import {
  categoryWeights,
  displayCards,
  displayPos,
  gradeAnswer,
  pickFlop,
  SESSION_LENGTH,
  spotTitle,
  textureCategory,
  tierCuts,
  tierFor,
  type FlopDetail,
  type FlopIndexRow,
  type FlopSpot,
  type Graded,
  type NutSide,
} from "@/lib/flopTrainer/logic";
import { cn } from "@/lib/utils";
import { FlopResult, InfoModal, SessionSummary, type SessionEntry } from "./FlopResult";

type SpotChoice = "bn" | "utg" | "mix";
const SPOT_OF: Record<Exclude<SpotChoice, "mix">, string> = { bn: MVP_SPOTS[0], utg: MVP_SPOTS[1] };
const CHOICE_LABEL: Record<SpotChoice, string> = { bn: "BTN vs BB", utg: "UTG vs BB", mix: "Mixed" };

export interface Deal {
  spot: FlopSpot;
  row: FlopIndexRow;
  cards: string[];
}

/** XP for one answer — always from the server, never computed in the browser. */
export type AnswerXp =
  | { status: "guest" }
  | { status: "pending" }
  | { status: "done"; result: AnswerResult }
  | { status: "error" };

export interface Answer {
  id: number;
  guess: number;
  nut: NutSide;
  graded: Graded;
  xp: AnswerXp;
}

const newSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function FlopTrainer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const choice: SpotChoice = (["bn", "utg", "mix"] as const).find((c) => c === params.get("spot")) ?? "bn";
  const setChoice = (c: SpotChoice) => router.replace(`${pathname}?spot=${c}`, { scroll: false });

  const { user, session: auth } = useAuth();
  const token = auth?.access_token ?? "";
  const signedIn = Boolean(user && token);
  const { progress, applyServerXpTotal, dismissLevelUp } = useLearnProgress();
  const trainerLimit = useTrainerLimit(signedIn);
  const { allowHand, recordGuestHand, applyServerUsage, handleServerError } = trainerLimit;

  const [spots, setSpots] = useState<FlopSpot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [detail, setDetail] = useState<FlopDetail | null>(null);
  const [guess, setGuess] = useState(50);
  const [nut, setNut] = useState<NutSide | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [serverState, setServerState] = useState<FlopTrainerState | null>(null);
  const [best, setBest] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const answerId = useRef(0);
  const seen = useRef(new Set<string>());

  // Spots once; the server's state when signed in, the local best otherwise.
  useEffect(() => {
    fetchSpots().then(setSpots, () => setLoadError(true));
  }, []);
  useEffect(() => {
    if (!signedIn) {
      setServerState(null);
      setBest(readLocalBest());
      return;
    }
    fetchFlopTrainerState(token).then(
      (s) => {
        setServerState(s);
        setBest(s.best_session_points);
      },
      () => {
        // Backend down: the trainer still works, it just shows no XP numbers yet.
      },
    );
    // A new user only, not every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, signedIn]);

  const categoryStats = useMemo(
    () => (serverState && Object.keys(serverState.categories).length ? serverState.categories : localCategoryStats()),
    // Recomputed per answer so the local history is fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverState, entries.length],
  );

  const dealNext = useCallback(
    async (c: SpotChoice = choice, n = entries.length) => {
      if (!spots?.length) return;
      const ids = c === "mix" ? spots.map((s) => s.spot_id) : [SPOT_OF[c]];
      const spot = spots.find((s) => s.spot_id === ids[Math.floor(Math.random() * ids.length)]) ?? spots[0];
      try {
        const index = await fetchIndex(spot.spot_id);
        const row = pickFlop(
          index,
          tierCuts(index),
          tierFor(n, localRecentError()),
          categoryWeights(categoryStats),
          seen.current,
          Math.random,
        );
        seen.current.add(row.flop);
        setAnswer(null);
        setGuess(50);
        setNut(null);
        setDetail(null);
        setDeal({ spot, row, cards: displayCards(row.flop, Math.random) });
        // Bucket shares for the answer screen, loaded while the player thinks.
        fetchDetail(spot.spot_id, row.flop).then(setDetail, () => setDetail(null));
      } catch {
        setLoadError(true);
      }
    },
    [spots, choice, entries.length, categoryStats],
  );

  // First flop once the spots are in (client only: Math.random).
  const started = useRef(false);
  useEffect(() => {
    if (spots && !started.current) {
      started.current = true;
      void dealNext();
    }
  }, [spots, dealNext]);

  const startSession = useCallback(
    (c: SpotChoice = choice) => {
      setSessionId(newSessionId());
      setEntries([]);
      setShowSummary(false);
      setNewRecord(false);
      seen.current = new Set();
      void dealNext(c, 0);
    },
    [choice, dealNext],
  );

  const submit = useCallback(() => {
    if (!deal || answer || !nut) return;
    if (!allowHand()) return;
    const graded = gradeAnswer(guess, deal.row.equity_ip, nut, deal.row.nut_adv.leader);
    const id = ++answerId.current;
    const entry: SessionEntry = { ...graded, category: textureCategory(deal.row.texture) };
    const before = entries;
    const nextEntries = [...entries, entry];
    setEntries(nextEntries);
    recordLocalAnswer(entry.category, graded.error);
    if (before.length === 0) trackCustom("FlopTrainerStart", { spot: deal.spot.spot_id });
    const sessionDone = nextEntries.length >= SESSION_LENGTH;
    if (sessionDone) trackCustom("FlopTrainerComplete", { points: nextEntries.reduce((s, e) => s + e.points, 0) });

    if (!signedIn) {
      recordGuestHand();
      if (sessionDone) {
        const pts = nextEntries.reduce((s, e) => s + e.points, 0);
        const rec = recordLocalBest(pts);
        setNewRecord(rec);
        if (rec) setBest(pts);
      }
      setAnswer({ id, guess, nut, graded, xp: { status: "guest" } });
      return;
    }
    setAnswer({ id, guess, nut, graded, xp: { status: "pending" } });
    submitAnswer(token, { spot_id: deal.spot.spot_id, flop: deal.row.flop, guess_equity: guess, nut_guess: nut, session_id: sessionId }).then(
      (result) => {
        applyServerXpTotal(result.total_xp);
        applyServerUsage(result.usage);
        setBest(result.best_session_points);
        if (result.session_complete) setNewRecord(result.new_record);
        setServerState((s) => (s ? { ...s, daily_xp: result.daily_xp, daily_cap: result.daily_cap } : s));
        setAnswer((a) => (a && a.id === id ? { ...a, xp: { status: "done", result } } : a));
      },
      (err) => {
        // Over the daily limit: the answer never counted — undo it and show the limit screen.
        if (handleServerError(err)) {
          setEntries(before);
          setAnswer((a) => (a && a.id === id ? null : a));
        } else {
          setAnswer((a) => (a && a.id === id ? { ...a, xp: { status: "error" } } : a));
        }
      },
    );
  }, [deal, answer, nut, guess, entries, allowHand, signedIn, token, sessionId, recordGuestHand, applyServerXpTotal, applyServerUsage, handleServerError]);

  const next = useCallback(() => {
    if (entries.length >= SESSION_LENGTH) setShowSummary(true);
    else void dealNext();
  }, [entries.length, dealNext]);

  // Keyboard: Enter checks the answer, then deals the next flop.
  const keys = useRef({ submit, next, answer, showSummary });
  keys.current = { submit, next, answer, showSummary };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
      const k = keys.current;
      if (k.showSummary) return;
      e.preventDefault();
      if (k.answer) k.next();
      else k.submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const points = entries.reduce((s, e) => s + e.points, 0);
  const ip = deal ? displayPos(deal.spot.ip) : "";
  const oop = deal ? displayPos(deal.spot.oop) : "";

  if (loadError) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        The flop data could not be loaded. Check your connection and reload the page.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <ChoiceGroup
          toolSlug="flop-trainer"
          label="Spot · 40bb MTT"
          value={choice}
          options={(["bn", "utg", "mix"] as const).map((c) => ({ value: c, label: CHOICE_LABEL[c] }))}
          onChange={(c) => {
            setChoice(c);
            startSession(c);
          }}
        />
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info aria-hidden="true" className="h-3.5 w-3.5" />
          How it works
        </button>
      </div>

      <dl className="mb-4 grid grid-cols-4 gap-1.5 sm:flex sm:gap-x-5" aria-live="polite">
        {[
          ["Flop", `${Math.min(entries.length + (answer ? 0 : 1), SESSION_LENGTH)}/${SESSION_LENGTH}`],
          ["Points", points],
          ["Best", best],
          serverState ? ["XP today", `${serverState.daily_xp}/${serverState.daily_cap}`] : ["Answered", entries.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-center sm:flex sm:items-baseline sm:gap-1.5 sm:border-0 sm:bg-transparent sm:p-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs sm:normal-case sm:tracking-normal">{k}</dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-foreground sm:text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      {deal ? <Board deal={deal} /> : <div className="mx-auto h-[190px] max-w-[860px] animate-pulse rounded-3xl bg-card/40" />}

      <div className="mx-auto mt-5 max-w-[640px] space-y-5">
        <EquitySlider label={deal ? `How much equity does ${ip} have vs ${oop}?` : "Equity"} value={guess} onChange={setGuess} disabled={!deal || Boolean(answer)} />

        <fieldset disabled={!deal || Boolean(answer)}>
          <legend className="text-sm font-semibold text-foreground">Who has the nut advantage?</legend>
          <p className="mt-0.5 text-xs text-muted-foreground">More Strong hands (75%+ equity) in their range.</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup">
            {(["IP", "OOP", "EQUAL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={nut === s}
                onClick={() => setNut(s)}
                className={cn(
                  "h-12 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  nut === s ? "border-violet-500/60 bg-violet-500/20 text-violet-100" : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "IP" ? ip || "IP" : s === "OOP" ? oop || "OOP" : "Equal"}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={submit}
          disabled={!deal || !nut || Boolean(answer)}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nut ? "Check answer" : "Pick who has the nut advantage"}
          {nut && <span className="hidden md:inline">&nbsp;(Enter)</span>}
        </button>
      </div>

      <TrainerLimitGate limit={trainerLimit} resultOpen={Boolean(answer)} />

      {deal && answer && !showSummary && (
        <FlopResult
          deal={deal}
          detail={detail}
          answer={answer}
          last={entries.length >= SESSION_LENGTH}
          onNext={next}
        />
      )}

      {showSummary && (
        <SessionSummary entries={entries} best={best} newRecord={newRecord} signedIn={signedIn} onAgain={() => startSession()} />
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

      {!answer && !showSummary && progress.pendingLevelUp && (
        <LevelUpModal event={progress.pendingLevelUp} onContinue={dismissLevelUp} onDismiss={dismissLevelUp} token={token || undefined} />
      )}
    </div>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────

function Board({ deal }: { deal: Deal }) {
  const mobile = useIsMobile();
  return (
    <div
      className="relative mx-auto max-w-[860px] overflow-hidden rounded-3xl border border-emerald-950/40 px-4 py-5 text-center sm:py-7"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
        boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), 0 18px 44px rgba(0,0,0,0.35)",
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/60 sm:text-[11px]">
        MTT · 9-handed · antes · {deal.spot.stack_bb}bb
      </p>
      <p className="mt-1 text-sm font-semibold text-white sm:text-base">{spotTitle(deal.spot)}</p>
      <div className="mt-4 flex justify-center gap-2 sm:gap-3" aria-label="Flop">
        {deal.cards.map((c) => (
          <FourColorCard key={c} card={c} size={mobile ? "md" : "lg"} highContrast />
        ))}
      </div>
    </div>
  );
}

// ── Slider ──────────────────────────────────────────────────────────────────

function EquitySlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const set = (v: number) => onChange(Math.max(0, Math.min(100, v)));
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor="flop-equity-guess" className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <output htmlFor="flop-equity-guess" className="font-mono text-3xl font-bold tabular-nums text-white">
          {value}%
        </output>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <StepButton label="Lower by 1" onClick={() => set(value - 1)} disabled={disabled}>
          <Minus className="h-4 w-4" />
        </StepButton>
        {/* Painted track under the site's transparent .sp-slider input (globals.css). */}
        <div className="relative flex h-12 flex-1 items-center">
          <div className="pointer-events-none absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${value}%` }} />
            <div className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-y-1/2 bg-white/30" />
          </div>
          <input
            id="flop-equity-guess"
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={disabled}
            onChange={(e) => set(Number(e.target.value))}
            className="sp-slider relative"
          />
        </div>
        <StepButton label="Raise by 1" onClick={() => set(value + 1)} disabled={disabled}>
          <Plus className="h-4 w-4" />
        </StepButton>
      </div>
      <div className="flex justify-between px-12 text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card/50 text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {children}
    </button>
  );
}

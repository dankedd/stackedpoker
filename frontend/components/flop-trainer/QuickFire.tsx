"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { XPGain } from "@/components/learn/XPGain";
import { LevelUpModal } from "@/components/learn/LevelUpModal";
import { ChoiceGroup } from "@/components/tools/ToolFields";
import { TrainerLimitGate, useTrainerLimit } from "@/components/preflop-trainer/TrainerLimit";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { trackCustom } from "@/lib/metaPixel";
import { fetchFlopTrainerState, submitVersus, type VersusResult } from "@/lib/flopTrainer/api";
import { fetchIndex, fetchSpots } from "@/lib/flopTrainer/data";
import { FLOP_TRAINER_SPOTS } from "@/lib/flopTrainer/feature";
import { displayCards, displayPos, fmt, spotTitle, type FlopSpot } from "@/lib/flopTrainer/logic";
import { pickPair, versusCorrect, versusGap } from "@/lib/flopTrainer/phase3";
import { cn } from "@/lib/utils";
import { Board, type Deal } from "./FlopTrainer";

type SpotChoice = "bn" | "utg" | "mix";
const SPOT_OF: Record<Exclude<SpotChoice, "mix">, string> = FLOP_TRAINER_SPOTS;
const CHOICE_LABEL: Record<SpotChoice, string> = { bn: "BTN vs BB", utg: "UTG vs BB", mix: "Mixed" };
const BEST_KEY = "sp_flop_versus_best";

interface Pair {
  spot: FlopSpot;
  a: Deal;
  b: Deal;
}

interface Pick {
  id: number;
  side: "a" | "b";
  correct: boolean;
  xp: { status: "guest" } | { status: "pending" } | { status: "done"; result: VersusResult } | { status: "error" };
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Quick fire: two flops of the same spot — which one is better for the
 * preflop raiser (more range equity)? One tap, instant feedback; the gap
 * narrows as the streak grows.
 */
export function QuickFire() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const choice: SpotChoice = (["bn", "utg", "mix"] as const).find((c) => c === params.get("spot")) ?? "bn";

  const { user, session: auth } = useAuth();
  const token = auth?.access_token ?? "";
  const signedIn = Boolean(user && token);
  const { progress, applyServerXpTotal, dismissLevelUp } = useLearnProgress();
  const trainerLimit = useTrainerLimit(signedIn);
  const { allowHand, recordGuestHand, applyServerUsage, handleServerError } = trainerLimit;

  const [spots, setSpots] = useState<FlopSpot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pair, setPair] = useState<Pair | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [stats, setStats] = useState({ n: 0, right: 0 });
  const pickId = useRef(0);

  useEffect(() => {
    fetchSpots().then(setSpots, () => setLoadError(true));
  }, []);
  useEffect(() => {
    if (!signedIn) {
      setBest(readBest());
      return;
    }
    fetchFlopTrainerState(token).then(
      (s) => {
        setStreak(s.versus_streak ?? 0);
        setBest(s.versus_best ?? 0);
      },
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, signedIn]);

  const deal = useCallback(
    async (c: SpotChoice = choice, s = streak) => {
      if (!spots?.length) return;
      const ids = c === "mix" ? spots.map((x) => x.spot_id) : [SPOT_OF[c]];
      const spot = spots.find((x) => x.spot_id === ids[Math.floor(Math.random() * ids.length)]) ?? spots[0];
      try {
        const index = await fetchIndex(spot.spot_id);
        const [lo, hi] = versusGap(s);
        const [ra, rb] = pickPair(index, lo, hi, Math.random);
        setPick(null);
        setPair({
          spot,
          a: { spot, row: ra, cards: displayCards(ra.flop, Math.random) },
          b: { spot, row: rb, cards: displayCards(rb.flop, Math.random) },
        });
      } catch {
        setLoadError(true);
      }
    },
    [spots, choice, streak],
  );

  const started = useRef(false);
  useEffect(() => {
    if (spots && !started.current) {
      started.current = true;
      void deal();
    }
  }, [spots, deal]);

  const choose = useCallback(
    (side: "a" | "b") => {
      if (!pair || pick) return;
      if (!allowHand()) return;
      const correct = versusCorrect(side, pair.a.row.equity_ip, pair.b.row.equity_ip);
      const id = ++pickId.current;
      const before = { streak, stats };
      const nextStreak = correct ? streak + 1 : 0;
      setStreak(nextStreak);
      setStats((x) => ({ n: x.n + 1, right: x.right + Number(correct) }));
      if (stats.n === 0) trackCustom("FlopQuickFireStart", { spot: pair.spot.spot_id });
      if (!signedIn) {
        recordGuestHand();
        if (nextStreak > best) {
          setBest(nextStreak);
          try {
            localStorage.setItem(BEST_KEY, String(nextStreak));
          } catch {
            // Blocked storage: the best lasts this visit.
          }
        }
        setPick({ id, side, correct, xp: { status: "guest" } });
        return;
      }
      setPick({ id, side, correct, xp: { status: "pending" } });
      submitVersus(token, { spot_id: pair.spot.spot_id, flop_a: pair.a.row.flop, flop_b: pair.b.row.flop, pick: side }).then(
        (result) => {
          applyServerXpTotal(result.total_xp);
          applyServerUsage(result.usage);
          setStreak(result.streak);
          setBest(result.best_streak);
          setPick((p) => (p && p.id === id ? { ...p, xp: { status: "done", result } } : p));
        },
        (err) => {
          if (handleServerError(err)) {
            setStreak(before.streak);
            setStats(before.stats);
            setPick((p) => (p && p.id === id ? null : p));
          } else {
            setPick((p) => (p && p.id === id ? { ...p, xp: { status: "error" } } : p));
          }
        },
      );
    },
    [pair, pick, allowHand, streak, stats, best, signedIn, token, recordGuestHand, applyServerXpTotal, applyServerUsage, handleServerError],
  );

  // Keyboard: A / B (or ← / →) to pick, Enter / Space for the next pair.
  const keys = useRef({ choose, deal, pick });
  keys.current = { choose, deal, pick };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = keys.current;
      const key = e.key.toLowerCase();
      if (k.pick) {
        if (key === "enter" || key === " ") {
          e.preventDefault();
          void k.deal();
        }
        return;
      }
      if (key === "a" || key === "arrowleft") k.choose("a");
      if (key === "b" || key === "arrowright") k.choose("b");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loadError) {
    return <p className="py-10 text-center text-sm text-muted-foreground">The flop data could not be loaded. Check your connection and reload the page.</p>;
  }

  const ip = pair ? displayPos(pair.spot.ip) : "the raiser";
  const winner = pair && (pair.a.row.equity_ip >= pair.b.row.equity_ip ? "a" : "b");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <ChoiceGroup
          toolSlug="flop-trainer"
          label="Spot · 40bb MTT"
          value={choice}
          options={(["bn", "utg", "mix"] as const).map((c) => ({ value: c, label: CHOICE_LABEL[c] }))}
          onChange={(c) => {
            router.replace(`${pathname}?spot=${c}`, { scroll: false });
            void deal(c);
          }}
        />
        <dl className="flex gap-x-5 text-xs text-muted-foreground" aria-live="polite">
          {[
            ["Streak", streak],
            ["Best", best],
            ["Right", stats.n ? `${stats.right}/${stats.n}` : "–"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-baseline gap-1.5">
              <dt>{k}</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="text-center text-base font-semibold text-white sm:text-lg">Which flop is better for {ip}?</h2>
      {pair && <p className="mt-1 text-center text-xs text-muted-foreground">{spotTitle(pair.spot)} · the flop where {ip}&apos;s range has more equity</p>}

      <div className="mx-auto mt-4 grid max-w-[860px] gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const d = pair?.[side];
          const isWinner = pick && winner === side;
          const isPicked = pick?.side === side;
          return (
            <button
              key={side}
              type="button"
              disabled={!pair || Boolean(pick)}
              onClick={() => choose(side)}
              aria-label={`Flop ${side.toUpperCase()}`}
              className={cn(
                "relative rounded-3xl text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 enabled:hover:scale-[1.01] enabled:active:scale-[0.99]",
                pick && isWinner && "ring-2 ring-emerald-400",
                pick && isPicked && !pick.correct && "ring-2 ring-red-400",
              )}
            >
              {d ? <Board deal={d} compact /> : <div className="h-[120px] animate-pulse rounded-3xl bg-card/40" />}
              <span className="absolute left-3 top-2 text-xs font-bold text-emerald-100/70">{side.toUpperCase()}</span>
              {pick && d && (
                <span
                  className={cn(
                    "absolute right-3 top-2 rounded-full px-2 py-0.5 font-mono text-xs font-semibold",
                    isWinner ? "bg-emerald-500/25 text-emerald-200" : "bg-black/40 text-white/80",
                  )}
                >
                  {ip} {fmt(d.row.equity_ip)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-4 max-w-[640px]" aria-live="polite">
        {pick && pair ? (
          <div className="space-y-3">
            <p className={cn("flex items-center justify-center gap-2 text-sm font-semibold", pick.correct ? "text-emerald-300" : "text-red-300")}>
              {pick.correct ? <Check aria-hidden="true" className="h-4 w-4" /> : <X aria-hidden="true" className="h-4 w-4" />}
              {pick.correct ? "Right" : "Not this time"} — a {fmt(Math.abs(pair.a.row.equity_ip - pair.b.row.equity_ip))}-point gap
            </p>
            <PickXp xp={pick.xp} />
            <button
              type="button"
              autoFocus
              onClick={() => void deal()}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-violet-900/30 hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Next pair<span className="hidden md:inline">&nbsp;(Enter)</span>
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Tap a flop<span className="hidden md:inline"> — or press A / B</span>. The gap gets smaller as your streak grows.</p>
        )}
      </div>

      <TrainerLimitGate limit={trainerLimit} resultOpen={Boolean(pick)} />

      {!pick && progress.pendingLevelUp && (
        <LevelUpModal event={progress.pendingLevelUp} onContinue={dismissLevelUp} onDismiss={dismissLevelUp} token={token || undefined} />
      )}
    </div>
  );
}

function PickXp({ xp }: { xp: Pick["xp"] }) {
  if (xp.status === "guest") return <p className="text-center text-xs text-muted-foreground">Sign up free to earn XP for every right pick.</p>;
  if (xp.status === "pending") return <p className="h-6 animate-pulse text-center text-xs text-muted-foreground">Saving…</p>;
  if (xp.status === "error") return <p className="text-center text-xs text-amber-300/90">This pick could not be saved.</p>;
  const r = xp.result;
  return (
    <div className="flex items-center justify-center gap-3">
      {r.xp_awarded > 0 && <XPGain xp={r.xp_awarded} className="px-3 py-1" />}
      <p className="text-xs text-muted-foreground">
        {r.too_fast ? "Too quick — no XP for this one. " : ""}Today <b className="font-mono text-foreground">{r.daily_xp}</b>/{r.daily_cap} XP
        {r.leveled_up && <span className="ml-1 font-semibold text-amber-300">· Level {r.level}!</span>}
      </p>
    </div>
  );
}

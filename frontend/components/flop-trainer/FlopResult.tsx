"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { XPGain } from "@/components/learn/XPGain";
import { tierForLevel } from "@/lib/levels";
import { Modal } from "@/components/ui/modal";
import { fetchExamples, type BucketExamples } from "@/lib/flopTrainer/data";
import {
  BUCKETS,
  CATEGORY_LABEL,
  displayPos,
  explain,
  fmt,
  GOOD_WITHIN,
  PERFECT_WITHIN,
  type BucketKey,
  type Buckets,
  type Category,
  type FlopDetail,
  type Graded,
  type Verdict,
} from "@/lib/flopTrainer/logic";
import { BAND_LABEL, explainCbet, SIZE_LABEL } from "@/lib/flopTrainer/phase3";
import { cn } from "@/lib/utils";
import type { Answer, AnswerXp, CbetAnswer, Deal } from "./FlopTrainer";

export interface SessionEntry extends Graded {
  category: Category;
  /** 3 without the c-bet question, 5 with it. */
  maxPoints: number;
}

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  perfect: { label: "Perfect", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  good: { label: "Good", className: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  miss: { label: "Miss", className: "border-red-500/40 bg-red-500/15 text-red-300" },
};

const NEXT_BUTTON =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// ── Answer screen ───────────────────────────────────────────────────────────

export function FlopResult({
  deal,
  detail,
  answer,
  last,
  onNext,
}: {
  deal: Deal;
  detail: FlopDetail | null;
  answer: Answer;
  last: boolean;
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), []);
  // null while loading, false when they could not be loaded.
  const [examples, setExamples] = useState<BucketExamples | null | false>(null);
  useEffect(() => {
    let live = true;
    fetchExamples(deal.spot.spot_id, deal.row.flop).then(
      (e) => live && setExamples(e),
      () => live && setExamples(false),
    );
    return () => {
      live = false;
    };
  }, [deal.spot.spot_id, deal.row.flop]);

  const { graded: g } = answer;
  const ip = displayPos(deal.spot.ip);
  const oop = displayPos(deal.spot.oop);
  const nut = deal.row.nut_adv;
  const nutName = (s: string) => (s === "IP" ? ip : s === "OOP" ? oop : "Equal");

  return (
    <Modal open onClose={onNext} title={`${deal.cards.map(pretty).join(" ")} · ${ip} vs ${oop}`} maxWidthClassName="max-w-2xl" bodyClassName="px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-3 py-1 text-sm font-bold", VERDICT[g.verdict].className)}>{VERDICT[g.verdict].label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
            g.nutCorrect ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300",
          )}
        >
          {g.nutCorrect ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <X aria-hidden="true" className="h-3.5 w-3.5" />}
          Nut advantage
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          +{g.points} point{g.points === 1 ? "" : "s"}
        </span>
        <XpLine xp={answer.xp} />
      </div>

      <EquityBar exact={deal.row.equity_ip} guess={answer.guess} ip={ip} oop={oop} error={g.error} />

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">Equity Buckets</h3>
        <p className="text-xs text-muted-foreground">Each hand&apos;s equity against the other range. Tap a segment for typical hands.</p>
        {detail ? (
          <BucketBars detail={detail} ip={ip} oop={oop} examples={examples} />
        ) : (
          <div className="mt-3 h-20 animate-pulse rounded-lg bg-card/40" />
        )}
      </section>

      <section className="mt-5 rounded-xl border border-border/60 bg-card/30 p-3 text-sm">
        <p className="font-semibold text-foreground">
          Nut advantage: {nutName(nut.leader)}
          {answer.nut !== nut.leader && <span className="font-normal text-muted-foreground"> · you said {nutName(answer.nut)}</span>}
        </p>
        <p className="mt-1 text-muted-foreground">
          Strong hands: {ip} <b className="font-mono text-foreground">{fmt(nut.ip)}%</b> · {oop}{" "}
          <b className="font-mono text-foreground">{fmt(nut.oop)}%</b>
          {nut.leader === "EQUAL" ? " — within 3 points counts as equal." : ` — a ${fmt(Math.abs(nut.diff))}-point gap.`}
        </p>
      </section>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{explain(deal.spot, deal.row, detail)}</p>

      {answer.cbet && detail && <CbetResult cbet={answer.cbet} ip={ip} oop={oop} detail={detail} />}

      <div className="sticky bottom-0 -mx-4 mt-5 border-t border-white/[0.07] bg-[#0B1120] px-4 py-3 sm:-mx-6 sm:px-6 sm:py-5">
        <button ref={nextRef} type="button" onClick={onNext} className={NEXT_BUTTON}>
          {last ? "See your session" : "Next flop"}
          <span className="hidden md:inline">&nbsp;(Enter)</span>
        </button>
      </div>
    </Modal>
  );
}

function CbetResult({ cbet, ip, oop, detail }: { cbet: CbetAnswer; ip: string; oop: string; detail: FlopDetail }) {
  const a = cbet.advice;
  const Mark = ({ ok }: { ok: boolean }) =>
    ok ? <Check aria-label="right" className="h-4 w-4 text-emerald-300" /> : <X aria-label="wrong" className="h-4 w-4 text-red-300" />;
  return (
    <section className="mt-5 rounded-xl border border-border/60 bg-card/30 p-3 text-sm">
      <h3 className="font-semibold text-foreground">
        C-bet: {BAND_LABEL[a.band].split(" ")[0].toLowerCase()} frequency, {a.size} size
        <span className="ml-2 text-xs font-normal text-muted-foreground">+{cbet.points}</span>
      </h3>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        <li className="flex items-center gap-2">
          <Mark ok={cbet.bandOk} /> How often: you said {BAND_LABEL[cbet.band]}
          {!cbet.bandOk && ` — ${a.bands.map((b) => BAND_LABEL[b]).join(" or ")}`}
        </li>
        <li className="flex items-center gap-2">
          <Mark ok={cbet.sizeOk} /> Size: you said {SIZE_LABEL[cbet.size]}
          {!cbet.sizeOk && ` — ${SIZE_LABEL[a.size]}`}
        </li>
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{explainCbet(a, ip, oop, detail.buckets_oop)}</p>
    </section>
  );
}

const pretty = (c: string) => (c[0] === "T" ? "10" : c[0]) + ({ s: "♠", h: "♥", d: "♦", c: "♣" } as Record<string, string>)[c[1]];

/** Exact equity and the guess on one 0–100 bar, with the Perfect and Good zones. */
function EquityBar({ exact, guess, ip, oop, error }: { exact: number; guess: number; ip: string; oop: string; error: number }) {
  const clamp = (x: number) => Math.max(0, Math.min(100, x));
  return (
    <section>
      <p className="text-sm text-muted-foreground">
        {ip} has <b className="font-mono text-lg text-white">{fmt(exact)}%</b> equity vs {oop}. You said{" "}
        <b className="font-mono text-foreground">{guess}%</b> ({fmt(error)} off).
      </p>
      <div className="relative mt-3 h-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 rounded bg-amber-400/20"
          style={{ left: `${clamp(exact - GOOD_WITHIN)}%`, width: `${clamp(exact + GOOD_WITHIN) - clamp(exact - GOOD_WITHIN)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 rounded bg-emerald-400/30"
          style={{ left: `${clamp(exact - PERFECT_WITHIN)}%`, width: `${clamp(exact + PERFECT_WITHIN) - clamp(exact - PERFECT_WITHIN)}%` }}
        />
        <Marker at={exact} className="bg-violet-400" label={`${fmt(exact)}%`} top />
        <Marker at={guess} className="bg-white" label="You" />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </section>
  );
}

function Marker({ at, className, label, top }: { at: number; className: string; label: string; top?: boolean }) {
  return (
    <div className="absolute inset-y-0 -translate-x-1/2" style={{ left: `${at}%` }}>
      <div className={cn("mx-auto h-full w-1 rounded-full", className)} />
      <span className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-foreground", top ? "-top-3.5" : "-bottom-3.5")}>
        {label}
      </span>
    </div>
  );
}

export function BucketBars({ detail, ip, oop, examples }: { detail: FlopDetail; ip: string; oop: string; examples: BucketExamples | null | false }) {
  const [sel, setSel] = useState<{ side: "ip" | "oop"; key: BucketKey } | null>(null);
  const rows: { side: "ip" | "oop"; name: string; b: Buckets }[] = [
    { side: "ip", name: ip, b: detail.buckets_ip },
    { side: "oop", name: oop, b: detail.buckets_oop },
  ];
  const selBucket = sel && BUCKETS.find((x) => x.key === sel.key);
  const selRow = sel && rows.find((r) => r.side === sel.side);
  return (
    <div className="mt-3 space-y-2.5">
      {rows.map((r) => (
        <div key={r.side} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-semibold text-foreground">{r.name}</span>
          <div className="flex h-8 flex-1 overflow-hidden rounded-md">
            {BUCKETS.map((bk) => {
              const v = r.b[bk.key];
              const on = sel?.side === r.side && sel.key === bk.key;
              return (
                <button
                  key={bk.key}
                  type="button"
                  onClick={() => setSel(on ? null : { side: r.side, key: bk.key })}
                  aria-pressed={on}
                  aria-label={`${r.name} ${bk.label}: ${fmt(v)}%`}
                  title={`${bk.label}: ${fmt(v)}%`}
                  className={cn(
                    "flex h-full min-w-0 items-center justify-center text-[10px] font-semibold text-white/90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white",
                    sel && !on && "opacity-50",
                  )}
                  style={{ width: `${v}%`, background: bk.color }}
                >
                  {v >= 9 ? `${Math.round(v)}%` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-12 text-[11px] text-muted-foreground">
        {BUCKETS.map((bk) => (
          <li key={bk.key} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: bk.color }} />
            {bk.label} <span className="text-muted-foreground/70">{bk.rule}</span>
          </li>
        ))}
      </ul>
      {sel && selBucket && selRow && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-2.5 text-xs">
          <p className="text-foreground">
            <b>{selRow.name}</b> · {selBucket.label} ({selBucket.rule}): <b className="font-mono">{fmt(selRow.b[sel.key])}%</b> of the range
          </p>
          <p className="mt-1 text-muted-foreground">
            {examples
              ? examples[sel.side][sel.key].length
                ? `Typical hands: ${examples[sel.side][sel.key].join(", ")}`
                : "No typical hands — this bucket is mostly made of single suit combinations."
              : examples === false
                ? "Typical hands are not available right now."
                : "Loading typical hands…"}
          </p>
        </div>
      )}
    </div>
  );
}

function XpLine({ xp }: { xp: AnswerXp }) {
  if (xp.status === "guest") {
    return (
      <p className="basis-full text-xs text-muted-foreground">
        <Link href="/signup" className="font-semibold text-violet-300 underline-offset-4 hover:underline">
          Sign up free
        </Link>{" "}
        to earn XP for every flop and keep your best session.
      </p>
    );
  }
  if (xp.status === "pending") return <p className="basis-full h-7 animate-pulse text-xs text-muted-foreground">Saving XP…</p>;
  if (xp.status === "error") return <p className="basis-full text-xs text-amber-300/90">This answer could not be saved, so it earned no XP.</p>;
  const r = xp.result;
  return (
    <div className="flex basis-full flex-wrap items-center gap-3">
      {r.xp_awarded > 0 && <XPGain xp={r.xp_awarded} bonus={r.bonus_xp ?? 0} className="px-3 py-1" />}
      <p className="text-xs text-muted-foreground">
        {r.too_fast
          ? "Too quick after the last answer — no XP for this one."
          : r.daily_xp >= r.daily_cap && r.xp_awarded === 0 && r.points > 0
            ? "Today's trainer XP is maxed out — your points still count."
            : null}{" "}
        <span className="whitespace-nowrap">
          Today <b className="font-mono text-foreground">{r.daily_xp}</b>/{r.daily_cap} XP
        </span>
        {r.leveled_up && <span className="ml-1 font-semibold text-amber-300">· Level {r.level}, {tierForLevel(r.level).title}!</span>}
      </p>
    </div>
  );
}

// ── Session summary ─────────────────────────────────────────────────────────

export function SessionSummary({
  entries,
  best,
  newRecord,
  signedIn,
  onAgain,
}: {
  entries: SessionEntry[];
  best: number;
  newRecord: boolean;
  signedIn: boolean;
  onAgain: () => void;
}) {
  const points = entries.reduce((s, e) => s + e.points, 0);
  const max = entries.reduce((s, e) => s + e.maxPoints, 0);
  const count = (v: Verdict) => entries.filter((e) => e.verdict === v).length;
  const avg = entries.length ? entries.reduce((s, e) => s + e.error, 0) / entries.length : 0;
  const nuts = entries.filter((e) => e.nutCorrect).length;
  // The category with the largest average error (at least two flops in it).
  const byCat = new Map<Category, number[]>();
  for (const e of entries) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e.error]);
  const weakest = [...byCat.entries()]
    .filter(([, errs]) => errs.length >= 2)
    .map(([c, errs]) => [c, errs.reduce((s, x) => s + x, 0) / errs.length] as const)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <Modal open onClose={onAgain} title="Session complete" maxWidthClassName="max-w-md" bodyClassName="px-5 pt-4 sm:px-6">
      <div className="text-center">
        <p className="font-mono text-5xl font-bold tabular-nums text-white">
          {points}
          <span className="text-xl text-muted-foreground">/{max}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          points · best <b className="font-mono text-foreground">{Math.max(best, newRecord ? points : 0)}</b>
        </p>
        {newRecord && <span className="mt-2 inline-block rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-black">New record!</span>}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {(["perfect", "good", "miss"] as const).map((v) => (
          <div key={v} className={cn("rounded-lg border px-2 py-2", VERDICT[v].className)}>
            <dt className="text-[10px] uppercase tracking-wide">{VERDICT[v].label}</dt>
            <dd className="font-mono text-lg font-semibold">{count(v)}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li className="flex">
          Average error <b className="ml-auto font-mono text-foreground">{fmt(avg)} pts</b>
        </li>
        <li className="flex">
          Nut advantage right{" "}
          <b className="ml-auto font-mono text-foreground">
            {nuts}/{entries.length}
          </b>
        </li>
        {weakest && (
          <li className="flex">
            Hardest for you <b className="ml-auto text-foreground">{CATEGORY_LABEL[weakest[0]]}</b>
          </li>
        )}
      </ul>
      {!signedIn && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/signup" className="font-semibold text-violet-300 underline-offset-4 hover:underline">
            Sign up free
          </Link>{" "}
          to earn XP and keep your best session on every device.
        </p>
      )}
      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-white/[0.07] bg-[#0B1120] px-5 py-3 sm:-mx-6 sm:px-6">
        <button type="button" autoFocus onClick={onAgain} className={NEXT_BUTTON}>
          New session
        </button>
      </div>
    </Modal>
  );
}

// ── How it works ────────────────────────────────────────────────────────────

export function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="How the Flop Trainer works" maxWidthClassName="max-w-lg">
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          You see a single-raised pot at 40bb: the opener against the big blind, and a flop. Guess how much equity the
          opener&apos;s whole range has against the big blind&apos;s, and who holds more of the strongest hands.
        </p>
        <div>
          <h3 className="font-semibold text-foreground">Scoring</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Within {PERFECT_WITHIN} points: Perfect, 2 points</li>
            <li>Within {GOOD_WITHIN} points: Good, 1 point</li>
            <li>Further off: Miss, 0 points</li>
            <li>Nut advantage right: +1 point</li>
            <li>C-bet question (optional): +1 for how often, +1 for the size</li>
          </ul>
          <p className="mt-1">A session is 10 flops, from clear spots to close ones. Signed in, points are also your XP.</p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Equity Buckets</h3>
          <p className="mt-1">
            Every hand is sorted by its equity against the other player&apos;s range: Strong (75% or more), Good (50–75%),
            Weak (33–50%) and Trash (under 33%). The player with clearly more Strong hands — over 3 points more — has
            the nut advantage.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">The c-bet question</h3>
          <p className="mt-1">
            How often should the opener bet this flop — 80% or more, 60–80%, or under 60% — and with a small (min-bet or
            1/3 pot) or big (1/2 or 2/3 pot) size? The answer comes from average range profiles for each kind of flop:
            the flop is matched to the closest one. Paired and monotone boards use small sizes. On the few flops with a
            full reference strategy, those numbers are used.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">The numbers</h3>
          <p className="mt-1">
            Both ranges are the 40bb opening and big blind defence charts for a 9-handed tournament with antes. Equity is
            computed exactly over every turn and river, for all 1,755 distinct flops — nothing is estimated in your browser.
            Flops you misjudge come up more often.
          </p>
        </div>
      </div>
    </Modal>
  );
}

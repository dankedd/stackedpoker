"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { trackCustom } from "@/lib/metaPixel";
import { fetchExamples, type BucketExamples } from "@/lib/flopTrainer/data";
import { FLOP_TRAINER_ENABLED, FLOP_TRAINER_PATH, FLOP_TRAINER_SPOTS } from "@/lib/flopTrainer/feature";
import { BUCKETS, CATEGORY_LABEL, displayPos, fmt, textureCategory } from "@/lib/flopTrainer/logic";
import { NO_MATCH_LABEL, spotTitle } from "@/lib/flopTrainer/match";
import { flopLineLabel } from "@/lib/handHistory/flopCheck";
import { analyseFlop, spotNames, type FlopAnalysis } from "@/lib/handHistory/flopCheckApi";
import { t } from "@/lib/handHistory/strings";
import type { ParsedHand } from "@/lib/handHistory/types";
import { cn } from "@/lib/utils";
import { FlopBadge } from "@/components/hand-history/FlopBadge";
import { BucketBars } from "./FlopResult";

/** The flop analysis for a hand (match, precomputed row, Hero's hand position, verdict). */
export function useFlopAnalysis(hand: ParsedHand | null): FlopAnalysis | null {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [a, setA] = useState<FlopAnalysis | null>(null);
  useEffect(() => {
    setA(null);
    if (!hand || !FLOP_TRAINER_ENABLED) return;
    let live = true;
    analyseFlop(hand, token).then(
      (r) => live && setA(r),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [hand, token]);
  return a;
}

/** Trainer menu choice (/flop-trainer?spot=…) for the spots the Flop Trainer deals; other spots link by texture only. */
const TRAINER_SPOT: Record<string, string> = Object.fromEntries(Object.entries(FLOP_TRAINER_SPOTS).map(([choice, id]) => [id, choice]));

/**
 * The flop for both ranges, for a played hand: spot, range equity, Equity
 * Buckets, nut advantage, where Hero's hand sits in its range and the flop
 * decision check (lib/handHistory/flopCheck.ts). Hands that don't match a
 * spot with book ranges get one line saying why. Collapsible; built for
 * 390px first.
 */
export function FlopSpotPanel({
  analysis,
  showHero = true,
  active = false,
  hidden = false,
}: {
  analysis: FlopAnalysis | null;
  showHero?: boolean;
  active?: boolean;
  hidden?: boolean;
}) {
  const { session } = useAuth();
  const signedIn = Boolean(session?.access_token);
  const [examples, setExamples] = useState<BucketExamples | null | false>(null);
  const [open, setOpen] = useState(true);
  const m = analysis?.match.ok ? analysis.match.match : null;
  const spotId = m?.spotId;
  const flop = m?.flop;
  const hasRow = Boolean(analysis?.row);

  useEffect(() => {
    setExamples(null);
    if (!spotId || !flop || !hasRow) return;
    let live = true;
    fetchExamples(spotId, flop).then(
      (e) => live && setExamples(e),
      () => live && setExamples(false),
    );
    return () => {
      live = false;
    };
  }, [spotId, flop, hasRow]);

  if (!FLOP_TRAINER_ENABLED || hidden || !analysis) return null;
  const match = analysis.match;
  if (!match.ok && match.reason === "no_flop") return null;

  const shell = (children: React.ReactNode, title: string, sub?: string) => (
    <section
      aria-labelledby="flop-spot-title"
      className={cn("mt-4 min-w-0 rounded-2xl border bg-card/40 transition-colors", active ? "border-violet-500/50" : "border-border/60")}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span id="flop-spot-title" className="block text-sm font-semibold text-foreground">
            {title}
          </span>
          {sub && <span className="mt-0.5 block text-[11px] text-muted-foreground">{sub}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );

  // No match: one line why.
  if (!match.ok) {
    return shell(<p className="text-sm text-muted-foreground">{t.flop.noMatchBody}</p>, t.flop.title, NO_MATCH_LABEL[match.reason]);
  }
  const mm = match.match;
  const names = spotNames(mm);
  const title = spotTitle(mm.spot);
  const sub = `${t.flop.bookRanges}${mm.spot.derived ? t.flop.derivedNote : ""} · ${t.flop.stacksHere(Math.round(mm.effBb))}`;
  const row = analysis.row;
  if (!row) return shell(<p className="text-sm text-muted-foreground">{t.flop.notAnalysed}</p>, title, sub);

  const check = analysis.check;
  const pos = analysis.hand;
  const bucket = pos?.bucket ? BUCKETS.find((b) => b.key === pos.bucket) : null;
  const category = textureCategory(row.texture);
  const trainerSpot = TRAINER_SPOT[mm.spotId];
  const nutLeader = row.nut_adv.leader === "IP" ? names.ip : row.nut_adv.leader === "OOP" ? names.oop : t.flop.equal;
  const strategy = check?.advice?.source === "book" ? check.advice.strategy : undefined;

  return shell(
    <>
      <p className="text-sm text-muted-foreground">
        {names.ip} <b className="font-mono text-foreground">{fmt(row.equity_ip)}%</b> · {names.oop}{" "}
        <b className="font-mono text-foreground">{fmt(row.equity_oop)}%</b>
        <span className="mx-1.5">·</span>
        {t.flop.nutAdvantage} <b className="text-foreground">{nutLeader}</b>{" "}
        <span className="text-xs">
          ({t.flop.strongShare(fmt(row.nut_adv.ip), fmt(row.nut_adv.oop))})
        </span>
      </p>
      <BucketBars detail={row} ip={names.ip} oop={names.oop} examples={examples} />

      {showHero && mm.heroSide && mm.heroHand && (
        <p className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
          {!signedIn ? (
            t.flop.signIn(mm.heroHand)
          ) : !pos ? (
            <span className="inline-block h-4 w-48 animate-pulse rounded bg-card/60 align-middle" />
          ) : pos.equity !== undefined && bucket ? (
            <>
              {t.flop.yourHand} <b className="text-foreground">{mm.heroHand}</b>
              {pos.in_range && pos.top_pct !== undefined ? (
                <>
                  {" "}· <b className="text-foreground">{t.flop.topOfRange(Math.max(1, Math.round(pos.top_pct)))}</b>
                </>
              ) : (
                <> · {t.flop.outsideRange}</>
              )}{" "}
              ·{" "}
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: bucket.color }} />
                {bucket.label}
              </span>{" "}
              ({t.flop.equityAvg(Math.round(pos.equity))})
            </>
          ) : (
            t.flop.notInRange(mm.heroHand)
          )}
        </p>
      )}

      {showHero && check && check.line.kind !== "none" && (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.flop.youPlayed}</span>
            <b className="text-foreground">{flopLineLabel(check.line)}</b>
            <FlopBadge verdict={check.verdict} showAll />
          </p>
          <p className="mt-1 text-sm text-foreground/80">{check.explain}</p>
          {strategy && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.flop.bookStrategy(
                (
                  [
                    ["2/3", strategy.bet_2_3],
                    ["1/2", strategy.bet_1_2],
                    ["1/3", strategy.bet_1_3],
                    ["min", strategy.bet_min],
                    [t.flop.checkWord, strategy.check],
                  ] as const
                )
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => `${k} ${v}%`)
                  .join(" · "),
              )}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">{t.flop.mildNote}</p>
        </div>
      )}

      <Link
        href={`${FLOP_TRAINER_PATH}?${trainerSpot ? `spot=${trainerSpot}&` : ""}focus=${category}`}
        onClick={() => trackCustom("FlopTrainThisTexture", { category, spot: mm.spotId })}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Target aria-hidden="true" className="h-3.5 w-3.5" />
        {t.flop.trainTexture(CATEGORY_LABEL[category])}
        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </>,
    title,
    sub,
  );
}

export { displayPos };

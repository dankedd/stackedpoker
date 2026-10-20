"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { trackCustom } from "@/lib/metaPixel";
import { fetchHandPosition, type HandPosition } from "@/lib/flopTrainer/api";
import { fetchExamples, fetchFull, type BucketExamples, type FlopFull } from "@/lib/flopTrainer/data";
import { FLOP_TRAINER_ENABLED, FLOP_TRAINER_PATH } from "@/lib/flopTrainer/feature";
import { BUCKETS, CATEGORY_LABEL, displayPos, fmt, textureCategory } from "@/lib/flopTrainer/logic";
import type { FlopSpotMatch } from "@/lib/flopTrainer/match";
import { cn } from "@/lib/utils";
import { BucketBars } from "./FlopResult";

/**
 * The flop as the two ranges see it, for a played hand that matches a
 * trainer spot (lib/flopTrainer/match.ts): range equity, Equity Buckets and
 * nut advantage — and, with `showHero`, where Hero's hand sits in their range
 * plus a link to train this board type. Nothing renders for other hands.
 */
export function FlopSpotPanel({ match, showHero = true, active = false }: { match: FlopSpotMatch | null; showHero?: boolean; active?: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [full, setFull] = useState<FlopFull | null>(null);
  const [examples, setExamples] = useState<BucketExamples | null | false>(null);
  const [pos, setPos] = useState<HandPosition | null>(null);
  const spotId = match?.spotId;
  const flop = match?.flop;

  useEffect(() => {
    if (!spotId || !flop || !FLOP_TRAINER_ENABLED) return;
    let live = true;
    setFull(null);
    fetchFull(spotId, flop).then(
      (f) => live && setFull(f),
      () => live && setFull(null),
    );
    fetchExamples(spotId, flop).then(
      (e) => live && setExamples(e),
      () => live && setExamples(false),
    );
    return () => {
      live = false;
    };
  }, [spotId, flop]);

  const heroSide = match?.heroSide ?? null;
  const heroHand = match?.heroHand ?? null;
  useEffect(() => {
    setPos(null);
    if (!showHero || !token || !spotId || !flop || !heroSide || !heroHand || !FLOP_TRAINER_ENABLED) return;
    let live = true;
    fetchHandPosition(token, spotId, flop, heroHand, heroSide).then(
      (p) => live && setPos(p),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [showHero, token, spotId, flop, heroSide, heroHand]);

  if (!match || !FLOP_TRAINER_ENABLED) return null;
  const ip = displayPos(match.openerPosition);
  const oop = "BB";
  const category = full ? textureCategory(full.texture) : null;
  const choice = match.openerPosition === "UTG" ? "utg" : "bn";
  const bucket = pos?.bucket ? BUCKETS.find((b) => b.key === pos.bucket) : null;

  return (
    <section
      aria-labelledby="flop-spot-title"
      className={cn(
        "mt-4 rounded-2xl border bg-card/40 p-4 transition-colors",
        active ? "border-violet-500/50" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="flop-spot-title" className="text-sm font-semibold text-foreground">
          The flop for both ranges
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {ip} opens, BB calls · book&apos;s 40bb ranges (stacks here {Math.round(match.effBb)}bb)
        </span>
      </div>

      {!full ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-card/40" />
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {ip} <b className="font-mono text-foreground">{fmt(full.equity_ip)}%</b> · {oop}{" "}
            <b className="font-mono text-foreground">{fmt(full.equity_oop)}%</b>
            <span className="mx-1.5">·</span>
            Nut advantage{" "}
            <b className="text-foreground">{full.nut_adv.leader === "IP" ? ip : full.nut_adv.leader === "OOP" ? oop : "equal"}</b>{" "}
            <span className="text-xs">
              (Strong {fmt(full.nut_adv.ip)}% vs {fmt(full.nut_adv.oop)}%)
            </span>
          </p>
          <BucketBars detail={full} ip={ip} oop={oop} examples={examples} />

          {showHero && heroSide && heroHand && (
            <p className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
              {!token ? (
                <>Sign in to see where your {heroHand} sits in your range on this flop.</>
              ) : !pos ? (
                <span className="inline-block h-4 w-48 animate-pulse rounded bg-card/60 align-middle" />
              ) : pos.in_range && pos.top_pct !== undefined && bucket ? (
                <>
                  Your <b className="text-foreground">{heroHand}</b> is in the{" "}
                  <b className="text-foreground">top {Math.max(1, Math.round(pos.top_pct))}%</b> of your range on this flop ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: bucket.color }} />
                    {bucket.label}
                  </span>{" "}
                  ({Math.round(pos.equity ?? 0)}% equity, average over its suits)
                </>
              ) : (
                <>
                  Your <b className="text-foreground">{heroHand}</b> is not part of the book&apos;s {heroSide === "ip" ? `${ip} opening` : "BB calling"} range here.
                </>
              )}
            </p>
          )}

          {category && (
            <Link
              href={`${FLOP_TRAINER_PATH}?spot=${choice}&focus=${category}`}
              onClick={() => trackCustom("FlopTrainThisTexture", { category })}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Target aria-hidden="true" className="h-3.5 w-3.5" />
              Train this texture: {CATEGORY_LABEL[category]}
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

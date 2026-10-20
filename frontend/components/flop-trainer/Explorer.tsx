"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { UpgradeButton } from "@/components/billing/UpgradeUi";
import { CardPicker } from "@/components/poker/CardPicker";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { ChoiceGroup } from "@/components/tools/ToolFields";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { hasProAccess, PRO_PRICE_LABEL } from "@/lib/billing/entitlements";
import { trackCustom } from "@/lib/metaPixel";
import { fetchExplorerHands, type ExplorerHands } from "@/lib/flopTrainer/api";
import { fetchExamples, fetchFull, fetchSpots, MVP_SPOTS, type BucketExamples, type FlopFull } from "@/lib/flopTrainer/data";
import { BUCKETS, CATEGORY_LABEL, displayPos, fmt, spotTitle, textureCategory, type FlopSpot } from "@/lib/flopTrainer/logic";
import { canonicalFlop, cbetAdvice, explainCbet, gridHand, BAND_LABEL, SIZE_LABEL } from "@/lib/flopTrainer/phase3";
import { cn } from "@/lib/utils";
import { BucketBars } from "./FlopResult";

type SpotChoice = "bn" | "utg";
const SPOT_OF: Record<SpotChoice, string> = { bn: MVP_SPOTS[0], utg: MVP_SPOTS[1] };
const DEFAULT_FLOP = ["Ks", "7d", "2c"];
const CARD_RE = /^[2-9TJQKA][cdhs]$/;

function parseFlop(q: string | null): string[] {
  const cards = q && q.length === 6 ? [q.slice(0, 2), q.slice(2, 4), q.slice(4, 6)] : [];
  return cards.length === 3 && cards.every((c) => CARD_RE.test(c)) && new Set(cards).size === 3 ? cards : DEFAULT_FLOP;
}

/**
 * Explorer (Pro): any spot and flop → equity, Equity Buckets, nut advantage,
 * hand classes, the c-bet advice and a 13x13 per-hand equity heatmap. Free
 * users and guests see the same page blurred behind an upgrade card.
 */
export function Explorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const choice: SpotChoice = params.get("spot") === "utg" ? "utg" : "bn";
  const cards = parseFlop(params.get("flop"));
  const setQuery = (spot: SpotChoice, c: string[]) => router.replace(`${pathname}?spot=${spot}&flop=${c.join("")}`, { scroll: false });

  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const { entitlements, loading } = useEntitlements();
  const pro = hasProAccess(entitlements);

  const [spots, setSpots] = useState<FlopSpot[] | null>(null);
  const [full, setFull] = useState<FlopFull | null>(null);
  const [hands, setHands] = useState<ExplorerHands | null>(null);
  const [examples, setExamples] = useState<BucketExamples | null | false>(null);
  const [error, setError] = useState(false);
  const spotId = SPOT_OF[choice];
  const spot = spots?.find((s) => s.spot_id === spotId) ?? null;
  const flop = useMemo(() => canonicalFlop(cards), [cards.join("")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSpots().then(setSpots, () => setError(true));
  }, []);

  // Analytics: one open per visit, and the paywall once it is decided.
  useEffect(() => {
    trackCustom("ExplorerOpen", {});
  }, []);
  useEffect(() => {
    if (!loading && !pro) trackCustom("PaywallView", { source: "flop_explorer" });
  }, [loading, pro]);

  useEffect(() => {
    let live = true;
    setFull(null);
    setExamples(null);
    fetchFull(spotId, flop).then(
      (f) => live && setFull(f),
      () => live && setError(true),
    );
    fetchExamples(spotId, flop).then(
      (e) => live && setExamples(e),
      () => live && setExamples(false),
    );
    return () => {
      live = false;
    };
  }, [spotId, flop]);

  useEffect(() => {
    if (!pro || !token) {
      setHands(null);
      return;
    }
    let live = true;
    fetchExplorerHands(token, spotId, flop).then(
      (h) => live && setHands(h),
      () => live && setHands(null),
    );
    return () => {
      live = false;
    };
  }, [pro, token, spotId, flop]);

  const setCard = (i: number, c: string) => {
    const next = [...cards];
    next[i] = c;
    if (new Set(next).size === 3) setQuery(choice, next);
  };

  const locked = !pro;
  const ip = spot ? displayPos(spot.ip) : "IP";
  const oop = spot ? displayPos(spot.oop) : "BB";

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <ChoiceGroup
          toolSlug="flop-trainer"
          label="Spot · 40bb MTT"
          value={choice}
          options={[
            { value: "bn", label: "BTN vs BB" },
            { value: "utg", label: "UTG vs BB" },
          ]}
          onChange={(s) => setQuery(s, cards)}
        />
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Flop</span>
          <div className="mt-1.5 flex gap-2">
            {cards.map((c, i) => (
              <CardPicker key={i} value={c} onChange={(v) => setCard(i, v)} disabledCards={cards.filter((_, j) => j !== i)} size="sm" disabled={locked} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn(locked && "pointer-events-none select-none blur-[6px]")} aria-hidden={locked || undefined}>
        {error ? (
          <p className="py-10 text-center text-sm text-muted-foreground">This flop could not be loaded.</p>
        ) : !full || !spot ? (
          <div className="h-[420px] animate-pulse rounded-2xl bg-card/40" />
        ) : (
          <ExplorerBody spot={spot} full={full} cards={cards} hands={hands} locked={locked} examples={examples} ip={ip} oop={oop} />
        )}
      </div>

      {locked && !loading && (
        <div className="absolute inset-x-0 top-28 z-10 mx-auto max-w-sm rounded-2xl border border-violet-500/40 bg-[#0B0E1A]/95 p-5 text-center shadow-2xl shadow-black/60">
          <Lock aria-hidden="true" className="mx-auto h-6 w-6 text-violet-300" />
          <h2 className="mt-2 text-lg font-bold text-white">The Explorer is part of Pro</h2>
          <p className="mt-1 text-sm text-white/70">
            Pick any of the 1,755 flops and see both ranges hand by hand: equity, buckets, nut advantage, c-bet advice and a
            13×13 heatmap. {PRO_PRICE_LABEL}/month.
          </p>
          <div className="mt-4">
            <UpgradeButton source="flop_explorer" />
          </div>
        </div>
      )}
    </div>
  );
}

function ExplorerBody({
  spot,
  full,
  cards,
  hands,
  locked,
  examples,
  ip,
  oop,
}: {
  spot: FlopSpot;
  full: FlopFull;
  cards: string[];
  hands: ExplorerHands | null;
  locked: boolean;
  examples: BucketExamples | null | false;
  ip: string;
  oop: string;
}) {
  const [side, setSide] = useState<"ip" | "oop">("ip");
  const nut = full.nut_adv;
  const advice = cbetAdvice(spot.spot_id, full.flop, full.buckets_ip, full.buckets_oop, full.texture);
  const classes = [...new Set([...Object.keys(full.hand_classes.ip), ...Object.keys(full.hand_classes.oop)])];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2" aria-label="Flop">
          {cards.map((c) => (
            <FourColorCard key={c} card={c} size="sm" highContrast />
          ))}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{spotTitle(spot)} · 40bb</p>
          <p className="text-lg text-white">
            {ip} <b className="font-mono">{fmt(full.equity_ip)}%</b> · {oop} <b className="font-mono">{fmt(full.equity_oop)}%</b>
          </p>
          <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[textureCategory(full.texture)]} · {full.texture.filter((t) => !t.includes(":")).join(", ")}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold text-foreground">Equity Buckets</h3>
          <BucketBars detail={full} ip={ip} oop={oop} examples={examples} />
          <p className="mt-3 text-sm text-muted-foreground">
            Nut advantage: <b className="text-foreground">{nut.leader === "IP" ? ip : nut.leader === "OOP" ? oop : "Equal"}</b> — Strong hands {ip}{" "}
            {fmt(nut.ip)}% · {oop} {fmt(nut.oop)}%
          </p>
          <div className="mt-3 rounded-xl border border-border/60 bg-card/30 p-3 text-sm">
            <p className="font-semibold text-foreground">
              C-bet: {BAND_LABEL[advice.band]}, {SIZE_LABEL[advice.size]}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{explainCbet(advice, ip, oop, full.buckets_oop)}</p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">Hand classes</h3>
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Class</th>
                <th className="py-1 text-right font-medium">{ip} share · eq.</th>
                <th className="py-1 text-right font-medium">{oop} share · eq.</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const a = full.hand_classes.ip[c];
                const b = full.hand_classes.oop[c];
                return (
                  <tr key={c} className="border-t border-border/40">
                    <td className="py-1 text-foreground">{c}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{a ? `${fmt(a[0])}% · ${Math.round(a[1])}%` : "–"}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{b ? `${fmt(b[0])}% · ${Math.round(b[1])}%` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Equity per hand</h3>
          <div className="inline-flex gap-1 rounded-lg border border-white/10 p-0.5" role="radiogroup" aria-label="Range">
            {(["ip", "oop"] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={side === x}
                onClick={() => setSide(x)}
                className={cn("rounded-md px-3 py-1 text-xs font-semibold", side === x ? "bg-violet-500/25 text-violet-100" : "text-muted-foreground")}
              >
                {x === "ip" ? ip : oop}
              </button>
            ))}
          </div>
        </div>
        {hands ? (
          <Heatmap hands={hands[side]} />
        ) : locked ? (
          <Heatmap hands={PLACEHOLDER} />
        ) : (
          <div className="mx-auto mt-2 aspect-square w-full max-w-[560px] animate-pulse rounded-lg bg-card/40" />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Colour = the hand&apos;s Equity Bucket on this flop (average over its suit combinations); faded = played only part of the
          time preflop; empty = not in the range.
        </p>
      </section>
    </div>
  );
}

/** Shown blurred to free users — not real data. */
const PLACEHOLDER: Record<string, [number, number]> = Object.fromEntries(
  Array.from({ length: 169 }, (_, k) => {
    const i = Math.floor(k / 13);
    const j = k % 13;
    return [gridHand(i, j), [1, 90 - 4 * Math.min(i, j) - 2 * Math.abs(i - j)] as [number, number]];
  }),
);

function Heatmap({ hands }: { hands: Record<string, [number, number]> }) {
  const color = (eq: number) => (BUCKETS.find((b) => eq >= ({ strong: 75, good: 50, weak: 33, trash: -1 } as const)[b.key]) ?? BUCKETS[3]).color;
  return (
    <div className="mx-auto mt-2 grid max-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
      {Array.from({ length: 169 }, (_, k) => {
        const h = gridHand(Math.floor(k / 13), k % 13);
        const v = hands[h];
        const inRange = v && v[0] > 0;
        return (
          <div
            key={h}
            title={inRange ? `${h}: ${Math.round(v[1])}% equity · played ${Math.round(v[0] * 100)}%` : `${h}: not in range`}
            className="flex aspect-square flex-col items-center justify-center rounded-[3px] text-[8px] leading-none sm:text-[10px]"
            style={inRange ? { background: color(v[1]), opacity: 0.35 + 0.65 * v[0] } : { background: "rgba(255,255,255,0.03)" }}
          >
            <span className={cn("font-semibold", inRange ? "text-white" : "text-white/25")}>{h}</span>
            {inRange && <span className="mt-0.5 hidden font-mono text-white/85 sm:block">{Math.round(v[1])}</span>}
          </div>
        );
      })}
    </div>
  );
}

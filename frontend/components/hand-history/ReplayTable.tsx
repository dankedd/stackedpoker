"use client";

/**
 * Multiway replay table for imported hands. Renders exactly one TimelineStep
 * (lib/handHistory/timeline.ts) — it never computes chips itself. Same felt,
 * chip and card tokens as the Preflop Trainer table.
 *
 * Layout rules (they keep 6-max and 9-max readable on a phone):
 *  - Bets go on the line from the seat to the table centre, at the first spot
 *    that touches no seat box, no cards, no other bet and not the pot — so a
 *    bet never covers a name or a stack (placeBets below, in px).
 *  - The action label ("Raise", "Fold", "+12 BB") is a pill on the box's
 *    bottom edge, and the dealer button hangs on the box's corner — neither
 *    takes space on the felt.
 *  - Hero's cards sit fully above Hero's box.
 *  - Folding dims the box and the cards, never the text: positions and stacks
 *    stay readable (WCAG AA) in every state.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { CardBack } from "@/components/poker/PlayingCard";
import { CHIP_PALETTE, PokerChip } from "@/components/poker/ChipStack";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { totalOnTable, type AmountFormatter, type TimelineStep } from "@/lib/handHistory/timeline";
import type { ParsedHand } from "@/lib/handHistory/types";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

/** GGPoker anonymises opponents as short hex hashes ("be4bfd82"). */
const HASHED_NAME = /^[0-9a-f]{6,10}$/i;

/** Seat box, label pill and card sizes in px (keep in sync with the classes below). */
const GEOM = {
  mobile: { boxW: 72, boxH: 56, pill: 8, heroCards: { w: 70, h: 59 }, cards: { w: 60, h: 40 }, chip: 12, charW: 6.2 },
  desktop: { boxW: 96, boxH: 62, pill: 9, heroCards: { w: 86, h: 73 }, cards: { w: 86, h: 62 }, chip: 16, charW: 6.8 },
};

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
const overlaps = (a: Rect, b: Rect) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

export function ReplayTable({ hand, step, fmt }: { hand: ParsedHand; step: TimelineStep; fmt: AmountFormatter }) {
  const mobile = useIsMobile();
  const g = mobile ? GEOM.mobile : GEOM.desktop;
  const ref = useRef<HTMLDivElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [centre, setCentre] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The pot and board block changes size with every step; bets must stay clear of it.
  useLayoutEffect(() => {
    const el = ref.current;
    const c = centreRef.current;
    if (!el || !c) return;
    const a = el.getBoundingClientRect();
    const b = c.getBoundingClientRect();
    const next = { l: b.left - a.left, t: b.top - a.top, r: b.right - a.left, b: b.bottom - a.top };
    setCentre((prev) =>
      prev && Math.abs(prev.l - next.l) < 0.5 && Math.abs(prev.t - next.t) < 0.5 && Math.abs(prev.r - next.r) < 0.5 && Math.abs(prev.b - next.b) < 0.5
        ? prev
        : next,
    );
  }, [step, size.w, size.h, mobile, fmt]);

  const slots = Math.max(hand.maxSeats, ...hand.players.map((p) => p.seat), 2);
  const hero = hand.players.find((p) => p.isHero) ?? hand.players[0];
  const rx = mobile ? 39 : 42;
  const ry = mobile ? 39 : 38;
  const bets = Object.values(step.bets).reduce((a, b) => a + b, 0);
  const onTable = totalOnTable(step);

  // Hero sits at the bottom; seats run clockwise from there, like the client.
  const angleOf = (seat: number) => Math.PI / 2 + (((seat - hero.seat + slots) % slots) * 2 * Math.PI) / slots;
  const seats = hand.players.map((p) => {
    const ang = angleOf(p.seat);
    return { p, ang, xPct: 50 + rx * Math.cos(ang), yPct: 50 + ry * Math.sin(ang) };
  });

  const betPositions = size.w && centre ? placeBets() : new Map<string, { left: number; top: number }>();

  /**
   * Bet positions in px. Each bet walks from its seat toward the table centre
   * (and a little to either side) and takes the first spot that overlaps no
   * seat box, label pill, cards, the pot block or a bet placed before it.
   */
  function placeBets() {
    const out = new Map<string, { left: number; top: number }>();
    const obstacles: Rect[] = [];
    for (const s of seats) {
      const x = (s.xPct / 100) * size.w;
      const y = (s.yPct / 100) * size.h;
      obstacles.push({ l: x - g.boxW / 2, t: y - g.boxH / 2, r: x + g.boxW / 2, b: y + g.boxH / 2 + g.pill });
      const cards = s.p.isHero ? g.heroCards : g.cards;
      obstacles.push({ l: x - cards.w / 2, t: y - g.boxH / 2 - cards.h, r: x + cards.w / 2, b: y - g.boxH / 2 });
    }
    const pad = 4;
    obstacles.push({ l: centre!.l - pad, t: centre!.t - pad, r: centre!.r + pad, b: centre!.b + pad });
    const cx = (centre!.l + centre!.r) / 2;
    const cy = (centre!.t + centre!.b) / 2;

    for (const s of seats) {
      const bet = step.bets[s.p.name] ?? 0;
      if (bet <= 0) continue;
      const x = (s.xPct / 100) * size.w;
      const y = (s.yPct / 100) * size.h;
      const halfW = Math.max(g.chip, (fmt(bet).length * g.charW + 12) / 2);
      const halfH = g.chip + 6;
      const len = Math.hypot(cx - x, cy - y) || 1;
      const ux = (cx - x) / len;
      const uy = (cy - y) / len;
      const reach = (hw: number, hh: number) =>
        Math.min(Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity);
      const d0 = reach(g.boxW / 2, g.boxH / 2 + (uy > 0 ? g.pill : 0)) + 4 + reach(halfW, halfH);
      const rectAt = (px: number, py: number): Rect => ({ l: px - halfW, t: py - halfH, r: px + halfW, b: py + halfH });

      let best = { left: x + ux * d0, top: y + uy * d0 };
      search: for (let k = 0; k <= 24; k++) {
        for (const side of [0, 1, -1, 2, -2, 3, -3]) {
          const d = d0 + k * 5;
          const px = x + ux * d - uy * side * 12;
          const py = y + uy * d + ux * side * 12;
          const r = rectAt(px, py);
          if (r.l < 2 || r.r > size.w - 2 || r.t < 2 || r.b > size.h - 2) continue;
          if (obstacles.some((o) => overlaps(o, r))) continue;
          best = { left: px, top: py };
          break search;
        }
      }
      out.set(s.p.name, best);
      obstacles.push(rectAt(best.left, best.top));
    }
    return out;
  }

  return (
    <div
      ref={ref}
      className={cn("relative mx-auto w-full max-w-[860px] select-none", mobile ? "mt-6 aspect-[1/1.02]" : "mt-4 aspect-[16/9.4]")}
    >
      <div
        className="absolute rounded-[999px]"
        style={{
          inset: mobile ? "9% 9% 6%" : "11% 8%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      />
      <div
        className="absolute rounded-[999px] border border-emerald-950/40"
        style={{
          inset: mobile ? "11% 12% 8%" : "13% 10%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
          boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      />

      {/* Board and pot, centred on the felt. */}
      {/* Preflop on a phone the pot sits lower, between the bets and Hero's cards. */}
      <div
        ref={centreRef}
        className={cn(
          "absolute left-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5",
          mobile && step.board.length === 0 ? "top-[57%]" : "top-[46%]",
        )}
      >
        {step.board.length > 0 && (
          <div className="flex gap-1">
            {step.board.map((c) => (
              <FourColorCard key={c} card={c} size="sm" highContrast className="animate-fade-in" style={mobile ? { width: 34, height: 48 } : undefined} />
            ))}
          </div>
        )}
        <div className="flex flex-col items-center whitespace-nowrap rounded-xl bg-black/55 px-2.5 py-1 text-center leading-tight">
          <p className="text-[13px] font-bold text-white sm:text-sm">
            {t.step.potLabel} <span className="font-mono">{fmt(onTable)}</span>
          </p>
          {bets > 0 && step.pot > 0 && (
            // Tabular figures rather than monospace: same alignment, a narrower line.
            <p className="text-[10px] tabular-nums text-emerald-50 sm:text-[11px]">
              {mobile ? t.step.potSplitShort(fmt(step.pot), fmt(bets)) : t.step.potSplit(fmt(step.pot), fmt(bets))}
            </p>
          )}
        </div>
      </div>

      {seats.map(({ p, ang, xPct, yPct }) => {
        const isHeroSeat = p.isHero;
        const folded = step.folded.includes(p.name);
        const acting = step.player === p.name;
        const allIn = step.allIn.includes(p.name);
        const shown = step.shown[p.name];
        const cards = isHeroSeat ? hand.heroCards : shown;
        const bet = step.bets[p.name] ?? 0;
        const won = step.won[p.name];
        const label = won ? `+${fmt(won)}` : folded ? t.step.seat.fold : step.seatLabels[p.name];
        const isButton = p.seat === hand.buttonSeat;
        const leftHalf = Math.cos(ang) < -0.05;
        const name = isHeroSeat ? t.step.hero : p.name;
        const betPos = betPositions.get(p.name);

        return (
          <div key={p.seat}>
            <div
              className={cn("absolute -translate-x-1/2 -translate-y-1/2", isHeroSeat ? "z-[4]" : "z-[3]")}
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
              data-seat={p.position}
            >
              {/* Cards: Hero's fully above the box; others tucked behind its top edge. */}
              <div
                className={cn(
                  "absolute left-1/2 flex -translate-x-1/2 transition-opacity",
                  isHeroSeat ? "bottom-[calc(100%+3px)]" : "bottom-[calc(100%-10px)]",
                  folded && "opacity-35 grayscale-[40%]",
                )}
              >
                {cards ? (
                  cards.map((c, k) => (
                    <FourColorCard
                      key={c}
                      card={c}
                      size="sm"
                      highContrast
                      style={{
                        ...(mobile ? (isHeroSeat ? { width: 40, height: 56 } : { width: 34, height: 48 }) : null),
                        marginLeft: k ? (mobile ? -10 : -14) : 0,
                        transform: `rotate(${k ? 4 : -4}deg)`,
                      }}
                    />
                  ))
                ) : !folded ? (
                  <>
                    <CardBack size="xs" style={{ transform: "rotate(-4deg)" }} />
                    <CardBack size="xs" style={{ marginLeft: -12, transform: "rotate(4deg)" }} />
                  </>
                ) : null}
              </div>

              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl border px-1.5 pb-[7px] pt-0.5 text-center shadow-md shadow-black/40 transition-colors",
                  mobile ? "h-[56px] w-[72px]" : "h-[62px] w-[96px]",
                  folded
                    ? "border-white/[0.08] bg-[#0c1120]"
                    : isHeroSeat
                      ? "border-violet-500/60 bg-[#140a33]"
                      : acting
                        ? "border-amber-400/80 bg-[#21190a]"
                        : "border-white/15 bg-[#111827]",
                  acting && !folded && (isHeroSeat ? "ring-2 ring-violet-400" : "ring-2 ring-amber-400/70"),
                  won && "ring-2 ring-emerald-400/80",
                )}
              >
                <p
                  className={cn(
                    "text-[13px] font-bold leading-tight sm:text-sm",
                    folded ? "text-slate-300" : isHeroSeat ? "text-violet-200" : acting ? "text-amber-200" : "text-white",
                  )}
                >
                  {p.position}
                </p>
                <p
                  className={cn("max-w-full truncate text-[10px] leading-tight sm:text-[11px]", isHeroSeat ? "font-semibold text-violet-200" : "text-slate-400")}
                  title={name}
                >
                  {HASHED_NAME.test(name) ? <span className="tracking-tight">{name}</span> : name}
                </p>
                <p className={cn("text-[12px] font-semibold leading-tight sm:text-[13px]", folded ? "text-slate-300" : allIn ? "text-rose-300" : "text-sky-300")}>
                  {allIn && step.stacks[p.name] <= 0 ? t.step.seat.allIn : <span className="font-mono">{fmt(step.stacks[p.name])}</span>}
                </p>

                {label && (
                  <span
                    className={cn(
                      "absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-[#0b1020] px-1.5 py-px text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-[10px]",
                      won
                        ? "border-emerald-400/50 text-emerald-300"
                        : folded
                          ? "border-white/10 text-slate-300"
                          : allIn && label === t.step.seat.allIn
                            ? "border-rose-400/50 text-rose-300"
                            : isHeroSeat
                              ? "border-violet-400/50 text-violet-200"
                              : acting
                                ? "border-amber-400/50 text-amber-200"
                                : "border-white/15 text-slate-200",
                    )}
                  >
                    {won ? <span className="font-mono normal-case">{label}</span> : label}
                  </span>
                )}

                {isButton && (
                  <span
                    aria-label={t.step.dealer}
                    title={t.step.dealer}
                    className={cn(
                      "absolute -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] font-black text-neutral-900 shadow",
                      leftHalf ? "-left-2" : "-right-2",
                    )}
                  >
                    D
                  </span>
                )}
              </div>
            </div>

            {bet > 0 && betPos && <BetChips label={fmt(bet)} left={betPos.left} top={betPos.top} size={g.chip} />}
          </div>
        );
      })}
    </div>
  );
}

/** One chip colour for every bet; an all-in is told by the seat's "All-in" label, not by the chip. */
function BetChips({ label, left, top, size }: { label: string; left: number; top: number; size: number }) {
  const spread = Math.max(3, Math.round(size * 0.22));
  return (
    <div className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2px]" style={{ left, top }} data-bet>
      <div className="relative" style={{ width: size + spread, height: size + spread }}>
        <PokerChip tone="bet" sizePx={size} style={{ left: 0, top: spread, opacity: 0.7 }} />
        <PokerChip tone="bet" sizePx={size} style={{ left: spread, top: 0 }} />
      </div>
      <span className={cn("whitespace-nowrap rounded-full bg-black/60 px-1.5 py-px font-mono text-[10px] font-bold leading-tight sm:text-[11px]", CHIP_PALETTE.bet.text)}>
        {label}
      </span>
    </div>
  );
}

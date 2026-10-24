"use client";

/**
 * Multiway replay table for imported hands. Renders exactly one TimelineStep
 * (lib/handHistory/timeline.ts) — it never computes chips itself. Same felt,
 * chip and card tokens as the Preflop Trainer table.
 *
 * Layout rules (they keep 6-max and 9-max readable on a phone):
 *  - Bets sit ~38% of the way from the seat to the pot, at the free spot
 *    nearest that point with 16px clear of every seat box, card, the board and
 *    the pot label (less only when the felt is too small). Hero's cards sit
 *    between Hero's seat and the pot, so Hero's bet goes above the cards, or
 *    beside them when there is no room — never on or behind them (placeBets).
 *  - When a street ends, the bets slide into the pot.
 *  - The action label ("Raise", "Fold", "+12 BB") is a pill on the box's
 *    bottom edge, and the dealer button hangs on the box's corner — neither
 *    takes space on the felt.
 *  - Hero's cards sit fully above Hero's box.
 *  - Folding dims the box and the cards, never the text: positions and stacks
 *    stay readable (WCAG AA) in every state.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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

/** Seat box, label pill, card and bet-label sizes in px (keep in sync with the classes below). */
const GEOM = {
  mobile: { boxW: 72, boxH: 56, pill: 8, heroCards: { w: 70, h: 59 }, cards: { w: 60, h: 40 }, chip: 12, label: 15, charW: 6.2 },
  desktop: { boxW: 96, boxH: 62, pill: 9, heroCards: { w: 86, h: 73 }, cards: { w: 86, h: 62 }, chip: 16, label: 16, charW: 6.8 },
};

/** Where a bet wants to sit: this share of the way from the seat to the pot. */
const BET_PULL = 0.38;
/** Room kept between a bet and seats, cards, board and pot; tried in order until one fits. */
const CLEARANCES = [16, 12, 8, 4, 0];
const SWEEP_MS = 450;

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
const overlaps = (a: Rect, b: Rect) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const grow = (a: Rect, by: number): Rect => ({ l: a.l - by, t: a.t - by, r: a.r + by, b: a.b + by });

interface Point {
  left: number;
  top: number;
}
interface SweptBet extends Point {
  name: string;
  label: string;
}

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
  const onTable = totalOnTable(step);

  // Hero sits at the bottom; seats run clockwise from there, like the client.
  const angleOf = (seat: number) => Math.PI / 2 + (((seat - hero.seat + slots) % slots) * 2 * Math.PI) / slots;
  const seats = hand.players.map((p) => {
    const ang = angleOf(p.seat);
    return { p, ang, xPct: 50 + rx * Math.cos(ang), yPct: 50 + ry * Math.sin(ang) };
  });

  const betPositions = size.w && centre ? placeBets() : new Map<string, Point>();
  const potPoint: Point | null = centre ? { left: (centre.l + centre.r) / 2, top: centre.b - 12 } : null;

  // Bets that left the table on this step went into the pot: slide them there
  // from where they stood. Only going forward — stepping back just redraws.
  const prevStep = useRef(step);
  const drawnAt = useRef(betPositions);
  const [sweep, setSweep] = useState<{ id: number; chips: SweptBet[] } | null>(null);
  // Declared before the drawnAt update below, so it still sees where the bets stood.
  useEffect(() => {
    const prev = prevStep.current;
    prevStep.current = step;
    if (prev === step) return;
    const chips =
      step.pot > prev.pot
        ? Object.entries(prev.bets).flatMap(([name, amount]) => {
            const at = drawnAt.current.get(name);
            return amount > 0 && !(step.bets[name] > 0) && at ? [{ name, label: fmt(amount), ...at }] : [];
          })
        : [];
    setSweep(chips.length ? { id: Date.now(), chips } : null);
  }, [step, fmt]);
  useEffect(() => {
    drawnAt.current = betPositions;
  });

  /**
   * Bet positions in px. A bet takes the free spot nearest BET_PULL of the way
   * from its seat to the pot, keeping the first of CLEARANCES that fits from
   * every seat box (with its label pill and dealer button), all cards, the
   * board and pot block, and leaving bets placed before it untouched. A bet
   * stays in front of its seat and never clearly nearer another seat, so it
   * never reads as a neighbour's. Hero's cards are in the way of Hero's line, so
   * Hero aims between the cards and the pot and otherwise sits beside them.
   */
  function placeBets() {
    const out = new Map<string, Point>();
    const fixed: Rect[] = [centre!];
    const cx = (centre!.l + centre!.r) / 2;
    const cy = (centre!.t + centre!.b) / 2;
    const geo = seats.map((s) => {
      const x = (s.xPct / 100) * size.w;
      const y = (s.yPct / 100) * size.h;
      const btn = s.p.seat === hand.buttonSeat ? 8 : 0;
      fixed.push({ l: x - g.boxW / 2 - btn, t: y - g.boxH / 2 - btn, r: x + g.boxW / 2 + btn, b: y + g.boxH / 2 + g.pill });
      const cards = s.p.isHero ? g.heroCards : g.cards;
      const lift = s.p.isHero ? 3 : 0;
      // +3px each side: the cards are tilted ±4°, so their corners stick out past their box.
      const cardRect = { l: x - cards.w / 2 - 3, t: y - g.boxH / 2 - lift - cards.h - 3, r: x + cards.w / 2 + 3, b: y - g.boxH / 2 - lift };
      fixed.push(cardRect);
      // Hero's cards stand out more than Hero's box, so they are what a bet should read as near.
      const anchor = s.p.isHero ? { left: x, top: (cardRect.t + cardRect.b) / 2 } : { left: x, top: y };
      return { s, x, y, cardRect, anchor };
    });
    const placed: Rect[] = [];
    const spread = Math.max(3, Math.round(g.chip * 0.22));
    const grid: Point[] = [];
    for (let top = 4; top < size.h; top += 5) for (let left = 4; left < size.w; left += 5) grid.push({ left, top });
    const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

    // Hero first: Hero has the least room, between the cards and the pot.
    for (const { s, x, y, cardRect, anchor } of [...geo].sort((a, b) => Number(b.s.p.isHero) - Number(a.s.p.isHero))) {
      const bet = step.bets[s.p.name] ?? 0;
      if (bet <= 0) continue;
      const halfW = Math.max(g.chip + spread, fmt(bet).length * g.charW + 12) / 2;
      const halfH = (g.chip + spread + 2 + g.label) / 2;
      const rectAt = (p: Point): Rect => ({ l: p.left - halfW, t: p.top - halfH, r: p.left + halfW, b: p.top + halfH });
      const fits = (p: Point, clear: number) => {
        const r = rectAt(p);
        if (r.l < 2 || r.r > size.w - 2 || r.t < 2 || r.b > size.h - 2) return false;
        const grown = grow(r, clear);
        return !fixed.some((o) => overlaps(o, grown)) && !placed.some((o) => overlaps(o, grown));
      };

      // Hero's line runs straight through the cards: aim for the middle of the gap above them.
      const target = s.p.isHero
        ? { left: x, top: (cardRect.t + centre!.b) / 2 }
        : { left: x + (cx - x) * BET_PULL, top: y + (cy - y) * BET_PULL };
      const d2 = (a: Point, b: Point) => (a.left - b.left) ** 2 + (a.top - b.top) ** 2;
      const pot = { left: cx, top: cy };
      const reach = d2({ left: x, top: y }, pot);
      // In front of the seat (nearer the pot than the seat is) and not clearly nearer another seat
      // (at most 1.2× as far from this one: a phone needs that little slack).
      const own = grid
        .filter((p) => d2(p, pot) < reach && geo.every((o) => o.s === s || d2(p, anchor) < 1.44 * d2(p, o.anchor)))
        .sort((a, b) => d2(a, target) - d2(b, target));

      let best: Point | undefined;
      for (const clear of CLEARANCES) {
        best = own.find((p) => fits(p, clear));
        if (best) break;
      }
      // Nothing free at all (a full table on a phone): the spot that covers the least.
      if (!best) {
        let least = Infinity;
        for (const p of own.slice(0, 600)) {
          const r = rectAt(p);
          const cover = fixed.reduce((a, o) => a + area(o, r), 0) + placed.reduce((a, o) => a + area(o, r), 0);
          if (cover < least) [least, best] = [cover, p];
        }
      }
      best ??= target;
      out.set(s.p.name, best);
      placed.push(rectAt(best));
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

      {/* Board and pot, centred on the felt; a little higher on a phone, to leave Hero's bet room above Hero's cards. */}
      <div
        ref={centreRef}
        className={cn(
          "absolute left-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5",
          mobile ? (step.board.length > 0 ? "top-[41%]" : "top-[42%]") : "top-[46%]",
        )}
      >
        {step.board.length > 0 && (
          <div className="flex gap-1">
            {step.board.map((c) => (
              <FourColorCard key={c} card={c} size="sm" highContrast className="animate-fade-in" style={mobile ? { width: 34, height: 48 } : undefined} />
            ))}
          </div>
        )}
        <p className="whitespace-nowrap rounded-xl bg-black/55 px-2.5 py-1 text-center text-[13px] font-bold leading-tight text-white sm:text-sm" data-pot>
          {t.step.potLabel} <span className="font-mono">{fmt(onTable)}</span>
        </p>
      </div>

      {sweep &&
        potPoint &&
        sweep.chips.map((c) => (
          <SweepChips key={`${sweep.id}-${c.name}`} label={c.label} from={c} to={potPoint} size={g.chip} />
        ))}

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

/** A bet from the street that just ended, sliding into the pot and fading out. */
function SweepChips({ label, from, to, size }: { label: string; from: Point; to: Point; size: number }) {
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    // Two frames: the first paints the chip where the bet stood, the second starts the slide.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setMoved(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  const at = moved ? to : from;
  return (
    <BetChips
      label={label}
      left={at.left}
      top={at.top}
      size={size}
      sweeping
      className="pointer-events-none motion-reduce:hidden"
      style={{ opacity: moved ? 0 : 1, transition: `left ${SWEEP_MS}ms ease-in, top ${SWEEP_MS}ms ease-in, opacity ${SWEEP_MS}ms ease-in` }}
    />
  );
}

/** One chip colour for every bet; an all-in is told by the seat's "All-in" label, not by the chip. */
function BetChips({
  label,
  left,
  top,
  size,
  sweeping,
  className,
  style,
}: {
  label: string;
  left: number;
  top: number;
  size: number;
  sweeping?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const spread = Math.max(3, Math.round(size * 0.22));
  return (
    <div
      className={cn("absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2px]", className)}
      style={{ left, top, ...style }}
      aria-hidden={sweeping || undefined}
      {...(sweeping ? { "data-sweep": "" } : { "data-bet": "" })}
    >
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

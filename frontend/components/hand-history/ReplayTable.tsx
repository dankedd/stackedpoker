"use client";

/**
 * Multiway replay table for imported hands. Renders exactly one TimelineStep
 * (lib/handHistory/timeline.ts) — it never computes chips itself. Same felt,
 * chip and card tokens as the Preflop Trainer table.
 */

import { CardBack } from "@/components/poker/PlayingCard";
import { DealerMarker } from "@/components/poker/DealerMarker";
import { CHIP_PALETTE, PokerChip, type ChipTone } from "@/components/poker/ChipStack";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { AmountFormatter, TimelineStep } from "@/lib/handHistory/timeline";
import type { ParsedHand } from "@/lib/handHistory/types";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

export function ReplayTable({ hand, step, fmt }: { hand: ParsedHand; step: TimelineStep; fmt: AmountFormatter }) {
  const mobile = useIsMobile();
  const slots = Math.max(hand.maxSeats, ...hand.players.map((p) => p.seat), 2);
  const hero = hand.players.find((p) => p.isHero) ?? hand.players[0];
  const rx = mobile ? 40 : 44;
  const ry = mobile ? 42 : 40;
  const totalBets = Object.values(step.bets).reduce((a, b) => a + b, 0);

  // Hero sits at the bottom; seats run clockwise from there, like the client.
  const angleOf = (seat: number) => Math.PI / 2 + (((seat - hero.seat + slots) % slots) * 2 * Math.PI) / slots;

  return (
    <div className={cn("relative mx-auto w-full max-w-[860px] select-none", mobile ? "aspect-[4/5]" : "aspect-[16/9.6]")}>
      <div
        className="absolute rounded-[999px]"
        style={{
          inset: mobile ? "10% 12%" : "11% 8%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      />
      <div
        className="absolute rounded-[999px] border border-emerald-950/40"
        style={{
          inset: mobile ? "12% 15%" : "13% 10%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
          boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div className="absolute left-1/2 top-[45%] flex w-[80%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex min-h-[52px] gap-1 sm:min-h-[87px]">
            {step.board.map((c) => (
              <FourColorCard key={c} card={c} size="sm" className="animate-fade-in" style={mobile ? { width: 34, height: 48 } : undefined} />
            ))}
          </div>
          <p className="rounded-full bg-black/35 px-3 py-0.5 font-mono text-xs font-bold text-emerald-50 sm:text-sm">
            {t.step.pot(fmt(step.pot))}
            {totalBets > 0 && <span className="font-normal text-emerald-100/70"> · totaal {fmt(step.pot + totalBets)}</span>}
          </p>
        </div>
      </div>

      {hand.players.map((p) => {
        const ang = angleOf(p.seat);
        const x = 50 + rx * Math.cos(ang);
        const y = 50 + ry * Math.sin(ang);
        const isHeroSeat = p.isHero;
        const folded = step.folded.includes(p.name);
        const acting = step.player === p.name;
        const allIn = step.allIn.includes(p.name);
        const shown = step.shown[p.name];
        const cards = isHeroSeat ? hand.heroCards : shown;
        const bet = step.bets[p.name] ?? 0;
        const won = step.won[p.name];
        const label = step.seatLabels[p.name];
        const pull = isHeroSeat ? 0.32 : mobile ? 0.72 : 0.58;
        const tone: ChipTone = allIn ? "allin" : label === "SB" || label === "BB" ? "blind" : "bet";
        const isButton = p.seat === hand.buttonSeat;
        const da = ang + (isHeroSeat ? 0.42 : 0.3);

        return (
          <div key={p.seat}>
            <div
              className={cn("absolute flex w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[100px]", isHeroSeat ? "z-[3]" : "z-[2]")}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className={cn("relative", folded && "opacity-45")}>
                <div className="absolute bottom-[calc(100%-10px)] left-1/2 flex -translate-x-1/2">
                  {cards ? (
                    cards.map((c, k) => (
                      <FourColorCard
                        key={c}
                        card={c}
                        size="sm"
                        style={{
                          ...(mobile && !isHeroSeat ? { width: 34, height: 48 } : null),
                          marginLeft: k ? (mobile ? -12 : -16) : 0,
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
                    "relative min-w-[68px] rounded-xl border px-2 py-1 text-center shadow-md shadow-black/40 transition-colors sm:min-w-[92px]",
                    isHeroSeat ? "border-violet-500/60 bg-[rgba(16,8,42,0.96)]" : "border-border/60 bg-card/90",
                    acting && (isHeroSeat ? "ring-2 ring-violet-400" : "border-amber-400/70 bg-[rgba(40,30,8,0.92)] ring-2 ring-amber-400/70"),
                    won && "ring-2 ring-emerald-400/80",
                  )}
                >
                  <p className={cn("truncate text-[11px] font-bold sm:text-xs", isHeroSeat ? "text-violet-300" : acting ? "text-amber-300" : "text-foreground")}>
                    {p.name}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">{p.position}</p>
                  <p className={cn("font-mono text-[10px] font-semibold sm:text-xs", allIn ? "text-rose-300" : "text-sky-300")}>
                    {allIn && step.stacks[p.name] <= 0 ? "All-in" : fmt(step.stacks[p.name])}
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  "mt-0.5 min-h-3 whitespace-nowrap text-[9px] font-bold uppercase tracking-wide sm:text-[10px]",
                  won ? "text-emerald-300" : isHeroSeat ? "text-violet-300" : acting ? "text-amber-300" : "text-muted-foreground",
                )}
              >
                {won ? `+${fmt(won)}` : folded ? "Fold" : label ?? ""}
              </p>
            </div>

            {bet > 0 && (
              <BetChips
                label={fmt(bet)}
                tone={tone}
                left={50 + rx * pull * Math.cos(ang)}
                top={50 + ry * pull * Math.sin(ang)}
                size={mobile ? 12 : 16}
              />
            )}
            {isButton && (
              <DealerMarker
                style={{
                  left: `${50 + rx * (mobile ? 0.8 : 0.66) * Math.cos(da)}%`,
                  top: `${50 + ry * (mobile ? 0.8 : 0.66) * Math.sin(da)}%`,
                  transform: "translate(-50%,-50%)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BetChips({ label, tone, left, top, size }: { label: string; tone: ChipTone; left: number; top: number; size: number }) {
  const spread = Math.max(3, Math.round(size * 0.22));
  return (
    <div className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]" style={{ left: `${left}%`, top: `${top}%` }}>
      <div className="relative" style={{ width: size + spread, height: size + spread }}>
        <PokerChip tone={tone} sizePx={size} style={{ left: 0, top: spread, opacity: 0.7 }} />
        <PokerChip tone={tone} sizePx={size} style={{ left: spread, top: 0 }} />
      </div>
      <span className={cn("whitespace-nowrap rounded-full bg-black/45 px-1.5 py-px font-mono text-[10px] font-bold leading-tight sm:text-[11px]", CHIP_PALETTE[tone].text)}>
        {label}
      </span>
    </div>
  );
}

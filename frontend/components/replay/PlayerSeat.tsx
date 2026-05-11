"use client";

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";

const ACTION_BADGE: Record<string, string> = {
  good:    "bg-emerald-500 text-black",
  okay:    "bg-amber-400 text-black",
  mistake: "bg-red-500 text-white",
  neutral: "bg-white/92 text-black",
};

export interface PlayerSeatProps {
  descriptor: SeatDescriptor;
  isActive: boolean;
  isFolded: boolean;
  isFolding: boolean;
  actionVerb?: string;
  actionAmount?: string;
  actionRating?: "good" | "okay" | "mistake";
  actionKey?: number;
}

export function PlayerSeat({
  descriptor,
  isActive,
  isFolded,
  isFolding,
  actionVerb,
  actionAmount,
  actionRating,
  actionKey,
}: PlayerSeatProps) {
  const { isHero, isSitting, position, playerName, cards, cardsKnown } = descriptor;

  // ── Ghost seat ──────────────────────────────────────────────────────────
  if (!isSitting) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-[0.06] pointer-events-none select-none">
        <div className="flex gap-0.5">
          <div className="h-[36px] w-[26px] rounded border border-white/20" />
          <div className="h-[36px] w-[26px] rounded border border-white/20" />
        </div>
        <div className="text-[7px] text-white/25 font-medium tracking-wide">{position}</div>
      </div>
    );
  }

  const initial = playerName ? playerName[0].toUpperCase() : position[0];

  // Active glow is applied as a box-shadow on the card cluster
  const cardGlow: React.CSSProperties = isActive
    ? isHero
      ? { borderRadius: "7px", boxShadow: "0 0 0 1.5px rgba(34,197,94,0.55), 0 0 22px rgba(34,197,94,0.2)" }
      : { borderRadius: "7px", boxShadow: "0 0 0 1.5px rgba(251,191,36,0.42), 0 0 16px rgba(251,191,36,0.12)" }
    : {};

  const renderCards = () => {
    const size = isHero ? "md" : "sm";
    if (isHero) {
      return cards.length > 0
        ? cards.map((c, i) => <PlayingCard key={i} card={c} size={size} />)
        : [<CardBack key={0} size={size} />, <CardBack key={1} size={size} />];
    }
    if (cardsKnown && cards.length > 0) {
      return cards.map((c, i) => <PlayingCard key={i} card={c} size={size} />);
    }
    return [<CardBack key={0} size={size} />, <CardBack key={1} size={size} />];
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1.5 select-none transition-all duration-500",
        isFolded && !isFolding && "opacity-[0.18] grayscale"
      )}
    >
      {/* ── Action badge ──────────────────────────────────────────────── */}
      {actionVerb && (
        <div
          key={actionKey}
          className={cn(
            "absolute -top-7 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            "px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xl",
            "animate-action-pop",
            actionRating ? ACTION_BADGE[actionRating] : ACTION_BADGE.neutral
          )}
        >
          {actionVerb}{actionAmount ? ` ${actionAmount}` : ""}
        </div>
      )}

      {/* ── Cards ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex gap-1 transition-all duration-300",
          isActive && isHero && "scale-[1.06]",
          isFolding && "animate-card-muck"
        )}
        style={cardGlow}
      >
        {renderCards()}
      </div>

      {/* ── Info capsule ──────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-semibold tracking-wide transition-all duration-300",
          isHero
            ? isActive
              ? "border-emerald-500/40 bg-emerald-950/55 text-emerald-400"
              : "border-emerald-900/35 bg-emerald-950/25 text-emerald-600/55"
            : isActive
              ? "border-white/12 bg-white/7 text-white/62"
              : isFolded
                ? "border-white/4 bg-transparent text-white/14"
                : "border-white/8 bg-black/28 text-white/32"
        )}
        style={{ backdropFilter: "blur(10px)" }}
      >
        {/* Initials dot */}
        <div
          className={cn(
            "h-3 w-3 rounded-full flex items-center justify-center text-[6px] font-bold flex-shrink-0",
            isHero ? "bg-emerald-500/18 text-emerald-400/70" : "bg-white/10 text-white/30"
          )}
        >
          {initial}
        </div>

        <span>{isHero ? "YOU" : position}</span>

        {isFolded && !isFolding && (
          <span className="text-red-400/50 leading-none">✕</span>
        )}
      </div>
    </div>
  );
}

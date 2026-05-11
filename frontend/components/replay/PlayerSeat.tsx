"use client";

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";

// Action badge fill colors — muted, not neon
const ACTION_BADGE: Record<string, string> = {
  good:    "bg-emerald-500/90 text-black",
  okay:    "bg-amber-400/90 text-black",
  mistake: "bg-rose-500/90 text-white",
  neutral: "bg-white/88 text-black",
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

  // ── Ghost (empty seat) ──────────────────────────────────────────────────
  if (!isSitting) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-[0.05] pointer-events-none select-none">
        <div className="flex gap-1">
          <div className="h-[36px] w-[26px] rounded border border-white/20" />
          <div className="h-[36px] w-[26px] rounded border border-white/20" />
        </div>
        <div className="text-[7px] font-medium tracking-wide text-white/30">{position}</div>
      </div>
    );
  }

  const initial = playerName ? playerName[0].toUpperCase() : position[0];

  // Active glow on the card cluster — emerald for hero, soft amber for others
  const cardGlow: React.CSSProperties = isActive
    ? isHero
      ? {
          padding: "3px",
          borderRadius: "8px",
          boxShadow:
            "0 0 0 1px rgba(34,197,94,0.45), 0 0 20px rgba(34,197,94,0.16), 0 0 40px rgba(34,197,94,0.06)",
        }
      : {
          padding: "3px",
          borderRadius: "8px",
          boxShadow:
            "0 0 0 1px rgba(251,191,36,0.38), 0 0 16px rgba(251,191,36,0.10)",
        }
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
        "relative flex flex-col items-center gap-2 select-none transition-all duration-500",
        isFolded && !isFolding && "opacity-30 grayscale"
      )}
    >
      {/* ── Action badge ──────────────────────────────────────────────── */}
      {actionVerb && (
        <div
          key={actionKey}
          className={cn(
            "absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            "px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-lg",
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
          "flex gap-1.5 transition-all duration-300",
          isActive && isHero && "scale-[1.04]",
          isFolding && "animate-card-muck"
        )}
        style={cardGlow}
      >
        {renderCards()}
      </div>

      {/* ── Capsule label ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] font-semibold tracking-wide transition-all duration-400",
          isHero
            ? isActive
              ? "border-emerald-500/45 text-emerald-400/90"
              : "border-emerald-900/35 text-emerald-600/50"
            : isActive
              ? "border-white/12 text-white/60"
              : isFolded
                ? "border-white/4 text-white/12"
                : "border-white/8 text-white/30"
        )}
        style={{
          background: isHero
            ? isActive
              ? "rgba(20, 40, 30, 0.75)"
              : "rgba(14, 24, 18, 0.55)"
            : isActive
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.30)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Initial circle */}
        <div
          className={cn(
            "h-3.5 w-3.5 rounded-full flex items-center justify-center text-[6px] font-bold flex-shrink-0",
          )}
          style={{
            background: isHero ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
            color: isHero ? "rgba(34,197,94,0.75)" : "rgba(255,255,255,0.28)",
          }}
        >
          {initial}
        </div>

        <span>{isHero ? "YOU" : position}</span>

        {isFolded && !isFolding && (
          <span className="text-rose-400/40 leading-none text-[9px]">✕</span>
        )}
      </div>
    </div>
  );
}

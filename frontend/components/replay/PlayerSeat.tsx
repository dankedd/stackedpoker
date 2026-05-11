"use client";

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";

// ── Action badge colors ─────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, string> = {
  good:    "bg-poker-green text-black",
  okay:    "bg-yellow-400 text-black",
  mistake: "bg-red-500 text-white",
  default: "bg-white/90 text-black",
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface PlayerSeatProps {
  descriptor: SeatDescriptor;
  isActive: boolean;
  isFolded: boolean;
  isFolding: boolean;   // fold is happening right now → trigger muck animation
  actionVerb?: string;
  actionAmount?: string;
  actionRating?: "good" | "okay" | "mistake";
  actionKey?: number;   // changes every step → forces badge re-animation
}

// ── Component ───────────────────────────────────────────────────────────────

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

  // ── Ghost seat (position exists but no player) ──────────────────────────
  if (!isSitting) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-[0.18] pointer-events-none select-none">
        <div className="flex gap-0.5">
          <div className="h-9 w-6 rounded border border-white/10" />
          <div className="h-9 w-6 rounded border border-white/10" />
        </div>
        <div className="px-2 py-0.5 rounded border border-white/8 text-[9px] text-white/30 font-bold uppercase tracking-wider">
          {position}
        </div>
      </div>
    );
  }

  // ── Active glow ring ────────────────────────────────────────────────────
  const ringClass = isActive
    ? isHero
      ? "animate-glow-pulse ring-1 ring-poker-green/60"
      : "ring-1 ring-yellow-400/35"
    : "";

  // ── Overall seat dimming ─────────────────────────────────────────────────
  // During fold animation we keep full opacity briefly, then dim after.
  const wrapperClass = cn(
    "relative flex flex-col items-center gap-1 select-none transition-all duration-500",
    isFolded && !isFolding && "opacity-30 grayscale"
  );

  // ── Pill style ───────────────────────────────────────────────────────────
  const pillClass = cn(
    "flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all duration-300",
    isHero
      ? isActive
        ? "border-poker-green/60 bg-[#0d1f12]/85 text-poker-green"
        : "border-poker-green/25 bg-[#0d1f12]/60 text-poker-green/70"
      : isActive
        ? "border-yellow-400/25 bg-white/6 text-white/70"
        : isFolded
          ? "border-white/6 bg-transparent text-white/28"
          : "border-white/10 bg-black/30 text-white/45"
  );

  // ── Card display ─────────────────────────────────────────────────────────
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
    <div className={wrapperClass}>
      {/* ── Action badge ─────────────────────────────────────────────────── */}
      {actionVerb && (
        <div
          key={actionKey}
          className={cn(
            "absolute -top-7 left-1/2 -translate-x-1/2 z-20",
            "whitespace-nowrap px-2 py-0.5 rounded-full",
            "text-[10px] font-extrabold tracking-wide uppercase shadow-lg",
            "animate-action-pop",
            actionRating ? BADGE_STYLE[actionRating] : BADGE_STYLE.default
          )}
        >
          {actionVerb}
          {actionAmount ? ` ${actionAmount}` : ""}
        </div>
      )}

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex gap-0.5 rounded-sm transition-all duration-300",
          ringClass,
          isActive && isHero && "scale-105",
          isFolding && "animate-card-muck"
        )}
      >
        {renderCards()}
      </div>

      {/* ── Name + position pill ─────────────────────────────────────────── */}
      <div className={pillClass}>
        {isFolded && !isFolding && (
          <span className="text-red-400/50 mr-0.5">✕</span>
        )}
        {playerName ? (
          <>
            <span className="max-w-[52px] truncate">{playerName}</span>
            <span className="text-white/15 mx-px">·</span>
            <span className={isHero ? "text-poker-green/50" : "text-white/28"}>
              {position}
            </span>
          </>
        ) : (
          <span>{position}</span>
        )}
      </div>
    </div>
  );
}

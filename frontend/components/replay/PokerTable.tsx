"use client";

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";
import type { ReplayAction } from "@/lib/types";
import type { VisibleBoard } from "@/hooks/useReplay";

interface PokerTableProps {
  seats: SeatDescriptor[];
  visibleBoard: VisibleBoard;
  currentAction: ReplayAction | null;
  currentPot: number;
  currentStep: number;
  bigBlind?: number;  // non-zero for tournament hands; enables chip display
}

const ACTION_BADGE_CLS: Record<string, string> = {
  good:    "bg-emerald-500/90 text-black",
  okay:    "bg-amber-400/90 text-black",
  mistake: "bg-rose-500/90 text-white",
  neutral: "bg-white/85 text-black",
};

const STREET_COLOR: Record<string, string> = {
  preflop: "rgba(56,189,248,0.55)",
  flop:    "rgba(34,197,94,0.55)",
  turn:    "rgba(251,191,36,0.55)",
  river:   "rgba(248,113,113,0.55)",
};

export function PokerTable({
  seats,
  visibleBoard,
  currentAction,
  currentPot,
  currentStep,
  bigBlind,
}: PokerTableProps) {
  const heroSeat = seats.find((s) => s.isHero);
  const opponentSeats = seats.filter((s) => !s.isHero);
  const actingPlayer = currentAction?.player ?? null;
  const currentStreet = currentAction?.street ?? "preflop";

  const allBoardCards = [
    ...visibleBoard.flop,
    ...visibleBoard.turn,
    ...visibleBoard.river,
  ];

  return (
    <div
      className="flex flex-col items-center w-full select-none"
      style={{ gap: "clamp(28px, 5vh, 56px)", padding: "clamp(24px, 4vh, 48px) 16px" }}
    >

      {/* ── Opponents row ───────────────────────────────────────────────── */}
      {opponentSeats.length > 0 && (
        <div className="flex items-end justify-center gap-5 sm:gap-8 flex-wrap">
          {opponentSeats.map((seat, i) => {
            const isActing = !!seat.playerName && seat.playerName === actingPlayer;
            const isFoldedPast = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
            const isFoldingNow = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;
            const showBadge = isActing && !!currentAction;
            const badgeRating = showBadge
              ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
              : undefined;

            return (
              <div
                key={i}
                className={cn(
                  "relative flex flex-col items-center gap-2 transition-all duration-500",
                  !seat.isSitting && "opacity-[0.055] pointer-events-none",
                  isFoldedPast && !isFoldingNow && "opacity-[0.22] grayscale",
                )}
              >
                {showBadge && (
                  <div
                    key={currentStep}
                    className={cn(
                      "absolute -top-6 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap",
                      "px-2 py-px rounded-full text-[9px] font-bold shadow-md animate-action-pop",
                      badgeRating ? ACTION_BADGE_CLS[badgeRating] : ACTION_BADGE_CLS.neutral
                    )}
                  >
                    {currentAction!.action}
                    {currentAction!.amount ? ` ${currentAction!.amount}` : ""}
                  </div>
                )}

                <div
                  className={cn("flex gap-1 transition-all duration-300", isFoldingNow && "animate-card-muck")}
                  style={isActing ? { filter: "drop-shadow(0 0 10px rgba(251,191,36,0.2))", transform: "scale(1.05)" } : {}}
                >
                  {seat.cardsKnown && seat.cards.length > 0
                    ? seat.cards.map((c, j) => <PlayingCard key={j} card={c} size="sm" />)
                    : [<CardBack key={0} size="sm" />, <CardBack key={1} size="sm" />]}
                </div>

                <span
                  className="text-[9px] font-medium tracking-wide transition-colors duration-300"
                  style={{ color: isActing ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)" }}
                >
                  {seat.position}
                </span>
                {seat.stack_bb !== undefined && (
                  <span className="text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.13)" }}>
                    {seat.stack_bb.toFixed(0)}bb
                    {bigBlind && bigBlind > 1 && (
                      <span style={{ color: "rgba(255,255,255,0.07)" }}>
                        {" "}· {Math.round(seat.stack_bb * bigBlind).toLocaleString()}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Board / community cards ─────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        {currentStep >= 0 && allBoardCards.length > 0 && (
          <span
            className="text-[8px] uppercase tracking-[0.28em] font-semibold transition-all duration-500"
            style={{ color: STREET_COLOR[currentStreet] }}
          >
            {currentStreet}
          </span>
        )}

        <div className="flex gap-2.5 sm:gap-3 items-center">
          {allBoardCards.length > 0
            ? allBoardCards.map((card, i) => (
                <PlayingCard key={`${card}-${i}`} card={card} size="md" />
              ))
            : Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="h-[68px] w-[48px] rounded-[5px]"
                  style={{
                    background: "rgba(255,255,255,0.022)",
                    border: "1px solid rgba(255,255,255,0.055)",
                  }}
                />
              ))}
        </div>

        {currentPot > 0 && currentStep >= 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="h-1 w-1 rounded-full" style={{ background: "rgba(255,255,255,0.28)" }} />
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: "rgba(248,250,252,0.48)" }}
            >
              {currentPot.toFixed(1)}
              <span className="font-normal ml-0.5" style={{ color: "rgba(148,163,184,0.28)" }}>
                bb
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Hero zone ───────────────────────────────────────────────────── */}
      {heroSeat && (
        <HeroZone
          seat={heroSeat}
          actingPlayer={actingPlayer}
          currentAction={currentAction}
          currentStep={currentStep}
          bigBlind={bigBlind}
        />
      )}
    </div>
  );
}

// ── Hero zone ────────────────────────────────────────────────────────────────

function HeroZone({
  seat,
  actingPlayer,
  currentAction,
  currentStep,
  bigBlind,
}: {
  seat: SeatDescriptor;
  actingPlayer: string | null;
  currentAction: ReplayAction | null;
  currentStep: number;
  bigBlind?: number;
}) {
  const isActing = !!seat.playerName && seat.playerName === actingPlayer;
  const isFoldedPast = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
  const isFoldingNow = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;
  const showBadge = isActing && !!currentAction;
  const badgeRating = showBadge
    ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
    : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-3 transition-all duration-500",
        isFoldedPast && !isFoldingNow && "opacity-30 grayscale",
      )}
    >
      {showBadge && (
        <div
          key={currentStep}
          className={cn(
            "absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap",
            "px-3 py-1 rounded-full text-[10px] font-bold shadow-lg animate-action-pop",
            badgeRating ? ACTION_BADGE_CLS[badgeRating] : ACTION_BADGE_CLS.neutral
          )}
        >
          {currentAction!.action}
          {currentAction!.amount ? ` ${currentAction!.amount}` : ""}
        </div>
      )}

      <div
        className={cn("flex gap-2 transition-all duration-300", isFoldingNow && "animate-card-muck")}
        style={
          isActing
            ? {
                filter: "drop-shadow(0 0 22px rgba(34,197,94,0.18)) drop-shadow(0 0 44px rgba(34,197,94,0.06))",
                transform: "scale(1.04)",
              }
            : {}
        }
      >
        {seat.cards.length > 0
          ? seat.cards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
          : [<CardBack key={0} size="lg" />, <CardBack key={1} size="lg" />]}
      </div>

      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300"
        style={{
          background: isActing ? "rgba(18, 36, 24, 0.85)" : "rgba(14, 20, 16, 0.65)",
          border: isActing
            ? "1px solid rgba(34,197,94,0.32)"
            : "1px solid rgba(34,197,94,0.10)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[6px] font-bold flex-shrink-0"
          style={{ background: "rgba(34,197,94,0.18)", color: "rgba(34,197,94,0.8)" }}
        >
          {seat.playerName?.[0]?.toUpperCase() ?? "Y"}
        </div>
        <span
          className="text-[9px] font-semibold tracking-wide"
          style={{ color: isActing ? "rgba(34,197,94,0.85)" : "rgba(34,197,94,0.4)" }}
        >
          YOU
        </span>
        <div className="w-px h-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-[9px] font-medium" style={{ color: "rgba(148,163,184,0.4)" }}>
          {seat.position}
        </span>
        {seat.stack_bb !== undefined && (
          <>
            <div className="w-px h-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[9px] font-medium tabular-nums" style={{ color: "rgba(148,163,184,0.3)" }}>
              {seat.stack_bb.toFixed(1)}bb
            </span>
            {bigBlind && bigBlind > 1 && (
              <span className="text-[8px]" style={{ color: "rgba(148,163,184,0.18)" }}>
                {Math.round(seat.stack_bb * bigBlind).toLocaleString()}c
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

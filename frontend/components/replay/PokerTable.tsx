"use client";

import { cn } from "@/lib/utils";
import { PlayingCard } from "@/components/poker/PlayingCard";
import { PlayerSeat } from "./PlayerSeat";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";
import { SEAT_COORDS } from "@/lib/replay/positions";
import type { ReplayAction } from "@/lib/types";
import type { VisibleBoard } from "@/hooks/useReplay";

interface PokerTableProps {
  seats: SeatDescriptor[];
  visibleBoard: VisibleBoard;
  currentAction: ReplayAction | null;
  currentPot: number;
  currentStep: number;
}

const STREET_HUE: Record<string, string> = {
  preflop: "rgba(56,189,248,0.38)",
  flop:    "rgba(34,197,94,0.38)",
  turn:    "rgba(251,191,36,0.38)",
  river:   "rgba(248,113,113,0.38)",
};

export function PokerTable({
  seats,
  visibleBoard,
  currentAction,
  currentPot,
  currentStep,
}: PokerTableProps) {
  const N = seats.length;
  const coords = SEAT_COORDS[N] ?? SEAT_COORDS[6];
  const currentStreet = currentAction?.street ?? "preflop";

  const allBoardCards = [
    ...visibleBoard.flop,
    ...visibleBoard.turn,
    ...visibleBoard.river,
  ];

  const actingPlayer = currentAction?.player ?? null;

  return (
    <div className="relative w-full max-w-3xl mx-auto" style={{ paddingBottom: "62%" }}>
      <div className="absolute inset-0">

        {/* ── Abstract table surface ────────────────────────────────────── */}
        {/* Base dark oval — gives the table a subtle sense of surface */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "7% 4%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 42%, #111827 0%, #0d1420 55%, transparent 82%)",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.5)",
          }}
        />
        {/* Subtle green haze on top */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "7% 4%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 35%, rgba(34,197,94,0.04) 0%, transparent 55%)",
          }}
        />

        {/* ── Center: street label + board cards + pot ──────────────────── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">

          {/* Street label */}
          {currentStep >= 0 && (
            <span
              className="text-[8px] uppercase font-semibold tracking-[0.3em] transition-all duration-700"
              style={{ color: STREET_HUE[currentStreet] }}
            >
              {currentStreet}
            </span>
          )}

          {/* Board cards */}
          <div className="flex gap-2.5 items-center">
            {allBoardCards.map((card, i) => (
              <PlayingCard key={`${card}-${i}`} card={card} size="md" />
            ))}
            {allBoardCards.length === 0 && currentStep < 0 &&
              [0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[68px] w-[48px] rounded-[5px]"
                  style={{
                    background: "rgba(255,255,255,0.018)",
                    border: "1px solid rgba(255,255,255,0.055)",
                  }}
                />
              ))
            }
          </div>

          {/* Pot */}
          {currentPot > 0 && currentStep >= 0 && (
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white/38" />
              <span
                className="text-[11px] font-semibold tabular-nums tracking-tight"
                style={{ color: "rgba(248,250,252,0.65)" }}
              >
                {currentPot.toFixed(1)}
                <span className="font-normal ml-0.5" style={{ color: "rgba(148,163,184,0.35)" }}>bb</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Player seats ──────────────────────────────────────────────── */}
        {seats.map((seat, i) => {
          const coord = coords[i];
          if (!coord) return null;

          const isActing = seat.playerName !== null && seat.playerName === actingPlayer;
          const isFoldedAlready = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
          const isFoldingNow = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;
          const showBadge = isActing && !!currentAction;
          const actionVerb = showBadge ? currentAction!.action : undefined;
          const actionAmount = showBadge ? currentAction!.amount : undefined;
          const actionRating =
            showBadge && seat.isHero
              ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
              : undefined;

          return (
            <div
              key={i}
              className="absolute z-10"
              style={{
                left: coord.x,
                top: coord.y,
                transform: `translate(${coord.tx}, ${coord.ty})`,
              }}
            >
              <PlayerSeat
                descriptor={seat}
                isActive={isActing}
                isFolded={isFoldedAlready || isFoldingNow}
                isFolding={isFoldingNow}
                actionVerb={actionVerb}
                actionAmount={actionAmount}
                actionRating={actionRating}
                actionKey={currentStep}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

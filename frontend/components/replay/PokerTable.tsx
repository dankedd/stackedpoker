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

const STREET_COLOR: Record<string, string> = {
  preflop: "text-blue-400/40",
  flop:    "text-emerald-400/40",
  turn:    "text-amber-400/40",
  river:   "text-red-400/40",
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
    <div className="relative w-full max-w-2xl mx-auto" style={{ paddingBottom: "62%" }}>
      <div className="absolute inset-0">

        {/* Ambient depth glow — no hard border, just soft presence */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "7% 4%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 38%, rgba(34,197,94,0.055) 0%, rgba(15,22,40,0.28) 50%, transparent 72%)",
            boxShadow: "0 16px 60px rgba(0,0,0,0.45)",
          }}
        />
        {/* Hairline oval outline */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "7% 4%",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        />

        {/* ── Center: street label + board cards + pot ──────────────────── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* Street label */}
          {currentStep >= 0 && (
            <span
              className={cn(
                "text-[8px] uppercase font-bold tracking-[0.32em] transition-colors duration-500",
                STREET_COLOR[currentStreet]
              )}
            >
              {currentStreet}
            </span>
          )}

          {/* Board cards */}
          <div className="flex gap-2 items-center">
            {allBoardCards.map((card, i) => (
              <PlayingCard key={`${card}-${i}`} card={card} size="md" />
            ))}
            {allBoardCards.length === 0 && currentStep < 0 &&
              [0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[68px] w-[48px] rounded-[5px] border border-white/5"
                  style={{ background: "rgba(255,255,255,0.012)" }}
                />
              ))
            }
          </div>

          {/* Pot chip */}
          {currentPot > 0 && currentStep >= 0 && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1"
              style={{
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="text-[11px] font-bold text-white/68 tabular-nums tracking-tight">
                {currentPot.toFixed(1)}
                <span className="text-white/26 font-normal ml-0.5">bb</span>
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

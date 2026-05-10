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

const STREET_LABEL_COLOR: Record<string, string> = {
  preflop: "text-blue-400/55",
  flop:    "text-emerald-400/55",
  turn:    "text-orange-400/55",
  river:   "text-red-400/55",
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

  // Build a fast lookup: playerName → action info for this step
  const actingPlayer = currentAction?.player ?? null;

  // Which players are folded up to (but not including) this step
  // and which is folding right now
  const foldedSet = new Set<string>();
  // foldedAtStep is pre-computed per seat in SeatDescriptor

  return (
    <div className="relative w-full max-w-2xl mx-auto" style={{ paddingBottom: "62%" }}>
      <div className="absolute inset-0">

        {/* ── Wood rim ──────────────────────────────────────────────────────── */}
        <div
          className="absolute"
          style={{
            inset: "10% 5%",
            borderRadius: "50%",
            background:
              "linear-gradient(160deg, #9c7248 0%, #6b4c2a 40%, #3d2710 100%)",
            boxShadow:
              "0 28px 90px rgba(0,0,0,0.96), 0 0 0 2px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
            padding: "10px",
          }}
        >
          {/* ── Felt ──────────────────────────────────────────────────────── */}
          <div
            className="relative h-full overflow-hidden"
            style={{
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at 50% 35%, #1f6642 0%, #13482d 45%, #0c3320 80%, #081f14 100%)",
              boxShadow: "inset 0 0 90px rgba(0,0,0,0.6)",
            }}
          >
            {/* Decorative inner ring */}
            <div
              className="absolute pointer-events-none"
              style={{
                inset: "8%",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.045)",
              }}
            />

            {/* ── Table center: street + board + pot ─────────────────────── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              {/* Street label */}
              {currentStep >= 0 && (
                <span
                  className={cn(
                    "text-[9px] uppercase font-bold tracking-[0.22em] transition-colors duration-500",
                    STREET_LABEL_COLOR[currentStreet]
                  )}
                >
                  {currentStreet}
                </span>
              )}

              {/* Board cards */}
              <div className="flex gap-1.5 min-h-[34px] items-center">
                {allBoardCards.map((card, i) => (
                  <PlayingCard key={`${card}-${i}`} card={card} size="sm" />
                ))}
                {allBoardCards.length === 0 && currentStep < 0 && (
                  // Pre-deal: show placeholder slots
                  [0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-[34px] w-[24px] rounded border border-white/6"
                      style={{ background: "rgba(255,255,255,0.018)" }}
                    />
                  ))
                )}
              </div>

              {/* Pot */}
              {currentPot > 0 && currentStep >= 0 && (
                <div
                  className="flex items-center gap-1.5 rounded-full border border-yellow-600/20 px-3 py-1"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
                >
                  <span className="text-sm leading-none">🪙</span>
                  <span className="text-[11px] font-extrabold text-yellow-300 tabular-nums tracking-tight">
                    {currentPot.toFixed(1)}
                    <span className="text-yellow-500/55 font-normal ml-0.5">bb</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Player seats ──────────────────────────────────────────────────── */}
        {seats.map((seat, i) => {
          const coord = coords[i];
          if (!coord) return null;

          const isActing = seat.playerName !== null && seat.playerName === actingPlayer;
          const isFoldedAlready =
            seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
          const isFoldingNow =
            seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;

          // Action badge info — only shown on the seat that's currently acting
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

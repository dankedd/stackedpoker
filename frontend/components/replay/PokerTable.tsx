"use client";

import { PlayingCard } from "@/components/poker/PlayingCard";
import { PokerSeat } from "@/components/poker/PokerSeat";
import { SEAT_COORDS } from "@/lib/replay/positions";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";
import type { ReplayAction, SidePot } from "@/lib/types";
import type { VisibleBoard } from "@/hooks/useReplay";

// ── Public types ──────────────────────────────────────────────────────────────

export interface PokerTableProps {
  seats: SeatDescriptor[];
  visibleBoard: VisibleBoard;
  currentAction: ReplayAction | null;
  currentPot: number;
  currentStep: number;
  bigBlind?: number;
  currentHeroStack?: number | null;
  currentVillainStack?: number | null;
  playerStacksAfter?: Record<string, number>;
  allInPlayers?: string[];
  sidePots?: SidePot[];
}

// ── Design tokens (exported so consumers can match them) ──────────────────────

export const STREET_COLOR: Record<string, string> = {
  preflop: "#38BDF8",
  flop:    "#34D399",
  turn:    "#FBBF24",
  river:   "#F87171",
};

const IS_DEV = process.env.NODE_ENV === "development";

function fmtStack(bb: number): string {
  return bb % 1 === 0 ? `${bb}bb` : `${bb.toFixed(1)}bb`;
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * PokerTable — canonical oval table renderer for HandReplay.
 *
 * Compact proportions: 700px max-width, 58% aspect ratio.
 * Hero is always seat 0 at bottom-center.
 * Board cards, pot badge, and all seats share the same design tokens
 * as the puzzle flat layout (pot badge, typography, card sizes).
 */
export function PokerTable({
  seats,
  visibleBoard,
  currentAction,
  currentPot,
  currentStep,
  bigBlind,
  currentHeroStack,
  currentVillainStack,
  playerStacksAfter,
  allInPlayers = [],
  sidePots = [],
}: PokerTableProps) {
  const N             = seats.length;
  const tableCoords   = SEAT_COORDS[N] ?? SEAT_COORDS[6];
  const actingPlayer  = currentAction?.player ?? null;
  const currentStreet = currentAction?.street ?? "preflop";
  const streetColor   = STREET_COLOR[currentStreet] ?? "#38BDF8";

  const allBoardCards = [
    ...visibleBoard.flop,
    ...visibleBoard.turn,
    ...visibleBoard.river,
  ];

  return (
    /**
     * Compact oval: 700px max-width, 58% padding-bottom (≈ 12:7 ratio).
     * Feels closer to the puzzle's focused table, not an empty arena.
     */
    <div
      className="relative w-full select-none mx-auto"
      style={{ paddingBottom: "58%", maxWidth: "700px" }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 50% 48%, rgba(6,18,10,0.60) 0%, rgba(0,0,0,0) 70%)",
        }}
      >
        {/* ── Felt oval — more visible than before ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "82%",
            height: "76%",
            top: "46%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(8,26,14,0.70) 0%, rgba(4,14,7,0.42) 55%, rgba(0,0,0,0) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.4)",
          }}
        />

        {/* ── Community cards + pot — absolute center ── */}
        <div
          className="absolute z-10 flex flex-col items-center gap-2.5"
          style={{ left: "50%", top: "43%", transform: "translate(-50%, -50%)" }}
        >
          {/* Street label */}
          {currentStep >= 0 && allBoardCards.length > 0 && (
            <span
              className="text-[9px] uppercase tracking-[0.32em] font-black transition-all duration-500"
              style={{ color: streetColor, opacity: 0.65 }}
            >
              {currentStreet}
            </span>
          )}

          {/* Board cards */}
          <div className="flex gap-1.5 sm:gap-2 items-center">
            {allBoardCards.length > 0
              ? allBoardCards.map((card, i) => (
                  <PlayingCard key={`${card}-${i}`} card={card} size="sm" />
                ))
              : Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[48px] w-[34px] rounded-[5px]"
                    style={{
                      background: "rgba(255,255,255,0.016)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  />
                ))}
          </div>

          {/* Pot badge — identical tokens to puzzle PotDisplay */}
          {currentPot > 0 && currentStep >= 0 && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "rgba(251,191,36,0.55)" }} />
              <span className="text-[12px] font-black tabular-nums" style={{ color: "rgba(253,230,138,0.75)" }}>
                Pot:{" "}
                <span style={{ color: "rgba(253,230,138,0.92)" }}>{fmtStack(currentPot)}</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Seats ── */}
        {seats.map((seat) => {
          if (!seat.isSitting) return null;
          const coord = tableCoords[seat.seatIndex];
          if (!coord) return null;

          const liveStack =
            playerStacksAfter && seat.playerName && playerStacksAfter[seat.playerName] != null
              ? playerStacksAfter[seat.playerName]
              : seat.isHero && currentHeroStack != null
              ? currentHeroStack
              : !seat.isHero && seat.seatIndex === 1 && currentVillainStack != null
              ? currentVillainStack
              : seat.stack_bb;

          const isAllIn = !!seat.playerName && allInPlayers.includes(seat.playerName);

          return (
            <div
              key={seat.seatIndex}
              className="absolute z-10"
              style={{ left: coord.x, top: coord.y, transform: `translate(${coord.tx}, ${coord.ty})` }}
            >
              {IS_DEV && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    top: 0, left: "50%", transform: "translate(-50%, -100%)",
                    background: "rgba(0,0,0,0.82)", border: "1px solid rgba(251,191,36,0.45)",
                    borderRadius: "4px", padding: "2px 6px", fontSize: "9px",
                    fontFamily: "monospace", color: "rgba(251,191,36,0.9)",
                    whiteSpace: "nowrap", lineHeight: 1.6,
                  }}
                >
                  <div>#{seat.seatIndex} · {seat.position}</div>
                  <div>{coord.x},{coord.y}</div>
                  <div>pf:{seat.preflopOrder} po:{seat.postflopOrder}</div>
                </div>
              )}
              <PokerSeat
                seat={seat}
                actingPlayer={actingPlayer}
                currentAction={currentAction}
                currentStep={currentStep}
                bigBlind={bigBlind}
                liveStack={liveStack}
                isAllIn={isAllIn}
                flipLayout={coord.ty === "0%"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

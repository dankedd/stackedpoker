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
  /** Dynamic hero stack after the current action (from pot engine). */
  currentHeroStack?: number | null;
  /** Dynamic primary villain stack after the current action (from pot engine). */
  currentVillainStack?: number | null;
  /** Full player stack map keyed by player name (preferred over the above). */
  playerStacksAfter?: Record<string, number>;
  /** Cumulative list of all-in players at the current step. */
  allInPlayers?: string[];
  /** Active side pots (non-empty only in multiway all-in hands). */
  sidePots?: SidePot[];
}

// ── Street color tokens ───────────────────────────────────────────────────────

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
 * PokerTable — canonical oval table renderer.
 *
 * Seat 0 is always the hero at bottom-center.
 * Seats 1..N-1 are opponents clockwise around the oval.
 * Seat rendering is delegated to the shared PokerSeat component.
 *
 * paddingBottom: 65% → 8:5 aspect ratio.
 * All seats are absolutely positioned via SEAT_COORDS percentages.
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
  const N            = seats.length;
  const tableCoords  = SEAT_COORDS[N] ?? SEAT_COORDS[6];
  const actingPlayer = currentAction?.player ?? null;
  const currentStreet = currentAction?.street ?? "preflop";
  const streetColor   = STREET_COLOR[currentStreet] ?? "#38BDF8";

  const allBoardCards = [
    ...visibleBoard.flop,
    ...visibleBoard.turn,
    ...visibleBoard.river,
  ];

  return (
    <div
      className="relative w-full select-none mx-auto"
      style={{ paddingBottom: "65%", maxWidth: "840px" }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(10,28,18,0.55) 0%, rgba(0,0,0,0) 72%)",
        }}
      >
        {/* Felt oval */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "80%", height: "74%",
            top: "46%", left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(12,34,20,0.45) 0%, rgba(6,18,10,0.25) 55%, rgba(0,0,0,0) 100%)",
            border: "1px solid rgba(255,255,255,0.025)",
          }}
        />

        {/* ── Community cards + pot — absolute center ── */}
        <div
          className="absolute z-10 flex flex-col items-center gap-3"
          style={{ left: "50%", top: "44%", transform: "translate(-50%, -50%)" }}
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
          <div className="flex gap-2 sm:gap-2.5 items-center">
            {allBoardCards.length > 0
              ? allBoardCards.map((card, i) => (
                  <PlayingCard key={`${card}-${i}`} card={card} size="md" />
                ))
              : Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[64px] w-[46px] rounded-[6px]"
                    style={{
                      background: "rgba(255,255,255,0.018)",
                      border: "1px solid rgba(255,255,255,0.045)",
                    }}
                  />
                ))}
          </div>

          {/* Pot badge */}
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
                    top: 0,
                    left: "50%",
                    transform: "translate(-50%, -100%)",
                    background: "rgba(0,0,0,0.82)",
                    border: "1px solid rgba(251,191,36,0.45)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "9px",
                    fontFamily: "monospace",
                    color: "rgba(251,191,36,0.9)",
                    whiteSpace: "nowrap",
                    lineHeight: 1.6,
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

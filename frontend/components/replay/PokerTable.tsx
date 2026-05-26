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
  /** Villain bet/raise that hero is responding to — kept visible on table. */
  pendingAggression?: ReplayAction | null;
  /** All actions in the hand (for computing per-seat last-action indicators). */
  actions?: ReplayAction[];
}

// ── Design tokens (exported so consumers can match them) ──────────────────────

export const STREET_COLOR: Record<string, string> = {
  preflop: "#38BDF8",
  flop:    "#34D399",
  turn:    "#FBBF24",
  river:   "#F87171",
};

const IS_DEV = process.env.NODE_ENV === "development";

function fmtStack(bb: number | string): string {
  // Defensive: strip any existing "bb" suffix to prevent "5bbbb"
  const num = typeof bb === "string" ? parseFloat(String(bb).replace(/bb$/i, "")) : bb;
  if (isNaN(num)) return "0bb";
  return num % 1 === 0 ? `${num}bb` : `${num.toFixed(1)}bb`;
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
  pendingAggression = null,
  actions = [],
}: PokerTableProps) {
  const N             = seats.length;
  const tableCoords   = SEAT_COORDS[N] ?? SEAT_COORDS[6];
  const actingPlayer  = currentAction?.player ?? null;
  const currentStreet = currentAction?.street ?? "preflop";
  const streetColor   = STREET_COLOR[currentStreet] ?? "#38BDF8";
  const aggressorPlayer = pendingAggression?.player ?? null;

  // Build per-player last action map from actions applied so far (0..step-1)
  const lastActionMap = new Map<string, ReplayAction>();
  for (let i = 0; i < currentStep && i < actions.length; i++) {
    lastActionMap.set(actions[i].player, actions[i]);
  }

  const allBoardCards = [
    ...visibleBoard.flop,
    ...visibleBoard.turn,
    ...visibleBoard.river,
  ];

  return (
    /**
     * Compact oval: 560px max-width, 54% padding-bottom (≈ 2:1 ratio).
     * Fits comfortably in the 60% left column of the split workspace.
     */
    <div
      className="relative w-full select-none mx-auto"
      style={{ paddingBottom: "54%", maxWidth: "560px" }}
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
          {currentStep > 0 && allBoardCards.length > 0 && (
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

          {/* Pot badge — canonical amber tokens matching puzzle's pot badge */}
          {currentPot > 0 && currentStep > 0 && (
            <div
              className="flex items-center gap-1.5 h-6 px-3 rounded-full shrink-0 transition-all duration-300"
              style={{
                background: "rgba(251,191,36,0.07)",
                border: "1px solid rgba(251,191,36,0.18)",
                boxShadow: "0 0 10px rgba(251,191,36,0.06)",
              }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400/50 shrink-0" />
              <span className="text-[11px] font-black text-amber-300/80 tabular-nums leading-none">
                Pot: {fmtStack(currentPot)}
              </span>
            </div>
          )}

          {/* ── Facing aggression banner — table level ── */}
          {/* Renders directly on the table when hero faces a villain bet/shove.
              This is independent of the seat prop chain — guaranteed visible. */}
          {pendingAggression && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.35)",
                boxShadow: "0 0 20px rgba(248,113,113,0.15), 0 0 50px rgba(248,113,113,0.06)",
              }}
            >
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  background: "#F87171",
                  boxShadow: "0 0 6px rgba(248,113,113,0.6)",
                  animation: "glow-pulse 1.8s ease-in-out infinite",
                }}
              />
              <span className="text-[10px] font-black tracking-wide text-rose-300/90 uppercase">
                {pendingAggression.player}
                {" "}
                {pendingAggression.is_all_in ? "ALL-IN" : pendingAggression.action}
              </span>
              {pendingAggression.amount && (
                <span className="text-[12px] font-black tabular-nums text-rose-200/95">
                  {pendingAggression.amount}
                </span>
              )}
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
                pendingAggression={
                  seat.playerName === aggressorPlayer ? pendingAggression : null
                }
                lastAction={
                  seat.playerName ? lastActionMap.get(seat.playerName) ?? null : null
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

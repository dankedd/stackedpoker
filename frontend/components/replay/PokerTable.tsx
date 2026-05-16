"use client";

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import { SEAT_COORDS } from "@/lib/replay/positions";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";
import type { ReplayAction, SidePot } from "@/lib/types";
import type { VisibleBoard } from "@/hooks/useReplay";

interface PokerTableProps {
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

const ACTION_BADGE_CLS: Record<string, string> = {
  good:    "bg-emerald-500/90 text-black",
  okay:    "bg-amber-400/90 text-black",
  mistake: "bg-rose-500/90 text-white",
  neutral: "bg-white/85 text-black",
};

const STREET_COLOR: Record<string, string> = {
  preflop: "#38BDF8",
  flop:    "#34D399",
  turn:    "#FBBF24",
  river:   "#F87171",
};

function fmtStack(bb: number): string {
  return bb % 1 === 0 ? `${bb}bb` : `${bb.toFixed(1)}bb`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

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
  const N = seats.length;
  // SEAT_COORDS[N] gives the oval position for seatIndex 0..N-1.
  // seatIndex 0 = hero (always bottom-center).
  // seatIndex 1..N-1 = opponents in clockwise order from hero.
  const tableCoords = SEAT_COORDS[N] ?? SEAT_COORDS[6];

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
     * Oval table container.
     *
     * paddingBottom: 65% creates height = 65% of width (≈ 8:5 aspect ratio).
     * All seats are absolutely positioned using SEAT_COORDS percentages, so
     * the layout is always correct regardless of container width.
     *
     * Seat 0 (hero) is at SEAT_COORDS[N][0] = (50%, 93%) — always bottom-center.
     * Seat 1 is to hero's left, seats progress clockwise around the oval.
     */
    <div
      className="relative w-full select-none mx-auto"
      style={{ paddingBottom: "65%", maxWidth: "840px" }}
    >
      {/* ── Inner fill (makes absolute children respect the aspect ratio) ── */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(10,28,18,0.55) 0%, rgba(0,0,0,0) 72%)",
        }}
      >
        {/* Subtle felt oval */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "80%",
            height: "74%",
            top: "46%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(12,34,20,0.45) 0%, rgba(6,18,10,0.25) 55%, rgba(0,0,0,0) 100%)",
            border: "1px solid rgba(255,255,255,0.025)",
          }}
        />

        {/* ── Community cards + pot — absolute center ─────────────────────── */}
        <div
          className="absolute z-10 flex flex-col items-center gap-3"
          style={{
            left: "50%",
            top: "44%",
            transform: "translate(-50%, -50%)",
          }}
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

          {/* Pot */}
          {currentPot > 0 && currentStep >= 0 && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.55)" }}
              />
              <span
                className="text-[12px] font-black tabular-nums"
                style={{ color: "rgba(253,230,138,0.75)" }}
              >
                Pot:{" "}
                <span style={{ color: "rgba(253,230,138,0.92)" }}>
                  {fmtStack(currentPot)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Seats — each absolutely positioned using SEAT_COORDS ─────────── */}
        {seats.map((seat) => {
          // Ghost seats (empty table positions) are invisible but preserve topology.
          if (!seat.isSitting) return null;

          const coord = tableCoords[seat.seatIndex];
          if (!coord) return null;

          // Preferred: generalized stack map (new backend). Fallback: legacy fields.
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
              style={{
                left: coord.x,
                top: coord.y,
                transform: `translate(${coord.tx}, ${coord.ty})`,
              }}
            >
              {seat.isHero ? (
                <HeroZone
                  seat={seat}
                  actingPlayer={actingPlayer}
                  currentAction={currentAction}
                  currentStep={currentStep}
                  bigBlind={bigBlind}
                  liveStack={liveStack}
                  isAllIn={isAllIn}
                />
              ) : (
                <OpponentPod
                  seat={seat}
                  actingPlayer={actingPlayer}
                  currentAction={currentAction}
                  currentStep={currentStep}
                  bigBlind={bigBlind}
                  liveStack={liveStack}
                  isAllIn={isAllIn}
                  // Top seats (ty="0%") render label above cards so cards
                  // always face toward the table center.
                  flipLayout={coord.ty === "0%"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OpponentPod
// flipLayout=true  → [label][cards]  (label at top, cards toward table center)
// flipLayout=false → [cards][label]  (cards at top, label at bottom edge)
// ─────────────────────────────────────────────────────────────────────────────

function OpponentPod({
  seat,
  actingPlayer,
  currentAction,
  currentStep,
  bigBlind,
  liveStack,
  isAllIn,
  flipLayout,
}: {
  seat: SeatDescriptor;
  actingPlayer: string | null;
  currentAction: ReplayAction | null;
  currentStep: number;
  bigBlind?: number;
  liveStack?: number;
  isAllIn: boolean;
  flipLayout: boolean;
}) {
  const isActing    = !!seat.playerName && seat.playerName === actingPlayer;
  const isFoldedPast  = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
  const isFoldingNow  = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;
  const showBadge   = isActing && !!currentAction;
  const badgeRating = showBadge
    ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
    : undefined;

  const cardSection = (
    <div
      className={cn(
        "flex gap-1.5 transition-all duration-300",
        isFoldingNow && "animate-card-muck",
      )}
      style={
        isActing
          ? {
              filter:
                "drop-shadow(0 0 14px rgba(251,191,36,0.28)) drop-shadow(0 0 6px rgba(251,191,36,0.12))",
              transform: "scale(1.08)",
            }
          : {}
      }
    >
      {seat.cardsKnown && seat.cards.length > 0
        ? seat.cards.map((c, j) => <PlayingCard key={j} card={c} size="sm" />)
        : [<CardBack key={0} size="sm" />, <CardBack key={1} size="sm" />]}
    </div>
  );

  const labelSection = (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all duration-300"
        style={
          isActing
            ? { background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)" }
            : { background: "transparent", border: "1px solid transparent" }
        }
      >
        <span
          className="text-[11px] font-bold tracking-wide transition-colors duration-300"
          style={{ color: isActing ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.28)" }}
        >
          {seat.position}
        </span>
        {isAllIn && (
          <span
            className="text-[9px] font-black px-1 py-0 rounded"
            style={{ background: "rgba(251,191,36,0.18)", color: "rgba(251,191,36,0.85)" }}
          >
            ALL-IN
          </span>
        )}
      </div>
      {liveStack !== undefined && (
        <span
          className="text-[10px] tabular-nums font-medium transition-all duration-300"
          style={{ color: isActing ? "rgba(251,191,36,0.55)" : "rgba(255,255,255,0.14)" }}
        >
          {fmtStack(liveStack)}
          {bigBlind && bigBlind > 1 && (
            <span style={{ color: "rgba(255,255,255,0.07)" }}>
              {" "}·{Math.round(liveStack * bigBlind).toLocaleString()}
            </span>
          )}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2.5 transition-all duration-500",
        isFoldedPast && !isFoldingNow && "opacity-[0.18] grayscale",
      )}
    >
      {/* Action badge — above pod for bottom seats, below pod for top seats */}
      {showBadge && (
        <div
          key={currentStep}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            flipLayout ? "-bottom-7" : "-top-7",
            "px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg animate-action-pop",
            badgeRating ? ACTION_BADGE_CLS[badgeRating] : ACTION_BADGE_CLS.neutral,
          )}
        >
          {currentAction!.action}
          {currentAction!.amount ? ` ${currentAction!.amount}` : ""}
        </div>
      )}

      {flipLayout ? (
        <>
          {labelSection}
          {cardSection}
        </>
      ) : (
        <>
          {cardSection}
          {labelSection}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroZone — always seat 0, always bottom-center
// ─────────────────────────────────────────────────────────────────────────────

function HeroZone({
  seat,
  actingPlayer,
  currentAction,
  currentStep,
  bigBlind,
  liveStack,
  isAllIn = false,
}: {
  seat: SeatDescriptor;
  actingPlayer: string | null;
  currentAction: ReplayAction | null;
  currentStep: number;
  bigBlind?: number;
  liveStack?: number;
  isAllIn?: boolean;
}) {
  const isActing    = !!seat.playerName && seat.playerName === actingPlayer;
  const isFoldedPast  = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep;
  const isFoldingNow  = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep;
  const showBadge   = isActing && !!currentAction;
  const badgeRating = showBadge
    ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
    : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 transition-all duration-500",
        isFoldedPast && !isFoldingNow && "opacity-25 grayscale",
      )}
    >
      {/* Action badge */}
      {showBadge && (
        <div
          key={currentStep}
          className={cn(
            "absolute -top-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            "px-3.5 py-1 rounded-full text-[11px] font-bold shadow-xl animate-action-pop",
            badgeRating ? ACTION_BADGE_CLS[badgeRating] : ACTION_BADGE_CLS.neutral,
          )}
        >
          {currentAction!.action}
          {currentAction!.amount ? ` ${currentAction!.amount}` : ""}
        </div>
      )}

      {/* Hero cards */}
      <div
        className={cn(
          "flex gap-2.5 transition-all duration-300",
          isFoldingNow && "animate-card-muck",
        )}
        style={
          isActing
            ? {
                filter:
                  "drop-shadow(0 0 28px rgba(34,197,94,0.22)) drop-shadow(0 0 52px rgba(34,197,94,0.08))",
                transform: "scale(1.06)",
              }
            : {}
        }
      >
        {seat.cards.length > 0
          ? seat.cards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
          : [<CardBack key={0} size="lg" />, <CardBack key={1} size="lg" />]}
      </div>

      {/* Hero HUD */}
      <div
        className="flex items-center gap-2.5 px-4 py-2 rounded-full transition-all duration-300"
        style={{
          background: isActing ? "rgba(16,38,24,0.92)" : "rgba(12,22,16,0.78)",
          border: isActing
            ? "1px solid rgba(34,197,94,0.42)"
            : "1px solid rgba(34,197,94,0.14)",
          boxShadow: isActing
            ? "0 0 20px rgba(34,197,94,0.14), 0 0 40px rgba(34,197,94,0.06)"
            : "none",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* YOU avatar */}
        <div
          className="flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-black flex-shrink-0"
          style={{
            background: isActing ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.14)",
            color: isActing ? "rgba(34,197,94,0.95)" : "rgba(34,197,94,0.65)",
          }}
        >
          {seat.playerName?.[0]?.toUpperCase() ?? "Y"}
        </div>

        <span
          className="text-[12px] font-black tracking-wide"
          style={{ color: isActing ? "rgba(34,197,94,0.95)" : "rgba(34,197,94,0.55)" }}
        >
          YOU
        </span>

        <div className="w-px h-3.5" style={{ background: "rgba(255,255,255,0.10)" }} />

        <span
          className="text-[11px] font-bold"
          style={{ color: isActing ? "rgba(255,255,255,0.65)" : "rgba(148,163,184,0.45)" }}
        >
          {seat.position}
        </span>

        {isAllIn && (
          <span
            className="text-[9px] font-black px-1.5 py-0 rounded"
            style={{ background: "rgba(251,191,36,0.18)", color: "rgba(251,191,36,0.85)" }}
          >
            ALL-IN
          </span>
        )}

        {liveStack !== undefined && (
          <>
            <div className="w-px h-3.5" style={{ background: "rgba(255,255,255,0.10)" }} />
            <span
              className="text-[12px] font-bold tabular-nums transition-all duration-300"
              style={{
                color: isActing ? "rgba(186,230,253,0.85)" : "rgba(148,163,184,0.42)",
              }}
            >
              {fmtStack(liveStack)}
            </span>
            {bigBlind && bigBlind > 1 && (
              <span
                className="text-[10px] tabular-nums"
                style={{ color: "rgba(148,163,184,0.22)" }}
              >
                ·{Math.round(liveStack * bigBlind).toLocaleString()}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * PokerSeat — canonical, reusable seat component.
 *
 * Used by: PokerTable (replay), puzzle player, future live trainer.
 * Design language: matches the puzzle system (violet hero, amber opponent).
 *
 * flipLayout=true  → label ABOVE cards  (seats at top of oval)
 * flipLayout=false → label BELOW cards  (seats at sides/bottom)
 */

import { cn } from "@/lib/utils";
import { PlayingCard, CardBack } from "@/components/poker/PlayingCard";
import type { SeatDescriptor } from "@/lib/replay/seatEngine";
import type { ReplayAction } from "@/lib/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  good:    "bg-emerald-500/90 text-black",
  okay:    "bg-amber-400/90 text-black",
  mistake: "bg-rose-500/90 text-white",
  neutral: "bg-white/85 text-black",
};

/** Hero uses violet to match the puzzle system's primary color. */
const HERO_ACTIVE_BG      = "rgba(16,8,42,0.92)";
const HERO_ACTIVE_BORDER  = "1px solid rgba(124,92,255,0.44)";
const HERO_ACTIVE_SHADOW  = "0 0 20px rgba(124,92,255,0.15), 0 0 40px rgba(124,92,255,0.06)";
const HERO_ACTIVE_GLOW    = "drop-shadow(0 0 28px rgba(124,92,255,0.22)) drop-shadow(0 0 52px rgba(124,92,255,0.08))";
const HERO_ACTIVE_TEXT    = "rgba(167,139,250,0.95)";  // violet-400
const HERO_ACTIVE_STACK   = "rgba(186,230,253,0.85)";
const HERO_IDLE_BG        = "rgba(12,6,30,0.78)";
const HERO_IDLE_BORDER    = "1px solid rgba(124,92,255,0.14)";
const HERO_IDLE_TEXT      = "rgba(124,92,255,0.55)";
const HERO_IDLE_STACK     = "rgba(148,163,184,0.42)";
const HERO_AVATAR_ACTIVE  = "rgba(124,92,255,0.25)";
const HERO_AVATAR_IDLE    = "rgba(124,92,255,0.14)";

const OPP_ACTIVE_GLOW   = "drop-shadow(0 0 14px rgba(251,191,36,0.28)) drop-shadow(0 0 6px rgba(251,191,36,0.12))";
const OPP_ACTIVE_BG     = "rgba(251,191,36,0.10)";
const OPP_ACTIVE_BORDER = "1px solid rgba(251,191,36,0.22)";
const OPP_ACTIVE_TEXT   = "rgba(251,191,36,0.9)";
const OPP_ACTIVE_STACK  = "rgba(251,191,36,0.55)";
const OPP_IDLE_TEXT     = "rgba(255,255,255,0.28)";
const OPP_IDLE_STACK    = "rgba(255,255,255,0.14)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtStack(bb: number): string {
  return bb % 1 === 0 ? `${bb}bb` : `${bb.toFixed(1)}bb`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PokerSeatProps {
  seat: SeatDescriptor;
  /** Name of the player who is currently acting (null = nobody). */
  actingPlayer?: string | null;
  currentAction?: ReplayAction | null;
  /** Step index used to determine fold states. */
  currentStep?: number;
  bigBlind?: number;
  /** Live stack override (from pot engine). Falls back to seat.stack_bb. */
  liveStack?: number;
  isAllIn?: boolean;
  /** true → render position label ABOVE cards (top-oval seats). */
  flipLayout?: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PokerSeat({
  seat,
  actingPlayer = null,
  currentAction = null,
  currentStep = 0,
  bigBlind,
  liveStack,
  isAllIn = false,
  flipLayout = false,
}: PokerSeatProps) {
  if (!seat.isSitting) return null;

  const isActing     = !!seat.playerName && seat.playerName === actingPlayer;
  // step=N means N actions applied; foldedAtStep is a 0-based action index.
  // The current action is actions[step-1].
  // isFoldingNow: fold IS the current action (foldedAtStep === step - 1)
  // isFoldedPast: fold happened before the current action (foldedAtStep < step - 1)
  // At step=0 (clean state): both are false — no fold visible.
  const isFoldedPast = seat.foldedAtStep !== null && seat.foldedAtStep < currentStep - 1;
  const isFoldingNow = seat.foldedAtStep !== null && seat.foldedAtStep === currentStep - 1;
  const showBadge    = isActing && !!currentAction;
  const badgeRating  = showBadge
    ? (currentAction!.feedback?.rating as "good" | "okay" | "mistake" | undefined)
    : undefined;
  const stack        = liveStack ?? seat.stack_bb;

  return seat.isHero
    ? (
      <HeroSeat
        seat={seat}
        isActing={isActing}
        isFoldedPast={isFoldedPast}
        isFoldingNow={isFoldingNow}
        showBadge={showBadge}
        badgeRating={badgeRating}
        currentAction={currentAction}
        currentStep={currentStep}
        bigBlind={bigBlind}
        stack={stack}
        isAllIn={isAllIn}
      />
    ) : (
      <OpponentSeat
        seat={seat}
        isActing={isActing}
        isFoldedPast={isFoldedPast}
        isFoldingNow={isFoldingNow}
        showBadge={showBadge}
        badgeRating={badgeRating}
        currentAction={currentAction}
        currentStep={currentStep}
        bigBlind={bigBlind}
        stack={stack}
        isAllIn={isAllIn}
        flipLayout={flipLayout}
      />
    );
}

// ── HeroSeat ──────────────────────────────────────────────────────────────────

function HeroSeat({
  seat,
  isActing,
  isFoldedPast,
  isFoldingNow,
  showBadge,
  badgeRating,
  currentAction,
  currentStep,
  bigBlind,
  stack,
  isAllIn,
}: {
  seat: SeatDescriptor;
  isActing: boolean;
  isFoldedPast: boolean;
  isFoldingNow: boolean;
  showBadge: boolean;
  badgeRating?: "good" | "okay" | "mistake";
  currentAction: ReplayAction | null;
  currentStep: number;
  bigBlind?: number;
  stack?: number;
  isAllIn: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 transition-all duration-500",
        isFoldedPast && !isFoldingNow && "opacity-25 grayscale",
      )}
    >
      {/* Action badge — pops above hero */}
      {showBadge && (
        <div
          key={currentStep}
          className={cn(
            "absolute -top-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            "px-3.5 py-1 rounded-full text-[11px] font-bold shadow-xl animate-action-pop",
            badgeRating ? ACTION_BADGE[badgeRating] : ACTION_BADGE.neutral,
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
            ? { filter: HERO_ACTIVE_GLOW, transform: "scale(1.06)" }
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
          background: isActing ? HERO_ACTIVE_BG     : HERO_IDLE_BG,
          border:     isActing ? HERO_ACTIVE_BORDER  : HERO_IDLE_BORDER,
          boxShadow:  isActing ? HERO_ACTIVE_SHADOW  : "none",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Avatar */}
        <div
          className="flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-black flex-shrink-0"
          style={{
            background: isActing ? HERO_AVATAR_ACTIVE : HERO_AVATAR_IDLE,
            color: isActing ? HERO_ACTIVE_TEXT : HERO_IDLE_TEXT,
          }}
        >
          {seat.playerName?.[0]?.toUpperCase() ?? "Y"}
        </div>

        <span
          className="text-[12px] font-black tracking-wide"
          style={{ color: isActing ? HERO_ACTIVE_TEXT : HERO_IDLE_TEXT }}
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

        {stack !== undefined && (
          <>
            <div className="w-px h-3.5" style={{ background: "rgba(255,255,255,0.10)" }} />
            <span
              className="text-[12px] font-bold tabular-nums transition-all duration-300"
              style={{ color: isActing ? HERO_ACTIVE_STACK : HERO_IDLE_STACK }}
            >
              {fmtStack(stack)}
            </span>
            {bigBlind && bigBlind > 1 && (
              <span className="text-[10px] tabular-nums" style={{ color: "rgba(148,163,184,0.22)" }}>
                ·{Math.round(stack * bigBlind).toLocaleString()}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── OpponentSeat ──────────────────────────────────────────────────────────────

function OpponentSeat({
  seat,
  isActing,
  isFoldedPast,
  isFoldingNow,
  showBadge,
  badgeRating,
  currentAction,
  currentStep,
  bigBlind,
  stack,
  isAllIn,
  flipLayout,
}: {
  seat: SeatDescriptor;
  isActing: boolean;
  isFoldedPast: boolean;
  isFoldingNow: boolean;
  showBadge: boolean;
  badgeRating?: "good" | "okay" | "mistake";
  currentAction: ReplayAction | null;
  currentStep: number;
  bigBlind?: number;
  stack?: number;
  isAllIn: boolean;
  flipLayout: boolean;
}) {
  const cardSection = (
    <div
      className={cn(
        "flex gap-1.5 transition-all duration-300",
        isFoldingNow && "animate-card-muck",
      )}
      style={
        isActing
          ? { filter: OPP_ACTIVE_GLOW, transform: "scale(1.08)" }
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
            ? { background: OPP_ACTIVE_BG, border: OPP_ACTIVE_BORDER }
            : { background: "transparent", border: "1px solid transparent" }
        }
      >
        <span
          className="text-[11px] font-bold tracking-wide transition-colors duration-300"
          style={{ color: isActing ? OPP_ACTIVE_TEXT : OPP_IDLE_TEXT }}
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

      {stack !== undefined && (
        <span
          className="text-[10px] tabular-nums font-medium transition-all duration-300"
          style={{ color: isActing ? OPP_ACTIVE_STACK : OPP_IDLE_STACK }}
        >
          {fmtStack(stack)}
          {bigBlind && bigBlind > 1 && (
            <span style={{ color: "rgba(255,255,255,0.07)" }}>
              {" "}·{Math.round(stack * bigBlind).toLocaleString()}
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
      {/* Action badge */}
      {showBadge && (
        <div
          key={currentStep}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-20 whitespace-nowrap",
            flipLayout ? "-bottom-7" : "-top-7",
            "px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg animate-action-pop",
            badgeRating ? ACTION_BADGE[badgeRating] : ACTION_BADGE.neutral,
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

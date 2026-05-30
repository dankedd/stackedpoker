"use client";

/**
 * HandSolverWalkthrough
 *
 * Renders the solver's verdict for every hero decision in a hand.
 * For each decision shows:
 *   - Street + board
 *   - Hero's actual action
 *   - Solver's recommended action (highest frequency)
 *   - Frequency bars for all available actions
 *   - EV loss if hero deviated from solver's top line
 */

import type { HeroDecision, WalkthroughState } from "@/hooks/useHandSolverWalkthrough";
import type { SolverActionDetail } from "@/lib/api";

// ── Design tokens (matching SolverPanel) ─────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  check: "#94A3B8",
  call:  "#38BDF8",
  bet:   "#34D399",
  raise: "#34D399",
  fold:  "#64748B",
  allin: "#FBBF24",
};

function actionColor(token: string): string {
  if (token === "ai" || token === "rai") return ACTION_COLORS.allin;
  if (token === "x") return ACTION_COLORS.check;
  if (token === "c") return ACTION_COLORS.call;
  if (token === "f") return ACTION_COLORS.fold;
  if (token.startsWith("b")) return ACTION_COLORS.bet;
  if (token.startsWith("r")) return ACTION_COLORS.raise;
  return "#7C5CFF";
}

function actionLabel(action: SolverActionDetail): string {
  const { token, label } = action;
  if (token === "x")   return "Check";
  if (token === "c")   return "Call";
  if (token === "f")   return "Fold";
  if (token === "ai" || token === "rai") return "All-in";
  // label is already decoded: "bet 33", "raise 150"
  if (label.startsWith("bet "))   return `Bet ${label.slice(4)}%`;
  if (label.startsWith("raise ")) return `Raise ${label.slice(6)}%`;
  return label;
}

function heroActionLabel(action: { action: string; amount_bb: number }): string {
  const type = action.action;
  if (type === "check") return "Check";
  if (type === "call")  return `Call ${action.amount_bb.toFixed(1)}bb`;
  if (type === "fold")  return "Fold";
  if (type === "bet")   return `Bet ${action.amount_bb.toFixed(1)}bb`;
  if (type === "raise") return `Raise ${action.amount_bb.toFixed(1)}bb`;
  return type;
}

const STREET_COLORS: Record<string, string> = {
  flop:  "#7C5CFF",
  turn:  "#38BDF8",
  river: "#34D399",
};

// ── Card display ──────────────────────────────────────────────────────────────

function CardChip({ card }: { card: string }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const suitColor =
    suit === "h" || suit === "d" ? "#EF4444" : "#E2E8F0";
  const suitSymbol: Record<string, string> = { h: "♥", d: "♦", c: "♣", s: "♠" };

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold font-mono"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <span style={{ color: "#E2E8F0" }}>{rank}</span>
      <span style={{ color: suitColor }}>{suitSymbol[suit] ?? suit}</span>
    </span>
  );
}

// ── Frequency bar row ─────────────────────────────────────────────────────────

function FreqRow({
  action,
  isHeroAction,
  isTopSolver,
}: {
  action: SolverActionDetail;
  isHeroAction: boolean;
  isTopSolver: boolean;
}) {
  const pct = Math.round((action.frequency ?? 0) * 100);
  const color = actionColor(action.token);
  const label = actionLabel(action);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-bold"
            style={{ color: isHeroAction || isTopSolver ? color : `${color}70` }}
          >
            {label}
          </span>
          {isHeroAction && (
            <span
              className="text-[7px] font-black tracking-wider px-1 py-0.5 rounded uppercase"
              style={{
                background: "rgba(56,189,248,0.12)",
                color: "#38BDF8",
                border: "1px solid rgba(56,189,248,0.25)",
              }}
            >
              Hero
            </span>
          )}
          {isTopSolver && !isHeroAction && (
            <span
              className="text-[7px] font-black tracking-wider px-1 py-0.5 rounded uppercase"
              style={{
                background: `${color}15`,
                color: `${color}CC`,
                border: `1px solid ${color}30`,
              }}
            >
              GTO
            </span>
          )}
        </div>
        <span
          className="text-[11px] font-black tabular-nums"
          style={{ color: isHeroAction || isTopSolver ? color : `${color}70` }}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isHeroAction || isTopSolver ? color : `${color}50`,
          }}
        />
      </div>
    </div>
  );
}

// ── Decision card ─────────────────────────────────────────────────────────────

function DecisionCard({
  decision,
  index,
}: {
  decision: HeroDecision;
  index: number;
}) {
  const streetColor = STREET_COLORS[decision.street] ?? "#7C5CFF";
  const isOptimal =
    decision.matchedSolverAction?.token === decision.topSolverAction?.token;
  const topFreq = Math.round((decision.topSolverAction?.frequency ?? 0) * 100);
  const heroFreq = Math.round((decision.heroActionFrequency ?? 0) * 100);

  // EV loss: positive means hero played suboptimally
  const evLoss =
    decision.topActionEv != null && decision.heroActionEv != null
      ? decision.topActionEv - decision.heroActionEv
      : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(16,8,42,0.65)",
        border: `1px solid ${isOptimal ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)"}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="text-[8px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded"
            style={{ background: `${streetColor}15`, color: streetColor, border: `1px solid ${streetColor}30` }}
          >
            {decision.street}
          </span>
          <div className="flex gap-1">
            {decision.board.map(c => <CardChip key={c} card={c} />)}
          </div>
          <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.4)" }}>
            Pot {decision.potBb.toFixed(1)}bb
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOptimal ? (
            <span className="text-[9px] font-bold text-emerald-400">✓ Optimal</span>
          ) : (
            <span className="text-[9px] font-bold text-red-400">
              {evLoss != null ? `−${evLoss.toFixed(2)}bb EV` : "Suboptimal"}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4">
        {/* Hero's actual action */}
        <div>
          <p className="text-[8px] font-black tracking-[0.15em] uppercase mb-2"
            style={{ color: "rgba(148,163,184,0.4)" }}>
            Hero Played
          </p>
          <div
            className="rounded-lg px-3 py-2 text-center"
            style={{
              background: "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.2)",
            }}
          >
            <p className="text-[13px] font-black" style={{ color: "#38BDF8" }}>
              {heroActionLabel(decision.heroAction)}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "rgba(56,189,248,0.55)" }}>
              Solver: {heroFreq}% of range
            </p>
          </div>
        </div>

        {/* Solver's top recommendation */}
        <div>
          <p className="text-[8px] font-black tracking-[0.15em] uppercase mb-2"
            style={{ color: "rgba(148,163,184,0.4)" }}>
            GTO Recommends
          </p>
          <div
            className="rounded-lg px-3 py-2 text-center"
            style={{
              background: isOptimal ? "rgba(52,211,153,0.08)" : "rgba(124,92,255,0.08)",
              border: `1px solid ${isOptimal ? "rgba(52,211,153,0.2)" : "rgba(124,92,255,0.2)"}`,
            }}
          >
            <p
              className="text-[13px] font-black"
              style={{ color: isOptimal ? "#34D399" : "#A78BFA" }}
            >
              {decision.topSolverAction ? actionLabel(decision.topSolverAction) : "—"}
            </p>
            <p
              className="text-[9px] mt-0.5"
              style={{ color: isOptimal ? "rgba(52,211,153,0.55)" : "rgba(167,139,250,0.55)" }}
            >
              {topFreq}% of range
            </p>
          </div>
        </div>
      </div>

      {/* Frequency breakdown */}
      <div
        className="px-4 pb-3 space-y-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
      >
        <p className="text-[8px] font-black tracking-[0.15em] uppercase pt-2.5"
          style={{ color: "rgba(148,163,184,0.3)" }}>
          Full Range Distribution
        </p>
        {[...decision.solverActions]
          .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
          .map(a => (
            <FreqRow
              key={a.token}
              action={a}
              isHeroAction={a.token === decision.matchedSolverAction?.token}
              isTopSolver={a.token === decision.topSolverAction?.token}
            />
          ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function WalkthroughLoading() {
  return (
    <div
      className="rounded-xl px-5 py-6 text-center"
      style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.15)" }}
    >
      <div className="flex items-center justify-center gap-3 mb-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: "#7C5CFF", animation: "pulse 1.5s ease-in-out infinite" }}
        />
        <span className="text-[10px] font-black tracking-wider uppercase" style={{ color: "#7C5CFF" }}>
          Tracing Hand Through Tree
        </span>
      </div>
      <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>
        Walking solver tree to evaluate each decision…
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface HandSolverWalkthroughProps {
  walkthroughState: WalkthroughState;
}

export default function HandSolverWalkthrough({
  walkthroughState,
}: HandSolverWalkthroughProps) {
  const { decisions, loading, error } = walkthroughState;

  if (loading) return <WalkthroughLoading />;

  if (error) {
    return (
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(248,113,113,0.2)" }}
      >
        <p className="text-[10px] font-bold text-red-400 mb-1">Walkthrough Error</p>
        <p className="text-[10px]" style={{ color: "rgba(248,113,113,0.7)" }}>{error}</p>
      </div>
    );
  }

  if (decisions.length === 0) return null;

  const totalDecisions = decisions.length;
  const optimalCount = decisions.filter(
    d => d.matchedSolverAction?.token === d.topSolverAction?.token,
  ).length;

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "#34D399", boxShadow: "0 0 8px rgba(52,211,153,0.5)" }}
          />
          <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "#34D399" }}>
            Decision Review
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold" style={{ color: "#34D399" }}>
            {optimalCount}/{totalDecisions} optimal
          </span>
          <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.4)" }}>
            {totalDecisions} hero decision{totalDecisions !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Decision cards */}
      {decisions.map((d, i) => (
        <DecisionCard key={`${d.nodeId}-${i}`} decision={d} index={i} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SolverStrategy } from "@/lib/api";
import type { SolverState } from "@/hooks/useSolver";

// ── Design tokens ───────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  check:  "#94A3B8",
  call:   "#38BDF8",
  bet:    "#34D399",
  raise:  "#34D399",
  fold:   "#64748B",
  allin:  "#FBBF24",
};

function actionColor(name: string): string {
  if (name === "all-in" || name === "bet_allin") return ACTION_COLORS["allin"] ?? "#FBBF24";
  // "bet 33" (tree API) or "bet_33pct" (legacy parser) → base = "bet"
  const base = name.split(" ")[0].replace(/_.*$/, "");
  return ACTION_COLORS[base] ?? "#7C5CFF";
}

function actionLabel(name: string): string {
  if (name === "check") return "Check";
  if (name === "call") return "Call";
  if (name === "fold") return "Fold";
  if (name === "all-in" || name === "bet_allin") return "All-in";
  // Tree API format: "bet 33" → "Bet 33%", "raise 150" → "Raise 150%"
  const spaceIdx = name.indexOf(" ");
  if (spaceIdx !== -1) {
    const verb = name.slice(0, spaceIdx);
    const size = name.slice(spaceIdx + 1);
    if (verb === "bet" || verb === "raise") {
      return `${verb[0].toUpperCase()}${verb.slice(1)} ${size}%`;
    }
  }
  // Legacy parser format: "bet_33pct" → "Bet 33%"
  if (name.startsWith("bet_")) return `Bet ${name.replace("bet_", "").replace("pct", "%")}`;
  if (name.startsWith("raise_")) return `Raise ${name.replace("raise_", "").replace("pct", "%")}`;
  return name;
}

// ── Loading states ──────────────────────────────────────────────────────────

function SolverLoading({ state }: { state: SolverState }) {
  const messages: Record<string, string> = {
    submitting: "Submitting solve job...",
    queued:     "Queued — waiting for worker...",
    running:    "Solving — computing GTO equilibrium...",
  };
  const msg = messages[state] || "Loading...";

  return (
    <div className="px-5 py-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            background: "#7C5CFF",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7C5CFF" }}>
          {state === "running" ? "TexasSolver Running" : "Solver"}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>
        {msg}
      </p>
    </div>
  );
}

// ── Frequency bars ──────────────────────────────────────────────────────────

function FrequencyBars({
  frequencies,
  preferred,
}: {
  frequencies: Record<string, number>;
  preferred: string;
}) {
  const sorted = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {sorted.map(([action, freq]) => {
        const pct = Math.round(freq * 100);
        const isPreferred = action === preferred;
        const color = actionColor(action);

        return (
          <div key={action}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold"
                  style={{ color: isPreferred ? color : `${color}99` }}
                >
                  {actionLabel(action)}
                </span>
                {isPreferred && (
                  <span
                    className="text-[7px] font-black tracking-wider px-1.5 py-0.5 rounded uppercase"
                    style={{
                      background: `${color}15`,
                      color: `${color}BB`,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    GTO
                  </span>
                )}
              </div>
              <span
                className="text-[12px] font-black tabular-nums"
                style={{ color: isPreferred ? color : `${color}99` }}
              >
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: isPreferred ? color : `${color}80` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Combo grid ──────────────────────────────────────────────────────────────

function ComboGrid({
  combos,
  actions,
}: {
  combos: SolverStrategy["strategies"][string]["combos"];
  actions: string[];
}) {
  if (!combos || combos.length === 0) return null;

  // Sort by primary action frequency (most aggressive first)
  const sorted = [...combos].sort((a, b) => {
    const primaryAction = actions[actions.length - 1] || actions[0];
    return (b.actions[primaryAction] ?? 0) - (a.actions[primaryAction] ?? 0);
  });

  return (
    <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
      {sorted.slice(0, 100).map((combo) => {
        const totalFreq = Object.values(combo.actions).reduce((s, v) => s + v, 0);
        if (totalFreq < 0.001) return null;

        return (
          <div key={combo.hand} className="flex items-center gap-2 px-1 py-0.5">
            <span
              className="text-[10px] font-mono font-bold w-10 shrink-0"
              style={{ color: "rgba(167,139,250,0.85)" }}
            >
              {combo.hand}
            </span>
            {/* Stacked bar */}
            <div className="flex-1 flex h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
              {actions.map((action) => {
                const freq = combo.actions[action] ?? 0;
                if (freq < 0.005) return null;
                return (
                  <div
                    key={action}
                    style={{
                      width: `${freq * 100}%`,
                      background: actionColor(action),
                      opacity: 0.8,
                    }}
                  />
                );
              })}
            </div>
            {/* Primary frequency label */}
            <span className="text-[9px] tabular-nums w-8 text-right shrink-0" style={{ color: "rgba(148,163,184,0.45)" }}>
              {Math.round((combo.actions[actions[0]] ?? 0) * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main SolverPanel ────────────────────────────────────────────────────────

interface SolverPanelProps {
  state: SolverState;
  strategy: SolverStrategy | null;
  error: string | null;
  onSolve?: () => void;
}

export default function SolverPanel({ state, strategy, error, onSolve }: SolverPanelProps) {
  const [activePlayer, setActivePlayer] = useState<"oop" | "ip">("oop");
  const [showCombos, setShowCombos] = useState(false);

  // Loading states
  if (state === "submitting" || state === "queued" || state === "running") {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.15)" }}
      >
        <SolverLoading state={state} />
      </div>
    );
  }

  // Error state
  if (state === "error" || state === "failed") {
    return (
      <div
        className="rounded-xl overflow-hidden px-5 py-4"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(248,113,113,0.2)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-[9px] font-black tracking-wider uppercase text-red-400">
            Solver Error
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(248,113,113,0.7)" }}>
          {error || "Unknown error"}
        </p>
        {onSolve && (
          <button
            onClick={onSolve}
            className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold"
            style={{
              background: "rgba(124,92,255,0.12)",
              color: "#7C5CFF",
              border: "1px solid rgba(124,92,255,0.25)",
            }}
          >
            Retry Solve
          </button>
        )}
      </div>
    );
  }

  // Idle state — prompt to solve
  if (state === "idle" || !strategy) {
    return (
      <div
        className="rounded-xl overflow-hidden px-5 py-5 text-center"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.12)" }}
      >
        <p className="text-[10px] mb-3" style={{ color: "rgba(148,163,184,0.45)" }}>
          Run TexasSolver for real GTO equilibrium frequencies
        </p>
        {onSolve && (
          <button
            onClick={onSolve}
            className="px-4 py-2 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #7C5CFF 0%, #6344E8 100%)",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(124,92,255,0.25)",
            }}
          >
            Run Solver
          </button>
        )}
      </div>
    );
  }

  // ── Completed — show strategy ───────────────────────────────────────────

  const playerData = strategy.strategies[activePlayer];
  const otherPlayer = activePlayer === "oop" ? "ip" : "oop";
  const hasOther = !!strategy.strategies[otherPlayer];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.18)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(124,92,255,0.10)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: "#34D399",
              boxShadow: "0 0 8px rgba(52,211,153,0.5)",
            }}
          />
          <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "#34D399" }}>
            GTO Solver
          </span>
        </div>
        <div className="flex items-center gap-1">
          {strategy.solve_time_ms > 0 && (
            <span className="text-[8px] tabular-nums" style={{ color: "rgba(52,211,153,0.5)" }}>
              {(strategy.solve_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {strategy.iterations > 0 && (
            <span className="text-[8px] tabular-nums" style={{ color: "rgba(52,211,153,0.35)" }}>
              {strategy.iterations} iter
            </span>
          )}
        </div>
      </div>

      {/* Node description */}
      {strategy.node_description && (
        <p className="text-[9px] px-5 pt-2" style={{ color: "rgba(148,163,184,0.35)" }}>
          {strategy.node_description}
        </p>
      )}

      {/* Player toggle */}
      {hasOther && (
        <div className="flex gap-1 px-5 pt-3">
          {(["oop", "ip"] as const).map((p) => {
            const pData = strategy.strategies[p];
            if (!pData) return null;
            const isActive = p === activePlayer;
            return (
              <button
                key={p}
                onClick={() => setActivePlayer(p)}
                className="px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: isActive ? "rgba(124,92,255,0.15)" : "transparent",
                  color: isActive ? "#A78BFA" : "rgba(148,163,184,0.4)",
                  border: `1px solid ${isActive ? "rgba(124,92,255,0.3)" : "transparent"}`,
                }}
              >
                {pData.position} ({p.toUpperCase()})
              </button>
            );
          })}
        </div>
      )}

      {/* Frequency bars */}
      {playerData && (
        <div className="px-5 py-4">
          <FrequencyBars
            frequencies={playerData.frequencies}
            preferred={playerData.preferred_action}
          />
        </div>
      )}

      {/* Combo toggle */}
      {playerData && playerData.combo_count > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <button
            onClick={() => setShowCombos(!showCombos)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{ color: "rgba(148,163,184,0.4)" }}
          >
            <span>
              Combo Breakdown ({playerData.combo_count} hands)
            </span>
            <span style={{ fontSize: "8px" }}>{showCombos ? "▲" : "▼"}</span>
          </button>
          {showCombos && (
            <div className="px-4 pb-4">
              {/* Legend */}
              <div className="flex gap-3 mb-2 px-1">
                {playerData.actions.map((action) => (
                  <div key={action} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-sm"
                      style={{ background: actionColor(action) }}
                    />
                    <span className="text-[8px]" style={{ color: "rgba(148,163,184,0.45)" }}>
                      {actionLabel(action)}
                    </span>
                  </div>
                ))}
              </div>
              <ComboGrid combos={playerData.combos} actions={playerData.actions} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

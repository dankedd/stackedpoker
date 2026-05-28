"use client";

import { useEffect } from "react";
import { PlayingCard } from "@/components/poker/PlayingCard";
import type { SolverNodeResponse, SolverActionDetail } from "@/lib/api";
import type { UseSolverReplayReturn } from "@/hooks/useSolverReplay";

// ── Design tokens (consistent with SolverPanel) ────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  check:  "#94A3B8",
  call:   "#38BDF8",
  bet:    "#34D399",
  raise:  "#34D399",
  fold:   "#64748B",
  "all-in": "#FBBF24",
};

const STREET_COLORS: Record<string, string> = {
  preflop: "#38BDF8",
  flop:    "#34D399",
  turn:    "#FBBF24",
  river:   "#F87171",
};

function actionColor(label: string): string {
  const base = label.split(" ")[0].toLowerCase();
  return ACTION_COLORS[base] ?? "#7C5CFF";
}

// ── Board display ──────────────────────────────────────────────────────────

function BoardCards({ cards }: { cards: string[] }) {
  if (cards.length === 0) return null;

  const flop = cards.slice(0, 3);
  const turn = cards[3];
  const river = cards[4];

  return (
    <div className="flex items-end gap-1.5">
      {flop.map((card, i) => (
        <PlayingCard key={`f-${i}`} card={card} size="md" animationDelay={i * 60} />
      ))}
      {turn && (
        <>
          <div className="w-2" />
          <PlayingCard card={turn} size="md" animationDelay={200} />
        </>
      )}
      {river && (
        <>
          <div className="w-2" />
          <PlayingCard card={river} size="md" animationDelay={300} />
        </>
      )}
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────────

function ActionButton({
  action,
  childId,
  disabled,
  onClick,
}: {
  action: SolverActionDetail;
  childId: string;
  disabled: boolean;
  onClick: (childId: string) => void;
}) {
  const color = actionColor(action.label);
  const pct = action.frequency != null ? Math.round(action.frequency * 100) : null;

  return (
    <button
      onClick={() => onClick(childId)}
      disabled={disabled}
      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}25`,
      }}
    >
      {/* Frequency bar */}
      <div className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0">
        <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
          />
          {pct != null && (
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${pct * 0.974} 100`}
              strokeLinecap="round"
              style={{ opacity: 0.8 }}
            />
          )}
        </svg>
        <span
          className="text-[10px] font-black tabular-nums"
          style={{ color: `${color}CC` }}
        >
          {pct != null ? `${pct}` : "—"}
        </span>
      </div>

      {/* Label */}
      <div className="flex-1 text-left">
        <span className="text-[13px] font-bold capitalize" style={{ color }}>
          {action.label}
        </span>
      </div>

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={`${color}60`} strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// ── Frequency summary bars (inline, compact) ───────────────────────────────

function FrequencySummary({ actions }: { actions: SolverActionDetail[] }) {
  const withFreq = actions.filter((a) => a.frequency != null && a.frequency > 0.005);
  if (withFreq.length === 0) return null;

  return (
    <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
      {withFreq.map((a) => (
        <div
          key={a.token}
          style={{
            width: `${(a.frequency ?? 0) * 100}%`,
            background: actionColor(a.label),
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  );
}

// ── EV display ─────────────────────────────────────────────────────────────

function EVDisplay({ evs, actions }: { evs: Record<string, number>; actions: SolverActionDetail[] }) {
  const entries = actions
    .filter((a) => evs[a.token] != null)
    .map((a) => ({ label: a.label, token: a.token, ev: evs[a.token] }));

  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-black tracking-[0.2em] uppercase" style={{ color: "rgba(148,163,184,0.35)" }}>
        Aggregate Frequencies
      </span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {entries.map((e) => (
          <div key={e.token} className="flex items-center justify-between">
            <span className="text-[11px] capitalize" style={{ color: actionColor(e.label) }}>
              {e.label}
            </span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "rgba(148,163,184,0.7)" }}>
              {Math.round(e.ev * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Combo matrix ───────────────────────────────────────────────────────────

function ComboMatrix({
  strategy,
  actions,
}: {
  strategy: Record<string, number[]>;
  actions: SolverActionDetail[];
}) {
  const combos = Object.entries(strategy);
  if (combos.length === 0) return null;

  // Sort by first action frequency descending
  const sorted = [...combos].sort((a, b) => (b[1][0] ?? 0) - (a[1][0] ?? 0));

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-3 mb-2">
        {actions.map((a) => (
          <div key={a.token} className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm" style={{ background: actionColor(a.label) }} />
            <span className="text-[8px] capitalize" style={{ color: "rgba(148,163,184,0.45)" }}>
              {a.label}
            </span>
          </div>
        ))}
      </div>

      {/* Combo rows */}
      <div className="space-y-0.5 max-h-[320px] overflow-y-auto custom-scrollbar">
        {sorted.slice(0, 120).map(([combo, freqs]) => {
          const total = freqs.reduce((s, v) => s + v, 0);
          if (total < 0.001) return null;

          return (
            <div key={combo} className="flex items-center gap-2 px-1 py-0.5">
              <span
                className="text-[10px] font-mono font-bold w-10 shrink-0"
                style={{ color: "rgba(167,139,250,0.85)" }}
              >
                {combo}
              </span>
              <div
                className="flex-1 flex h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                {freqs.map((freq, i) => {
                  if (freq < 0.005 || !actions[i]) return null;
                  return (
                    <div
                      key={actions[i].token}
                      style={{
                        width: `${freq * 100}%`,
                        background: actionColor(actions[i].label),
                        opacity: 0.8,
                      }}
                    />
                  );
                })}
              </div>
              <span
                className="text-[9px] tabular-nums w-8 text-right shrink-0"
                style={{ color: "rgba(148,163,184,0.45)" }}
              >
                {Math.round((freqs[0] ?? 0) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Action breadcrumb trail ────────────────────────────────────────────────

function ActionTrail({
  history,
  onRoot,
  onBack,
  disabled,
}: {
  history: string[];
  onRoot: () => void;
  onBack: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={onRoot}
        disabled={disabled || history.length === 0}
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all disabled:opacity-30"
        style={{
          color: "#7C5CFF",
          background: history.length > 0 ? "rgba(124,92,255,0.1)" : "transparent",
        }}
      >
        Root
      </button>
      {history.map((action, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span
            className="text-[10px] font-bold capitalize"
            style={{ color: actionColor(action) }}
          >
            {action}
          </span>
        </span>
      ))}
      {history.length > 0 && (
        <button
          onClick={onBack}
          disabled={disabled}
          className="ml-2 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all disabled:opacity-30"
          style={{ color: "rgba(148,163,184,0.5)", background: "rgba(255,255,255,0.04)" }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}

// ── Node info header ───────────────────────────────────────────────────────

function NodeHeader({ node }: { node: SolverNodeResponse }) {
  const streetColor = STREET_COLORS[node.street] ?? "#94A3B8";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Street badge */}
      <span
        className="text-[9px] font-black tracking-[0.18em] uppercase px-2.5 py-1 rounded-md"
        style={{
          color: streetColor,
          background: `${streetColor}12`,
          border: `1px solid ${streetColor}25`,
        }}
      >
        {node.street}
      </span>

      {/* Actor badge */}
      {node.actor && (
        <span
          className="text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-md"
          style={{
            color: "#A78BFA",
            background: "rgba(167,139,250,0.1)",
            border: "1px solid rgba(167,139,250,0.2)",
          }}
        >
          {node.actor.toUpperCase()} to act
        </span>
      )}

      {/* Terminal badge */}
      {node.metadata.is_terminal && (
        <span
          className="text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-md"
          style={{
            color: "#F87171",
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.2)",
          }}
        >
          Terminal
        </span>
      )}

      {/* Pot size */}
      {node.metadata.pot_size > 0 && (
        <span className="text-[10px] tabular-nums" style={{ color: "rgba(148,163,184,0.5)" }}>
          Pot: {node.metadata.pot_size.toFixed(1)} BB
        </span>
      )}

      {/* Depth */}
      <span className="text-[9px] tabular-nums" style={{ color: "rgba(148,163,184,0.3)" }}>
        Depth {node.depth}
      </span>
    </div>
  );
}

// ── Main SolverReplay component ────────────────────────────────────────────

interface SolverReplayProps {
  replay: UseSolverReplayReturn;
}

export default function SolverReplay({ replay }: SolverReplayProps) {
  const {
    currentNode,
    treeMeta,
    actionHistory,
    loading,
    error,
    navigateToChild,
    navigateBack,
    navigateToRoot,
  } = replay;

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading && !currentNode) {
    return (
      <div
        className="rounded-xl overflow-hidden px-6 py-10 text-center"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.15)" }}
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: "#7C5CFF", animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7C5CFF" }}>
            Loading Solver Tree
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.55)" }}>
          Fetching tree data...
        </p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error && !currentNode) {
    return (
      <div
        className="rounded-xl overflow-hidden px-6 py-6"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(248,113,113,0.2)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-[9px] font-black tracking-wider uppercase text-red-400">
            Tree Error
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(248,113,113,0.7)" }}>
          {error}
        </p>
      </div>
    );
  }

  // ── No node loaded ─────────────────────────────────────────────────────

  if (!currentNode) return null;

  const hasStrategy = Object.keys(currentNode.strategy).length > 0;

  return (
    <div className="space-y-4">
      {/* Tree info bar */}
      {treeMeta && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-lg"
          style={{ background: "rgba(16,8,42,0.45)", border: "1px solid rgba(124,92,255,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: "#34D399", boxShadow: "0 0 8px rgba(52,211,153,0.5)" }}
            />
            <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "#34D399" }}>
              Solver Tree
            </span>
          </div>
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(148,163,184,0.35)" }}>
            {treeMeta.total_nodes.toLocaleString()} nodes · {treeMeta.streets.join(", ")}
          </span>
        </div>
      )}

      {/* Navigation trail */}
      <ActionTrail
        history={actionHistory}
        onRoot={navigateToRoot}
        onBack={navigateBack}
        disabled={loading}
      />

      {/* Node panel */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.18)" }}
      >
        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(124,92,255,0.08)" }}>
          <NodeHeader node={currentNode} />
        </div>

        {/* Board */}
        {currentNode.board.length > 0 && (
          <div className="px-5 py-4 flex justify-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <BoardCards cards={currentNode.board} />
          </div>
        )}

        {/* Frequency summary */}
        {currentNode.available_actions.length > 0 && (
          <div className="px-5 pt-4">
            <FrequencySummary actions={currentNode.available_actions} />
          </div>
        )}

        {/* EV / aggregate frequencies */}
        {Object.keys(currentNode.evs).length > 0 && (
          <div className="px-5 pt-4">
            <EVDisplay evs={currentNode.evs} actions={currentNode.available_actions} />
          </div>
        )}

        {/* Available actions */}
        {currentNode.available_actions.length > 0 && !currentNode.metadata.is_terminal && (
          <div className="px-5 py-4">
            <div className="mb-2">
              <span className="text-[8px] font-black tracking-[0.2em] uppercase" style={{ color: "rgba(148,163,184,0.35)" }}>
                Actions
              </span>
            </div>
            <div className="space-y-2">
              {currentNode.available_actions.map((action, idx) => {
                const childId = currentNode.children_ids[idx];
                if (!childId) return null;
                return (
                  <ActionButton
                    key={action.token}
                    action={action}
                    childId={childId}
                    disabled={loading}
                    onClick={navigateToChild}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Terminal state message */}
        {currentNode.metadata.is_terminal && (
          <div className="px-5 py-6 text-center">
            <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>
              End of line — {currentNode.metadata.node_type === "chance" ? "chance node (new card)" : "showdown / fold"}
            </p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="px-5 py-2 text-center">
            <span className="text-[10px]" style={{ color: "rgba(124,92,255,0.6)" }}>
              Loading node...
            </span>
          </div>
        )}

        {/* Inline error */}
        {error && currentNode && (
          <div className="px-5 py-2">
            <span className="text-[10px] text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* Combo matrix (collapsible) */}
      {hasStrategy && (
        <ComboSection strategy={currentNode.strategy} actions={currentNode.available_actions} />
      )}
    </div>
  );
}

// ── Combo section (collapsible) ────────────────────────────────────────────

function ComboSection({
  strategy,
  actions,
}: {
  strategy: Record<string, number[]>;
  actions: SolverActionDetail[];
}) {
  const comboCount = Object.keys(strategy).length;

  return (
    <details className="group">
      <summary
        className="flex items-center justify-between px-5 py-3 rounded-xl cursor-pointer list-none transition-all"
        style={{ background: "rgba(16,8,42,0.45)", border: "1px solid rgba(124,92,255,0.10)" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
          Combo Breakdown ({comboCount} hands)
        </span>
        <span className="text-[8px] group-open:rotate-180 transition-transform" style={{ color: "rgba(148,163,184,0.3)" }}>
          ▼
        </span>
      </summary>
      <div className="mt-2 px-4 py-3 rounded-xl" style={{ background: "rgba(16,8,42,0.45)", border: "1px solid rgba(124,92,255,0.08)" }}>
        <ComboMatrix strategy={strategy} actions={actions} />
      </div>
    </details>
  );
}

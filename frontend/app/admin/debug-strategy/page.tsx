"use client";

/**
 * /admin/debug-strategy
 *
 * Internal debug page for manual validation of the solver-backed strategy
 * pipeline. NOT user-facing — only accessible when DEBUG_STRATEGY_ENABLED=true
 * on the backend.
 *
 * Usage:
 *   1. Set DEBUG_STRATEGY_ENABLED=true in backend .env
 *   2. Optionally set DEBUG_ADMIN_TOKEN=<secret> and send it in X-Debug-Token
 *   3. Navigate to /admin/debug-strategy in the browser
 *   4. Paste a CanonicalHand JSON and click "Run Analysis"
 */

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SAMPLE_HAND = JSON.stringify(
  {
    hand_id: "debug_001",
    site: "GGPoker",
    game_type: "NLHE",
    stakes: { big_blind: 1.0, display: "0.5/1" },
    players: [
      {
        id: "seat_1",
        name: "Hero",
        seat: 1,
        position: "BTN",
        stack_bb: 100.0,
        hole_cards: [
          { rank: "A", suit: "s", notation: "As" },
          { rank: "K", suit: "h", notation: "Kh" },
        ],
        is_hero: true,
        is_active: true,
      },
      {
        id: "seat_2",
        name: "Villain",
        seat: 2,
        position: "BB",
        stack_bb: 100.0,
        hole_cards: [],
        is_hero: false,
        is_active: true,
      },
    ],
    hero_id: "seat_1",
    streets: [
      {
        name: "preflop",
        board_cards: [],
        actions: [
          {
            sequence: 1,
            street: "preflop",
            player_id: "seat_1",
            player_name: "Hero",
            action: "raise",
            amount_bb: 2.5,
            total_bet_bb: 2.5,
            is_hero: true,
            is_all_in: false,
            stack_before_bb: 100.0,
            stack_after_bb: 97.5,
            pot_before_bb: 1.5,
            pot_after_bb: 5.5,
          },
          {
            sequence: 2,
            street: "preflop",
            player_id: "seat_2",
            player_name: "Villain",
            action: "call",
            amount_bb: 1.5,
            total_bet_bb: 2.5,
            is_hero: false,
            is_all_in: false,
            stack_before_bb: 100.0,
            stack_after_bb: 97.5,
            pot_before_bb: 5.5,
            pot_after_bb: 6.5,
          },
        ],
      },
      {
        name: "flop",
        board_cards: [
          { rank: "A", suit: "h", notation: "Ah" },
          { rank: "K", suit: "c", notation: "Kc" },
          { rank: "7", suit: "d", notation: "7d" },
        ],
        actions: [],
      },
    ],
    effective_stack_bb: 97.5,
    final_pot_bb: 6.5,
  },
  null,
  2
);

// ── Badge components ──────────────────────────────────────────────────────────

function RetrievalBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    exact:    "bg-green-900/50 text-green-300 border border-green-700",
    similar:  "bg-yellow-900/50 text-yellow-300 border border-yellow-700",
    fallback: "bg-orange-900/50 text-orange-300 border border-orange-700",
    default:  "bg-red-900/50 text-red-300 border border-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[type] ?? "bg-slate-700 text-slate-300"}`}>
      {type}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    texassolver: "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
    gto_plus:    "bg-blue-900/50 text-blue-300 border border-blue-700",
    pio:         "bg-cyan-900/50 text-cyan-300 border border-cyan-700",
    gto_wizard:  "bg-indigo-900/50 text-indigo-300 border border-indigo-700",
    handcrafted: "bg-slate-800 text-slate-400 border border-slate-600",
    fallback:    "bg-orange-900/50 text-orange-300 border border-orange-700",
    default:     "bg-red-900/50 text-red-300 border border-red-700",
    registry:    "bg-purple-900/50 text-purple-300 border border-purple-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[source] ?? "bg-slate-700 text-slate-300"}`}>
      {source}
    </span>
  );
}

function SolverEngineBadge({ engine }: { engine: string | null }) {
  if (!engine) return null;
  const colors: Record<string, string> = {
    texassolver: "bg-emerald-900/40 text-emerald-400 border border-emerald-800",
    gto_plus:    "bg-blue-900/40 text-blue-400 border border-blue-800",
    pio:         "bg-cyan-900/40 text-cyan-400 border border-cyan-800",
    gto_wizard:  "bg-indigo-900/40 text-indigo-400 border border-indigo-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[engine] ?? "bg-slate-700 text-slate-300"}`}>
      solver: {engine}
    </span>
  );
}

function CacheBadge({ hit }: { hit: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${hit ? "bg-green-900/40 text-green-400 border border-green-800" : "bg-slate-800 text-slate-500 border border-slate-600"}`}>
      {hit ? "CACHE HIT" : "cache miss"}
    </span>
  );
}

// ── Signal bar ────────────────────────────────────────────────────────────────

function SignalBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-green-500" :
    pct >= 45 ? "bg-yellow-500" :
    "bg-orange-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded bg-slate-700">
        <div className={`h-full rounded ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DebugStrategyPage() {
  const [handJson, setHandJson] = useState(SAMPLE_HAND);
  const [adminToken, setAdminToken] = useState("");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setResult(null);
    setRawError(null);

    try {
      const body = JSON.parse(handJson);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["X-Debug-Token"] = adminToken;

      const res = await fetch(`${API_BASE}/api/debug/full-analysis`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setRawError(`HTTP ${res.status}: ${JSON.stringify(data, null, 2)}`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setRawError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retrieval = result?.retrieval as Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = result?.strategy_profile as Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findings = result?.findings as Array<Record<string, any>> | undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="border-b border-slate-700 pb-4">
          <h1 className="text-xl font-bold text-violet-400">
            Strategy Pipeline Debug
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Internal tool — requires <code className="text-orange-400">DEBUG_STRATEGY_ENABLED=true</code> on backend
          </p>
        </div>

        {/* Input panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              CanonicalHand JSON
            </label>
            <textarea
              value={handJson}
              onChange={(e) => setHandJson(e.target.value)}
              rows={18}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-200 resize-y focus:outline-none focus:border-violet-500"
              spellCheck={false}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider">
                X-Debug-Token (optional)
              </label>
              <input
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="leave empty if not configured"
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full py-2.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold transition-colors"
            >
              {loading ? "Running…" : "Run Analysis"}
            </button>

            {result && (
              <div className="text-xs text-slate-400 space-y-1 bg-slate-900 rounded p-3 border border-slate-700">
                <div>Latency: <span className="text-slate-200">{String(result.latency_ms)}ms</span></div>
                {result.error != null && (
                  <div className="text-red-400">Error: {String(result.error)}</div>
                )}
              </div>
            )}

            {/* Quick links */}
            <div className="text-xs space-y-1 text-slate-500">
              <div className="text-slate-400 font-semibold">Quick links</div>
              <a href={`${API_BASE}/docs#/debug/full_analysis_api_debug_full_analysis_post`}
                 target="_blank" rel="noreferrer"
                 className="block text-violet-400 hover:underline">
                → Swagger UI
              </a>
              <a href={`${API_BASE}/api/debug/strategy-store/stats`}
                 target="_blank" rel="noreferrer"
                 className="block text-violet-400 hover:underline">
                → Store stats JSON
              </a>
            </div>
          </div>
        </div>

        {/* Error display */}
        {rawError && (
          <div className="bg-red-950 border border-red-800 rounded p-4">
            <div className="text-red-400 text-xs font-bold mb-2">Error</div>
            <pre className="text-red-300 text-xs overflow-auto whitespace-pre-wrap">{rawError}</pre>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">

            {/* NodeKey + retrieval summary */}
            <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider">Node Key</h2>
              <div className="font-mono text-sm text-violet-300 break-all">
                {String(result.node_key || "—")}
              </div>

              {retrieval && (
                <div className="flex flex-wrap gap-2 items-center pt-1">
                  <RetrievalBadge type={String(retrieval.retrieval_type ?? "—")} />
                  <SourceBadge source={String(retrieval.strategy_source ?? "—")} />
                  <SolverEngineBadge engine={retrieval.solver_engine as string | null ?? null} />
                  <CacheBadge hit={Boolean(retrieval.cache_hit)} />
                  {retrieval.similarity_score != null && (
                    <span className="text-xs text-slate-400 font-mono">
                      sim: <span className="text-slate-200">{Number(retrieval.similarity_score).toFixed(4)}</span>
                    </span>
                  )}
                </div>
              )}

              {retrieval?.matched_node_key && retrieval.matched_node_key !== result.node_key && (
                <div className="text-xs text-slate-500">
                  Matched: <span className="text-slate-300 font-mono">{String(retrieval.matched_node_key)}</span>
                </div>
              )}
            </div>

            {/* Solver spot */}
            {result.solver_spot && (
              <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-2">
                <h2 className="text-xs text-slate-400 uppercase tracking-wider">Solver Spot</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(result.solver_spot as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="space-y-0.5">
                      <div className="text-xs text-slate-500">{k}</div>
                      <div className="text-xs text-slate-200 font-mono truncate">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy profile */}
            {profile && (
              <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-4">
                <h2 className="text-xs text-slate-400 uppercase tracking-wider">Strategy Profile</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <SignalBar label="Bet Frequency" value={Number(profile.bet_frequency ?? 0)} />
                    <SignalBar label="Range Advantage" value={Number(profile.range_advantage ?? 0)} />
                    <SignalBar label="Nut Advantage" value={Number(profile.nut_advantage ?? 0)} />
                  </div>
                  <div className="space-y-2">
                    <SignalBar label="Pressure Score" value={Number(profile.pressure_score ?? 0)} />
                    <SignalBar label="Volatility Score" value={Number(profile.volatility_score ?? 0)} />
                    <SignalBar label="Equity Realization" value={Number(profile.equity_realization ?? 0)} />
                  </div>
                </div>

                {profile.primary_sizing && (
                  <div className="text-xs text-slate-400">
                    Primary sizing: <span className="text-slate-200 font-mono">{String(profile.primary_sizing)}</span>
                  </div>
                )}

                {profile.rationale && (
                  <div className="text-xs text-slate-500 italic border-t border-slate-800 pt-2">
                    {String(profile.rationale)}
                  </div>
                )}

                {Array.isArray(profile.caveats) && profile.caveats.length > 0 && (
                  <div className="space-y-1">
                    {(profile.caveats as string[]).map((c, i) => (
                      <div key={i} className="text-xs text-yellow-400/80">⚠ {c}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Findings */}
            {findings && findings.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-2">
                <h2 className="text-xs text-slate-400 uppercase tracking-wider">
                  Findings ({findings.length})
                </h2>
                {findings.map((f, i) => {
                  const severity = String(f.severity ?? "note");
                  const color =
                    severity === "good" ? "text-green-400" :
                    severity === "warn" ? "text-yellow-400" :
                    severity === "error" ? "text-red-400" :
                    "text-slate-300";
                  return (
                    <div key={i} className="border-l-2 border-slate-700 pl-3 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${color}`}>{severity.toUpperCase()}</span>
                        <span className="text-xs text-slate-500">{String(f.category ?? "")}</span>
                      </div>
                      <div className="text-xs text-slate-200">{String(f.message ?? "")}</div>
                      {f.detail && (
                        <div className="text-xs text-slate-500">{String(f.detail)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Raw JSON */}
            <details className="bg-slate-900 border border-slate-700 rounded">
              <summary className="px-4 py-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                Raw JSON response
              </summary>
              <pre className="px-4 pb-4 text-xs text-slate-400 overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>

          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Plus, Loader2, RotateCcw, Layers } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { cn } from "@/lib/utils";
import { computeSessionResult } from "@/lib/bankroll/sessionForm";
import { SessionRow } from "@/components/bankroll/SessionRow";
import { SessionFormModal, type SessionFormEditingData } from "@/components/bankroll/SessionFormModal";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { BankrollPageLoader } from "@/components/bankroll/BankrollPageLoader";
import { BankrollEmptyState } from "@/components/bankroll/BankrollEmptyState";
import { BankrollErrorState } from "@/components/bankroll/BankrollErrorState";
import type { BankrollSessionRow, BankrollMentalEntryRow } from "@/lib/bankroll/types";

type SortKey = "newest" | "oldest" | "best" | "worst" | "mostHands" | "longest";
type ResultFilter = "all" | "winning" | "losing";

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
          : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-border/60"
      )}
    >
      {children}
    </button>
  );
}

export default function BankrollSessionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<BankrollSessionRow[]>([]);
  const [mentalBySession, setMentalBySession] = useState<Record<string, BankrollMentalEntryRow>>({});
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SessionFormEditingData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: sessionRows, error: sessionsError }, { data: mentalRows }, { data: settingsRow }] = await Promise.all([
        supabase
          .from("bankroll_sessions")
          .select("id, session_type, variant, site, stakes, currency, buy_in_amount, cash_out_amount, ev_amount, started_at, ended_at, duration_minutes, hands_played, notes, tournament_name, fee_amount, prize_amount, field_size, finishing_position")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(1000),
        supabase
          .from("bankroll_mental_entries")
          .select("id, session_id, overall_score")
          .eq("user_id", user.id)
          .not("session_id", "is", null),
        supabase.from("bankroll_settings").select("preferred_currency").eq("user_id", user.id).maybeSingle(),
      ]);

      if (sessionsError) {
        console.error("[bankroll/sessions] fetch error:", sessionsError.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

      setSessions((sessionRows ?? []) as unknown as BankrollSessionRow[]);
      setCurrency(settingsRow?.preferred_currency ?? "USD");

      const bySession: Record<string, BankrollMentalEntryRow> = {};
      for (const row of (mentalRows ?? []) as unknown as BankrollMentalEntryRow[]) {
        bySession[row.session_id] = row;
      }
      setMentalBySession(bySession);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { confirmId: confirmDel, handleDelete: handleDeleteClick, cancelDelete } = useConfirmDelete("bankroll_sessions", setSessions, fetchData);

  const siteOptions = useMemo(() => {
    const sites = new Set<string>();
    sessions.forEach((s) => { if (s.site) sites.add(s.site); });
    return Array.from(sites).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = sessions;

    if (resultFilter === "winning") list = list.filter((s) => computeSessionResult(s) >= 0);
    if (resultFilter === "losing") list = list.filter((s) => computeSessionResult(s) < 0);
    if (siteFilter !== "all") list = list.filter((s) => s.site === siteFilter);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((s) =>
        s.site?.toLowerCase().includes(q) ||
        s.variant?.toLowerCase().includes(q) ||
        s.stakes?.toLowerCase().includes(q) ||
        s.tournament_name?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (sortBy === "newest") sorted.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    if (sortBy === "oldest") sorted.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    if (sortBy === "best") sorted.sort((a, b) => computeSessionResult(b) - computeSessionResult(a));
    if (sortBy === "worst") sorted.sort((a, b) => computeSessionResult(a) - computeSessionResult(b));
    if (sortBy === "mostHands") sorted.sort((a, b) => (b.hands_played ?? 0) - (a.hands_played ?? 0));
    if (sortBy === "longest") sorted.sort((a, b) => (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0));

    return sorted;
  }, [sessions, resultFilter, siteFilter, search, sortBy]);

  const hasActiveFilters = resultFilter !== "all" || siteFilter !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    setSearch("");
    setResultFilter("all");
    setSiteFilter("all");
    setSortBy("newest");
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (session: BankrollSessionRow) => {
    const entry = mentalBySession[session.id];
    setEditing({ session, mentalScore: entry?.overall_score ?? null, mentalEntryId: entry?.id ?? null });
    setModalOpen(true);
  };

  if (authLoading) return <BankrollPageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

        {/* ── Header ── */}
        <div className="mb-8 animate-fade-in">
          <BankrollBackLink />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Sessions</h1>
              <p className="text-muted-foreground mt-1.5">Log, edit and review every session you've played.</p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200 shrink-0"
            >
              <Plus className="h-4 w-4" />
              New session
            </button>
          </div>
        </div>

        {loadError ? (
          <BankrollErrorState message="Couldn't load your sessions." onRetry={fetchData} />
        ) : (
          <>
            {/* ── Search + filter bar ── */}
            <div className="mb-6 space-y-3 animate-fade-in">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by site, variant, stakes, notes…"
                  className="w-full bg-card/60 border border-border/50 rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="h-8 bg-card/60 border border-border/50 rounded-lg px-2 text-xs text-foreground focus:outline-none focus:border-violet-500/40 cursor-pointer"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="best">Best result</option>
                  <option value="worst">Worst result</option>
                  <option value="mostHands">Most hands</option>
                  <option value="longest">Longest session</option>
                </select>

                <div className="h-4 w-px bg-border/40" />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {([["all", "Any result"], ["winning", "Winning"], ["losing", "Losing"]] as [ResultFilter, string][]).map(([v, label]) => (
                    <FilterChip key={v} active={resultFilter === v} onClick={() => setResultFilter(v)}>{label}</FilterChip>
                  ))}
                </div>

                {siteOptions.length > 0 && (
                  <>
                    <div className="h-4 w-px bg-border/40" />
                    <select
                      value={siteFilter}
                      onChange={(e) => setSiteFilter(e.target.value)}
                      className="h-8 bg-card/60 border border-border/50 rounded-lg px-2 text-xs text-foreground focus:outline-none focus:border-violet-500/40 cursor-pointer"
                    >
                      <option value="all">All sites</option>
                      {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                    </select>
                  </>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* ── Results count ── */}
            <p className="text-sm text-muted-foreground mb-4">
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "session" : "sessions"}
                  {hasActiveFilters && sessions.length > filtered.length && (
                    <span className="text-muted-foreground/50"> of {sessions.length} total</span>
                  )}
                </>
              )}
            </p>

            {/* ── List ── */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border/30 bg-card/40 h-32 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <BankrollEmptyState
                icon={Layers}
                title={hasActiveFilters ? "No matching sessions" : "No sessions yet"}
                message={hasActiveFilters ? "Try adjusting your filters or search query." : "Log your first session to start building your bankroll history."}
                action={
                  !hasActiveFilters && (
                    <button
                      type="button"
                      onClick={openCreate}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/25"
                    >
                      <Plus className="h-4 w-4" />
                      New session
                    </button>
                  )
                }
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    currency={session.currency ?? currency}
                    mentalScore={mentalBySession[session.id]?.overall_score ?? null}
                    confirmingDelete={confirmDel === session.id}
                    onEdit={() => openEdit(session)}
                    onDelete={() => handleDeleteClick(session.id)}
                    onCancelDelete={cancelDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </main>

      {user && (
        <SessionFormModal
          open={modalOpen}
          userId={user.id}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Target } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GoalCard } from "@/components/bankroll/GoalCard";
import { GoalFormModal } from "@/components/bankroll/GoalFormModal";
import type { BankrollGoalRow, BankrollOverview } from "@/lib/bankroll/types";
import type { GoalProgressInput } from "@/lib/bankroll/goals";

export default function BankrollGoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [goals, setGoals] = useState<BankrollGoalRow[]>([]);
  const [progressInput, setProgressInput] = useState<Omit<GoalProgressInput, "goalType" | "targetValue"> | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: goalRows }, { data: overviewRow }, { data: settingsRow }] = await Promise.all([
        supabase
          .from("bankroll_goals")
          .select("id, goal_type, title, target_value, currency, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
        supabase.from("bankroll_settings").select("preferred_currency, starting_bankroll, starting_at").eq("user_id", user.id).maybeSingle(),
      ]);

      setGoals((goalRows ?? []) as unknown as BankrollGoalRow[]);
      setCurrency(settingsRow?.preferred_currency ?? "USD");

      const overview = overviewRow as unknown as BankrollOverview | null;
      const startingAt = settingsRow?.starting_at ?? user.created_at;
      const daysElapsed = Math.max(1, (Date.now() - new Date(startingAt).getTime()) / 86_400_000);

      setProgressInput({
        currentBankroll: overview?.current_bankroll ?? 0,
        startingBankroll: settingsRow?.starting_bankroll ?? 0,
        totalSessionProfit: overview?.total_session_profit ?? 0,
        totalHours: (overview?.total_minutes ?? 0) / 60,
        totalHands: overview?.total_hands ?? 0,
        sessionCount: overview?.session_count ?? 0,
        daysElapsed,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteClick = useCallback(async (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      return;
    }
    setConfirmDel(null);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const supabase = createClient();
    const { error } = await supabase.from("bankroll_goals").delete().eq("id", id);
    if (error) {
      console.error("[bankroll/goals] delete failed:", error.message);
      fetchData();
    }
  }, [confirmDel, fetchData]);

  if (authLoading || loading || !progressInput) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-8 animate-fade-in">
          <Link href="/bankroll" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Bankroll
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Goals</h1>
              <p className="text-muted-foreground mt-1.5">Track progress toward your bankroll, profit and volume milestones.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200 shrink-0"
            >
              <Plus className="h-4 w-4" />
              New goal
            </button>
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-16 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border/60">
                <Target className="h-7 w-7 text-muted-foreground/40" />
              </div>
            </div>
            <p className="text-foreground font-semibold mb-2">No goals yet</p>
            <p className="text-sm text-muted-foreground/60 mb-6">Set a bankroll, profit, or volume target and watch your progress build up here.</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/25"
            >
              <Plus className="h-4 w-4" />
              New goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progressInput={progressInput}
                confirmingDelete={confirmDel === goal.id}
                onDelete={() => handleDeleteClick(goal.id)}
                onCancelDelete={() => setConfirmDel(null)}
              />
            ))}
          </div>
        )}

      </main>

      {user && (
        <GoalFormModal open={modalOpen} userId={user.id} currency={currency} onClose={() => setModalOpen(false)} onSaved={fetchData} />
      )}
    </div>
  );
}

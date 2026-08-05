"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { GoalCard } from "@/components/bankroll/GoalCard";
import { GoalFormModal } from "@/components/bankroll/GoalFormModal";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { BankrollPageLoader } from "@/components/bankroll/BankrollPageLoader";
import { BankrollEmptyState } from "@/components/bankroll/BankrollEmptyState";
import { BankrollErrorState } from "@/components/bankroll/BankrollErrorState";
import type { BankrollGoalRow, BankrollOverview } from "@/lib/bankroll/types";
import type { GoalProgressInput } from "@/lib/bankroll/goals";

export default function BankrollGoalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [goals, setGoals] = useState<BankrollGoalRow[]>([]);
  const [progressInput, setProgressInput] = useState<Omit<GoalProgressInput, "goalType" | "targetValue"> | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: goalRows, error: goalsError }, { data: overviewRow }, { data: settingsRow }] = await Promise.all([
        supabase
          .from("bankroll_goals")
          .select("id, goal_type, title, target_value, currency, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
        supabase.from("bankroll_settings").select("preferred_currency, starting_bankroll, starting_at").eq("user_id", user.id).maybeSingle(),
      ]);

      if (goalsError) {
        console.error("[bankroll/goals] fetch error:", goalsError.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

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

  const { confirmId: confirmDel, handleDelete: handleDeleteClick, cancelDelete } = useConfirmDelete("bankroll_goals", setGoals, fetchData);

  if (authLoading || (loading && !loadError)) return <BankrollPageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-8 animate-fade-in">
          <BankrollBackLink />
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

        {loadError || !progressInput ? (
          <BankrollErrorState message="Couldn't load your goals." onRetry={fetchData} />
        ) : goals.length === 0 ? (
          <BankrollEmptyState
            icon={Target}
            title="No goals yet"
            message="Set a bankroll, profit, or volume target and watch your progress build up here."
            action={
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/25"
              >
                <Plus className="h-4 w-4" />
                New goal
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progressInput={progressInput}
                confirmingDelete={confirmDel === goal.id}
                onDelete={() => handleDeleteClick(goal.id)}
                onCancelDelete={cancelDelete}
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

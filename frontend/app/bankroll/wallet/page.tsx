"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { BankrollStatCard } from "@/components/bankroll/BankrollStatCard";
import { WalletTransactionModal } from "@/components/bankroll/WalletTransactionModal";
import { TransactionRow } from "@/components/bankroll/TransactionRow";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { BankrollPageLoader } from "@/components/bankroll/BankrollPageLoader";
import { BankrollEmptyState } from "@/components/bankroll/BankrollEmptyState";
import { BankrollErrorState } from "@/components/bankroll/BankrollErrorState";
import type { BankrollOverview, BankrollTransactionRow } from "@/lib/bankroll/types";

export default function BankrollWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<BankrollOverview | null>(null);
  const [transactions, setTransactions] = useState<BankrollTransactionRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalType, setModalType] = useState<"deposit" | "withdrawal" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: overviewRow, error: overviewError }, { data: transactionRows }, { data: settingsRow }] = await Promise.all([
        supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
        supabase
          .from("bankroll_transactions")
          .select("id, type, amount, currency, occurred_at, note")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(500),
        supabase.from("bankroll_settings").select("preferred_currency").eq("user_id", user.id).maybeSingle(),
      ]);

      if (overviewError) {
        console.error("[bankroll/wallet] fetch error:", overviewError.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

      setOverview(overviewRow as unknown as BankrollOverview | null);
      setTransactions((transactionRows ?? []) as unknown as BankrollTransactionRow[]);
      setCurrency(settingsRow?.preferred_currency ?? "USD");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentBankroll = overview?.current_bankroll ?? 0;
  const totalDeposits = overview?.total_deposits ?? 0;
  const totalWithdrawals = overview?.total_withdrawals ?? 0;
  const netProfit = overview?.total_session_profit ?? 0;
  const profitPositive = netProfit >= 0;

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
              <h1 className="text-3xl font-black text-foreground tracking-tight">Wallet</h1>
              <p className="text-muted-foreground mt-1.5">Move money in and out of your bankroll.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalType("withdrawal")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 bg-card/60 text-foreground text-sm font-semibold hover:border-border hover:bg-card/80 transition-all"
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Withdrawal
              </button>
              <button
                type="button"
                onClick={() => setModalType("deposit")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Deposit
              </button>
            </div>
          </div>
        </div>

        {loadError ? (
          <BankrollErrorState message="Couldn't load your wallet." onRetry={fetchData} />
        ) : (
          <>
            {/* ── Stat grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <BankrollStatCard
                icon={Wallet}
                label="Balance"
                value={loading ? "—" : formatCurrency(currentBankroll, currency)}
                caption="current bankroll"
                delayMs={0}
              />
              <BankrollStatCard
                icon={ArrowDownToLine}
                label="Total Deposited"
                value={loading ? "—" : formatCurrency(totalDeposits, currency)}
                caption="all-time"
                valueClassName="text-emerald-400"
                delayMs={40}
              />
              <BankrollStatCard
                icon={ArrowUpFromLine}
                label="Total Withdrawn"
                value={loading ? "—" : formatCurrency(totalWithdrawals, currency)}
                caption="all-time"
                valueClassName="text-red-400"
                delayMs={80}
              />
              <BankrollStatCard
                icon={profitPositive ? TrendingUp : TrendingDown}
                label="Net Profit"
                value={loading ? "—" : formatCurrency(netProfit, currency)}
                caption="from sessions, not deposits"
                valueClassName={profitPositive ? "text-emerald-400" : "text-red-400"}
                delayMs={120}
              />
            </div>

            {/* ── History ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-4">
                History
              </p>

              {loading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/30 bg-card/40 h-[60px] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <BankrollEmptyState
                  icon={Wallet}
                  title="No transactions yet"
                  message="Add a deposit to start tracking your bankroll."
                  size="compact"
                />
              ) : (
                <div className="space-y-2.5">
                  {transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)}
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {user && modalType && (
        <WalletTransactionModal
          open={modalType !== null}
          type={modalType}
          userId={user.id}
          currency={currency}
          onClose={() => setModalType(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

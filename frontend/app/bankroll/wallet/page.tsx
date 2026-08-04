"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Loader2, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { BankrollStatCard } from "@/components/bankroll/BankrollStatCard";
import { WalletTransactionModal } from "@/components/bankroll/WalletTransactionModal";
import { TransactionRow } from "@/components/bankroll/TransactionRow";
import type { BankrollOverview, BankrollTransactionRow } from "@/lib/bankroll/types";

export default function BankrollWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<BankrollOverview | null>(null);
  const [transactions, setTransactions] = useState<BankrollTransactionRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<"deposit" | "withdrawal" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: overviewRow }, { data: transactionRows }, { data: settingsRow }] = await Promise.all([
        supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
        supabase
          .from("bankroll_transactions")
          .select("id, type, amount, currency, occurred_at, note")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(500),
        supabase.from("bankroll_settings").select("preferred_currency").eq("user_id", user.id).maybeSingle(),
      ]);

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

  if (authLoading) {
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

        {/* ── Header ── */}
        <div className="mb-8 animate-fade-in">
          <Link href="/bankroll" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Bankroll
          </Link>
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
            <div className="rounded-2xl border border-border/40 bg-card/40 p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border/60">
                  <Wallet className="h-6 w-6 text-muted-foreground/40" />
                </div>
              </div>
              <p className="text-foreground font-semibold mb-2">No transactions yet</p>
              <p className="text-sm text-muted-foreground/60">Add a deposit to start tracking your bankroll.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)}
            </div>
          )}
        </div>

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

import { redirect } from "next/navigation";
import {
  Wallet, TrendingUp, TrendingDown, Percent, Layers, Clock, Activity, Coins, ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { BankrollStatCard } from "@/components/bankroll/BankrollStatCard";
import { BankrollChart } from "@/components/bankroll/BankrollChart";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { buildBankrollSeries } from "@/lib/bankroll/series";
import type {
  BankrollLedgerSession,
  BankrollLedgerTransaction,
  BankrollOverview,
  RecentBankrollSession,
  SettledBankrollSession,
} from "@/lib/bankroll/types";

export default async function BankrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: overviewRow },
    { data: settingsRow },
    { data: recentSessionRow },
    { data: settledSessionRows },
    { data: ledgerSessionRows },
    { data: ledgerTransactionRows },
  ] = await Promise.all([
    supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
    supabase
      .from("bankroll_settings")
      .select("preferred_currency, starting_bankroll, starting_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bankroll_sessions")
      .select("stakes, variant, site, session_type, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bankroll_sessions")
      .select("buy_in_amount, cash_out_amount")
      .eq("user_id", user.id)
      .not("cash_out_amount", "is", null),
    supabase
      .from("bankroll_sessions")
      .select("started_at, buy_in_amount, cash_out_amount, ev_amount")
      .eq("user_id", user.id)
      .order("started_at", { ascending: true })
      .limit(2000),
    supabase
      .from("bankroll_transactions")
      .select("occurred_at, type, amount")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: true })
      .limit(2000),
  ]);

  const overview = overviewRow as unknown as BankrollOverview | null;
  const recentSession = recentSessionRow as unknown as RecentBankrollSession | null;
  const settledSessions = (settledSessionRows ?? []) as unknown as SettledBankrollSession[];
  const ledgerSessions = (ledgerSessionRows ?? []) as unknown as BankrollLedgerSession[];
  const ledgerTransactions = (ledgerTransactionRows ?? []) as unknown as BankrollLedgerTransaction[];

  const currency = settingsRow?.preferred_currency ?? "USD";
  const startingAt = settingsRow?.starting_at ?? user.created_at;

  const { series: bankrollSeries, hasEvData } = buildBankrollSeries(
    settingsRow?.starting_bankroll ?? 0,
    startingAt,
    ledgerSessions,
    ledgerTransactions
  );

  const currentBankroll = overview?.current_bankroll ?? 0;
  const startingBankroll = overview?.starting_bankroll ?? 0;
  const sessionProfit = overview?.total_session_profit ?? 0;
  const sessionCount = overview?.session_count ?? 0;
  const totalHands = overview?.total_hands ?? 0;
  const totalMinutes = overview?.total_minutes ?? 0;
  const hours = totalMinutes / 60;

  const settledBuyIns = settledSessions.reduce((sum, s) => sum + Number(s.buy_in_amount ?? 0), 0);
  const roi = settledBuyIns > 0 ? (sessionProfit / settledBuyIns) * 100 : null;
  const avgPerHour = hours > 0 ? sessionProfit / hours : null;

  // Book-sourced heuristic: Modern Poker Theory, "MTT Bankroll Management", p.264 —
  // "I generally suggest keeping at least 200 buy-ins in your bankroll." That guidance
  // is stated for tournaments specifically; the book has no separate cash-game figure.
  // Applying the 200-buy-in floor here as a general bankroll-safety heuristic across
  // all game types is a pedagogical simplification, not a direct cash-game citation.
  const recommendedBuyIn = currentBankroll > 0 ? currentBankroll / 200 : null;

  const currentStakeLabel = recentSession?.stakes ?? "—";
  const currentStakeCaption = recentSession
    ? [recentSession.variant, recentSession.site].filter(Boolean).join(" · ") || "Most recent session"
    : "No sessions logged yet";

  const profitPositive = sessionProfit >= 0;
  const roiPositive = roi != null && roi >= 0;
  const avgPerHourPositive = avgPerHour != null && avgPerHour >= 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-10 page-enter">

        {/* ── Hero ── */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-violet-500/12 bg-gradient-to-br from-violet-950/40 via-background/70 to-blue-950/20 px-8 py-8 sm:px-10 animate-fade-in">
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-violet-600/12 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-0 h-48 w-48 rounded-full bg-blue-500/8 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60 mb-2">Bankroll</p>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              Your <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">bankroll</span>, at a glance
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed max-w-xl">
              Every deposit, session and result rolled into one running total.
            </p>
          </div>
        </div>

        {/* ── Stat grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BankrollStatCard
            icon={Wallet}
            label="Current Bankroll"
            value={formatCurrency(currentBankroll, currency)}
            caption={`Starting ${formatCurrency(startingBankroll, currency)}`}
            delayMs={0}
          />
          <BankrollStatCard
            icon={profitPositive ? TrendingUp : TrendingDown}
            label="Profit"
            value={formatCurrency(sessionProfit, currency)}
            caption="all-time, from sessions"
            valueClassName={profitPositive ? "text-emerald-400" : "text-red-400"}
            delayMs={40}
          />
          <BankrollStatCard
            icon={Percent}
            label="ROI"
            value={formatPercent(roi, { signed: true })}
            caption="return on buy-ins"
            valueClassName={roi != null ? (roiPositive ? "text-emerald-400" : "text-red-400") : undefined}
            delayMs={80}
          />
          <BankrollStatCard
            icon={Layers}
            label="Sessions"
            value={String(sessionCount)}
            caption={`${totalHands.toLocaleString()} hands played`}
            delayMs={120}
          />
          <BankrollStatCard
            icon={Clock}
            label="Hours"
            value={hours.toFixed(1)}
            caption="total time played"
            delayMs={160}
          />
          <BankrollStatCard
            icon={Activity}
            label="Average per hour"
            value={formatCurrency(avgPerHour, currency)}
            caption="profit per hour"
            valueClassName={avgPerHour != null ? (avgPerHourPositive ? "text-emerald-400" : "text-red-400") : undefined}
            delayMs={200}
          />
          <BankrollStatCard
            icon={Coins}
            label="Current Stake"
            value={currentStakeLabel}
            caption={currentStakeCaption}
            delayMs={240}
          />
          <BankrollStatCard
            icon={ShieldCheck}
            label="Recommended Stake"
            value={recommendedBuyIn != null ? `${formatCurrency(recommendedBuyIn, currency)} buy-in` : "—"}
            caption="200 buy-in rule · Modern Poker Theory p.264"
            delayMs={280}
          />
        </div>

        {/* ── Bankroll chart ── */}
        <div className="mt-8">
          <BankrollChart data={bankrollSeries} currency={currency} hasEvData={hasEvData} />
        </div>

      </main>
    </div>
  );
}

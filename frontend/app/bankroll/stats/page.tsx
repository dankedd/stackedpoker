import { redirect } from "next/navigation";
import {
  TrendingUp, TrendingDown, Percent, Coins, Activity,
  Flame, Snowflake, Trophy, AlertTriangle, Hash, Clock, Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { BankrollStatCard } from "@/components/bankroll/BankrollStatCard";
import { BreakdownSection } from "@/components/bankroll/BreakdownSection";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { computeSessionResult } from "@/lib/bankroll/sessionForm";
import {
  computeStreaks, computeBiggestWinLoss, computeWinRate, groupSessionsBy,
  type SessionForStats, type BankrollDimensionBreakdowns,
} from "@/lib/bankroll/stats";
import type { BankrollOverview } from "@/lib/bankroll/types";

export default async function BankrollStatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: sessionRows }, { data: overviewRow }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("bankroll_sessions")
      .select("started_at, buy_in_amount, cash_out_amount, hands_played, duration_minutes, site, stakes, variant")
      .eq("user_id", user.id)
      .limit(5000),
    supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
    supabase.from("bankroll_settings").select("preferred_currency").eq("user_id", user.id).maybeSingle(),
  ]);

  const sessions = (sessionRows ?? []) as unknown as SessionForStats[];
  const overview = overviewRow as unknown as BankrollOverview | null;
  const currency = settingsRow?.preferred_currency ?? "USD";

  const settled = sessions.filter((s) => s.cash_out_amount != null);
  const profit = settled.reduce((sum, s) => sum + computeSessionResult(s), 0);
  const totalHands = settled.reduce((sum, s) => sum + (s.hands_played ?? 0), 0);
  const totalHours = settled.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / 60;
  const sessionCount = settled.length;

  // ROI here is profit relative to money actually deposited into the bankroll
  // (bankroll_transactions), not profit/buy-ins — the session form only
  // captures a single "Resultaat" (buy_in_amount is always written as 0, see
  // sessionForm.ts), so a per-session buy-in-based ROI can't be computed from
  // this data model. This is an implementation decision, not a poker-theory
  // figure. total_deposits comes from the same bankroll_overview() RPC used
  // everywhere else on /bankroll for consistency.
  const totalDeposits = overview?.total_deposits ?? 0;
  const roi = totalDeposits > 0 ? (profit / totalDeposits) * 100 : null;

  const avgSession = sessionCount > 0 ? profit / sessionCount : null;
  const avgHour = totalHours > 0 ? profit / totalHours : null;

  const { longestWinStreak, longestLossStreak } = computeStreaks(sessions);
  const { biggestWin, biggestLoss } = computeBiggestWinLoss(sessions);
  const winRate = computeWinRate(sessions);

  const breakdowns: BankrollDimensionBreakdowns = {
    site: groupSessionsBy(sessions, "site"),
    stakes: groupSessionsBy(sessions, "stakes"),
    variant: groupSessionsBy(sessions, "variant"),
    month: groupSessionsBy(sessions, "month"),
    year: groupSessionsBy(sessions, "year"),
  };

  const profitPositive = profit >= 0;
  const roiPositive = roi != null && roi >= 0;
  const avgSessionPositive = avgSession != null && avgSession >= 0;
  const avgHourPositive = avgHour != null && avgHour >= 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-8 animate-fade-in">
          <BankrollBackLink />
          <h1 className="text-3xl font-black text-foreground tracking-tight">Statistics</h1>
          <p className="text-muted-foreground mt-1.5">Every angle on your results, all-time.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <BankrollStatCard
            icon={profitPositive ? TrendingUp : TrendingDown}
            label="Profit"
            value={formatCurrency(profit, currency)}
            caption="all-time, from sessions"
            valueClassName={profitPositive ? "text-emerald-400" : "text-red-400"}
            delayMs={0}
          />
          <BankrollStatCard
            icon={Percent}
            label="ROI"
            value={formatPercent(roi, { signed: true })}
            caption="profit vs. deposits"
            valueClassName={roi != null ? (roiPositive ? "text-emerald-400" : "text-red-400") : undefined}
            delayMs={30}
          />
          <BankrollStatCard
            icon={Coins}
            label="Average Session"
            value={formatCurrency(avgSession, currency)}
            caption="profit per session"
            valueClassName={avgSession != null ? (avgSessionPositive ? "text-emerald-400" : "text-red-400") : undefined}
            delayMs={60}
          />
          <BankrollStatCard
            icon={Activity}
            label="Average Hour"
            value={formatCurrency(avgHour, currency)}
            caption="profit per hour"
            valueClassName={avgHour != null ? (avgHourPositive ? "text-emerald-400" : "text-red-400") : undefined}
            delayMs={90}
          />
          <BankrollStatCard
            icon={Flame}
            label="Longest Winning Streak"
            value={String(longestWinStreak)}
            caption="consecutive winning sessions"
            valueClassName="text-emerald-400"
            delayMs={120}
          />
          <BankrollStatCard
            icon={Snowflake}
            label="Longest Losing Streak"
            value={String(longestLossStreak)}
            caption="consecutive losing sessions"
            valueClassName={longestLossStreak > 0 ? "text-red-400" : undefined}
            delayMs={150}
          />
          <BankrollStatCard
            icon={Trophy}
            label="Biggest Win"
            value={formatCurrency(biggestWin, currency)}
            caption="single best session"
            valueClassName="text-emerald-400"
            delayMs={180}
          />
          <BankrollStatCard
            icon={AlertTriangle}
            label="Biggest Loss"
            value={formatCurrency(biggestLoss, currency)}
            caption="single worst session"
            valueClassName={biggestLoss != null && biggestLoss < 0 ? "text-red-400" : undefined}
            delayMs={210}
          />
          <BankrollStatCard
            icon={Hash}
            label="Hands"
            value={totalHands.toLocaleString()}
            caption="total hands played"
            delayMs={240}
          />
          <BankrollStatCard
            icon={Clock}
            label="Hours"
            value={totalHours.toFixed(1)}
            caption="total time played"
            delayMs={270}
          />
          <BankrollStatCard
            icon={Target}
            label="Winrate"
            value={formatPercent(winRate)}
            caption="% of winning sessions"
            delayMs={300}
          />
        </div>

        <BreakdownSection breakdowns={breakdowns} currency={currency} />

      </main>
    </div>
  );
}

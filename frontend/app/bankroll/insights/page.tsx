import { redirect } from "next/navigation";
import { Bot, Coins, TrendingDown, Clock, Layers, Percent, Wallet, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { InsightCard } from "@/components/bankroll/InsightCard";
import { InsightTipCard } from "@/components/bankroll/InsightTipCard";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { computeSessionResult } from "@/lib/bankroll/sessionForm";
import {
  computeStakeInsights, computeDurationInsight, computeTimeOfDayBreakdown, bestAndWorstTimeOfDay,
  computeVolumeInsight, computeRoi, computeBankrollGrowth, generateInsightTips,
} from "@/lib/bankroll/insights";
import type { SessionForStats } from "@/lib/bankroll/stats";
import type { BankrollOverview } from "@/lib/bankroll/types";

export default async function BankrollInsightsPage() {
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
    supabase.from("bankroll_settings").select("preferred_currency, starting_bankroll, starting_at").eq("user_id", user.id).maybeSingle(),
  ]);

  const sessions = (sessionRows ?? []) as unknown as SessionForStats[];
  const overview = overviewRow as unknown as BankrollOverview | null;
  const currency = settingsRow?.preferred_currency ?? "USD";

  const profit = sessions.filter((s) => s.cash_out_amount != null).reduce((sum, s) => sum + computeSessionResult(s), 0);
  const startingAt = settingsRow?.starting_at ?? user.created_at;
  const daysElapsed = Math.max(1, (Date.now() - new Date(startingAt).getTime()) / 86_400_000);

  const stakes = computeStakeInsights(sessions);
  const duration = computeDurationInsight(sessions);
  const timeOfDayBreakdown = computeTimeOfDayBreakdown(sessions);
  const timeOfDay = bestAndWorstTimeOfDay(timeOfDayBreakdown);
  const volume = computeVolumeInsight(sessions);
  const roi = computeRoi(profit, overview?.total_deposits ?? 0);
  const growth = computeBankrollGrowth(overview?.current_bankroll ?? 0, settingsRow?.starting_bankroll ?? 0, daysElapsed);

  const tips = generateInsightTips({ stakes, duration, timeOfDay, volume, roi, growth, currency });

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-6 animate-fade-in">
          <BankrollBackLink />
        </div>

        {/* ── Hero — same visual language as /coach ── */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/50 via-background/70 to-blue-950/25 px-8 py-8 sm:px-10 animate-fade-in">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 shrink-0">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60 mb-1.5">AI Coach Insights</p>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 tracking-tight">Your Bankroll, Analyzed</h1>
              <p className="text-muted-foreground max-w-lg leading-relaxed">
                Automatic patterns from every session you&apos;ve logged — stakes, timing, duration, and trend.
              </p>
            </div>
          </div>
        </div>

        {/* ── Insight cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <InsightCard
            icon={Coins}
            label="Best Stake"
            value={stakes.best ? stakes.best.label : "Not enough data"}
            caption={stakes.best ? `${formatCurrency(stakes.best.avgProfit, currency)}/session avg · ${stakes.best.sessionCount} sessions` : "Log 3+ sessions per stake"}
            valueClassName={stakes.best ? "text-emerald-400" : undefined}
          />
          <InsightCard
            icon={TrendingDown}
            label="Worst Stake"
            value={stakes.worst ? stakes.worst.label : "Not enough data"}
            caption={stakes.worst ? `${formatCurrency(stakes.worst.avgProfit, currency)}/session avg · ${stakes.worst.sessionCount} sessions` : "Log 3+ sessions per stake"}
            valueClassName={stakes.worst ? "text-red-400" : undefined}
          />
          <InsightCard
            icon={Clock}
            label="Best Session Duration"
            value={duration.best ? duration.best.label : "Not enough data"}
            caption={duration.best ? `${formatCurrency(duration.best.avgProfitPerHour, currency)}/hour avg · ${duration.best.sessionCount} sessions` : "Log 3+ sessions per length bucket"}
            valueClassName={duration.best ? "text-emerald-400" : undefined}
          />
          <InsightCard
            icon={Layers}
            label="Volume"
            value={`${volume.sessionCount} session${volume.sessionCount === 1 ? "" : "s"}`}
            caption={`${volume.totalHours.toFixed(1)}h played · ${volume.totalHands.toLocaleString()} hands`}
          />
          <InsightCard
            icon={Percent}
            label="ROI"
            value={formatPercent(roi, { signed: true })}
            caption="profit vs. deposits"
            valueClassName={roi != null ? (roi >= 0 ? "text-emerald-400" : "text-red-400") : undefined}
          />
          <InsightCard
            icon={Wallet}
            label="Bankroll Growth"
            value={growth.growthPercent != null ? formatPercent(growth.growthPercent, { signed: true }) : formatCurrency(growth.growthAmount, currency)}
            caption={`${formatCurrency(growth.growthAmount, currency)} since you started tracking`}
            valueClassName={growth.growthAmount >= 0 ? "text-emerald-400" : "text-red-400"}
          />
        </div>

        {/* ── Results by time of day ── */}
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3.5">
            <CalendarClock className="h-3.5 w-3.5 text-violet-400/70" />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Results by Time of Day</p>
          </div>
          {timeOfDayBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">No settled sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {timeOfDayBreakdown.map((bucket) => {
                const positive = bucket.avgProfit >= 0;
                return (
                  <div key={bucket.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 rounded-xl border border-border/30 bg-background/30 px-4 py-2.5">
                    <p className="text-sm font-medium text-foreground sm:w-44 shrink-0">{bucket.label}</p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground/60">
                      <span className={cn("font-bold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
                        {positive ? "+" : ""}{formatCurrency(bucket.avgProfit, currency)}/session avg
                      </span>
                      <span>{bucket.sessionCount} session{bucket.sessionCount !== 1 ? "s" : ""}</span>
                      <span>{Math.round(bucket.winRate)}% win rate</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Coach's tips ── */}
        <InsightTipCard tips={tips} />

      </main>
    </div>
  );
}

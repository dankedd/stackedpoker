import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, BookOpen, BarChart3, ChevronRight,
  Layers, Clock, Spade, Brain, Zap, Settings,
} from "lucide-react";
import { PuzzleTrainingPanel } from "@/components/dashboard/PuzzleTrainingPanel";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { cn } from "@/lib/utils";

// Client component just for the upgrade CTA (needs onClick)
import { UpgradeCTA } from "./upgrade-cta";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, subscription_tier, hands_analyzed_count, analyses_limit, subscription_status, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const displayName = profile?.username ?? user.email?.split("@")[0] ?? "Player";
  const handsAnalyzed = profile?.hands_analyzed_count ?? 0;
  const tier = profile?.subscription_tier ?? "free";
  const subStatus = profile?.subscription_status ?? null;
  const hasStripeCustomer = !!profile?.stripe_customer_id;
  const isUnlimited = tier === "pro" || tier === "admin";
  const limit = profile?.analyses_limit ?? 3;

  const planLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const planColor = tier === "pro" ? "text-blue-400" : tier === "admin" ? "text-violet-400" : "text-muted-foreground";
  const planSub = tier === "free"
    ? `${handsAnalyzed}/${limit} free analyses used`
    : subStatus === "past_due" ? "Payment past due" : "Active";

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-10 page-enter">

        {/* Success banner (client — reads ?upgraded=1) */}
        <UpgradeBanner />

        {/* ── Welcome hero ── */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-violet-500/12 bg-gradient-to-br from-violet-950/40 via-background/70 to-blue-950/20 px-8 py-8 sm:px-10 animate-fade-in">
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-violet-600/12 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-0 h-48 w-48 rounded-full bg-blue-500/8 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60 mb-2">Dashboard</p>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">{displayName}</span>
              </h1>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                {handsAnalyzed > 0
                  ? `${handsAnalyzed} hand${handsAnalyzed !== 1 ? "s" : ""} analyzed — keep building your edge.`
                  : "Analyze your first hand to start building patterns and closing leaks."}
              </p>
            </div>
            <Link
              href="/analyze"
              className="group relative overflow-hidden shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <Spade className="h-4 w-4" />
              Analyze a hand
            </Link>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-violet-950/30 via-card/70 to-card/60 p-6 space-y-3 card-lift stagger-item" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Hands Analyzed</span>
            </div>
            <p className="text-4xl font-black text-violet-400">{handsAnalyzed}</p>
            <p className="text-xs text-muted-foreground/50">total sessions</p>
          </div>

          {/* Plan tile — tier-responsive */}
          <div className={cn(
            "rounded-2xl border p-6 space-y-3 card-lift stagger-item",
            tier === "pro"   ? "border-blue-500/25 bg-gradient-to-br from-blue-950/40 via-card/70 to-card/60" :
            tier === "admin" ? "border-violet-500/25 bg-gradient-to-br from-violet-950/40 via-card/70 to-card/60" :
            "border-border/50 bg-card/60"
          )} style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Plan</span>
            </div>
            <p className={cn("text-4xl font-black", planColor)}>{planLabel}</p>
            <p className="text-xs text-muted-foreground/50">{planSub}</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/60 p-6 space-y-3 card-lift stagger-item" style={{ animationDelay: "180ms" }}>
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Member since</span>
            </div>
            <p className="text-4xl font-black text-muted-foreground/70">
              {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-muted-foreground/50">account age</p>
          </div>
        </div>

        {/* Upgrade / manage strip */}
        {tier === "free" && (
          <div className="mb-8 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/8 to-blue-500/8 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30 shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Upgrade to Pro</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Advanced analysis, AI coaching, puzzles & more — €14.99/month · iDEAL & card
                </p>
              </div>
            </div>
            <UpgradeCTA />
          </div>
        )}

        {tier === "pro" && hasStripeCustomer && (
          <div className="mb-8 flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-5 py-3.5 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Manage your Pro subscription, invoices, or payment method</span>
            </div>
            <ManageSubscriptionButton size="sm" />
          </div>
        )}

        {/* Quick actions */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-4">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/analyze" className="group block">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/8 hover:border-violet-500/40 p-6 card-lift h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 transition-transform duration-200 group-hover:scale-105 will-change-transform">
                    <Spade className="h-5 w-5 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Analyze a Hand</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste a hand history or upload a screenshot for instant GTO coaching.
                </p>
              </div>
            </Link>

            <Link href="/history" className="group block">
              <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border/80 p-6 card-lift h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border/60 transition-transform duration-200 group-hover:scale-105 will-change-transform">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Hand History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Review past analyses, replay hands, and track your improvement.
                </p>
              </div>
            </Link>

            <Link href="/analyze/puzzles" className="group block">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/8 hover:border-violet-500/40 p-6 card-lift h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/25 transition-transform duration-200 group-hover:scale-105 will-change-transform">
                    <Brain className="h-5 w-5 text-violet-400" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Puzzles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Train with multi-street interactive scenarios and live AI coaching.
                </p>
              </div>
            </Link>

            <Link href="/settings" className="group block">
              <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border/80 p-6 card-lift h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border/60 transition-transform duration-200 group-hover:scale-105 will-change-transform">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your subscription, billing, and account details.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Puzzle training stats */}
        <div className="mb-10">
          <PuzzleTrainingPanel />
        </div>

        {/* Recent analyses placeholder */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Recent Analyses</p>
            <Link href="/history" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-12 text-center">
            <div className="flex justify-center mb-5">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/12 to-blue-500/8 border border-violet-500/15">
                <Layers className="h-7 w-7 text-violet-400/50" />
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#0B0F1A] border border-border/60 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-muted-foreground/60">0</span>
                </div>
              </div>
            </div>
            <p className="text-foreground font-semibold">Start your study library</p>
            <p className="text-sm text-muted-foreground mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">
              Analyze your first hand to start building patterns, tracking leaks, and improving your game.
            </p>
            <Button variant="poker" size="sm" asChild>
              <Link href="/analyze">Analyze your first hand</Link>
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
}

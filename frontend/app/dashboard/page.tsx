import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, BookOpen, BarChart3, ChevronRight,
  Layers, Clock, Spade, Brain, Zap, Settings,
} from "lucide-react";
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

      <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-10">

        {/* Success banner (client — reads ?upgraded=1) */}
        <UpgradeBanner />

        {/* Welcome */}
        <div className="mb-10 animate-fade-in">
          <p className="text-sm font-medium text-violet-400 mb-1">Dashboard</p>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="text-muted-foreground mt-2">
            Ready to review your game and find the leaks?
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Hands Analyzed</span>
            </div>
            <p className="text-3xl font-bold text-violet-400">{handsAnalyzed}</p>
            <p className="text-xs text-muted-foreground/60">total sessions</p>
          </div>

          {/* Plan tile — responsive based on tier */}
          <div className={cn(
            "rounded-xl border p-6 space-y-3 animate-fade-in",
            tier === "pro"   ? "border-blue-500/20 bg-blue-500/5" :
            tier === "admin" ? "border-violet-500/20 bg-violet-500/5" :
            "border-border/60 bg-card/60"
          )}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Plan</span>
            </div>
            <p className={cn("text-3xl font-bold", planColor)}>{planLabel}</p>
            <p className="text-xs text-muted-foreground/60">{planSub}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Member since</span>
            </div>
            <p className="text-3xl font-bold text-muted-foreground">
              {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-muted-foreground/60">account age</p>
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
                  Unlimited analyses, session review, puzzles — €9/month · iDEAL & card
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
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/analyze" className="group">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
                    <Spade className="h-5 w-5 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Analyze a Hand</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste a hand history or upload a screenshot for instant GTO coaching.
                </p>
              </div>
            </Link>

            <Link href="/history" className="group">
              <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border/60">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Hand History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Review past analyses, replay hands, and track your improvement.
                </p>
              </div>
            </Link>

            <Link href="/analyze/puzzles" className="group">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/25">
                    <Brain className="h-5 w-5 text-violet-400" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Puzzles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Train with multi-street interactive scenarios and live AI coaching.
                </p>
              </div>
            </Link>

            <Link href="/settings" className="group">
              <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border/60">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your subscription, billing, and account details.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent analyses placeholder */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Analyses</h2>
            <Link href="/history" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border/60">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-foreground font-medium">No analyses yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Analyze your first hand to start tracking your progress.
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

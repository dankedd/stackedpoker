import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, BookOpen, BarChart3, ChevronRight,
  Layers, Clock, Spade, Puzzle, Film, Settings, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { PlanBadge } from "@/components/layout/PlanBadge";
import { ContinueLearningCard } from "@/components/dashboard/ContinueLearningCard";
import { LearningPathSummary } from "@/components/dashboard/LearningPathSummary";
import { SkillProfileWidget, type SkillProfileData } from "@/components/dashboard/SkillProfileWidget";
import { PersonalizedActionsWidget } from "@/components/dashboard/PersonalizedActionsWidget";
// Metadata only — never '@/lib/learn/curriculum'. See scripts/generateCurriculumPublic.ts.
import { MODULES_BY_SLUG } from "@/lib/learn/curriculumPublic.generated";
import { isPaidTier, canAccessElite, getSubscription } from "@/lib/entitlements";
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

  const { data: assessmentRow } = await supabase
    .from("user_skill_assessment")
    .select("experience_level, recommended_module_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const recommendedModuleTitle = assessmentRow?.recommended_module_id
    ? MODULES_BY_SLUG[assessmentRow.recommended_module_id]?.title ?? null
    : null;

  const skillProfile: SkillProfileData | null = assessmentRow
    ? {
        experienceLevel: assessmentRow.experience_level,
        recommendedModuleTitle,
      }
    : null;

  const displayName = profile?.username ?? user.email?.split("@")[0] ?? "Player";
  const handsAnalyzed = profile?.hands_analyzed_count ?? 0;
  const tier = profile?.subscription_tier ?? "free";
  const subStatus = profile?.subscription_status ?? null;
  const hasStripeCustomer = !!profile?.stripe_customer_id;
  const limit = profile?.analyses_limit ?? 3;

  const planColor = canAccessElite(tier) ? "text-amber-400" : isPaidTier(tier) ? "text-violet-400" : "text-muted-foreground";
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
              <div className="flex items-center gap-2.5 mb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60">Dashboard</p>
                <PlanBadge tier={tier} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">{displayName}</span>
              </h1>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Pick up where you left off and keep building your poker foundation.
              </p>
            </div>
            <Link
              href="/learn"
              className="group relative overflow-hidden shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <BookOpen className="h-4 w-4" />
              Continue Learning
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
            canAccessElite(tier) ? "border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-card/70 to-card/60" :
            isPaidTier(tier)     ? "border-violet-500/25 bg-gradient-to-br from-violet-950/40 via-card/70 to-card/60" :
            "border-border/50 bg-card/60"
          )} style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Plan</span>
            </div>
            <p className={cn("text-4xl font-black", planColor)}>{getSubscription(tier).label}</p>
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
                <p className="font-semibold text-foreground text-sm">Upgrade to Plus</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unlock every Learn module, full Bankroll Tracker, and more AI Coach — €7.99/month · iDEAL & card
                </p>
              </div>
            </div>
            <UpgradeCTA />
          </div>
        )}

        {isPaidTier(tier) && hasStripeCustomer && (
          <div className="mb-8 flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-5 py-3.5 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Manage your {getSubscription(tier).label} subscription, invoices, or payment method</span>
            </div>
            <ManageSubscriptionButton size="sm" />
          </div>
        )}

        {/* Continue Learning — primary CTA */}
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-3">
            Continue learning
          </p>
          <ContinueLearningCard />
        </div>

        {/* Personalized for the learner's self-reported experience level */}
        {skillProfile && (
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/60 mb-3">
              Recommended for you
            </p>
            <PersonalizedActionsWidget
              level={skillProfile.experienceLevel}
              recommendedModuleId={assessmentRow?.recommended_module_id ?? null}
            />
          </div>
        )}

        {/* Skill profile — from the onboarding self-assessment */}
        <div className="mb-6">
          <SkillProfileWidget data={skillProfile} />
        </div>

        {/* Your Learning Path */}
        <div className="mb-10">
          <LearningPathSummary />
        </div>

        {/* Next for Stacked — muted, clearly secondary */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-4">
            Next for Stacked
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: "/practice", icon: Puzzle, title: "Practice", status: "next" as const, description: "Turn concepts into instinct through strategy-backed training." },
              { href: "/analyze",  icon: Spade,  title: "Analyze",  status: "later" as const, description: "Study your own hands with strategy-backed explanations." },
              { href: "/replay",   icon: Film,   title: "Replay",   status: "later" as const, description: "Reconstruct hands street by street." },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group block">
                <div className="rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 hover:border-border/60 p-4 h-full transition-colors">
                  <div className="flex items-center justify-between mb-2.5">
                    <item.icon className="h-4 w-4 text-muted-foreground/50" />
                    <StatusBadge status={item.status} className="text-[9px] py-0.5 px-2" />
                  </div>
                  <h3 className="text-sm font-semibold text-muted-foreground/80">{item.title}</h3>
                  <p className="text-xs text-muted-foreground/45 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-4">Account</p>
          {/* Settings is the only account entry — Hand History pointed at an
              unreleased feature and was removed, so this is a single column
              rather than a 2-up row with a hole in it. */}
          <div className="grid grid-cols-1 gap-3">
            <Link href="/settings" className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border/80 px-4 py-3.5 transition-colors">
              <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-medium flex-1">Settings</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Recent analyses — de-emphasized, Analyze is in development */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">Recent Analyses</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/20 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/30 border border-border/40">
                <Layers className="h-5 w-5 text-muted-foreground/40" />
              </div>
            </div>
            <p className="text-foreground/70 font-medium text-sm">Analyze is in development</p>
            <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs mx-auto leading-relaxed">
              We&apos;re rebuilding hand analysis around a reliable strategy foundation. Your analyzed hands will show up here once it&apos;s available.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}

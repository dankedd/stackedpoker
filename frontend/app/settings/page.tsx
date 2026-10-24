import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { PlanBadge } from "@/components/layout/PlanBadge";
import { parseEntitlements, type Entitlements } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { PokerExperiencePicker } from "./PokerExperiencePicker";
import { EmailPreferences } from "./EmailPreferences";
import { DisplayNameForm } from "./DisplayNameForm";
import { SETTINGS } from "@/lib/lifecycle/strings";
import { ProductToursCard } from "@/components/onboarding/TourLinks";
import type { ExperienceLevel } from "@/lib/learn/experienceLevel";
import { canUseFeature } from "@/lib/features";
import { HandleForm } from "@/components/social/HandleForm";
import { AccountDataCard } from "@/components/social/AccountDataCard";

const STATUS_STYLE: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  active:     { icon: <CheckCircle2 className="h-4 w-4" />, label: "Active",     color: "text-emerald-400" },
  trialing:   { icon: <CheckCircle2 className="h-4 w-4" />, label: "Trialing",   color: "text-blue-400" },
  past_due:   { icon: <AlertTriangle className="h-4 w-4" />, label: "Past due — update payment", color: "text-amber-400" },
  canceled:   { icon: <Clock className="h-4 w-4" />,         label: "Canceled",   color: "text-muted-foreground" },
  incomplete: { icon: <AlertTriangle className="h-4 w-4" />, label: "Incomplete", color: "text-amber-400" },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, subscription_tier")
    .eq("id", user.id)
    .single();

  const { data: assessmentRow } = await supabase
    .from("user_skill_assessment")
    .select("experience_level")
    .eq("user_id", user.id)
    .maybeSingle();
  const currentLevel = (assessmentRow?.experience_level ?? null) as ExperienceLevel | null;

  // Separate query: the column comes from supabase_retention.sql.
  const { data: emailRow } = await supabase.from("profiles").select("email_opt_out").eq("id", user.id).maybeSingle();
  const emailOptOut = emailRow?.email_opt_out === true;

  // Separate query: the column comes from supabase_display_name.sql. Until that
  // has run, the old read-only username row is shown instead of the form.
  const { data: nameRow, error: nameError } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const displayName = (nameRow?.display_name as string | null | undefined) ?? null;

  // Plan, limits and usage: the database's own view (my_entitlements()).
  const { data: entRaw } = await supabase.rpc("my_entitlements");
  const ent = parseEntitlements(entRaw);
  const tier = profile?.subscription_tier ?? "free";

  // Social layer (supabase/migrations/*social*): username + data controls.
  // my_social_profile() fails until the migration has run → no form.
  const social = canUseFeature("social", tier);
  const { data: socialRaw } = social ? await supabase.rpc("my_social_profile") : { data: null };
  const socialProfile = socialRaw as { handle: string | null; next_handle_change_at: string | null } | null;
  const plan = ent?.plan ?? "free";
  const status = ent?.subscription.status ?? null;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const periodEnd = ent?.subscription.currentPeriodEnd ? fmtDate(ent.subscription.currentPeriodEnd) : null;
  const hasStripeCustomer = !!ent?.subscription.hasCustomer;
  const statusInfo = status ? STATUS_STYLE[status] ?? null : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-2xl px-4 sm:px-6 py-10">
        {/* Back */}
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">Manage your account and subscription.</p>

        {/* Subscription card */}
        <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="font-semibold text-foreground">Subscription</h2>
            {plan === "trial" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-400">
                <Zap className="h-3 w-3" /> Pro trial
              </span>
            ) : (
              <PlanBadge tier={tier === "admin" ? "admin" : plan === "pro" ? "pro" : "free"} />
            )}
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4">
            {/* Status row */}
            {statusInfo && (
              <div className="flex items-center gap-2 text-sm">
                <span className={statusInfo.color}>{statusInfo.icon}</span>
                <span className={cn("font-medium", statusInfo.color)}>{statusInfo.label}</span>
              </div>
            )}

            {plan === "trial" && ent?.trialEndsAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trial ends</span>
                <span className="font-medium text-foreground">{fmtDate(ent.trialEndsAt)}</span>
              </div>
            )}

            {/* Usage (Free limits; Pro and trial are unlimited) */}
            {ent && <UsageRows ent={ent} />}

            {/* Period end */}
            {periodEnd && status !== "canceled" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {ent?.subscription.cancelAtPeriodEnd ? "Pro until" : "Next billing date"}
                </span>
                <span className="font-medium text-foreground">{periodEnd}</span>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 flex flex-wrap gap-3">
            {plan !== "pro" && (
              <Button variant="poker" size="sm" asChild>
                <Link href="/pricing?source=pricing_page">Upgrade to Pro →</Link>
              </Button>
            )}
            {hasStripeCustomer && (
              <ManageSubscriptionButton />
            )}
          </div>
        </div>

        {/* Account card */}
        <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40">
          <div className="px-6 py-4">
            <h2 className="font-semibold text-foreground">Account</h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            {socialProfile && (
              <HandleForm current={socialProfile.handle} nextChangeAt={socialProfile.next_handle_change_at} />
            )}
            {nameError ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium text-foreground">{profile?.username ?? "—"}</span>
              </div>
            ) : (
              <DisplayNameForm current={displayName} />
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium text-foreground">
                {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* Email card */}
        <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 mt-6">
          <div className="px-6 py-4">
            <h2 className="font-semibold text-foreground">{SETTINGS.title}</h2>
          </div>
          <div className="px-6 py-5">
            <EmailPreferences optedOut={emailOptOut} />
          </div>
        </div>

        <ProductToursCard />

        {/* Learning card */}
        <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 mt-6">
          <div className="px-6 py-4">
            <h2 className="font-semibold text-foreground">Poker Experience</h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs text-muted-foreground/70">
              Changes your recommendations — your course progress is never affected.
            </p>
            <PokerExperiencePicker currentLevel={currentLevel} />
          </div>
        </div>

        {social && <AccountDataCard />}
      </main>
    </div>
  );
}

function UsageRows({ ent }: { ent: Entitlements }) {
  const rows: [string, number, number | null][] = [
    ["Preflop Trainer hands today", ent.usage.trainerHandsToday, ent.limits.trainerHandsPerDay],
    ["Tournaments uploaded this week", ent.usage.tournamentsThisWeek, ent.limits.tournamentsPerWeek],
    ["AI Coach questions today", ent.usage.aiQuestionsToday, ent.limits.aiQuestionsPerDay],
  ];
  return (
    <>
      {rows.map(([label, used, limit]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">
            {limit === null ? (
              <span className="flex items-center gap-1 text-violet-400">
                <Zap className="h-3.5 w-3.5" /> Unlimited
              </span>
            ) : (
              `${Math.min(used, limit)} / ${limit}`
            )}
          </span>
        </div>
      ))}
    </>
  );
}

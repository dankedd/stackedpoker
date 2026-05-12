import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { cn } from "@/lib/utils";

const PLAN_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:  { label: "Free",  color: "text-muted-foreground", bg: "bg-secondary/60",    border: "border-border/50" },
  pro:   { label: "Pro",   color: "text-blue-400",         bg: "bg-blue-500/10",     border: "border-blue-500/20" },
  admin: { label: "Admin", color: "text-violet-400",       bg: "bg-violet-500/10",   border: "border-violet-500/20" },
};

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
    .select("username, subscription_tier, hands_analyzed_count, analyses_limit, subscription_status, current_period_end, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const tier = profile?.subscription_tier ?? "free";
  const status = profile?.subscription_status ?? null;
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const hasStripeCustomer = !!profile?.stripe_customer_id;
  const planStyle = PLAN_STYLE[tier] ?? PLAN_STYLE.free;
  const statusInfo = status ? STATUS_STYLE[status] ?? null : null;
  const isUnlimited = tier === "pro" || tier === "admin";
  const used = profile?.hands_analyzed_count ?? 0;
  const limit = profile?.analyses_limit ?? 3;

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
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", planStyle.bg, planStyle.border, planStyle.color)}>
              {planStyle.label}
            </span>
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

            {/* Usage */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Analyses used</span>
              <span className="font-medium text-foreground">
                {isUnlimited ? (
                  <span className="flex items-center gap-1 text-blue-400">
                    <Zap className="h-3.5 w-3.5" /> Unlimited
                  </span>
                ) : (
                  `${used} / ${limit}`
                )}
              </span>
            </div>

            {/* Period end */}
            {periodEnd && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === "canceled" ? "Access until" : "Next billing date"}
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
            {tier === "free" && (
              <Button variant="poker" size="sm" asChild>
                <Link href="/dashboard">Upgrade to Pro →</Link>
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
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium text-foreground">{profile?.username ?? "—"}</span>
            </div>
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
      </main>
    </div>
  );
}

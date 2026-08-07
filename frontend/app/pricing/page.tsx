import Link from "next/link";
import { Check, Infinity, Zap, Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { UpgradePricingCTA } from "./upgrade-cta";
import { PricingFAQ } from "./faq";
import { cn } from "@/lib/utils";

// ── Configurable prices ───────────────────────────────────────────────────────
// Internal tier keys ("pro"/"premium") stay as-is — they mirror Supabase's
// subscription_tier enum and the Stripe checkout plan param. "Plus"/"Elite"
// below are display labels only.

const PLUS_PRICE  = "€7.99";
const ELITE_PRICE = "€11.99";

// ── Plan feature rows ─────────────────────────────────────────────────────────

const FREE_FEATURES = [
  { text: "Module 1",                            limit: null },
  { text: "Module 2",                             limit: null },
  { text: "First lesson of every remaining module", limit: null },
  { text: "XP & Levels",                          limit: null },
  { text: "Achievements",                         limit: null },
  { text: "Daily Streak",                         limit: null },
  { text: "Leaderboard",                          limit: null },
  { text: "Range Trainer",                        limit: "Limited scenarios" },
  { text: "AI Coach",                             limit: "3 messages per day" },
];

const PLUS_FEATURES = [
  { text: "Everything in Free",                   limit: null },
  { text: "Access to all Learn modules",          limit: null },
  { text: "Access to all future modules",         limit: null },
  { text: "All interactive lessons & exercises",  limit: null },
  { text: "AI Coach",                             limit: "15 messages per day" },
  { text: "Full Range Trainer",                   limit: null },
  { text: "Full Bankroll Tracker",                limit: "Overview · Wallet · Sessions · Calendar · Goals · Stats · AI Insights" },
  { text: "Personal Dashboard",                   limit: null },
  { text: "Full progress tracking",               limit: null },
];

const ELITE_FEATURES = [
  { text: "Everything in Plus",     unlimited: false },
  { text: "Unlimited AI Coach",     unlimited: true },
  { text: "Solver Explorer",        unlimited: false },
  { text: "Solver Tree Explorer",   unlimited: false },
];

// ── Comparison table ──────────────────────────────────────────────────────────

type CompRow = {
  feature: string;
  free: string | boolean;
  plus: string | boolean;
  elite: string | boolean;
};

const COMPARISON: CompRow[] = [
  { feature: "Learn modules",        free: "Module 1-2 + first lesson each", plus: "All modules", elite: "All modules" },
  { feature: "XP & Levels",          free: true,  plus: true,  elite: true },
  { feature: "Achievements",         free: true,  plus: true,  elite: true },
  { feature: "Daily Streak",         free: true,  plus: true,  elite: true },
  { feature: "Leaderboard",          free: true,  plus: true,  elite: true },
  { feature: "Range Trainer",        free: "Limited", plus: "Full", elite: "Full" },
  { feature: "AI Coach",             free: "3/day", plus: "15/day", elite: "Unlimited" },
  { feature: "Bankroll Tracker",     free: false, plus: true,  elite: true },
  { feature: "Personal Dashboard",   free: false, plus: true,  elite: true },
  { feature: "Full progress tracking", free: false, plus: true, elite: true },
  { feature: "Solver Explorer",      free: false, plus: false, elite: true },
  { feature: "Solver Tree Explorer", free: false, plus: false, elite: true },
  { feature: "Cancel anytime",       free: true,  plus: true,  elite: true },
];

// ─────────────────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let tier = "free";
  let hasStripeCustomer = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, stripe_customer_id")
      .eq("id", user.id)
      .single();
    tier              = profile?.subscription_tier ?? "free";
    hasStripeCustomer = !!profile?.stripe_customer_id;
  }

  const isPremium = tier === "premium" || tier === "admin";
  const isPro     = tier === "pro";
  const isAnyPaid = isPro || isPremium;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar variant="static" />

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-violet-600/8 blur-[140px]" />
            <div className="absolute top-32 left-1/4 w-[400px] h-[300px] rounded-full bg-blue-600/5 blur-[100px]" />
            <div className="absolute top-20 right-1/4 w-[350px] h-[250px] rounded-full bg-amber-500/4 blur-[100px]" />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Simple, transparent pricing
            </div>

            <h1 className="mb-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
              Pick your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-blue-400 to-violet-400">
                level of grind.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Every plan shares the same core platform. Plus and Elite unlock
              more of it as you grow.
            </p>

            {isAnyPaid && (
              <div className={cn(
                "mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium",
                isPremium
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-violet-500/30 bg-violet-500/10 text-violet-300",
              )}>
                <Check className="h-4 w-4" />
                {isPremium
                  ? "You're on Elite — unlimited AI Coach and full solver access"
                  : "You're on Plus — full platform access unlocked"}
              </div>
            )}
          </div>
        </section>

        {/* ── Pricing cards ──────────────────────────────────────────────────── */}
        <section className="relative pb-24 sm:pb-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">

              {/* ── Free ── */}
              <div className={cn(
                "rounded-2xl border bg-card/60 p-8 flex flex-col gap-6 transition-all duration-300",
                "border-border/50 hover:border-border/80 hover:bg-card/80 hover:shadow-xl hover:shadow-black/20",
                !isPro && !isPremium && user ? "ring-1 ring-border/40" : "",
              )}>
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Free
                    </span>
                    {!isAnyPaid && user && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-muted-foreground">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-black text-foreground">€0</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Start your poker journey
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {FREE_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground/80">{f.text}</span>
                        {f.limit && (
                          <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wide">
                            {f.limit}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="block w-full rounded-xl border border-border/70 bg-secondary/40 px-6 py-3.5 text-center text-sm font-semibold text-foreground hover:bg-secondary/70 hover:border-border transition-all duration-200"
                >
                  Start Free
                </Link>
              </div>

              {/* ── Plus ── */}
              <div className={cn(
                "relative rounded-2xl border p-8 flex flex-col gap-6 transition-all duration-300",
                "border-violet-500/40 bg-gradient-to-b from-violet-500/10 via-violet-500/5 to-transparent",
                "shadow-2xl shadow-violet-900/30 hover:shadow-violet-900/50 hover:border-violet-500/60",
                "hover:-translate-y-1",
              )}>
                {/* Glow */}
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-500/15 blur-[50px] rounded-full" />
                </div>

                {/* Most popular badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-600 px-4 py-1 text-[11px] font-bold text-white shadow-lg shadow-violet-600/40">
                    <Zap className="h-3 w-3" />
                    Most popular
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Plus</span>
                    {isPro && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-black text-foreground">{PLUS_PRICE}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Improve with confidence
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {PLUS_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground">{f.text}</span>
                        {f.limit && (
                          <span className="text-[10px] text-violet-400/50 font-medium uppercase tracking-wide">
                            {f.limit}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {isPro ? (
                  hasStripeCustomer ? (
                    <ManageSubscriptionButton
                      size="default"
                      className="w-full [&>button]:w-full [&>button]:justify-center"
                    />
                  ) : (
                    <div className="w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3.5 text-center text-sm font-semibold text-violet-300">
                      Active plan
                    </div>
                  )
                ) : isPremium ? null : (
                  <UpgradePricingCTA plan="pro" loggedIn={!!user} fullWidth />
                )}
              </div>

              {/* ── Elite ── */}
              <div className={cn(
                "relative rounded-2xl border p-8 flex flex-col gap-6 transition-all duration-300",
                "border-amber-500/25 bg-gradient-to-b from-amber-500/6 via-violet-500/4 to-transparent",
                "shadow-2xl shadow-amber-900/15 hover:shadow-amber-900/30 hover:border-amber-500/45",
                "hover:-translate-y-1",
              )}>
                {/* Ambient glow */}
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/8 blur-[60px] rounded-full" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-violet-500/5 blur-[60px] rounded-full" />
                </div>

                {/* Unlimited access badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-600/90 to-amber-500/90 px-4 py-1 text-[11px] font-bold text-white shadow-lg shadow-amber-600/30">
                    <Crown className="h-3 w-3" />
                    Unlimited access
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400/80">
                      Elite
                    </span>
                    {isPremium && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-black text-foreground">{ELITE_PRICE}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Master your game
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {ELITE_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      {f.unlimited ? (
                        <Infinity className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground">{f.text}</span>
                        {f.unlimited && (
                          <span className="text-[10px] text-amber-400/50 font-medium uppercase tracking-wide">
                            Unlimited access
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {isPremium ? (
                  hasStripeCustomer ? (
                    <ManageSubscriptionButton
                      size="default"
                      className="w-full [&>button]:w-full [&>button]:justify-center"
                    />
                  ) : (
                    <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-3.5 text-center text-sm font-semibold text-amber-300">
                      Active plan
                    </div>
                  )
                ) : (
                  <UpgradePricingCTA plan="premium" loggedIn={!!user} fullWidth />
                )}
              </div>

            </div>

            {/* Reassurance strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground/45">
              {[
                "No credit card for free plan",
                "Stripe-secured payments",
                "Cancel anytime",
                "Same AI engine on every plan",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-muted-foreground/25" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table ───────────────────────────────────────────────── */}
        <section className="relative py-20 sm:py-24 bg-secondary/20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Compare plans
              </h2>
              <p className="text-muted-foreground">
                Everything included in each plan, side by side.
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-4 items-center px-6 py-4 border-b border-border/50 bg-secondary/40">
                <div className="text-sm font-semibold text-foreground">Feature</div>
                <div className="text-sm font-semibold text-muted-foreground text-center">Free</div>
                <div className="text-sm font-semibold text-violet-400 text-center">Plus</div>
                <div className="text-sm font-semibold text-amber-400 text-center">Elite</div>
              </div>

              {COMPARISON.map((row, i) => (
                <div
                  key={row.feature}
                  className={cn(
                    "grid grid-cols-4 items-center px-6 py-3.5",
                    i < COMPARISON.length - 1 && "border-b border-border/20",
                    i % 2 === 1 && "bg-secondary/8",
                  )}
                >
                  <div className="text-sm text-foreground">{row.feature}</div>

                  {/* Free */}
                  <div className="flex justify-center">
                    {typeof row.free === "boolean" ? (
                      row.free ? (
                        <Check className="h-4 w-4 text-muted-foreground/50" />
                      ) : (
                        <span className="h-4 w-4 flex items-center justify-center text-muted-foreground/20 text-base">—</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground/70">{row.free}</span>
                    )}
                  </div>

                  {/* Plus */}
                  <div className="flex justify-center">
                    {typeof row.plus === "boolean" ? (
                      row.plus ? (
                        <Check className="h-4 w-4 text-violet-400" />
                      ) : (
                        <span className="h-4 w-4 flex items-center justify-center text-muted-foreground/20 text-base">—</span>
                      )
                    ) : (
                      <span className="text-xs font-medium text-violet-300">{row.plus}</span>
                    )}
                  </div>

                  {/* Elite */}
                  <div className="flex justify-center">
                    {typeof row.elite === "boolean" ? (
                      row.elite ? (
                        <Infinity className="h-4 w-4 text-amber-400" />
                      ) : (
                        <span className="h-4 w-4 flex items-center justify-center text-muted-foreground/20 text-base">—</span>
                      )
                    ) : (
                      <span className="text-xs font-medium text-amber-300">{row.elite}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────────── */}
        <section className="relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Frequently asked questions
              </h2>
              <p className="text-muted-foreground">Everything you need to know before upgrading.</p>
            </div>
            <PricingFAQ />
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────────────── */}
        <section className="relative py-24 sm:py-32 overflow-hidden bg-secondary/20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 65% 60% at 50% 55%, rgba(124,92,255,0.10) 0%, transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-2xl px-4 sm:px-6 text-center">
            <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/25 to-blue-600/15 border border-violet-500/25">
              <Zap className="h-6 w-6 text-violet-400" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
              Ready to study like the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
                top players?
              </span>
            </h2>

            <p className="text-muted-foreground text-lg mb-9 leading-relaxed">
              Start free — upgrade when you&apos;re ready to go deeper.
              Cancel anytime, no questions asked.
            </p>

            {isAnyPaid ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/learn"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Continue learning
                </Link>
                {hasStripeCustomer && (
                  <ManageSubscriptionButton
                    size="default"
                    variant="outline"
                    className="[&>button]:text-sm"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <UpgradePricingCTA plan="pro" loggedIn={!!user} fullWidth={false} />
                {!user && (
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/40 px-7 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-border transition-all duration-200"
                  >
                    Start for free
                  </Link>
                )}
              </div>
            )}

            <p className="mt-6 text-sm text-muted-foreground/35">
              Free plan · No card required · Same AI engine on every plan
            </p>
          </div>
        </section>

      </main>

      <LandingFooter />
    </div>
  );
}

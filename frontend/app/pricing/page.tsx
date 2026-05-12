import Link from "next/link";
import {
  Check, X, Zap, Sparkles, BarChart3, Brain, BookOpen,
  Layers, Shield, MessageSquare, History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { UpgradePricingCTA } from "./upgrade-cta";
import { PricingFAQ } from "./faq";
import { cn } from "@/lib/utils";

// ── Plan feature lists ────────────────────────────────────────────────────────

const FREE_FEATURES = [
  { text: "3 hand analyses (lifetime)", included: true },
  { text: "Basic GTO heuristics",       included: true },
  { text: "Board texture analysis",     included: true },
  { text: "Hand history replay",        included: true },
  { text: "GGPoker & PokerStars",       included: true },
  { text: "Unlimited session reviews",  included: false },
  { text: "Puzzle training library",    included: false },
  { text: "Advanced AI coaching",       included: false },
  { text: "Screenshot analysis",        included: false },
  { text: "Future premium features",    included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited hand analyses",       included: true },
  { text: "Unlimited session reviews",     included: true },
  { text: "Full puzzle training library",  included: true },
  { text: "Advanced AI coaching",          included: true },
  { text: "Screenshot analysis (GGPoker)", included: true },
  { text: "Hand history replay",           included: true },
  { text: "GGPoker & PokerStars",          included: true },
  { text: "All future premium features",   included: true },
  { text: "iDEAL, card & mobile pay",      included: true },
  { text: "Cancel anytime",               included: true },
];

// ── Feature comparison rows ───────────────────────────────────────────────────

type CompRow = { feature: string; free: boolean | string; pro: boolean | string };

const COMPARISON: CompRow[] = [
  { feature: "Hand analyses",          free: "3 total",   pro: "Unlimited" },
  { feature: "Session review",         free: false,       pro: true },
  { feature: "Puzzle training",        free: false,       pro: true },
  { feature: "AI coaching",            free: "Basic",     pro: "Advanced" },
  { feature: "Screenshot analysis",    free: false,       pro: true },
  { feature: "Hand replay",            free: true,        pro: true },
  { feature: "Board texture analysis", free: true,        pro: true },
  { feature: "Spot classification",    free: true,        pro: true },
  { feature: "GTO heuristics",         free: true,        pro: true },
  { feature: "Future features",        free: false,       pro: true },
];

// ── What you unlock icons ─────────────────────────────────────────────────────

const PRO_HIGHLIGHTS = [
  { icon: BarChart3,    label: "Unlimited Analyses",   sub: "Analyze every hand, every session" },
  { icon: Layers,       label: "Session Review",        sub: "AI picks your top spots automatically" },
  { icon: Brain,        label: "Advanced AI Coaching",  sub: "Deep GPT-4o explanations per action" },
  { icon: BookOpen,     label: "Puzzle Library",        sub: "Multi-street interactive scenarios" },
  { icon: MessageSquare,label: "Screenshot Analysis",   sub: "Upload GGPoker screenshots for coaching" },
  { icon: Shield,       label: "Future Features",       sub: "Every new tool, included automatically" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

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

  const isPro = tier === "pro" || tier === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar variant="static" />

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-violet-600/9 blur-[130px]" />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
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
              One plan.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
                Everything included.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Start free and experience the quality. Upgrade to Pro when
              you&apos;re ready to go deep — no hidden costs, no feature gates.
            </p>

            {isPro && (
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300">
                <Check className="h-4 w-4" />
                You&apos;re on Pro — enjoy unlimited access
              </div>
            )}
          </div>
        </section>

        {/* ── Pricing cards ─────────────────────────────────────────────── */}
        <section className="relative pb-24 sm:pb-32">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">

              {/* Free */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-8 flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Free
                    </span>
                    {!isPro && user && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-muted-foreground">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-black text-foreground">€0</span>
                    <span className="text-muted-foreground text-sm">/forever</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get started with no commitment. No credit card required.
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {FREE_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      {f.included ? (
                        <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/25 shrink-0 mt-0.5" />
                      )}
                      <span className={f.included ? "text-foreground" : "text-muted-foreground/40"}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={user ? "/analyze" : "/signup"}
                  className="block w-full rounded-xl border border-border/70 bg-secondary/40 px-6 py-3.5 text-center text-sm font-semibold text-foreground hover:bg-secondary/70 hover:border-border transition-all duration-200"
                >
                  {user ? "Continue with Free" : "Get started free"}
                </Link>
              </div>

              {/* Pro */}
              <div className="relative rounded-2xl border border-violet-500/35 bg-gradient-to-b from-violet-500/8 via-blue-500/4 to-transparent p-8 flex flex-col gap-6 shadow-2xl shadow-violet-900/25">
                {/* Most popular badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-600 px-4 py-1 text-[11px] font-bold text-white shadow-lg shadow-violet-600/40">
                    <Zap className="h-3 w-3" />
                    Most popular
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                      Pro
                    </span>
                    {isPro && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">
                        Current plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-black text-foreground">€9</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Billed monthly · Cancel anytime · iDEAL & card
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {PRO_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span className="text-foreground">{f.text}</span>
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
                ) : (
                  <UpgradePricingCTA loggedIn={!!user} fullWidth />
                )}
              </div>
            </div>

            {/* Reassurance strip */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground/50">
              {[
                "No credit card for free plan",
                "Stripe-secured payments",
                "Cancel anytime",
                "Instant Pro activation",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-muted-foreground/30" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── What you unlock (Pro highlight icons) ─────────────────────── */}
        <section className="relative py-20 sm:py-24 bg-secondary/20 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-violet-600/5 blur-[110px]"
          />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Everything in Pro
              </h2>
              <p className="text-muted-foreground">
                One subscription unlocks the full study ecosystem.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRO_HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/60 px-5 py-4 hover:border-border/80 hover:bg-card/80 transition-all duration-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <h.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{h.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{h.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature comparison table ───────────────────────────────────── */}
        <section className="relative py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Full feature breakdown
              </h2>
              <p className="text-muted-foreground">
                Exactly what&apos;s included in each plan.
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 items-center px-6 py-4 border-b border-border/50 bg-secondary/40">
                <div className="text-sm font-semibold text-foreground">Feature</div>
                <div className="text-sm font-semibold text-muted-foreground text-center">Free</div>
                <div className="text-sm font-semibold text-violet-400 text-center">Pro</div>
              </div>

              {COMPARISON.map((row, i) => (
                <div
                  key={row.feature}
                  className={cn(
                    "grid grid-cols-3 items-center px-6 py-3.5",
                    i < COMPARISON.length - 1 && "border-b border-border/25",
                    i % 2 === 1 && "bg-secondary/10",
                  )}
                >
                  <div className="text-sm text-foreground">{row.feature}</div>
                  <div className="flex justify-center">
                    {typeof row.free === "boolean" ? (
                      row.free ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/20" />
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.free}</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {typeof row.pro === "boolean" ? (
                      row.pro ? (
                        <Check className="h-4 w-4 text-violet-400" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/20" />
                      )
                    ) : (
                      <span className="text-xs font-medium text-violet-300">{row.pro}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section className="relative py-20 sm:py-24 bg-secondary/20">
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

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 65% 60% at 50% 55%, rgba(124,92,255,0.13) 0%, transparent 65%)",
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
              Join players who&apos;ve already fixed major leaks.
              Start free — upgrade when you&apos;re serious.
            </p>

            {isPro ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/analyze"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Analyze a hand
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
                <UpgradePricingCTA loggedIn={!!user} fullWidth={false} />
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
              Free plan · 3 analyses included · No card required to start
            </p>
          </div>
        </section>

      </main>

      <LandingFooter />
    </div>
  );
}

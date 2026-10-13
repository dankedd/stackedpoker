import type { Metadata } from "next";
import Link from "next/link";
import { Check, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";
import { PricingCTA } from "./upgrade-cta";
import { PricingFAQ } from "./faq";
import {
  FREE_LIMITS,
  PRO_PRICE_LABEL,
  UPGRADE_SOURCES,
  parseEntitlements,
  type UpgradeSource,
} from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * Sourced from the SEO registry like every other content surface.
 *
 * This route previously exported NO metadata, so it silently inherited the
 * root layout's — title, description and, most damagingly, the root
 * canonical. /pricing was telling search engines it was the homepage.
 */
export const metadata: Metadata = entryMetadata(staticPageEntry("/pricing")!);

const FREE_FEATURES = [
  `${FREE_LIMITS.trainerHandsPerDay} Preflop Trainer hands per day`,
  `${FREE_LIMITS.tournamentsPerWeek} tournament per week, with full analysis`,
  `${FREE_LIMITS.aiQuestionsPerDay} AI Coach questions per day`,
];

const PRO_FEATURES = ["Unlimited hands", "Unlimited tournaments + full history", "Unlimited AI Coach"];

const ANALYSIS = "Filtering, first-in checks against ranges, pot odds on calls, stars and notes";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source: rawSource } = await searchParams;
  const source: UpgradeSource = UPGRADE_SOURCES.includes(rawSource as UpgradeSource) ? (rawSource as UpgradeSource) : "pricing_page";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ent = user ? parseEntitlements((await supabase.rpc("my_entitlements")).data) : null;
  const plan = ent?.plan ?? (user ? "free" : null);
  const trialEnds = ent?.plan === "trial" && ent.trialEndsAt
    ? new Date(ent.trialEndsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0E1A]">
      <Navbar variant="static" />

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-10 pt-16 text-center sm:pt-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[420px] max-w-4xl rounded-full bg-[#7C5CFF]/10 blur-[120px]" />
          <div className="relative mx-auto max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Try everything free.
              <br />
              <span className="text-[#B9A8FF]">Go unlimited with Pro.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/65">
              Free gives you every feature with a daily or weekly limit. Pro removes the limits.
            </p>
            {plan === "trial" && trialEnds && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/35 bg-[#7C5CFF]/10 px-4 py-1.5 text-sm text-[#D6CCFF]">
                <Sparkles className="h-4 w-4" /> Your Pro trial runs until {trialEnds}
              </p>
            )}
            {plan === "pro" && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/35 bg-[#7C5CFF]/10 px-4 py-1.5 text-sm text-[#D6CCFF]">
                <Check className="h-4 w-4" /> You&apos;re on Pro
              </p>
            )}
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2 md:items-stretch">
            {/* Free */}
            <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">Free</h2>
                {plan === "free" && <CurrentPlan />}
              </div>
              <p className="mt-4 flex items-baseline gap-1.5 text-white">
                <span className="text-5xl font-black">€0</span>
              </p>
              <p className="mt-2 text-sm text-white/55">Every core feature, limited by volume.</p>
              <FeatureList items={FREE_FEATURES} />
              <p className="mt-4 text-xs leading-relaxed text-white/45">Full analysis: {ANALYSIS}. History shows your most recent tournament.</p>
              <div className="mt-auto pt-8">
                {!user ? (
                  <Link
                    href="/signup"
                    className="flex h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                  >
                    Create free account
                  </Link>
                ) : null}
              </div>
            </article>

            {/* Pro */}
            <article className="relative flex flex-col rounded-2xl border border-[#7C5CFF]/50 bg-gradient-to-b from-[#7C5CFF]/[0.14] to-[#7C5CFF]/[0.03] p-6 shadow-[0_0_48px_rgba(124,92,255,0.18)] sm:p-8">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#B9A8FF]">Pro</h2>
                {(plan === "pro" || plan === "trial") && <CurrentPlan label={plan === "trial" ? "Trial" : undefined} />}
              </div>
              <p className="mt-4 flex items-baseline gap-1.5 text-white">
                <span className="text-5xl font-black">{PRO_PRICE_LABEL}</span>
                <span className="text-sm text-white/55">/month</span>
              </p>
              <p className="mt-2 text-sm text-white/65">Cancel anytime. VAT included.</p>
              <FeatureList items={PRO_FEATURES} unlimited />
              <p className="mt-4 text-xs leading-relaxed text-white/45">Same full analysis on every tournament, with your complete upload history.</p>
              <div className="mt-auto pt-8">
                {plan === "pro" ? (
                  ent?.subscription.hasCustomer ? (
                    <ManageSubscriptionButton size="default" className="w-full [&>button]:h-12 [&>button]:w-full [&>button]:justify-center" />
                  ) : (
                    <div className="flex h-12 items-center justify-center rounded-xl border border-[#7C5CFF]/35 bg-[#7C5CFF]/10 text-sm font-semibold text-[#D6CCFF]">
                      Active plan
                    </div>
                  )
                ) : (
                  <PricingCTA loggedIn={Boolean(user)} onTrial={plan === "trial"} source={source} />
                )}
              </div>
            </article>
          </div>

          <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
            {["New accounts get 7 days of Pro, no card needed", "Card, iDEAL, Bancontact, Apple Pay & Google Pay", "Payments by Stripe"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-white/35" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-white/[0.06] px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">Questions</h2>
            <PricingFAQ />
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

function CurrentPlan({ label }: { label?: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/75">
      {label ?? "Current plan"}
    </span>
  );
}

function FeatureList({ items, unlimited }: { items: string[]; unlimited?: boolean }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-3 text-[15px] text-white/85">
          {unlimited ? (
            <InfinityIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#B9A8FF]" />
          ) : (
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0 text-white/40")} />
          )}
          {f}
        </li>
      ))}
    </ul>
  );
}

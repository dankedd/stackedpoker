"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Flame, Medal, Shield, Target, Trophy } from "lucide-react";
import type { LeaderRow } from "@/lib/home/stats";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { cn } from "@/lib/utils";
import { FAQ } from "@/lib/home/faq";
import { FrictionLine, StartFreeButton } from "./Cta";
import { InView, useCountUp } from "./InView";

// ── Progress ─────────────────────────────────────────────────────────────────

export function ProgressSection() {
  const [run, setRun] = useState(false);
  const level = useCountUp(7, run, 700);
  const badges = [Target, Shield, Medal, Trophy];
  return (
    <section aria-labelledby="progress-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 id="progress-title" className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Progress you can see.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-white/75">
            Every graded hand earns XP. Keep your streak, level up, unlock badges and climb the leaderboard.
          </p>
        </div>
        <InView onEnter={() => setRun(true)} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Your progress dashboard</p>
            <span className="rounded-full border border-white/15 px-1.5 py-px text-[10px] uppercase tracking-wide text-white/50">Example</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-white">
              <span className="text-sm text-white/60">Level </span>
              <span className="font-mono text-4xl font-black tabular-nums">{level}</span>
            </p>
            <p className="flex items-center gap-1.5 text-sm text-amber-200">
              <Flame className="hp-loop-flicker h-5 w-5 text-amber-400" aria-hidden /> <span className="font-mono font-semibold">5</span>-day streak
            </p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
            <span className="hp-grow-x block h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: "72%" }} />
          </div>
          <p className="mt-1 text-right font-mono text-[11px] text-white/55">72% to level 8</p>
          <div className="mt-5 flex gap-3">
            {badges.map((B, n) => (
              <span key={n} className="hp-pop flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10 text-violet-200" style={{ ["--hp-i" as string]: n + 4 }}>
                <B className="h-5 w-5" aria-hidden />
              </span>
            ))}
          </div>
        </InView>
      </div>
    </section>
  );
}

// ── Live leaderboard (real data; hidden when empty) ──────────────────────────

export function LeaderboardSection({ rows }: { rows: LeaderRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby="lb-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 id="lb-title" className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
        Top players
      </h2>
      <p className="mt-2 text-center text-sm text-white/55">Live top 5 by XP · all time</p>
      <InView as="ol" className="mt-6 space-y-2">
        {rows.map((r, n) => (
          <li key={`${r.rank}-${r.username}`} className="hp-reveal flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" style={{ ["--hp-i" as string]: n }}>
            <span className="w-6 font-mono text-sm font-bold text-violet-300">{r.rank}</span>
            <span className="flex-1 truncate text-white">{r.username}</span>
            <span className="font-mono text-sm text-white/70 tabular-nums">{r.total_xp.toLocaleString("en-US")} XP</span>
          </li>
        ))}
      </InView>
      <p className="mt-3 text-center text-sm">
        <Link href="/leaderboard" className="text-violet-300 hover:underline">
          See the full leaderboard
        </Link>
      </p>
    </section>
  );
}

// ── Pricing teaser ───────────────────────────────────────────────────────────

const TIERS = [
  { name: "Free", price: "€0", per: "", popular: false, perks: ["Preflop trainer (limited scenarios)", "AI coach · 3 messages a day", "XP, levels, streaks & leaderboard"] },
  { name: "Plus", price: "€7.99", per: "/mo", popular: true, perks: ["Full preflop trainer", "AI coach · 15 messages a day", "Full bankroll tracker with AI insights"] },
  { name: "Elite", price: "€11.99", per: "/mo", popular: false, perks: ["Everything in Plus", "Unlimited AI coach"] },
];

export function PricingTeaser() {
  return (
    <section aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h2 id="pricing-title" className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
        Start free. Upgrade when you&apos;re ready.
      </h2>
      <InView className="mt-10 grid gap-4 md:grid-cols-3">
        {TIERS.map((t, n) => (
          <article
            key={t.name}
            className={cn(
              "hp-reveal relative rounded-3xl border bg-white/[0.03] p-6",
              t.popular ? "border-violet-400/60 shadow-[0_0_40px_rgba(124,92,255,0.25)]" : "border-white/10",
            )}
            style={{ ["--hp-i" as string]: n }}
          >
            {t.popular && <span className="absolute -top-3 left-6 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white">Most popular</span>}
            <h3 className="text-lg font-bold text-white">{t.name}</h3>
            <p className="mt-2 text-white">
              <span className="font-mono text-4xl font-black tabular-nums">{t.price}</span>
              <span className="text-white/55">{t.per}</span>
            </p>
            <ul className="mt-5 space-y-2 text-[15px] text-white/80">
              {t.perks.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </InView>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href="/pricing" onClick={() => trackEvent(SEO_EVENTS.ctaClick, { location: "pricing", cta: "compare_plans" })} className="text-sm font-semibold text-violet-300 hover:underline">
          Compare plans
        </Link>
        <p className="text-[13px] text-white/50">Stripe-secured · Cancel anytime · Same AI engine on every plan</p>
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────



export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 id="faq-title" className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
        Questions
      </h2>
      <div className="mt-8 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02]">
        {FAQ.map((f, n) => {
          const isOpen = open === n;
          return (
            <div key={f.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${n}`}
                  onClick={() => {
                    setOpen(isOpen ? null : n);
                    if (!isOpen) trackEvent(SEO_EVENTS.faqOpen, { question: f.q });
                  }}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-semibold text-white"
                >
                  {f.q}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/60 transition-transform duration-300 [transition-timing-function:var(--hp-ease)]", isOpen && "rotate-180")} aria-hidden />
                </button>
              </h3>
              {/* Animated height via the grid-rows trick (no measuring, no layout thrash). */}
              <div id={`faq-${n}`} role="region" className={cn("grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--hp-ease)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-[15px] leading-relaxed text-white/70">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────

const SUITS = [
  { s: "♠", x: "8%", y: "20%", r: "-12deg", c: "text-white" },
  { s: "♥", x: "86%", y: "18%", r: "10deg", c: "text-rose-400" },
  { s: "♦", x: "18%", y: "70%", r: "8deg", c: "text-blue-400" },
  { s: "♣", x: "78%", y: "72%", r: "-8deg", c: "text-emerald-400" },
];

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-16 sm:px-6">
      <InView className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#120b2c] to-[#070A12] px-6 py-16 text-center">
        {SUITS.map((s, n) => (
          <span
            key={s.s}
            aria-hidden
            className={cn("hp-loop-float pointer-events-none absolute select-none text-7xl opacity-[0.08]", s.c)}
            style={{ left: s.x, top: s.y, ["--hp-rot" as string]: s.r, animationDelay: `${n * -2.2}s` }}
          >
            {s.s}
          </span>
        ))}
        <h2 id="final-title" className="relative mx-auto max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">
          Your next decision can be better than your last.
        </h2>
        <div className="relative mt-8 flex flex-col items-center gap-3">
          <StartFreeButton location="final" size="lg" />
          <FrictionLine />
        </div>
      </InView>
    </section>
  );
}

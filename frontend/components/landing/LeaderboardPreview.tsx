"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { RevealOnScroll } from "@/components/landing/shared/RevealOnScroll";

type Period = "all" | "24h";

interface DemoRow {
  rank: number;
  username: string;
  level: number;
  xp: number;
}

// Static demo data only — there is no public/anonymous leaderboard endpoint,
// so this never queries real user data. Handles are clearly placeholders.
const DEMO_ROWS: Record<Period, DemoRow[]> = {
  all: [
    { rank: 1, username: "RangeReader", level: 34, xp: 58420 },
    { rank: 2, username: "BlockerBluff", level: 31, xp: 52110 },
    { rank: 3, username: "ThinValueTom", level: 29, xp: 47960 },
    { rank: 4, username: "PolarizedPat", level: 26, xp: 41200 },
  ],
  "24h": [
    { rank: 1, username: "ThinValueTom", level: 29, xp: 1240 },
    { rank: 2, username: "RangeReader", level: 34, xp: 980 },
    { rank: 3, username: "GTOMorning", level: 18, xp: 860 },
    { rank: 4, username: "BlockerBluff", level: 31, xp: 610 },
  ],
};

const TOP_RANK_STYLES: Record<number, string> = {
  1: "border-amber-500/30 bg-amber-500/[0.06] text-amber-400",
  2: "border-slate-400/25 bg-slate-400/[0.05] text-slate-300",
  3: "border-orange-700/30 bg-orange-700/[0.05] text-orange-400/90",
};

export function LeaderboardPreview() {
  const [period, setPeriod] = useState<Period>("all");
  const rows = DEMO_ROWS[period];

  return (
    <section className="relative py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">
        <RevealOnScroll>
          <MarketingSectionHeader
            eyebrow="Compete and climb"
            heading="See how you stack up."
            body="Every lesson earns XP toward a shared leaderboard — a demo preview below."
          />
        </RevealOnScroll>

        <RevealOnScroll variant="scale" delayMs={80}>
          <MarketingGlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-center gap-2 mb-5">
              {(["all", "24h"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150",
                    period === p
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-muted-foreground/50 border border-transparent hover:text-muted-foreground/80"
                  )}
                >
                  {p === "all" ? "All Time" : "24 Hours"}
                </button>
              ))}
            </div>

            {/* `key={period}` remounts the row list on toggle, which naturally
                re-triggers each row's own RevealOnScroll stagger below — a
                cheap re-entrance rather than a second, separate animation. */}
            <div key={period} className="space-y-2">
              {rows.map((row, i) => (
                <RevealOnScroll key={row.username} delayMs={i * 60}>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/40 px-4 py-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[12px] font-bold",
                        row.rank <= 3 ? TOP_RANK_STYLES[row.rank] : "border-border/50 bg-white/[0.03] text-muted-foreground"
                      )}
                    >
                      {row.rank}
                    </div>
                    <span className="flex-1 truncate text-[13px] font-medium text-foreground/90">{row.username}</span>
                    <span className="rounded-full border border-border/50 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      LVL {row.level}
                    </span>
                    <span className="text-[12px] font-bold tabular-nums text-foreground/90">
                      {period === "24h" ? `+${row.xp.toLocaleString()}` : row.xp.toLocaleString()} XP
                    </span>
                  </div>
                </RevealOnScroll>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] text-muted-foreground/40">Demo preview · not live data</p>

            <div className="mt-5 text-center">
              <Link
                href="/leaderboard"
                className="group inline-flex items-center gap-2 text-[14px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                See the full leaderboard
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
              </Link>
            </div>
          </MarketingGlassCard>
        </RevealOnScroll>
      </div>
    </section>
  );
}

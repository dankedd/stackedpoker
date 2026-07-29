import { Flame, Trophy, GraduationCap } from "lucide-react";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";

// Demo values only — illustrative, not a real user's progress.
const DEMO_LEVEL = 12;
const DEMO_XP = 8420;
const DEMO_XP_TO_NEXT = 580;
const DEMO_PROGRESS_PCT = 72;

export function ProgressionSection() {
  return (
    <section className="relative py-20 md:py-28 bg-card/10">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <MarketingSectionHeader
          eyebrow="Keep moving forward"
          heading="Progress you can see."
          body="Every lesson earns XP, tracks concept mastery, and moves you toward the next level — illustrative example below."
        />

        <MarketingGlassCard elevated className="p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" strokeWidth="3" className="stroke-white/[0.06]" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  strokeWidth="3"
                  strokeDasharray={`${(DEMO_PROGRESS_PCT / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`}
                  strokeLinecap="round"
                  className="stroke-amber-400"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-foreground">
                {DEMO_LEVEL}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-semibold text-foreground">Level {DEMO_LEVEL}</span>
                <span className="text-xs text-muted-foreground/50 font-mono">{DEMO_XP.toLocaleString()} XP</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                  style={{ width: `${DEMO_PROGRESS_PCT}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/50">
                {DEMO_XP_TO_NEXT} XP to Level {DEMO_LEVEL + 1} · demo values
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-3 text-center">
              <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-foreground">14</p>
              <p className="text-[10px] text-muted-foreground/50">day streak</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-black/20 px-3 py-3 text-center">
              <Trophy className="h-4 w-4 text-amber-400/80 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-foreground">11</p>
              <p className="text-[10px] text-muted-foreground/50">badges</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-black/20 px-3 py-3 text-center">
              <GraduationCap className="h-4 w-4 text-violet-400/80 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-foreground">10</p>
              <p className="text-[10px] text-muted-foreground/50">modules</p>
            </div>
          </div>
        </MarketingGlassCard>
      </div>
    </section>
  );
}

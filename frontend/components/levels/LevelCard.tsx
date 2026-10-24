import { Flame } from "lucide-react";
import { getLevelProgress, TIER_STYLES, XP_RULES } from "@/lib/levels";
import type { XpProfile } from "@/lib/levels/api";
import { LEVELS } from "@/lib/levels/strings";
import { cn } from "@/lib/utils";
import { LevelBadge } from "./LevelBadge";

/**
 * Level, title, progress to the next level and where the XP came from.
 * Presentational — the dashboard (LevelOverview) and the public profile
 * pass the numbers in.
 */
export function LevelCard({ profile, className }: { profile: XpProfile; className?: string }) {
  const p = getLevelProgress(profile.totalXp);
  const style = TIER_STYLES[p.tier.color];
  const streak = XP_RULES.streak_bonus;
  const bonusLine = LEVELS.bonuses(profile.bonusXp, profile.handReviewXp);
  const trainerTotal = profile.preflopXp + profile.flopXp;
  const share = (xp: number) => (trainerTotal > 0 ? Math.round((xp / trainerTotal) * 100) : 0);

  return (
    <section
      aria-label={LEVELS.heading}
      className={cn("relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 sm:p-6", className)}
    >
      <div aria-hidden className={cn("pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full blur-3xl", style.glow)} />

      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 bg-background/60 shadow-lg",
            style.badge,
          )}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Lvl</span>
          <span className="text-2xl font-black leading-none tabular-nums">{p.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{LEVELS.heading}</p>
          <p className={cn("truncate text-xl font-black tracking-tight sm:text-2xl", style.text)}>{p.tier.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <LevelBadge level={p.level} />
            <span className="tabular-nums">
              {LEVELS.totalXp}: <b className="font-semibold text-foreground">{profile.totalXp.toLocaleString("en-US")}</b>
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold tabular-nums text-foreground">
            {p.isMaxLevel ? LEVELS.maxLevel : LEVELS.progress(p.currentLevelXp, p.xpRequiredForNextLevel)}
          </span>
          {!p.isMaxLevel && (
            <span className="text-right tabular-nums text-muted-foreground">{LEVELS.toNext(p.xpRemaining, p.level + 1)}</span>
          )}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", style.bar)}
            style={{ width: `${p.progressPercent}%` }}
            role="progressbar"
            aria-valuenow={p.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={p.isMaxLevel ? LEVELS.maxLevel : LEVELS.toNext(p.xpRemaining, p.level + 1)}
          />
        </div>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-3">
        {[
          { label: LEVELS.preflop, xp: profile.preflopXp, bar: "bg-violet-400" },
          { label: LEVELS.flop, xp: profile.flopXp, bar: "bg-blue-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/40 bg-white/[0.02] px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {s.xp.toLocaleString("en-US")} <span className="text-xs font-semibold text-muted-foreground">XP</span>
            </dd>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cn("h-full rounded-full", s.bar)} style={{ width: `${share(s.xp)}%` }} />
            </div>
          </div>
        ))}
      </dl>

      <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{LEVELS.today(profile.dailyXp, profile.dailyCap)}</span>
        <span className={cn("inline-flex items-center gap-1", profile.streakDays >= streak.min_streak_days && "text-orange-300")}>
          <Flame className="h-3 w-3" aria-hidden />
          {profile.streakDays >= streak.min_streak_days
            ? LEVELS.streakBonusOn(streak.percent)
            : LEVELS.streakBonus(streak.min_streak_days, streak.percent)}
        </span>
        {bonusLine && <span className="tabular-nums">{bonusLine}</span>}
      </div>
    </section>
  );
}

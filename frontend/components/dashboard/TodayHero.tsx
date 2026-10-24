import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import type { HeroState } from "@/lib/dashboard/hero";
import { DASH } from "@/lib/dashboard/strings";
import { STREAK } from "@/lib/lifecycle/strings";
import { cn } from "@/lib/utils";
import { ResetClock } from "./ResetClock";

const H = DASH.hero;

function title(h: HeroState): string {
  switch (h.kind) {
    case "train":
      return H.train.title;
    case "mistakes":
      return H.mistakes.title(h.mistakes);
    case "limit":
      return H.limit.title;
    case "import":
      return H.import.title;
    default:
      return H.keepTraining.title;
  }
}

function cta(h: HeroState, hasTournament: boolean): string {
  switch (h.kind) {
    case "train":
      return H.train.cta;
    case "mistakes":
      return H.mistakes.cta;
    case "limit":
      return hasTournament ? H.limit.cta : H.limit.ctaNoTournament;
    case "import":
      return H.import.cta;
    default:
      return H.keepTraining.cta;
  }
}

const SECONDARY = {
  train: H.secondaryTrain,
  import: H.secondaryImport,
  example: H.import.example,
} as const;

/** The daily goal ring: spots today out of the goal. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const share = goal > 0 ? Math.min(1, done / goal) : 0;
  return (
    <div
      role="img"
      aria-label={H.ringLabel(done, goal)}
      className="relative h-[68px] w-[68px] shrink-0 sm:h-20 sm:w-20"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-white/[0.07]"
        />
        {share > 0 && (
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            className={cn(
              share >= 1 ? "stroke-emerald-400" : "stroke-violet-400",
            )}
          />
        )}
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
      >
        <span className="text-base font-black tabular-nums text-foreground sm:text-lg">
          {done}
        </span>
        <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          /{goal}
        </span>
      </span>
    </div>
  );
}

/**
 * Block 1 — Today: greeting, the one primary action (lib/dashboard/hero.ts),
 * the day streak and the daily goal ring. Kept short so the button sits above
 * the fold on a 390×844 phone.
 */
export function TodayHero({
  name,
  hero,
  streak,
  hasTournament,
}: {
  name: string;
  hero: HeroState;
  streak: { streak: number; activeToday: boolean } | null;
  hasTournament: boolean;
}) {
  const sub =
    hero.kind === "import"
      ? H.import.body
      : hero.kind === "mistakes"
        ? null
        : H.progress(hero.done, hero.goal);
  return (
    <section
      aria-labelledby="today-title"
      className="relative overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/50 via-background/70 to-blue-950/20 px-5 py-5 sm:px-8 sm:py-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-20 h-64 w-64 rounded-full bg-violet-600/12 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span className="uppercase tracking-[0.18em] text-violet-300/80">
              {DASH.todayLabel}
            </span>
            {streak && streak.streak > 0 ? (
              <span className="inline-flex items-center gap-1 text-orange-300">
                <Flame aria-hidden className="h-3.5 w-3.5" />
                {STREAK.badge(streak.streak).replace("🔥 ", "")}
              </span>
            ) : (
              <span>{STREAK.startNone}</span>
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {DASH.greeting(name)}
          </p>
          <h1
            id="today-title"
            className="mt-0.5 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl"
          >
            {title(hero)}
          </h1>
          {sub && (
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {sub}
            </p>
          )}
          {hero.kind === "limit" && hero.resetAt && (
            <p className="mt-1 text-sm font-medium text-violet-200">
              <ResetClock to={hero.resetAt} />
            </p>
          )}
        </div>
        <GoalRing done={hero.done} goal={hero.goal} />
      </div>

      <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={hero.href}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-5 text-[15px] font-semibold text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          {cta(hero, hasTournament)}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
        {hero.secondary && (
          <Link
            href={hero.secondary.href}
            className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:text-left"
          >
            {SECONDARY[hero.secondary.kind]}
          </Link>
        )}
      </div>
    </section>
  );
}

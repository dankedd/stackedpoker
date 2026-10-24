import Link from "next/link";
import { Target, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { SkillView } from "@/lib/dashboard/model";
import { DASH } from "@/lib/dashboard/strings";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { cn } from "@/lib/utils";
import { Block, EmptyState } from "./Block";

const S = DASH.skill;

function Meter({ label, pct, n, big }: { label: string; pct: number | null; n: number; big?: boolean }) {
  return (
    <div className={cn("min-w-0", big ? "" : "rounded-lg bg-white/[0.02] px-2.5 py-2")}>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-black tabular-nums text-foreground", big ? "text-2xl" : "text-base")}>
        {pct === null ? <span className="text-muted-foreground/60">—</span> : `${pct}%`}
      </p>
      {big ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct ?? 0}%` }} />
        </div>
      ) : (
        <p className="text-[10px] tabular-nums text-muted-foreground/70">{S.sample(n)}</p>
      )}
    </div>
  );
}

/** Block 2b — trainer accuracy, the weakest texture, the weekly trend and one button to the weakest spot. */
export function SkillCard({ view }: { view: SkillView }) {
  if (!view.enough) {
    return (
      <Block title={S.heading} aside={<span className="text-[11px] text-muted-foreground/60">{S.window(view.days)}</span>}>
        <p className="mb-3 text-lg font-bold text-foreground">{S.notEnough}</p>
        <EmptyState text={S.notEnoughBody(view.needed)} cta={S.trainMore} href={PREFLOP_TRAINER_PATH} />
      </Block>
    );
  }
  const TrendIcon = view.trend?.dir === "up" ? TrendingUp : view.trend?.dir === "down" ? TrendingDown : Minus;
  return (
    <Block title={S.heading} aside={<span className="text-[11px] text-muted-foreground/60">{S.window(view.days)}</span>}>
      <div className="grid grid-cols-2 gap-4">
        <Meter big label={S.preflop} pct={view.preflop.pct} n={view.preflop.n} />
        <Meter big label={S.flop} pct={view.flop.pct} n={view.flop.n} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {view.preflop.kinds.map((k) => (
          <Meter key={k.key} label={k.label} pct={k.pct} n={k.n} />
        ))}
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        {view.weakestTexture && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{S.weakestTexture}</dt>
            <dd className="truncate text-right font-medium text-foreground">
              {view.weakestTexture.label} <span className="tabular-nums text-muted-foreground">· {view.weakestTexture.pct}%</span>
            </dd>
          </div>
        )}
        {view.trend && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{S.trend}</dt>
            <dd
              className={cn(
                "inline-flex items-center gap-1 font-medium tabular-nums",
                view.trend.dir === "up" ? "text-emerald-300" : view.trend.dir === "down" ? "text-orange-300" : "text-foreground",
              )}
            >
              <TrendIcon aria-hidden className="h-3.5 w-3.5" />
              {view.trend.dir === "up" ? S.trendUp(view.trend.points) : view.trend.dir === "down" ? S.trendDown(view.trend.points) : S.trendSteady}
            </dd>
          </div>
        )}
      </dl>
      <Link
        href={view.weakest?.href ?? PREFLOP_TRAINER_PATH}
        className="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] px-3.5 py-2 transition-colors hover:border-violet-500/50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Target aria-hidden className="h-4 w-4 shrink-0 text-violet-300" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{view.weakest ? S.trainWeakest : S.trainMore}</span>
            {view.weakest && <span className="block truncate text-xs text-muted-foreground">{view.weakest.label}</span>}
          </span>
        </span>
      </Link>
    </Block>
  );
}

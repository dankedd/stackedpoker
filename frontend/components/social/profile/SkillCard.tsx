"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/flopTrainer/logic";
import { flopVerdictShares, headlineTrends, MIN_SAMPLE, pct, skillRows, type Period, type SkillStats } from "@/lib/social/stats";
import { PROFILE } from "@/lib/social/strings";
import { cn } from "@/lib/utils";
import { SkillRadar } from "./SkillRadar";

export function SkillCard({ stats, refreshedAt }: { stats: SkillStats; refreshedAt: string | null }) {
  const [period, setPeriod] = useState<Period>(30);
  const rows = skillRows(stats, period);
  const trends = headlineTrends(rows);
  const flop = flopVerdictShares(stats);
  const overall = stats.preflop?.overall?.all;
  const empty = !overall && !stats.flop_review?.all && !stats.trainer?.spots;

  return (
    <section aria-labelledby="skill-title" className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5" data-skill-card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="skill-title" className="font-semibold text-foreground">
          {PROFILE.skillTitle}
        </h2>
        <div role="group" className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs font-semibold">
          {([30, 90] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn("rounded-md px-3 py-1", period === p ? "bg-violet-500/25 text-violet-100" : "text-slate-400 hover:text-white")}
            >
              {p === 30 ? PROFILE.period30 : PROFILE.period90}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">{PROFILE.statsEmpty}</p>
      ) : (
        <>
          {trends.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {trends.map((r) => (
                <li
                  key={r.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    r.trend! > 0 ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300",
                  )}
                >
                  {r.trend! > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {period === 30 ? PROFILE.trendThisMonth(r.label, r.trend!) : PROFILE.trendQuarter(r.label, r.trend!)}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
            <SkillRadar rows={rows} />
            <table className="w-full text-sm">
              <caption className="sr-only">{PROFILE.radarTable}</caption>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="py-2 pr-2 text-left font-medium text-foreground">
                      {r.label}
                    </th>
                    <td className="py-2 text-right">
                      {r.pct != null ? (
                        <span className="font-mono font-semibold text-foreground">{r.pct}%</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{PROFILE.notEnough(r.n, MIN_SAMPLE)}</span>
                      )}
                    </td>
                    <td className="w-14 py-2 text-right font-mono text-xs">
                      {r.trend != null && r.trend !== 0 && (
                        <span className={r.trend > 0 ? "text-emerald-400" : "text-rose-400"}>
                          {r.trend > 0 ? "+" : ""}
                          {r.trend}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Block title={PROFILE.preflop}>
              <Fact label={PROFILE.preflopOverall} value={pct(overall)} n={overall?.[0] ?? 0} unit="%" />
            </Block>
            <Block title={PROFILE.flop}>
              {flop.good != null ? (
                <p className="text-sm text-foreground">
                  <span className="text-emerald-300">{PROFILE.good} {flop.good}%</span> · {PROFILE.ok} {flop.ok}% ·{" "}
                  <span className="text-amber-300">{PROFILE.questionable} {flop.questionable}%</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{PROFILE.notEnough(flop.n, MIN_SAMPLE)}</p>
              )}
              {stats.weakest_texture && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {PROFILE.weakestTexture}:{" "}
                  <span className="text-foreground">
                    {CATEGORY_LABEL[stats.weakest_texture.category as keyof typeof CATEGORY_LABEL] ?? stats.weakest_texture.category}
                  </span>
                </p>
              )}
            </Block>
            <Block title={PROFILE.trainer}>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{PROFILE.spotsTrained}</dt>
                <dd className="text-right font-mono text-foreground">{stats.trainer?.spots ?? 0}</dd>
                <dt className="text-muted-foreground">{PROFILE.accuracy}</dt>
                <dd className="text-right font-mono text-foreground">{pct(stats.trainer?.accuracy) != null ? `${pct(stats.trainer?.accuracy)}%` : `${stats.trainer?.accuracy?.[0] ?? 0}/${MIN_SAMPLE}`}</dd>
                <dt className="text-muted-foreground">{PROFILE.currentStreak}</dt>
                <dd className="text-right font-mono text-foreground">{stats.trainer?.current_streak ?? 0}</dd>
                <dt className="text-muted-foreground">{PROFILE.bestStreak}</dt>
                <dd className="text-right font-mono text-foreground">{stats.trainer?.best_streak ?? 0}</dd>
              </dl>
            </Block>
          </div>
        </>
      )}
      {refreshedAt && (
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          {PROFILE.updated(new Date(refreshedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}
        </p>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-white/[0.02] p-3">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Fact({ label, value, n, unit }: { label: string; value: number | null; n: number; unit: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {value != null ? (
        <span className="font-mono font-semibold text-foreground">
          {value}
          {unit}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{PROFILE.notEnough(n, MIN_SAMPLE)}</span>
      )}
    </p>
  );
}

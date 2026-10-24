"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Tooltip } from "recharts";
import type { SkillRow } from "@/lib/social/stats";
import { PROFILE } from "@/lib/social/strings";

const STROKE = "#8B5CF6";

/**
 * One series (the player's accuracy per skill), so no legend: the card's
 * title names it. Axes without enough decisions sit at 0 and read "—".
 * The same numbers are in the rows next to it, so nothing is colour- or
 * shape-only. Drawn only when at least three skills have a percentage.
 */
export function SkillRadar({ rows }: { rows: SkillRow[] }) {
  const known = rows.filter((r) => r.pct != null).length;
  if (known < 3) return null;
  const data = rows.map((r) => ({ skill: r.label, value: r.pct ?? 0, shown: r.pct == null ? "—" : `${r.pct}%`, n: r.n }));
  return (
    <figure className="mx-auto w-[300px] max-w-full" aria-label={PROFILE.radarLabel}>
      {/* Fixed size: fits a 390px phone, and needs no width measuring on first paint. */}
      <div className="flex justify-center">
          <RadarChart data={data} width={300} height={260} outerRadius={78} margin={{ top: 8, right: 34, bottom: 8, left: 34 }}>
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={STROKE} strokeWidth={2} fill={STROKE} fillOpacity={0.22} dot={{ r: 4, fill: STROKE, strokeWidth: 0 }} isAnimationActive={false} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <div className="rounded-lg border border-border/60 bg-[#0B1120] px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-foreground">{p.skill}</p>
                    <p className="text-muted-foreground">
                      {p.shown} · {p.n} decisions
                    </p>
                  </div>
                );
              }}
            />
          </RadarChart>
      </div>
      <figcaption className="sr-only">{PROFILE.radarTable}</figcaption>
    </figure>
  );
}

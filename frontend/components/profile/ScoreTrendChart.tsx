"use client";

import type { ScoreTrendPoint } from "@/lib/types";
import { useMemo } from "react";

const W = 560;
const H = 120;
const PAD = { top: 10, right: 16, bottom: 28, left: 32 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top  - PAD.bottom;

function smooth(values: number[]): number[] {
  if (values.length < 3) return values;
  return values.map((v, i) => {
    if (i === 0 || i === values.length - 1) return v;
    return (values[i - 1] + v + values[i + 1]) / 3;
  });
}

interface Props {
  trend: ScoreTrendPoint[];
}

export function ScoreTrendChart({ trend }: Props) {
  const data = useMemo(() => {
    if (!trend || trend.length < 2) return null;
    const scores = smooth(trend.map((p) => p.score));
    const minS = Math.max(0,   Math.min(...scores) - 5);
    const maxS = Math.min(100, Math.max(...scores) + 5);
    const range = maxS - minS || 1;
    const n = scores.length;

    const xOf = (i: number) => (i / (n - 1)) * CHART_W;
    const yOf = (s: number) => CHART_H - ((s - minS) / range) * CHART_H;

    const pts = scores.map((s, i) => ({ x: xOf(i), y: yOf(s), score: s, date: trend[i].date }));
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    // Area fill (under the line)
    const areaPath =
      `M${pts[0].x},${CHART_H} ` +
      pts.map((p) => `L${p.x},${p.y}`).join(" ") +
      ` L${pts[pts.length - 1].x},${CHART_H} Z`;

    // Trend direction colour
    const lastScore  = scores[scores.length - 1];
    const firstScore = scores[0];
    const trendUp    = lastScore >= firstScore;
    const lineColor  = lastScore >= 75 ? "#4ade80" : lastScore >= 60 ? "#818cf8" : lastScore >= 45 ? "#fbbf24" : "#f87171";

    // Y-axis ticks: 0, 25, 50, 75, 100
    const yTicks = [0, 25, 50, 75, 100].filter((v) => v >= minS - 5 && v <= maxS + 5);

    // X-axis: show first, middle, last date
    const xLabels = [
      { x: pts[0].x, label: formatDate(trend[0].date) },
      { x: pts[Math.floor(n / 2)].x, label: formatDate(trend[Math.floor(n / 2)].date) },
      { x: pts[n - 1].x, label: formatDate(trend[n - 1].date) },
    ];

    return { pts, linePath, areaPath, lineColor, yTicks, xLabels, minS, maxS, range };
  }, [trend]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[120px] text-xs text-muted-foreground">
        Not enough data for trend chart (need 2+ analyses).
      </div>
    );
  }

  const { pts, linePath, areaPath, lineColor, yTicks, xLabels, minS, range } = data;

  const yOf = (s: number) => CHART_H - ((s - minS) / range) * CHART_H;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: "140px" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={0} y1={yOf(v)} x2={CHART_W} y2={yOf(v)}
                stroke="#ffffff10" strokeWidth={1}
              />
              <text
                x={-4} y={yOf(v)} textAnchor="end" dominantBaseline="middle"
                fill="#64748b" fontSize={8}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Area */}
          <path d={areaPath} fill="url(#trend-area)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={lineColor} />
          ))}

          {/* X labels */}
          {xLabels.map(({ x, label }) => (
            <text key={label} x={x} y={CHART_H + 16} textAnchor="middle" fill="#64748b" fontSize={8}>
              {label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

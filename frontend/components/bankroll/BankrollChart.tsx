"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from "recharts";
import { LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { BankrollChartPoint } from "@/lib/bankroll/types";

type RangeKey = "day" | "week" | "month" | "year" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "day", label: "Day", days: 1 },
  { key: "week", label: "Week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "year", label: "Year", days: 365 },
  { key: "all", label: "All time", days: null },
];

const VIOLET = "#7C5CFF";
const BLUE = "#5EA8FF";

function formatAxisDate(iso: string, range: RangeKey): string {
  const d = new Date(iso);
  if (range === "day") return d.toLocaleTimeString("en-US", { hour: "numeric" });
  if (range === "week" || range === "month") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface ChartTooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: BankrollChartPoint;
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1120]/95 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl shadow-black/50 text-xs">
      {date && (
        <p className="text-muted-foreground/60 font-medium mb-1.5">
          {new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: undefined })}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey as string} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground/70">{entry.name}</span>
            <span className="font-semibold text-foreground tabular-nums ml-auto">
              {formatCurrency(entry.value as number, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BankrollChartProps {
  data: BankrollChartPoint[];
  currency: string;
  hasEvData: boolean;
}

export function BankrollChart({ data, currency, hasEvData }: BankrollChartProps) {
  const [range, setRange] = useState<RangeKey>("month");
  const [showEv, setShowEv] = useState(hasEvData);

  const filtered = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === range);
    if (!opt?.days || data.length === 0) return data;
    const cutoff = Date.now() - opt.days * 24 * 60 * 60 * 1000;
    const sliced = data.filter((d) => new Date(d.date).getTime() >= cutoff);
    if (sliced.length === 0) return data.slice(-1);
    // Keep one anchor point before the cutoff so the line doesn't appear to
    // start mid-air when there were no events inside the selected window.
    const firstIdx = data.indexOf(sliced[0]);
    return firstIdx > 0 ? [data[firstIdx - 1], ...sliced] : sliced;
  }, [data, range]);

  const hasActivity = data.length > 1;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 card-lift">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/25 shrink-0">
            <LineChartIcon className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Bankroll over time</h2>
            <p className="text-xs text-muted-foreground/50">Drag the handles below the chart to zoom into a range</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasEvData && (
            <button
              type="button"
              onClick={() => setShowEv((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                showEv
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-border/50 bg-transparent text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3" />
              EV
            </button>
          )}

          <div className="flex items-center rounded-full border border-border/50 bg-background/40 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all duration-150",
                  range === opt.key
                    ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-sm shadow-violet-900/40"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/30 border border-border/40">
            <LineChartIcon className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-foreground/70 font-medium text-sm">No bankroll history yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Log a deposit or a session and your bankroll curve will build up here.
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIOLET} stopOpacity={0.35} />
                <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => formatAxisDate(v, range)}
              stroke="rgba(255,255,255,0.3)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v, currency)}
              stroke="rgba(255,255,255,0.3)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "rgba(124,92,255,0.3)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="bankroll"
              name="Bankroll"
              stroke={VIOLET}
              strokeWidth={2.5}
              fill="url(#bankrollFill)"
              dot={false}
              activeDot={{ r: 4, fill: VIOLET, stroke: "#0B1120", strokeWidth: 2 }}
            />
            {showEv && (
              <Line
                type="monotone"
                dataKey="evBankroll"
                name="EV"
                stroke={BLUE}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: BLUE, stroke: "#0B1120", strokeWidth: 2 }}
              />
            )}
            <Brush
              dataKey="date"
              height={26}
              travellerWidth={8}
              stroke={VIOLET}
              fill="rgba(124,92,255,0.06)"
              tickFormatter={() => ""}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

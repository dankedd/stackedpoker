"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import {
  CONFIDENCE_LEVELS,
  VARIANCE_ASSUMPTIONS,
  calculateVariance,
  explainVariance,
  validateVariance,
} from "@/lib/tools/variance";
import { ChoiceGroup, FieldGrid, NumberField } from "./ToolFields";
import { ResultNote, ResultStat, ToolError, ToolPanel } from "./ToolPanel";

const SLUG = "variance-calculator";

const ERROR_TEXT: Record<string, string> = {
  "hands-not-positive": "Enter a hand count greater than zero.",
  "std-dev-not-positive": "Enter your standard deviation in bb/100 — it must be above zero.",
  "confidence-out-of-range": "Pick a confidence level.",
};

const DEFAULTS = { winRate: "3", stdDev: "100", hands: "100000", confidence: "0.95" };

export function VarianceCalculator() {
  const [winRate, setWinRate] = useState(DEFAULTS.winRate);
  const [stdDev, setStdDev] = useState(DEFAULTS.stdDev);
  const [hands, setHands] = useState(DEFAULTS.hands);
  const [confidence, setConfidence] = useState(DEFAULTS.confidence);

  const winRateNumber = Number(winRate);
  const stdDevNumber = Number(stdDev);
  const handsNumber = Number(hands);
  const confidenceNumber = Number(confidence);

  const { result, error } = useMemo(() => {
    const input = {
      winRateBb100: winRateNumber,
      stdDevBb100: stdDevNumber,
      hands: handsNumber,
      confidence: confidenceNumber,
    };
    if (!Number.isFinite(winRateNumber)) return { result: null, error: "Enter a win rate." };
    const invalid = validateVariance(input);
    if (invalid) return { result: null, error: ERROR_TEXT[invalid.kind] };
    return { result: calculateVariance(input), error: null };
  }, [winRateNumber, stdDevNumber, handsNumber, confidenceNumber]);

  const completed = Boolean(result);
  useEffect(() => {
    if (completed) trackEvent(SEO_EVENTS.toolCalculate, { tool_slug: SLUG });
  }, [completed]);

  const copyText = result
    ? `${handsNumber.toLocaleString("en-US")} hands at ${winRateNumber} bb/100 (SD ${stdDevNumber}): ` +
      `${(confidenceNumber * 100).toFixed(0)}% of the time between ${Math.round(result.lowerBb)} and ` +
      `${Math.round(result.upperBb)} bb. ${result.probabilityOfLossPct.toFixed(1)}% chance of being ` +
      `down. — StackedPoker variance calculator`
    : undefined;

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Variance calculator"
      description="How wide your results can swing over a sample, and what that sample can actually prove."
      copyText={copyText}
      onReset={() => {
        setWinRate(DEFAULTS.winRate);
        setStdDev(DEFAULTS.stdDev);
        setHands(DEFAULTS.hands);
        setConfidence(DEFAULTS.confidence);
      }}
      results={
        error ? (
          <ToolError>{error}</ToolError>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultStat
                label="Expected result"
                value={`${Math.round(result.expectedBb).toLocaleString("en-US")} bb`}
                emphasis
              />
              <ResultStat
                label={`${(result.confidence * 100).toFixed(0)}% range`}
                value={`${Math.round(result.lowerBb).toLocaleString("en-US")} to ${Math.round(result.upperBb).toLocaleString("en-US")} bb`}
              />
              <ResultStat
                label="Chance of being down"
                value={`${result.probabilityOfLossPct.toFixed(1)}%`}
                hint="After the full sample"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Result range over {handsNumber.toLocaleString("en-US")} hands
              </p>
              {/* The chart repeats what the numbers above already say, so it is
                  hidden from assistive tech rather than read out as a maze of
                  unlabelled points. */}
              <div aria-hidden="true" className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.points} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="hands"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value: number) => `${Math.round(value)}`}
                      stroke="hsl(var(--border))"
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [`${Math.round(Number(value))} bb`, String(name)]}
                      labelFormatter={(label) => `${Number(label).toLocaleString("en-US")} hands`}
                    />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      name="Upper"
                      stroke="none"
                      fill="#7c5cff"
                      fillOpacity={0.16}
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      name="Lower"
                      stroke="none"
                      fill="hsl(var(--background))"
                      fillOpacity={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      name="Expected"
                      stroke="#7c5cff"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <ResultNote>{explainVariance(result, handsNumber)}</ResultNote>

            <ResultStat
              label="Win rate this sample is consistent with"
              value={`${result.lowerWinRate.toFixed(2)} to ${result.upperWinRate.toFixed(2)} bb/100`}
              hint="The sample cannot distinguish between any two rates inside this range"
            />
          </div>
        ) : null
      }
      footer={
        <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-2.5">
          <p className="text-xs font-medium text-foreground/80">What this model assumes</p>
          <ul className="mt-1.5 space-y-1">
            {VARIANCE_ASSUMPTIONS.map((assumption) => (
              <li key={assumption} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <FieldGrid>
        <NumberField
          toolSlug={SLUG}
          label="Win rate"
          value={winRate}
          onChange={setWinRate}
          min={-100}
          unit="bb/100"
        />
        <NumberField
          toolSlug={SLUG}
          label="Standard deviation"
          value={stdDev}
          onChange={setStdDev}
          unit="bb/100"
          hint="From your own tracker"
          invalid={!(stdDevNumber > 0)}
        />
        <NumberField
          toolSlug={SLUG}
          label="Hands played"
          value={hands}
          onChange={setHands}
          step={1000}
          invalid={!(handsNumber > 0)}
        />
      </FieldGrid>

      <ChoiceGroup
        toolSlug={SLUG}
        label="Confidence level"
        value={confidence}
        options={CONFIDENCE_LEVELS.map((level) => ({
          value: String(level.confidence),
          label: level.label,
        }))}
        onChange={setConfidence}
      />
    </ToolPanel>
  );
}

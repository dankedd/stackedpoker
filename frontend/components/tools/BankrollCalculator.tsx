"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import {
  BANKROLL_CATEGORIES,
  BANKROLL_CATEGORY_META,
  BANKROLL_PROVENANCE,
  calculateBankroll,
  defaultBuyInCount,
  explainBankroll,
  validateBankroll,
  type BankrollCategory,
} from "@/lib/tools/bankroll";
import { ChoiceGroup, FieldGrid, NumberField } from "./ToolFields";
import { ResultNote, ResultStat, ToolError, ToolPanel } from "./ToolPanel";

const SLUG = "bankroll-calculator";

const ERROR_TEXT: Record<string, string> = {
  "bankroll-negative": "A bankroll cannot be negative.",
  "buy-in-not-positive": "Enter a buy-in greater than zero.",
  "buy-in-count-not-positive": "The buy-in rule must be at least 1.",
  "unknown-category": "Pick a game type.",
};

const STATUS_STYLE = {
  safe: { icon: TrendingUp, className: "text-violet-300", label: "Rolled for this stake" },
  move_up: { icon: TrendingUp, className: "text-emerald-300", label: "Ready to move up" },
  move_down: { icon: TrendingDown, className: "text-amber-300", label: "Move down" },
  unknown: { icon: AlertTriangle, className: "text-muted-foreground", label: "Unknown" },
} as const;

export function BankrollCalculator() {
  const [category, setCategory] = useState<BankrollCategory>("cash");
  const [bankroll, setBankroll] = useState("2000");
  const [buyIn, setBuyIn] = useState("100");
  const [buyInCount, setBuyInCount] = useState(String(defaultBuyInCount("cash")));

  const bankrollNumber = Number(bankroll);
  const buyInNumber = Number(buyIn);
  const countNumber = Number(buyInCount);

  const { result, error } = useMemo(() => {
    const input = {
      bankroll: bankrollNumber,
      category,
      buyIn: buyInNumber,
      buyInCount: countNumber,
    };
    const invalid = validateBankroll(input);
    if (invalid) return { result: null, error: ERROR_TEXT[invalid.kind] ?? "Check your inputs." };
    return { result: calculateBankroll(input), error: null };
  }, [bankrollNumber, buyInNumber, countNumber, category]);

  const completed = Boolean(result);
  useEffect(() => {
    if (completed) trackEvent(SEO_EVENTS.toolCalculate, { tool_slug: SLUG, game_type: category });
  }, [completed, category]);

  const meta = BANKROLL_CATEGORY_META[category];
  const provenance = BANKROLL_PROVENANCE[category];
  const status = result ? STATUS_STYLE[result.status] : null;
  const StatusIcon = status?.icon;

  const copyText = result
    ? `${meta.label}: $${Math.round(bankrollNumber)} bankroll at $${buyInNumber} buy-ins = ` +
      `${result.buyInsAvailable.toFixed(1)} buy-ins. Your ${result.buyInCount}-buy-in rule wants ` +
      `$${Math.round(result.recommendedBankroll)}. — StackedPoker bankroll calculator`
    : undefined;

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Bankroll calculator"
      description="How many buy-ins your roll covers, and what your own rule asks for."
      copyText={copyText}
      onReset={() => {
        setCategory("cash");
        setBankroll("2000");
        setBuyIn("100");
        setBuyInCount(String(defaultBuyInCount("cash")));
      }}
      results={
        error ? (
          <ToolError>{error}</ToolError>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultStat
                label="Buy-ins available"
                value={result.buyInsAvailable.toFixed(1)}
                emphasis
              />
              <ResultStat
                label={`Bankroll for ${result.buyInCount} buy-ins`}
                value={`$${Math.round(result.recommendedBankroll).toLocaleString("en-US")}`}
                hint={result.shortfall > 0 ? `$${Math.round(result.shortfall).toLocaleString("en-US")} short` : "Covered"}
              />
              <ResultStat
                label="Stake this roll supports"
                value={`$${Math.round(result.affordableBuyIn).toLocaleString("en-US")}`}
                hint="Largest buy-in under your rule"
              />
            </div>

            {status && StatusIcon && (
              <p className={`flex items-center gap-2 text-sm font-medium ${status.className}`}>
                <StatusIcon aria-hidden="true" className="h-4 w-4" />
                {status.label}
              </p>
            )}

            <ResultNote>{explainBankroll(result, category)}</ResultNote>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ResultStat
                label="Move up around"
                value={`$${Math.round(result.moveUpAt).toLocaleString("en-US")}`}
              />
              <ResultStat
                label="Move down below"
                value={`$${Math.round(result.moveDownBelow).toLocaleString("en-US")}`}
              />
            </div>
          </div>
        ) : null
      }
      footer={
        // Provenance sits with the number, not in a footnote. A house default
        // presented as a rule is how players end up broke following advice
        // nobody actually stands behind.
        <p className="rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {provenance.cited ? "Source: " : "Not a book figure: "}
          </span>
          {provenance.note}
        </p>
      }
    >
      <ChoiceGroup
        toolSlug={SLUG}
        label="Game type"
        value={category}
        options={BANKROLL_CATEGORIES.map((id) => ({
          value: id,
          label: BANKROLL_CATEGORY_META[id].label,
        }))}
        onChange={(next) => {
          setCategory(next);
          setBuyInCount(String(defaultBuyInCount(next)));
        }}
      />

      <FieldGrid>
        <NumberField
          toolSlug={SLUG}
          label="Current bankroll"
          value={bankroll}
          onChange={setBankroll}
          unit="$"
          invalid={!(bankrollNumber >= 0)}
        />
        <NumberField
          toolSlug={SLUG}
          label="Buy-in at your stake"
          value={buyIn}
          onChange={setBuyIn}
          unit="$"
          invalid={!(buyInNumber > 0)}
        />
        <NumberField
          toolSlug={SLUG}
          label="Your buy-in rule"
          value={buyInCount}
          onChange={setBuyInCount}
          min={1}
          step={1}
          unit="×"
          invalid={!(countNumber > 0)}
        />
      </FieldGrid>

      <div>
        <span className="block text-xs font-medium text-muted-foreground">
          Common rules for {meta.label}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {meta.buyInPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setBuyInCount(String(preset))}
              className="h-9 rounded-md border border-border bg-card/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {preset} buy-ins
            </button>
          ))}
        </div>
      </div>
    </ToolPanel>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import {
  COMMON_BET_FRACTIONS,
  calculatePotOdds,
  explainPotOdds,
  validatePotOdds,
} from "@/lib/tools/potOdds";
import { FieldGrid, NumberField } from "./ToolFields";
import { ResultNote, ResultStat, ToolError, ToolPanel } from "./ToolPanel";

const SLUG = "pot-odds-calculator";

const DEFAULTS = { pot: "100", bet: "50", call: "" };

const ERROR_TEXT: Record<string, string> = {
  "pot-not-positive": "Enter a pot size greater than zero.",
  "bet-negative": "A bet cannot be negative.",
  "call-negative": "The amount to call cannot be negative.",
};

/**
 * Pot odds, recalculated as you type.
 *
 * Every figure comes from lib/tools/potOdds.ts, which in turn calls
 * lib/theory/math.ts — the same functions the lessons use.
 */
export function PotOddsCalculator() {
  const [pot, setPot] = useState(DEFAULTS.pot);
  const [bet, setBet] = useState(DEFAULTS.bet);
  const [call, setCall] = useState(DEFAULTS.call);

  const potNumber = Number(pot);
  const betNumber = Number(bet);
  const callNumber = call.trim() === "" ? undefined : Number(call);

  const { result, error } = useMemo(() => {
    const input = { pot: potNumber, bet: betNumber, call: callNumber };
    const invalid = validatePotOdds(input);
    if (invalid || !Number.isFinite(potNumber) || !Number.isFinite(betNumber)) {
      return { result: null, error: invalid ? ERROR_TEXT[invalid.kind] : "Enter numbers only." };
    }
    return { result: calculatePotOdds(input), error: null };
  }, [potNumber, betNumber, callNumber]);

  // "Calculation completed" — fired when the inputs first produce a valid
  // result, not on every keystroke, so the metric counts uses not characters.
  const completed = Boolean(result);
  useEffect(() => {
    if (completed) trackEvent(SEO_EVENTS.toolCalculate, { tool_slug: SLUG });
  }, [completed]);

  const copyText = result
    ? `Pot ${pot}, bet ${bet} → you need ${result.requiredEquityPct.toFixed(1)}% equity to call ` +
      `(${result.oddsRatio}). MDF ${result.mdfPct.toFixed(1)}%. — StackedPoker pot odds calculator`
    : undefined;

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Pot odds calculator"
      description="Enter the pot and the bet. The required equity updates as you type."
      copyText={copyText}
      onReset={() => {
        setPot(DEFAULTS.pot);
        setBet(DEFAULTS.bet);
        setCall(DEFAULTS.call);
      }}
      results={
        error ? (
          <ToolError>{error}</ToolError>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultStat
                label="Equity needed to call"
                value={`${result.requiredEquityPct.toFixed(1)}%`}
                emphasis
              />
              <ResultStat label="Pot odds" value={result.oddsRatio} hint="Reward to risk" />
              <ResultStat
                label="Pot after your call"
                value={String(Math.round(result.potAfterCall * 100) / 100)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ResultStat
                label="Bet as % of pot"
                value={`${(result.betAsPotFraction * 100).toFixed(0)}%`}
              />
              <ResultStat
                label="Minimum defense frequency"
                value={`${result.mdfPct.toFixed(1)}%`}
                hint="How much of your whole range must continue"
              />
            </div>
            <ResultNote>{explainPotOdds(result)}</ResultNote>
          </div>
        ) : null
      }
    >
      <FieldGrid>
        <NumberField
          toolSlug={SLUG}
          label="Pot before the bet"
          value={pot}
          onChange={setPot}
          invalid={!Number.isFinite(potNumber) || potNumber <= 0}
        />
        <NumberField
          toolSlug={SLUG}
          label="Villain's bet"
          value={bet}
          onChange={setBet}
          invalid={betNumber < 0}
        />
        <NumberField
          toolSlug={SLUG}
          label="Amount to call"
          value={call}
          onChange={setCall}
          hint="Leave blank when it equals the bet"
          invalid={callNumber !== undefined && callNumber < 0}
        />
      </FieldGrid>

      <div>
        <span className="block text-xs font-medium text-muted-foreground">Common bet sizes</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {COMMON_BET_FRACTIONS.map((fraction) => (
            <button
              key={fraction}
              type="button"
              onClick={() => {
                const next = potNumber > 0 ? potNumber * fraction : fraction * 100;
                setBet(String(Math.round(next * 100) / 100));
              }}
              className="h-9 rounded-md border border-border bg-card/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {fraction === 1 ? "Pot" : `${Math.round(fraction * 100)}%`}
            </button>
          ))}
        </div>
      </div>
    </ToolPanel>
  );
}

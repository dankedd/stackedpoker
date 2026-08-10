"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { formatCards, parseCards } from "@/lib/tools/cards";
import {
  EQUITY_LIMITATIONS,
  boardCount,
  calculateEquity,
  validateEquityInput,
  type EquityResult,
} from "@/lib/tools/equity";
import { FieldGrid, TextField } from "./ToolFields";
import { ResultNote, ResultStat, ToolError, ToolPanel } from "./ToolPanel";

const SLUG = "equity-calculator";

/**
 * Enumerations at or below this size run on every keystroke — 990 boards is
 * about a millisecond, so the result feels instant.
 *
 * The preflop case is 1.7 million boards (~0.5s on a desktop, longer on a
 * phone). That one waits for an explicit click and shows a progress state,
 * rather than freezing the page while somebody is still typing the second
 * card of their hand.
 */
const INSTANT_BOARD_LIMIT = 5000;

const DEFAULTS = { hero: "AsKs", villain: "QdQh", board: "" };

export function EquityCalculator() {
  const [heroText, setHeroText] = useState(DEFAULTS.hero);
  const [villainText, setVillainText] = useState(DEFAULTS.villain);
  const [boardText, setBoardText] = useState(DEFAULTS.board);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);

  const hero = useMemo(() => parseCards(heroText), [heroText]);
  const villain = useMemo(() => parseCards(villainText), [villainText]);
  const board = useMemo(() => parseCards(boardText), [boardText]);

  const invalidText = [...hero.invalid, ...villain.invalid, ...board.invalid];
  const validation = validateEquityInput(hero.cards, villain.cards, board.cards);
  const boards = board.cards.length <= 5 ? boardCount(board.cards.length) : 0;
  const isInstant = boards > 0 && boards <= INSTANT_BOARD_LIMIT;

  const error = invalidText.length
    ? `Not a card: ${invalidText.join(", ")}. Use ranks A K Q J T 9–2 and suits s h d c, e.g. "AsKh".`
    : validation?.kind === "hero-incomplete"
      ? "Enter both of your hole cards."
      : validation?.kind === "villain-incomplete"
        ? "Enter both of villain's hole cards."
        : validation?.kind === "board-too-long"
          ? `A board has at most five cards; you entered ${validation.count}.`
          : validation?.kind === "duplicate-cards"
            ? `${formatCards(validation.cards)} is used more than once — every card exists once in a deck.`
            : null;

  const run = useCallback(() => {
    if (validation) return;
    setComputing(true);
    // Yield one frame so the progress state paints before the enumeration
    // blocks the thread.
    requestAnimationFrame(() => {
      const computed = calculateEquity(hero.cards, villain.cards, board.cards);
      setResult(computed);
      setComputing(false);
      trackEvent(SEO_EVENTS.toolCalculate, {
        tool_slug: SLUG,
        street: ["preflop", "", "", "flop", "turn", "river"][board.cards.length] || "preflop",
        boards: computed.boardsEvaluated,
      });
    });
  }, [validation, hero.cards, villain.cards, board.cards]);

  // Cheap spots recalculate themselves; the expensive one waits to be asked.
  useEffect(() => {
    if (!validation && isInstant) run();
    else if (validation) setResult(null);
  }, [validation, isInstant, run]);

  const copyText = result
    ? `${formatCards(hero.cards)} vs ${formatCards(villain.cards)}` +
      `${board.cards.length ? ` on ${formatCards(board.cards)}` : " preflop"}: ` +
      `${(result.heroEquity * 100).toFixed(2)}% vs ${(result.villainEquity * 100).toFixed(2)}% ` +
      `(exact, ${result.boardsEvaluated.toLocaleString("en-US")} runouts). — StackedPoker equity calculator`
    : undefined;

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Equity calculator"
      description="Exact hand-versus-hand equity by enumerating every remaining runout — no simulation."
      copyText={copyText}
      onReset={() => {
        setHeroText(DEFAULTS.hero);
        setVillainText(DEFAULTS.villain);
        setBoardText(DEFAULTS.board);
        setResult(null);
      }}
      results={
        error ? (
          <ToolError>{error}</ToolError>
        ) : computing ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Enumerating {boards.toLocaleString("en-US")} runouts…
          </p>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ResultStat
                label={`Your equity — ${formatCards(hero.cards)}`}
                value={`${(result.heroEquity * 100).toFixed(2)}%`}
                emphasis
              />
              <ResultStat
                label={`Villain — ${formatCards(villain.cards)}`}
                value={`${(result.villainEquity * 100).toFixed(2)}%`}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultStat label="You win" value={`${result.heroWinPct.toFixed(2)}%`} />
              <ResultStat label="Villain wins" value={`${result.villainWinPct.toFixed(2)}%`} />
              <ResultStat label="Split" value={`${result.tiePct.toFixed(2)}%`} />
            </div>
            <ResultNote>
              Exact, not simulated: all {result.boardsEvaluated.toLocaleString("en-US")} possible
              runouts were dealt and counted. Split pots count as half a pot to each player, which
              is why equity and win percentage differ when a chop is possible.
            </ResultNote>
          </div>
        ) : null
      }
      footer={
        <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-2.5">
          <p className="text-xs font-medium text-foreground/80">What this calculator does not do</p>
          <ul className="mt-1.5 space-y-1">
            {EQUITY_LIMITATIONS.map((limitation) => (
              <li key={limitation} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <FieldGrid>
        <TextField
          toolSlug={SLUG}
          label="Your hand"
          value={heroText}
          onChange={setHeroText}
          placeholder="As Ks"
          hint="Two cards"
          invalid={Boolean(hero.invalid.length) || hero.cards.length !== 2}
        />
        <TextField
          toolSlug={SLUG}
          label="Villain's hand"
          value={villainText}
          onChange={setVillainText}
          placeholder="Qd Qh"
          hint="Two cards"
          invalid={Boolean(villain.invalid.length) || villain.cards.length !== 2}
        />
        <TextField
          toolSlug={SLUG}
          label="Board"
          value={boardText}
          onChange={setBoardText}
          placeholder="Jh 7c 2d"
          hint="Leave blank for preflop"
          invalid={Boolean(board.invalid.length) || board.cards.length > 5}
        />
      </FieldGrid>

      {!validation && !isInstant && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={computing}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {computing ? "Calculating…" : "Run all runouts"}
          </button>
          <span className="text-xs text-muted-foreground">
            {boards.toLocaleString("en-US")} boards — takes about half a second.
          </span>
        </div>
      )}
    </ToolPanel>
  );
}

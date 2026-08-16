"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { COACH_HAND_STORAGE_KEY } from "@/lib/learn/coachReviewStorage";
import { formatCards, parseCards } from "@/lib/tools/cards";
import { analyseHand } from "@/lib/tools/handAnalysis/analyze";
import {
  buildCoachHandContext,
  decodeHandFromQuery,
  encodeHandToQuery,
} from "@/lib/tools/handAnalysis/coachContext";
import { parseHandHistory, type ParseResult } from "@/lib/tools/handAnalysis/parse";
import {
  applicablePresets,
  unavailableReason,
  type RangePreset,
} from "@/lib/tools/handAnalysis/rangePresets";
import type { ConceptRecommendation } from "@/lib/tools/handAnalysis/recommendations";
import type {
  ActionType,
  HandAction,
  HandAnalysis,
  HandInput,
  HandNotAnalysable,
  MissingField,
  ConditionalRange,
  MissingInformation,
  Position,
  Street,
  Unknown,
} from "@/lib/tools/handAnalysis/types";
import { isAnalysed } from "@/lib/tools/handAnalysis/types";
import {
  deleteAnalyzedHand,
  filterSavedHands,
  handFromSavedRow,
  listAnalyzedHands,
  saveAnalyzedHand,
  type SavedHandRow,
} from "@/lib/tools/handAnalysis/savedHands";
import { blockingIssues, classifyInput } from "@/lib/tools/handAnalysis/validate";
import { missingInformation } from "@/lib/tools/handAnalysis/completeness";
import { useAuth } from "@/hooks/useAuth";
import { ChoiceGroup, FieldGrid, NumberField, TextField } from "./ToolFields";
import { ResultStat, ToolError, ToolPanel } from "./ToolPanel";

const SLUG = "poker-hand-analyzer";
const ANALYZER_PATH = "/tools/poker-hand-analyzer";

const POSITIONS: Position[] = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
const STREETS: Street[] = ["preflop", "flop", "turn", "river"];
const ACTION_TYPES: ActionType[] = ["check", "call", "bet", "raise", "3bet", "4bet", "allin", "fold"];

const VERDICT_LABEL: Record<HandAnalysis["verdict"], string> = {
  "profitable-by-the-maths": "The maths backs the call",
  "unprofitable-by-the-maths": "The maths does not back the call",
  "profitable-against-the-range": "Against that range, the maths backs the call",
  "unprofitable-against-the-range": "Against that range, the maths does not back the call",
  "needs-review": "The maths cannot settle this one",
  "insufficient-information": "Not enough entered to assess",
};

/** One line under the headline, in plain language, for someone new to poker. */
const VERDICT_PLAIN: Record<HandAnalysis["verdict"], string> = {
  "profitable-by-the-maths": "At the price you were offered, this call wins money over time.",
  "unprofitable-by-the-maths": "At the price you were offered, this call loses money over time.",
  "profitable-against-the-range":
    "This is a conditional result. Villain's real cards are unknown; the answer holds for the range you picked, and moves if they are playing a different one.",
  "unprofitable-against-the-range":
    "This is a conditional result. Villain's real cards are unknown; the answer holds for the range you picked, and moves if they are playing a different one.",
  "needs-review":
    "Everything below is solid — the facts, the numbers and the theory. What no arithmetic can decide is what your opponent held, so the answer is yours to reason out, with the pieces laid out here.",
  "insufficient-information": "Add a little more of the hand and there will be more to say.",
};

const CONFIDENCE_LABEL: Record<HandAnalysis["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  insufficient: "Insufficient information",
};

const VERDICT_STYLE: Record<HandAnalysis["verdict"], string> = {
  "profitable-by-the-maths": "border-violet-500/45 bg-violet-500/[0.12] text-violet-100",
  "unprofitable-by-the-maths": "border-amber-500/45 bg-amber-500/[0.10] text-amber-100",
  // Deliberately NOT the same styling as the unconditional verdicts — a
  // conditional conclusion should not look like a settled one at a glance.
  "profitable-against-the-range": "border-sky-500/45 bg-sky-500/[0.10] text-sky-100",
  "unprofitable-against-the-range": "border-sky-500/45 bg-sky-500/[0.10] text-sky-100",
  "needs-review": "border-border/70 bg-background/50 text-foreground",
  "insufficient-information": "border-border/70 bg-background/50 text-muted-foreground",
};

export interface PokerHandAnalyzerProps {
  /**
   * Concept → lessons/wiki/glossary/tool, resolved from the SEO index on the
   * server. Passed in rather than imported so the content registries never
   * reach the browser bundle.
   */
  recommendations?: Record<string, ConceptRecommendation>;
}

/**
 * The Poker Hand Analyzer.
 *
 * Anonymous-first: the analysis is never gated, and the account CTA appears
 * only after a result has been delivered (§10).
 *
 * The result is laid out in one fixed order — verdict, why, what happened,
 * what we can calculate, what stays uncertain, the concept, the lesson, the
 * coach (§2) — so a reader always meets the conclusion before the machinery.
 * Detail below each heading is progressively disclosed; nobody has to read an
 * SPR to find out whether their call was good.
 *
 * The other mechanics worth knowing:
 *  - the hand round-trips through the URL, so a link restores it and the AI
 *    Coach can send the user back with it intact (§7);
 *  - the coach handoff reuses the sessionStorage pattern LessonPlayer already
 *    uses for its post-lesson review, rather than inventing a second one;
 *  - every "we could not determine X" that a field would fix renders as a
 *    button that focuses that field (§5), so a limitation is never a dead end.
 */
export function PokerHandAnalyzer(props: PokerHandAnalyzerProps) {
  // `useSearchParams` in the body below reads the shared hand from the URL.
  // Without this boundary it would force the whole statically-generated tool
  // page to render on demand.
  return (
    <Suspense fallback={<AnalyzerSkeleton />}>
      <HandAnalyzerBody {...props} />
    </Suspense>
  );
}

function AnalyzerSkeleton() {
  return (
    <section className="mt-8 rounded-2xl border border-violet-500/25 bg-card/40 px-5 py-8">
      <p className="text-sm text-muted-foreground">Loading the analyser…</p>
    </section>
  );
}

function HandAnalyzerBody({ recommendations = {} }: PokerHandAnalyzerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [heroPosition, setHeroPosition] = useState<Position>("BTN");
  const [heroText, setHeroText] = useState("");
  const [villainPosition, setVillainPosition] = useState<Position | "unknown">("unknown");
  const [villainText, setVillainText] = useState("");
  const [boardText, setBoardText] = useState("");
  const [potText, setPotText] = useState("");
  const [stackText, setStackText] = useState("");
  const [actions, setActions] = useState<HandAction[]>([]);
  const [historyText, setHistoryText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mode, setMode] = useState<"manual" | "paste">("manual");
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** "known" = I'll type villain's cards. "range" = model them with a chart. */
  const [rangeMode, setRangeMode] = useState<"known" | "range">("known");
  const [presetId, setPresetId] = useState<string>("");
  const [analysis, setAnalysis] = useState<HandAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [started, setStarted] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedHands, setSavedHands] = useState<SavedHandRow[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const { user } = useAuth();

  // Focus targets for "add missing information" (§5) and for moving focus to
  // the result once an analysis lands (§12).
  const heroRef = useRef<HTMLInputElement>(null);
  const villainRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLInputElement>(null);
  const potRef = useRef<HTMLInputElement>(null);
  const stackRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const villainPositionRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const heroPositionRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  // Restore a hand from the URL — the return half of the Coach round trip.
  useEffect(() => {
    if (!searchParams.get("hc")) return;
    const restored = decodeHandFromQuery(new URLSearchParams(searchParams.toString()));
    applyHand(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening the analyzer — the denominator for every funnel below it.
  useEffect(() => {
    trackEvent(SEO_EVENTS.analyzerOpened, { tool_slug: SLUG });
  }, []);

  const applyHand = useCallback((hand: Partial<HandInput>) => {
    if (hand.heroPosition) setHeroPosition(hand.heroPosition);
    if (hand.heroCards?.length) setHeroText(hand.heroCards.join(" "));
    if (hand.villainPosition) setVillainPosition(hand.villainPosition);
    if (hand.villainCards?.length) setVillainText(hand.villainCards.join(" "));
    if (hand.board) setBoardText(hand.board.join(" "));
    if (hand.potBb !== undefined) setPotText(String(hand.potBb));
    if (hand.effectiveStackBb !== undefined) setStackText(String(hand.effectiveStackBb));
    if (hand.actions) setActions(hand.actions);
    if (hand.villainRangePresetId) {
      setPresetId(hand.villainRangePresetId);
      setRangeMode("range");
    }
  }, []);

  const hero = useMemo(() => parseCards(heroText), [heroText]);
  const villain = useMemo(() => parseCards(villainText), [villainText]);
  const board = useMemo(() => parseCards(boardText), [boardText]);

  const hand: HandInput = useMemo(
    () => ({
      heroPosition,
      heroCards: hero.cards,
      ...(villainPosition !== "unknown" ? { villainPosition } : {}),
      ...(villain.cards.length ? { villainCards: villain.cards } : {}),
      board: board.cards,
      actions,
      ...(potText.trim() && Number.isFinite(Number(potText)) ? { potBb: Number(potText) } : {}),
      ...(stackText.trim() && Number.isFinite(Number(stackText))
        ? { effectiveStackBb: Number(stackText) }
        : {}),
      // A known hand always wins: modelling a hand we can see would be
      // replacing a fact with an assumption.
      ...(presetId && villain.cards.length !== 2 ? { villainRangePresetId: presetId } : {}),
    }),
    [heroPosition, hero.cards, villainPosition, villain.cards, board.cards, actions, potText, stackText, presetId],
  );

  const unreadable = [...hero.invalid, ...villain.invalid, ...board.invalid];

  /**
   * The live outcome of what has been typed so far (§4).
   *
   * Recomputed on every keystroke, but only as far as classification — the
   * expensive part (an equity enumeration) runs on submit, not on input.
   */
  const inputState = useMemo(
    () => (unreadable.length ? "invalid" : classifyInput(hand)),
    // The length, not the array: `unreadable` is rebuilt on every render, and
    // depending on it directly would defeat the memo entirely.
    [hand, unreadable.length],
  );

  /**
   * The live guidance for a hand that is not ready yet.
   *
   * Built from the cheap classifiers rather than by calling `analyseHand` —
   * that would run a full equity enumeration on every keystroke the moment
   * both hands were known, for a result nobody asked for yet (§13).
   */
  const preflight = useMemo<HandNotAnalysable | null>(() => {
    if (inputState === "analyzable") return null;
    return {
      state: inputState,
      reasons: blockingIssues(hand).map((issue) => issue.message),
      missing: missingInformation(hand),
    };
  }, [inputState, hand]);

  const ready = inputState === "analyzable";

  /**
   * Which reviewed ranges genuinely fit this spot.
   *
   * Cheap — a position/action/street comparison over twelve presets, no
   * enumeration — so it can run on every keystroke. The expensive part is the
   * equity itself, and that only runs on submit (§20).
   */
  const presets = useMemo(() => applicablePresets(hand), [hand]);
  const rangeUnavailable = useMemo(
    () => (presets.length === 0 ? unavailableReason(hand) : null),
    [presets.length, hand],
  );
  const villainKnown = villain.cards.length === 2;

  // Drop a selection that stopped applying — otherwise editing the board or
  // the action could leave a chart selected that no longer describes the spot.
  useEffect(() => {
    if (presetId && !presets.some((preset) => preset.id === presetId)) setPresetId("");
  }, [presetId, presets]);

  // "Input started" — once, the first time anything is typed.
  useEffect(() => {
    if (started || (!heroText && !boardText && !historyText)) return;
    setStarted(true);
    trackEvent(SEO_EVENTS.handInputStarted, { tool_slug: SLUG, mode });
  }, [started, heroText, boardText, historyText, mode]);

  const focusField = useCallback((field: MissingField) => {
    const targets: Record<MissingField, RefObject<HTMLElement | null>> = {
      heroCards: heroRef,
      heroPosition: heroPositionRef,
      villainCards: villainRef,
      villainPosition: villainPositionRef,
      board: boardRef,
      potBb: potRef,
      effectiveStackBb: stackRef,
      actions: actionsRef,
      villainRange: rangeRef,
    };
    // Pot, stack, villain's seat and the action list all live behind the
    // disclosure; sending focus into a collapsed element would look broken.
    if (["potBb", "effectiveStackBb", "villainPosition", "actions"].includes(field)) {
      setDetailsOpen(true);
    }
    if (field === "villainRange") setRangeMode("range");
    setMode("manual");
    // After the disclosure has had a frame to open.
    requestAnimationFrame(() => {
      const element = targets[field].current;
      if (!element) return;
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      const focusable =
        element instanceof HTMLInputElement
          ? element
          : element.querySelector<HTMLElement>("input, button, select");
      focusable?.focus();
    });
  }, []);

  const runAnalysis = useCallback(() => {
    if (!ready) {
      trackEvent(SEO_EVENTS.analysisFailed, { tool_slug: SLUG, reason: inputState });
      return;
    }
    setAnalysing(true);
    setSaveState("idle");
    // Yield a frame so the pending state paints before a preflop
    // known-vs-known equity enumeration blocks the thread.
    requestAnimationFrame(() => {
      const outcome = analyseHand(hand);
      setAnalysing(false);
      if (!isAnalysed(outcome)) {
        trackEvent(SEO_EVENTS.analysisFailed, { tool_slug: SLUG, reason: outcome.state });
        return;
      }
      setAnalysis(outcome);
      trackEvent(SEO_EVENTS.analysisCompleted, {
        tool_slug: SLUG,
        street: outcome.summary.street,
        verdict: outcome.verdict,
        confidence: outcome.confidence,
        concepts: outcome.conceptIds.length,
        unknowns: outcome.unknowns.length,
        conditional: Boolean(outcome.conditional),
      });
      if (outcome.conditional) {
        trackEvent(SEO_EVENTS.rangeAnalysisCompleted, {
          tool_slug: SLUG,
          preset_id: outcome.conditional.presetId,
          street: outcome.summary.street,
          verdict: outcome.verdict,
          confidence: outcome.confidence,
          combos: outcome.conditional.combosConsidered,
        });
      }
      // Put the hand in the URL so it is shareable and restorable.
      router.replace(`${ANALYZER_PATH}?${encodeHandToQuery(hand)}`, { scroll: false });
      // Move focus to the conclusion. Without this a keyboard or screen-reader
      // user presses "Analyse" and is left at the bottom of the form with the
      // answer somewhere above them.
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }, [ready, hand, inputState, router]);

  const applyHistory = useCallback(() => {
    const result = parseHandHistory(historyText);
    setParseResult(result);

    // Whatever came through is filled in, even when the parse was partial —
    // one unreadable stakes line should not cost the user their whole hand.
    if (Object.keys(result.partial).length) applyHand(result.partial);
    if (result.hand || result.parsed.length) {
      setMode("manual");
      trackEvent(SEO_EVENTS.handParsed, {
        tool_slug: SLUG,
        format: result.format ?? "unknown",
        complete: Boolean(result.hand),
        fields_read: result.parsed.length,
        fields_missing: result.undetermined.length,
      });
      return;
    }
    trackEvent(SEO_EVENTS.analysisFailed, { tool_slug: SLUG, reason: "parse" });
  }, [historyText, applyHand]);

  const askCoach = useCallback(() => {
    if (!analysis) return;
    const returnPath = `${ANALYZER_PATH}?${encodeHandToQuery(hand)}`;
    try {
      sessionStorage.setItem(
        COACH_HAND_STORAGE_KEY,
        JSON.stringify(buildCoachHandContext(hand, analysis, returnPath)),
      );
    } catch {
      // Private mode — the coach still opens, just without the hand preloaded.
    }
    trackEvent(SEO_EVENTS.aiCoachClicked, { tool_slug: SLUG, verdict: analysis.verdict });
    router.push("/coach?hand=1");
  }, [analysis, hand, router]);

  // "My analysed hands" — only ever fetched for a signed-in visitor.
  useEffect(() => {
    if (!user) {
      setSavedHands([]);
      setSavedLoaded(false);
      return;
    }
    let cancelled = false;
    listAnalyzedHands().then((rows) => {
      if (cancelled) return;
      setSavedHands(rows);
      setSavedLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, saveState]);

  const save = useCallback(async () => {
    if (!analysis) return;
    setSaveState("saving");
    setSaveError(null);
    const primary = analysis.concepts[0];
    const result = await saveAnalyzedHand(hand, analysis, {
      ...(historyText.trim() ? { rawHandText: historyText } : {}),
      ...(primary && recommendations[primary.conceptId]?.lessons[0]
        ? { recommendedLessonPath: recommendations[primary.conceptId].lessons[0].path }
        : {}),
    });
    if (result.ok) {
      setSaveState("saved");
      trackEvent(SEO_EVENTS.handSaved, { tool_slug: SLUG, verdict: analysis.verdict });
    } else {
      setSaveState("error");
      setSaveError(result.error ?? "Could not save that hand.");
    }
  }, [analysis, hand, historyText, recommendations]);

  const reopen = useCallback(
    (row: SavedHandRow) => {
      const restored = handFromSavedRow(row);
      if (!restored) return;
      // Reset first, so a field the saved hand does not carry (say, a pot) is
      // not silently inherited from whatever is on screen right now.
      setVillainText("");
      setPotText("");
      setStackText("");
      setActions([]);
      setPresetId("");
      setRangeMode(restored.villainRangePresetId ? "range" : "known");
      applyHand(restored);
      setAnalysis(null);
      setSaveState("idle");
      trackEvent(SEO_EVENTS.handReopened, { tool_slug: SLUG });
      // The analysis is deliberately RECOMPUTED rather than read back from the
      // row: the engine may have improved since, and stale rendered prose must
      // never be the source of truth (§9).
      requestAnimationFrame(() => {
        const outcome = analyseHand(restored);
        if (isAnalysed(outcome)) setAnalysis(outcome);
        router.replace(`${ANALYZER_PATH}?${encodeHandToQuery(restored)}`, { scroll: false });
      });
    },
    [applyHand, router],
  );

  const remove = useCallback(async (id: string) => {
    const result = await deleteAnalyzedHand(id);
    if (!result.ok) return;
    setSavedHands((rows) => rows.filter((row) => row.id !== id));
    trackEvent(SEO_EVENTS.handDeleted, { tool_slug: SLUG });
  }, []);

  const reset = () => {
    setHeroText("");
    setVillainText("");
    setBoardText("");
    setPotText("");
    setStackText("");
    setActions([]);
    setHistoryText("");
    setParseResult(null);
    setAnalysis(null);
    setSaveState("idle");
    setPresetId("");
    setRangeMode("known");
    router.replace(ANALYZER_PATH, { scroll: false });
  };

  const addAction = (street: Street) =>
    setActions((current) => [...current, { street, actor: "hero", type: "bet" }]);

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Analyse a hand"
      description="Enter the hand or paste a history. No account needed."
      onReset={reset}
      copyText={
        analysis
          ? [
              `${analysis.summary.heroCards} ${analysis.summary.heroPosition} on ${analysis.summary.board} — ${VERDICT_LABEL[analysis.verdict]}.`,
              analysis.verdictBasis,
              // A conditional result must stay conditional once it leaves the
              // page — pasted into a forum, the condition is the first thing
              // that would otherwise be lost.
              analysis.conditional
                ? `Conditional on the ${analysis.conditional.presetLabel} range (${analysis.conditional.citation}).`
                : "",
              "— StackedPoker hand analyzer",
            ]
              .filter(Boolean)
              .join(" ")
          : undefined
      }
      results={
        analysing ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Analysing…
          </p>
        ) : analysis ? (
          <AnalysisResult
            analysis={analysis}
            recommendations={recommendations}
            onAskCoach={askCoach}
            onAddInformation={focusField}
            onSave={user ? save : undefined}
            saveState={saveState}
            saveError={saveError}
            signedIn={Boolean(user)}
            headingRef={resultRef}
          />
        ) : null
      }
      footer={
        user ? (
          <SavedHands
            rows={savedHands}
            loaded={savedLoaded}
            onReopen={reopen}
            onDelete={remove}
          />
        ) : null
      }
    >
      <ChoiceGroup
        toolSlug={SLUG}
        label="How do you want to enter the hand?"
        value={mode}
        options={[
          { value: "manual", label: "Enter it" },
          { value: "paste", label: "Paste a history" },
        ]}
        onChange={(next) => setMode(next as "manual" | "paste")}
      />

      {mode === "paste" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="hand-history" className="block text-xs font-medium text-muted-foreground">
              Hand history
            </label>
            <textarea
              id="hand-history"
              value={historyText}
              onChange={(event) => setHistoryText(event.target.value)}
              rows={8}
              placeholder="Paste a PokerStars or GGPoker hand history…"
              className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={applyHistory}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Read the hand
          </button>
        </div>
      ) : (
        <>
          {parseResult && <ParseReport result={parseResult} onFix={focusField} />}

          <FieldGrid>
            <TextField
              toolSlug={SLUG}
              label="Your hand"
              value={heroText}
              onChange={setHeroText}
              placeholder="As Ks"
              hint="Two cards"
              invalid={Boolean(hero.invalid.length)}
              inputRef={heroRef}
            />
            <TextField
              toolSlug={SLUG}
              label="Board"
              value={boardText}
              onChange={setBoardText}
              placeholder="Jh 7h 2c"
              hint="Blank for preflop"
              invalid={Boolean(board.invalid.length)}
              inputRef={boardRef}
            />
            <TextField
              toolSlug={SLUG}
              label="Villain's hand"
              value={villainText}
              onChange={setVillainText}
              placeholder="Optional"
              hint="Known cards give exact equity"
              invalid={Boolean(villain.invalid.length)}
              inputRef={villainRef}
            />
          </FieldGrid>

          <div ref={heroPositionRef}>
            <ChoiceGroup
              toolSlug={SLUG}
              label="Your position"
              value={heroPosition}
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              onChange={setHeroPosition}
            />
          </div>

          <div ref={rangeRef}>
            <RangeSelector
              mode={rangeMode}
              onModeChange={(next) => {
                setRangeMode(next);
                if (next === "range") {
                  trackEvent(SEO_EVENTS.rangeAnalysisStarted, { tool_slug: SLUG });
                  if (!presets.length) {
                    trackEvent(SEO_EVENTS.rangeAnalysisUnavailable, {
                      tool_slug: SLUG,
                      street: board.cards.length >= 3 ? "postflop" : "preflop",
                    });
                  }
                } else {
                  setPresetId("");
                }
              }}
              presets={presets}
              selectedId={presetId}
              onSelect={(id) => {
                setPresetId(id);
                trackEvent(SEO_EVENTS.rangePresetSelected, { tool_slug: SLUG, preset_id: id });
              }}
              unavailable={rangeUnavailable}
              villainKnown={villainKnown}
            />
          </div>

          <details
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen((event.target as HTMLDetailsElement).open)}
            className="rounded-lg border border-border/60 bg-background/30"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Pot, stacks and action
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="space-y-4 border-t border-border/50 px-3 py-3">
              <FieldGrid cols={2}>
                <NumberField
                  toolSlug={SLUG}
                  label="Pot before the action"
                  value={potText}
                  onChange={setPotText}
                  unit="bb"
                  inputRef={potRef}
                />
                <NumberField
                  toolSlug={SLUG}
                  label="Effective stack"
                  value={stackText}
                  onChange={setStackText}
                  unit="bb"
                  inputRef={stackRef}
                />
              </FieldGrid>

              <div ref={villainPositionRef}>
                <ChoiceGroup
                  toolSlug={SLUG}
                  label="Villain's position"
                  value={villainPosition}
                  options={[
                    { value: "unknown", label: "Unknown" },
                    ...POSITIONS.map((p) => ({ value: p, label: p })),
                  ]}
                  onChange={(next) => setVillainPosition(next as Position | "unknown")}
                />
              </div>

              <div ref={actionsRef}>
                <ActionEditor actions={actions} onChange={setActions} onAdd={addAction} />
              </div>
            </div>
          </details>
        </>
      )}

      {/* The three states, told apart (§4). An impossible hand is an error to
          fix; an unfinished one is an invitation to keep going. */}
      {inputState === "invalid" && preflight && (heroText.trim() !== "" || unreadable.length > 0) && (
        <ToolError>
          {unreadable.length
            ? `Not a card: ${unreadable.join(", ")}. Use ranks A K Q J T 9–2 and suits s h d c — for example "As Kh".`
            : preflight.reasons[0]}
        </ToolError>
      )}

      {inputState === "incomplete" && preflight && (
        <IncompleteNotice outcome={preflight} onAddInformation={focusField} />
      )}

      {/* Sticky on a phone: with the form scrolled, the primary action would
          otherwise be off-screen exactly when it becomes available. */}
      <div className="sticky bottom-2 z-10 -mx-1 px-1 sm:static sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={!ready || analysing}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-all hover:from-violet-500 hover:to-blue-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:shadow-md"
        >
          {analysing ? "Analysing…" : "Analyse this hand"}
        </button>
      </div>
    </ToolPanel>
  );
}

// ── Incomplete / parse feedback ──────────────────────────────────────────────

/**
 * The "valid but not finished" state (§4).
 *
 * Deliberately not styled as an error: nothing is wrong, there is simply more
 * to enter, and every line comes with the control that finishes it.
 */
function IncompleteNotice({
  outcome,
  onAddInformation,
}: {
  outcome: HandNotAnalysable;
  onAddInformation: (field: MissingField) => void;
}) {
  const blocking = outcome.missing.filter((item) => item.severity === "blocking");
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3.5">
      <p className="text-sm font-medium text-foreground">Almost there</p>
      <ul className="mt-1.5 space-y-1">
        {outcome.reasons.map((reason) => (
          <li key={reason} className="text-sm leading-relaxed text-muted-foreground">
            {reason}
          </li>
        ))}
      </ul>
      {blocking.length > 0 && (
        <MissingButtons missing={blocking} onAddInformation={onAddInformation} />
      )}
    </div>
  );
}

/** "Add missing information" — the direct action §5 asks for. */
function MissingButtons({
  missing,
  onAddInformation,
}: {
  missing: MissingInformation[];
  onAddInformation: (field: MissingField) => void;
}) {
  if (!missing.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {missing.map((item) => (
        <button
          key={item.field}
          type="button"
          onClick={() => onAddInformation(item.field)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-violet-500/35 bg-violet-500/10 px-3 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * What the parser got, and what it did not (§6).
 *
 * Both halves are shown together on purpose. A history that produced the board,
 * the cards and eight actions but could not name the seat has still done almost
 * all of the work, and reporting only the failure would hide that.
 */
function ParseReport({
  result,
  onFix,
}: {
  result: ParseResult;
  onFix: (field: MissingField) => void;
}) {
  if (result.problems.length) {
    return (
      <div role="alert" className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
        <p className="text-sm font-medium text-amber-200">That history could not be read.</p>
        <ul className="space-y-1">
          {result.problems.map((problem) => (
            <li key={problem.message} className="text-xs leading-relaxed text-amber-100/90">
              {problem.line ? `Line ${problem.line}: ` : ""}
              {problem.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
      {result.parsed.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/80">
            Read from your history
          </p>
          <dl className="mt-1.5 space-y-0.5">
            {result.parsed.map((field) => (
              <div key={field.field} className="flex items-baseline gap-2 text-sm">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="font-medium text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {result.undetermined.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">
            Could not determine
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {result.undetermined.map((field) => (
              <li key={field.field} className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{field.label}. </span>
                {field.message}
              </li>
            ))}
          </ul>
          <MissingButtons
            missing={result.undetermined.map((field) => ({
              field: field.field,
              label: `Set ${field.label.toLowerCase()}`,
              unlocks: "",
              severity: "blocking" as const,
            }))}
            onAddInformation={onFix}
          />
        </div>
      )}
    </div>
  );
}

// ── Range selection (§4, §16) ────────────────────────────────────────────────

/**
 * "What do you think villain can have?"
 *
 * Written for someone who has never used a solver. The choice is framed as a
 * question about knowledge — do you know their cards or not — rather than as a
 * technical switch, and the consequence of each option is stated before it is
 * taken. A range is introduced as "a chart of the hands they'd play this way",
 * never as a fact about the person on the other side.
 *
 * When nothing applies the component says WHY, in one sentence, instead of
 * showing an empty dropdown. That sentence is the whole difference between a
 * tool that looks broken and one that has been honest with you.
 */
function RangeSelector({
  mode,
  onModeChange,
  presets,
  selectedId,
  onSelect,
  unavailable,
  villainKnown,
}: {
  mode: "known" | "range";
  onModeChange: (mode: "known" | "range") => void;
  presets: RangePreset[];
  selectedId: string;
  onSelect: (id: string) => void;
  unavailable: string | null;
  /** Villain's cards are typed in — a range would be strictly worse. */
  villainKnown: boolean;
}) {
  if (villainKnown) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-3">
      <ChoiceGroup
        toolSlug={SLUG}
        label="What do you think villain can have?"
        value={mode}
        options={[
          { value: "known", label: "I know their cards" },
          { value: "range", label: "I don't know — use a reviewed range" },
        ]}
        onChange={(next) => onModeChange(next as "known" | "range")}
      />

      {mode === "known" && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Type them into “Villain&rsquo;s hand” above and the equity becomes exact.
        </p>
      )}

      {mode === "range" && unavailable && (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            No reviewed range is available for this spot
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{unavailable}</p>
        </div>
      )}

      {mode === "range" && !unavailable && (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A range is a chart of the hands villain would play this way. Picking one lets the
            analyser calculate your exact equity <em>against that chart</em> — a conditional
            answer, not a claim about what this particular opponent holds.
          </p>
          <div role="radiogroup" aria-label="Choose a range" className="space-y-2">
            {presets.map((preset) => {
              const selected = preset.id === selectedId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(preset.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-sky-500/50 bg-sky-500/[0.10]"
                      : "border-border bg-card/40 hover:border-sky-500/30"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">{preset.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {preset.description}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    {preset.provenance.figure} — {preset.provenance.source}, p.
                    {preset.provenance.page}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The conditional banner (§6).
 *
 * Sits directly under the verdict, before anything else, because a reader who
 * skims the headline and stops must not walk away with a conditional result in
 * their head as an unconditional one.
 */
function ConditionalNotice({ conditional }: { conditional: ConditionalRange }) {
  return (
    <section
      aria-labelledby="conditional"
      className="rounded-xl border border-sky-500/30 bg-sky-500/[0.07] px-4 py-3.5"
    >
      <h3 id="conditional" className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">
        Conditional analysis
      </h3>
      <p className="mt-1.5 text-sm font-medium text-foreground">
        Villain range: {conditional.presetLabel}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{conditional.citation}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This analysis assumes villain holds that range. Your real equity depends on the range they
        actually have.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Where this range comes from, and what it assumes
        </summary>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {conditional.derivationNote}
        </p>
        <ul className="mt-1.5 space-y-1">
          {conditional.assumptions.map((assumption) => (
            <li key={assumption} className="text-xs leading-relaxed text-muted-foreground">
              • {assumption}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {conditional.combosConsidered} of the range&rsquo;s {conditional.combosInRange} combos are still
          possible once your cards and the board are removed from the deck.
        </p>
      </details>
    </section>
  );
}

// ── Action editor ────────────────────────────────────────────────────────────

function ActionEditor({
  actions,
  onChange,
  onAdd,
}: {
  actions: HandAction[];
  onChange: (actions: HandAction[]) => void;
  onAdd: (street: Street) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-muted-foreground">What happened</span>

      <ul className="mt-2 space-y-2">
        {actions.map((action, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Action ${index + 1} street`}
              value={action.street}
              onChange={(event) => {
                const next = [...actions];
                next[index] = { ...action, street: event.target.value as Street };
                onChange(next);
              }}
              className="h-9 rounded-md border border-border bg-input px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STREETS.map((street) => (
                <option key={street} value={street}>{street}</option>
              ))}
            </select>

            <select
              aria-label={`Action ${index + 1} player`}
              value={action.actor}
              onChange={(event) => {
                const next = [...actions];
                next[index] = { ...action, actor: event.target.value as "hero" | "villain" };
                onChange(next);
              }}
              className="h-9 rounded-md border border-border bg-input px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="hero">You</option>
              <option value="villain">Villain</option>
            </select>

            <select
              aria-label={`Action ${index + 1} type`}
              value={action.type}
              onChange={(event) => {
                const next = [...actions];
                next[index] = { ...action, type: event.target.value as ActionType };
                onChange(next);
              }}
              className="h-9 rounded-md border border-border bg-input px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <input
              type="number"
              aria-label={`Action ${index + 1} size in big blinds`}
              value={action.amountBb ?? ""}
              min={0}
              placeholder="bb"
              onChange={(event) => {
                const next = [...actions];
                const raw = event.target.value;
                next[index] = {
                  ...action,
                  ...(raw === "" ? { amountBb: undefined } : { amountBb: Number(raw) }),
                };
                onChange(next);
              }}
              className="h-9 w-20 rounded-md border border-border bg-input px-2 text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <button
              type="button"
              onClick={() => onChange(actions.filter((_, i) => i !== index))}
              className="h-9 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap gap-2">
        {STREETS.map((street) => (
          <button
            key={street}
            type="button"
            onClick={() => onAdd(street)}
            className="h-9 rounded-md border border-border bg-card/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            + {street}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Result ───────────────────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

/**
 * The analysis, in the order §2 fixes.
 *
 * Verdict, why, what happened, what we can calculate, what stays uncertain,
 * the concept, the lesson, the coach. Nothing technical appears above the
 * conclusion, and every section below the first is skimmable in one line.
 */
function AnalysisResult({
  analysis,
  recommendations,
  onAskCoach,
  onAddInformation,
  onSave,
  saveState,
  saveError,
  signedIn,
  headingRef,
}: {
  analysis: HandAnalysis;
  recommendations: Record<string, ConceptRecommendation>;
  onAskCoach: () => void;
  onAddInformation: (field: MissingField) => void;
  /** Absent for anonymous visitors — saving is the first thing needing an account. */
  onSave?: () => void;
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  signedIn: boolean;
  headingRef: RefObject<HTMLParagraphElement | null>;
}) {
  const { summary, keyDecision } = analysis;
  const primary = analysis.concepts[0];
  const primaryRecommendation = primary ? recommendations[primary.conceptId] : undefined;
  const topLesson = primaryRecommendation?.lessons[0];

  // Only the gaps a field would actually close get an action; "what villain
  // holds" is not a setting anyone can turn on.
  const resolvable = analysis.unknowns.filter((unknown) => unknown.resolvedBy);
  const inherent = analysis.unknowns.filter((unknown) => !unknown.resolvedBy);

  return (
    <div className="space-y-6">
      {/* 1 ── The verdict, first and alone */}
      <div className={`rounded-xl border px-4 py-4 ${VERDICT_STYLE[analysis.verdict]}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
          Your decision
        </p>
        <p
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {VERDICT_LABEL[analysis.verdict]}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed opacity-90">
          {VERDICT_PLAIN[analysis.verdict]}
        </p>
        <p className="mt-2 inline-flex rounded-full border border-current/30 px-2 py-0.5 text-[11px] font-medium opacity-80">
          {CONFIDENCE_LABEL[analysis.confidence]}
        </p>
      </div>

      {/* 1b ── The condition, immediately under the conclusion it qualifies */}
      {analysis.conditional && <ConditionalNotice conditional={analysis.conditional} />}

      {/* 2 ── Why? */}
      <section aria-labelledby="why">
        <SectionHeading id="why">Why?</SectionHeading>
        <div className="mt-2 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">{keyDecision.question}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {keyDecision.relationship}
          </p>
          {keyDecision.factors.length > 0 && (
            <dl className="mt-3 space-y-2.5 border-t border-border/50 pt-3">
              {keyDecision.factors.map((factor) => (
                <div key={factor.label}>
                  <dt className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-foreground">{factor.label}</span>
                    <span className="tabular-nums text-violet-300">{factor.value}</span>
                  </dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {factor.bearing}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* 3 ── What happened */}
      <section aria-labelledby="what-happened">
        <SectionHeading id="what-happened">What happened</SectionHeading>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultStat label="Your hand" value={summary.heroCards} />
          <ResultStat label="Position" value={summary.heroPosition} />
          <ResultStat label="Street" value={summary.street} />
          <ResultStat label="Board" value={summary.board} />
        </div>
        <ul className="mt-2 space-y-1 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          {analysis.facts.map((fact) => (
            <li key={fact} className="text-sm leading-relaxed text-muted-foreground">
              {fact}
            </li>
          ))}
        </ul>
      </section>

      {/* 4 ── What we can calculate */}
      {analysis.calculations.length > 0 && (
        <section aria-labelledby="calculations">
          <SectionHeading id="calculations">What we can calculate</SectionHeading>
          <dl className="mt-2 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-background/40">
            {analysis.calculations.map((calculation) => (
              <div key={calculation.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{calculation.label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {calculation.value}
                </dd>
              </div>
            ))}
          </dl>
          <details className="mt-2 rounded-xl border border-border/50 bg-background/30">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              How each number was worked out
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </summary>
            <dl className="divide-y divide-border/40 border-t border-border/40">
              {analysis.calculations.map((calculation) => (
                <div key={calculation.id} className="px-4 py-2">
                  <dt className="text-xs font-medium text-foreground">{calculation.label}</dt>
                  <dd className="text-[11px] leading-relaxed text-muted-foreground/80">
                    {calculation.basis}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      )}

      {/* 5 ── What remains uncertain */}
      <section aria-labelledby="uncertain">
        <SectionHeading id="uncertain">What we cannot determine</SectionHeading>
        <ul className="mt-2 space-y-2.5 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
          {[...resolvable, ...inherent].map((unknown) => (
            <UnknownRow key={unknown.id} unknown={unknown} />
          ))}
        </ul>
        {analysis.missing.filter((item) => item.severity === "improves").length > 0 && (
          <div className="mt-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3.5">
            <p className="text-sm font-medium text-foreground">To improve this analysis</p>
            <ul className="mt-1.5 space-y-1">
              {analysis.missing.map((item) => (
                <li key={item.field} className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground/90">{item.label}</span> — {item.unlocks}.
                </li>
              ))}
            </ul>
            <MissingButtons missing={analysis.missing} onAddInformation={onAddInformation} />
          </div>
        )}
      </section>

      {/* 6 ── The concepts this hand exercises */}
      {analysis.concepts.length > 0 && (
        <section aria-labelledby="what-matters">
          <SectionHeading id="what-matters">What to investigate</SectionHeading>
          <dl className="mt-2 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-background/40">
            {analysis.concepts.map((concept) => (
              <div key={concept.conceptId} className="px-4 py-3">
                <dt className="text-sm font-medium text-foreground">{concept.name}</dt>
                <dd className="mt-1 space-y-1.5">
                  <p className="text-xs text-muted-foreground/80">{concept.trigger}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {concept.explanation}
                  </p>
                  <ConceptLinks recommendation={recommendations[concept.conceptId]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 7 ── The lesson */}
      {topLesson && (
        <section aria-labelledby="next-lesson">
          <SectionHeading id="next-lesson">Recommended next lesson</SectionHeading>
          <Link
            href={topLesson.path}
            onClick={() =>
              trackEvent(SEO_EVENTS.lessonClicked, {
                tool_slug: SLUG,
                concept: primary?.conceptId,
                position: 1,
              })
            }
            className="group mt-2 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5 transition-colors hover:border-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GraduationCap aria-hidden="true" className="h-4 w-4 text-violet-400" />
                {topLesson.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {primaryRecommendation?.reason ??
                  "This lesson explains the concept that mattered most in your hand."}
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </section>
      )}

      {/* 8 ── The coach */}
      <div>
        <button
          type="button"
          onClick={onAskCoach}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          <Bot aria-hidden="true" className="h-4 w-4" />
          Ask the AI Coach about this hand
        </button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          The coach opens with this exact hand, the numbers above and the concepts already loaded.
        </p>
      </div>

      {/* Account — AFTER the value has been delivered, never before it (§10) */}
      {signedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === "saving" || saveState === "saved"}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saveState === "saved"
              ? "Saved"
              : saveState === "saving"
                ? "Saving…"
                : "Save this hand"}
          </button>
          {saveError && (
            <p role="alert" className="text-xs text-amber-300">
              {saveError}
            </p>
          )}
        </div>
      ) : (
        <aside className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-4 py-4">
          <p className="text-sm font-semibold text-foreground">
            Want to keep improving this decision?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The analysis above is yours either way. A free account lets you save this hand, carry it
            into the AI Coach, pick up the recommended lesson and track your progress.
          </p>
          <Link
            href="/signup"
            onClick={() => trackEvent(SEO_EVENTS.signupClicked, { tool_slug: SLUG, placement: "post-analysis" })}
            className="mt-3 inline-flex h-10 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Create a free account
          </Link>
        </aside>
      )}
    </div>
  );
}

function UnknownRow({ unknown }: { unknown: Unknown }) {
  return (
    <li className="flex gap-2.5">
      <HelpCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
      <div>
        <p className="text-sm font-medium text-foreground">{unknown.question}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{unknown.because}</p>
      </div>
    </li>
  );
}

function ConceptLinks({ recommendation }: { recommendation?: ConceptRecommendation }) {
  if (!recommendation) return null;
  const links = [
    recommendation.wiki,
    recommendation.lessons[0],
    recommendation.glossary,
    recommendation.tool,
  ].filter(Boolean) as { label: string; path: string }[];
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
      {links.map((link) => (
        <Link
          key={link.path}
          href={link.path}
          onClick={() => trackEvent(SEO_EVENTS.lessonClicked, { tool_slug: SLUG, target: link.path })}
          className="rounded text-xs text-violet-400 underline-offset-4 transition-colors hover:text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

// ── Saved hands (§9) ─────────────────────────────────────────────────────────

/**
 * "My analysed hands".
 *
 * Reopening RECOMPUTES: the row stores the input and the conclusion, never the
 * rendered prose, so a hand saved before an engine improvement comes back with
 * today's analysis rather than yesterday's wording.
 */
function SavedHands({
  rows,
  loaded,
  onReopen,
  onDelete,
}: {
  rows: SavedHandRow[];
  loaded: boolean;
  onReopen: (row: SavedHandRow) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterSavedHands(rows, query), [rows, query]);

  if (!loaded) return null;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3.5">
        <p className="text-sm font-medium text-foreground">No saved hands yet</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Analyse a hand and press “Save this hand” — saved hands come back here, re-analysed with
          whatever the engine knows today.
        </p>
      </div>
    );
  }

  return (
    <details className="rounded-xl border border-border/60 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        My analysed hands ({rows.length})
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      </summary>

      <div className="border-t border-border/50 px-4 py-3">
        <label htmlFor="saved-hand-filter" className="block text-xs font-medium text-muted-foreground">
          Filter
        </label>
        <input
          id="saved-hand-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cards, position, board or verdict"
          className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul className="divide-y divide-border/50 border-t border-border/50">
          {visible.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm text-foreground">
                  {(row.hero_cards ?? []).join(" ")} · {row.hero_position ?? "—"}
                  {row.board?.length ? ` on ${row.board.join(" ")}` : " preflop"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {row.analyzed_at.slice(0, 10)}
                  {row.findings?.verdict ? ` · ${VERDICT_LABEL[row.findings.verdict]}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onReopen(row)}
                  disabled={!handFromSavedRow(row)}
                  className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Reopen
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  aria-label={`Delete the hand from ${row.analyzed_at.slice(0, 10)}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export { formatCards };

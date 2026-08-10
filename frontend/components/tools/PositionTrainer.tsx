"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import {
  POSITIONS,
  POSITION_IDS,
  POSITION_TRAINER_LENGTH,
  buildQuestion,
  positionById,
  seatOrder,
  type PositionId,
  type TrainerMode,
} from "@/lib/tools/positions";
import { ChoiceGroup } from "./ToolFields";
import { ResultNote, ResultStat, ToolPanel } from "./ToolPanel";

const SLUG = "position-trainer";

interface Attempt {
  correct: boolean;
  answered: PositionId;
}

/**
 * Position drill.
 *
 * Seeded per run rather than per question, so "restart" genuinely reshuffles
 * while a single run stays stable across re-renders — a question that changed
 * underneath a keystroke would be unanswerable.
 */
export function PositionTrainer() {
  const [mode, setMode] = useState<TrainerMode>("name-the-seat");
  const [seed, setSeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState<PositionId | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const finished = index >= POSITION_TRAINER_LENGTH;
  const question = finished ? null : buildQuestion(index, seed, mode);

  const correctCount = attempts.filter((a) => a.correct).length;
  const streak = attempts.reduce((run, attempt) => (attempt.correct ? run + 1 : 0), 0);
  const bestStreak = attempts.reduce(
    (best, attempt) => {
      const next = attempt.correct ? best.run + 1 : 0;
      return { run: next, max: Math.max(best.max, next) };
    },
    { run: 0, max: 0 },
  ).max;

  const restart = useCallback((nextMode?: TrainerMode) => {
    if (nextMode) setMode(nextMode);
    setSeed((current) => current + 1);
    setIndex(0);
    setAttempts([]);
    setSelected(null);
    setStartedAt(null);
    setElapsedMs(null);
  }, []);

  const answer = useCallback(
    (choice: PositionId) => {
      if (!question || selected) return;
      const begun = startedAt ?? Date.now();
      if (!startedAt) setStartedAt(begun);

      setSelected(choice);
      const correct = choice === question.answer;
      const next = [...attempts, { correct, answered: choice }];
      setAttempts(next);

      if (next.length === POSITION_TRAINER_LENGTH) {
        const total = Date.now() - begun;
        setElapsedMs(total);
        trackEvent(SEO_EVENTS.toolCalculate, {
          tool_slug: SLUG,
          mode,
          score: next.filter((a) => a.correct).length,
          questions: POSITION_TRAINER_LENGTH,
          seconds: Math.round(total / 1000),
        });
      }
    },
    [question, selected, attempts, startedAt, mode],
  );

  // Advance a beat after the reveal so the feedback is readable.
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => {
      setSelected(null);
      setIndex((current) => current + 1);
    }, 1100);
    return () => clearTimeout(timer);
  }, [selected]);

  const options: PositionId[] = question?.mode === "who-acts-first" ? question.contenders : POSITION_IDS;

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Position trainer"
      description="Twelve questions on seat names and action order. Keyboard friendly — tab to an answer and press enter."
      onReset={() => restart()}
      copyText={
        finished
          ? `Scored ${correctCount}/${POSITION_TRAINER_LENGTH} on the StackedPoker position trainer` +
            `${elapsedMs ? ` in ${(elapsedMs / 1000).toFixed(1)}s` : ""}. Best streak ${bestStreak}.`
          : undefined
      }
      results={
        <div className="grid grid-cols-3 gap-3">
          <ResultStat label="Score" value={`${correctCount}/${attempts.length || 0}`} />
          <ResultStat label="Streak" value={String(streak)} hint={`Best ${bestStreak}`} />
          <ResultStat
            label="Time"
            value={elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : startedAt ? "running" : "—"}
          />
        </div>
      }
    >
      <ChoiceGroup
        toolSlug={SLUG}
        label="Drill"
        value={mode}
        options={[
          { value: "name-the-seat", label: "Name the seat" },
          { value: "who-acts-first", label: "Who acts first?" },
        ]}
        onChange={(next) => restart(next)}
      />

      {finished ? (
        <div className="space-y-3">
          <ResultNote>
            {correctCount === POSITION_TRAINER_LENGTH
              ? "Perfect run. Position is the cheapest edge in poker and you have the map memorised."
              : `You got ${correctCount} of ${POSITION_TRAINER_LENGTH}. The order never changes: preflop runs UTG → MP → CO → BTN → SB → BB, and postflop restarts at the small blind.`}
          </ResultNote>
          <button
            type="button"
            onClick={() => restart()}
            className="inline-flex h-10 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Run it again
          </button>
        </div>
      ) : (
        question && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Question {index + 1} of {POSITION_TRAINER_LENGTH}
            </p>

            <Table highlight={question.highlight} />

            <p className="text-sm font-medium text-foreground">{question.prompt}</p>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Answers">
              {options.map((id) => {
                const isAnswer = id === question.answer;
                const chosen = id === selected;
                const state = !selected
                  ? "idle"
                  : isAnswer
                    ? "correct"
                    : chosen
                      ? "wrong"
                      : "idle";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => answer(id)}
                    disabled={Boolean(selected)}
                    className={`inline-flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      state === "correct"
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-100"
                        : state === "wrong"
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                          : "border-border bg-card/50 text-foreground hover:border-violet-500/40 disabled:opacity-60"
                    }`}
                  >
                    {id}
                    {state === "correct" && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                    {state === "wrong" && <X aria-hidden="true" className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            <p ref={liveRef} aria-live="assertive" className="min-h-5 text-sm text-muted-foreground">
              {selected
                ? `${selected === question.answer ? "Correct." : `Not quite — ${question.answer}.`} ${question.explanation}`
                : ""}
            </p>
          </div>
        )
      )}
    </ToolPanel>
  );
}

/** The seat map. Decorative for screen readers — the question text carries the meaning. */
function Table({ highlight }: { highlight: PositionId | null }) {
  const seats = seatOrder();
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-4"
    >
      {seats.map((seat) => {
        const active = seat.id === highlight;
        return (
          <div
            key={seat.id}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
              active
                ? "border-violet-400/70 bg-violet-500/25 text-violet-100 shadow-[0_0_16px_rgba(124,92,255,0.35)]"
                : "border-border/70 bg-card/60 text-muted-foreground"
            }`}
          >
            {active ? "?" : seat.id}
            {seat.id === "BTN" && !active && (
              <span className="text-[9px] font-normal opacity-70">dealer</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { POSITIONS, positionById };

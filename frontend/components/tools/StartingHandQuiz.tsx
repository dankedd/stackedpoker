"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import {
  QUIZ_LENGTH,
  QUIZ_MODE_META,
  buildQuizQuestion,
  gradeAnswer,
  type QuizAction,
  type QuizMode,
} from "@/lib/tools/startingHands";
import { ChoiceGroup } from "./ToolFields";
import { ResultNote, ResultStat, ToolPanel } from "./ToolPanel";

const SLUG = "starting-hand-quiz";

const ACTION_LABEL: Record<QuizAction, string> = {
  fold: "Fold",
  call: "Call",
  raise: "Raise",
};

/**
 * Starting-hand quiz.
 *
 * Grading comes entirely from charts that already live in this codebase and
 * already carry their own provenance — see lib/tools/startingHands.ts. The
 * chart's real mix is shown after every answer, because "the chart 3-bets
 * this 48% of the time" teaches far more than a tick.
 */
export function StartingHandQuiz() {
  const [mode, setMode] = useState<QuizMode>("open-or-fold");
  const [seed, setSeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<QuizAction | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const finished = index >= QUIZ_LENGTH;
  const question = finished ? null : buildQuizQuestion(index, seed, mode);
  const wasCorrect = question && choice ? gradeAnswer(question, choice) : false;

  const restart = useCallback((nextMode?: QuizMode) => {
    if (nextMode) setMode(nextMode);
    setSeed((current) => current + 1);
    setIndex(0);
    setChoice(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
  }, []);

  const answer = useCallback(
    (action: QuizAction) => {
      if (!question || choice) return;
      setChoice(action);
      const correct = gradeAnswer(question, action);
      const nextScore = correct ? score + 1 : score;
      const nextStreak = correct ? streak + 1 : 0;
      setScore(nextScore);
      setStreak(nextStreak);
      setBestStreak((best) => Math.max(best, nextStreak));

      if (index + 1 === QUIZ_LENGTH) {
        trackEvent(SEO_EVENTS.toolCalculate, {
          tool_slug: SLUG,
          mode,
          score: nextScore,
          questions: QUIZ_LENGTH,
        });
      }
    },
    [question, choice, score, streak, index, mode],
  );

  useEffect(() => {
    if (!choice) return;
    const timer = setTimeout(() => {
      setChoice(null);
      setIndex((current) => current + 1);
    }, 2200);
    return () => clearTimeout(timer);
  }, [choice]);

  return (
    <ToolPanel
      toolSlug={SLUG}
      title="Starting hand quiz"
      description="Ten hands, graded against a real chart. The chart's exact mix is shown after every answer."
      onReset={() => restart()}
      copyText={
        finished
          ? `Scored ${score}/${QUIZ_LENGTH} on the StackedPoker starting hand quiz (${QUIZ_MODE_META[mode].label}). Best streak ${bestStreak}.`
          : undefined
      }
      results={
        <div className="grid grid-cols-3 gap-3">
          <ResultStat label="Score" value={`${score}/${finished ? QUIZ_LENGTH : index}`} />
          <ResultStat label="Streak" value={String(streak)} hint={`Best ${bestStreak}`} />
          <ResultStat label="Question" value={`${Math.min(index + 1, QUIZ_LENGTH)}/${QUIZ_LENGTH}`} />
        </div>
      }
    >
      <ChoiceGroup
        toolSlug={SLUG}
        label="Mode"
        value={mode}
        options={(Object.keys(QUIZ_MODE_META) as QuizMode[]).map((id) => ({
          value: id,
          label: QUIZ_MODE_META[id].label,
        }))}
        onChange={(next) => restart(next)}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{QUIZ_MODE_META[mode].description}</p>

      {finished ? (
        <div className="space-y-3">
          <ResultNote>
            {score === QUIZ_LENGTH
              ? "Ten from ten. You are reading the chart, not guessing."
              : `${score} of ${QUIZ_LENGTH}. Most mistakes at this stage are the mixed hands — the ones a chart plays two ways on purpose.`}
          </ResultNote>
          <button
            type="button"
            onClick={() => restart()}
            className="inline-flex h-10 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            New ten hands
          </button>
        </div>
      ) : (
        question && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-5 text-center">
              <p className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {question.hand}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{question.situation}</p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Your action">
              {question.options.map((action) => {
                const accepted =
                  action === question.answer || question.alsoAccepted.includes(action);
                const chosen = action === choice;
                const state = !choice ? "idle" : accepted ? "correct" : chosen ? "wrong" : "idle";
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => answer(action)}
                    disabled={Boolean(choice)}
                    className={`inline-flex h-11 flex-1 min-w-24 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      state === "correct"
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-100"
                        : state === "wrong"
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                          : "border-border bg-card/50 text-foreground hover:border-violet-500/40 disabled:opacity-60"
                    }`}
                  >
                    {ACTION_LABEL[action]}
                    {state === "correct" && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                    {state === "wrong" && <X aria-hidden="true" className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            <div aria-live="assertive" className="min-h-16 space-y-1.5">
              {choice && (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {wasCorrect ? "Correct." : `The chart plays it as ${ACTION_LABEL[question.answer].toLowerCase()}.`}
                    {question.alsoAccepted.length > 0 && wasCorrect && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        This one is close enough to a coin flip that either answer counts.
                      </span>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {question.explanation}
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                    Source: {question.source}
                  </p>
                </>
              )}
            </div>
          </div>
        )
      )}
    </ToolPanel>
  );
}

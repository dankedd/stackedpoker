import {
  BB_DEFENSE_COMPLETE_100BB,
  BB_DEFENSE_COMPLETE_100BB_PROVENANCE,
  type BBOpenDefenseMatchup,
} from "@/lib/learn/bbDefenseComplete";
import { RFI_DEEP } from "@/lib/learn/preflopBaselines";
import { allHandClasses } from "@/lib/learn/combos";
import { mulberry32 } from "./positions";

/**
 * Starting-hand quiz.
 *
 * Every question is graded against a chart that already exists in this
 * codebase and already carries its own provenance — nothing here decides what
 * the right answer is:
 *
 *   - "Open or fold"  → RFI_DEEP (lib/learn/preflopBaselines.ts), ported from
 *     the backend's cash_100bb open ranges, documented there as "simplified
 *     practical ranges, not solver-exact". Its own docstring establishes that
 *     for RFI a hand's ABSENCE genuinely means fold, which is what makes a
 *     two-option question honest.
 *   - "Defend the big blind" → BB_DEFENSE_COMPLETE_100BB
 *     (lib/learn/bbDefenseComplete.ts), a complete fold/call/3-bet strategy
 *     read from Modern Poker Theory's own chart images, with page and figure
 *     numbers per matchup.
 *
 * Mixed strategies are the norm in both charts, so the quiz grades the
 * DOMINANT action and accepts a genuinely close second (see
 * `MIX_TOLERANCE`) rather than marking a defensible answer wrong. The real
 * mix is always revealed afterwards — that a hand is 52% call / 48% 3-bet is
 * the lesson, not a detail to hide behind a tick or a cross.
 */

export type QuizAction = "fold" | "call" | "raise";
export type QuizMode = "open-or-fold" | "defend-bb";

export interface QuizQuestion {
  mode: QuizMode;
  /** Hand class, e.g. "AKs". */
  hand: string;
  /** Human-readable spot. */
  situation: string;
  position: string;
  /** Actions the learner may choose between. */
  options: QuizAction[];
  /** The chart's dominant action. */
  answer: QuizAction;
  /** Also accepted — the chart is close to indifferent. */
  alsoAccepted: QuizAction[];
  /** The chart's real mix, action → frequency 0–1. */
  mix: Partial<Record<QuizAction, number>>;
  explanation: string;
  /** Where the answer comes from, shown with the result. */
  source: string;
}

/**
 * Two actions within this many frequency points of each other are both
 * accepted. A chart that plays a hand 55/45 is not teaching that the 45 is
 * wrong.
 */
export const MIX_TOLERANCE = 0.15;

const DEFEND_MATCHUP_LABEL: Record<BBOpenDefenseMatchup, string> = {
  BB_vs_UTG: "an under-the-gun open",
  BB_vs_HJ: "a hijack open",
  BB_vs_CO: "a cutoff open",
  BB_vs_BTN: "a button open",
  BB_vs_SB: "a small-blind open",
};

const DEFEND_MATCHUPS = Object.keys(DEFEND_MATCHUP_LABEL) as BBOpenDefenseMatchup[];

/** RFI positions the quiz asks about, in curriculum order. */
export const RFI_POSITIONS = ["UTG", "HJ", "CO", "BTN"] as const;

const ALL_HANDS = allHandClasses();

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function dominant(mix: Partial<Record<QuizAction, number>>): {
  answer: QuizAction;
  alsoAccepted: QuizAction[];
} {
  const ranked = (Object.entries(mix) as [QuizAction, number][])
    .filter(([, freq]) => freq > 0)
    .sort((a, b) => b[1] - a[1]);

  const answer = ranked[0]?.[0] ?? "fold";
  const top = ranked[0]?.[1] ?? 0;
  const alsoAccepted = ranked
    .slice(1)
    .filter(([, freq]) => top - freq <= MIX_TOLERANCE)
    .map(([action]) => action);

  return { answer, alsoAccepted };
}

function formatMix(mix: Partial<Record<QuizAction, number>>): string {
  return (Object.entries(mix) as [QuizAction, number][])
    .filter(([, freq]) => freq > 0.001)
    .sort((a, b) => b[1] - a[1])
    .map(([action, freq]) => `${action} ${(freq * 100).toFixed(0)}%`)
    .join(", ");
}

function openOrFoldQuestion(rng: () => number): QuizQuestion {
  const position = pick(RFI_POSITIONS, rng);
  const hand = pick(ALL_HANDS, rng);

  const entries = RFI_DEEP[position] ?? [];
  const entry = entries.find((e) => e.hand === hand);
  const raiseFreq = entry?.freq ?? 0;

  const mix: Partial<Record<QuizAction, number>> = {
    raise: raiseFreq,
    fold: 1 - raiseFreq,
  };
  const { answer, alsoAccepted } = dominant(mix);

  return {
    mode: "open-or-fold",
    hand,
    position,
    situation: `You are first to act from ${position} at a 100bb table. Nobody has entered the pot.`,
    options: ["raise", "fold"],
    answer,
    alsoAccepted,
    mix,
    explanation:
      raiseFreq >= 1
        ? `${hand} is a standard open from ${position}.`
        : raiseFreq > 0
          ? `${hand} is a mixed open from ${position} — the chart raises it ${(raiseFreq * 100).toFixed(0)}% of the time.`
          : `${hand} is not in the ${position} opening range, so it folds.`,
    source:
      "StackedPoker RFI baseline (lib/learn/preflopBaselines.ts), ported from the backend's 100bb cash open ranges — simplified practical ranges, not solver output.",
  };
}

function defendQuestion(rng: () => number): QuizQuestion {
  const matchup = pick(DEFEND_MATCHUPS, rng);
  const chart = BB_DEFENSE_COMPLETE_100BB[matchup];
  const hands = Object.keys(chart);
  const hand = pick(hands, rng);
  const strategy = chart[hand] ?? {};

  // The chart's action ids are '3bet' / 'call' / 'fold'; the quiz speaks
  // fold/call/raise, so '3bet' maps onto 'raise'.
  const mix: Partial<Record<QuizAction, number>> = {
    raise: strategy["3bet"] ?? 0,
    call: strategy.call ?? 0,
    fold: strategy.fold ?? 0,
  };
  const { answer, alsoAccepted } = dominant(mix);
  const provenance = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup];

  return {
    mode: "defend-bb",
    hand,
    position: "BB",
    situation: `You are in the big blind facing ${DEFEND_MATCHUP_LABEL[matchup]}, 100bb effective.`,
    options: ["raise", "call", "fold"],
    answer,
    alsoAccepted,
    mix,
    explanation: `The chart plays ${hand} as ${formatMix(mix)}.`,
    source: `${provenance.source}, p.${provenance.page} — ${provenance.figure}. ${provenance.gameAssumptions}.`,
  };
}

/**
 * Deterministic question generator — index plus seed, never Math.random, so a
 * quiz can be replayed and a failing test names the exact question.
 */
export function buildQuizQuestion(index: number, seed: number, mode: QuizMode): QuizQuestion {
  const rng = mulberry32(seed + index * 2246822519);
  return mode === "open-or-fold" ? openOrFoldQuestion(rng) : defendQuestion(rng);
}

export function gradeAnswer(question: QuizQuestion, choice: QuizAction): boolean {
  return choice === question.answer || question.alsoAccepted.includes(choice);
}

export const QUIZ_LENGTH = 10;

export const QUIZ_MODE_META: Record<QuizMode, { label: string; description: string }> = {
  "open-or-fold": {
    label: "Open or fold",
    description:
      "You are first into the pot. Raise or fold? The beginner starting point — one decision, two options.",
  },
  "defend-bb": {
    label: "Defend the big blind",
    description:
      "Somebody raised and it is on you in the big blind. Fold, call or 3-bet — the spot every player faces most often.",
  },
};

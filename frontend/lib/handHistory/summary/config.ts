/**
 * Tournament summary — every rule and threshold in one place.
 *
 * The "Stacked score" is a pedagogical model built only from the verdicts the
 * preflop and flop checks already store. It is NOT an EV or bb-loss figure:
 * the checks have chart frequencies, not solver EVs. Change a number here and
 * bump nothing else — the config is hashed into SUMMARY_VERSION, so stored
 * summaries are recomputed on the next visit.
 */

export const SUMMARY_CONFIG = {
  score: {
    /**
     * Penalty per misplayed hand, 0–1. Preflop: the chart frequency of the
     * recommended action minus the frequency of Hero's action (folding a hand
     * the chart raises 100% → 1.0). Flop: a fixed penalty, because the flop
     * check is deliberately mild and has no per-hand frequencies.
     */
    flopQuestionablePenalty: 0.35,
    /**
     * Score = 100 × (1 − penaltyScale × Σ penalties / graded hands), clamped
     * to 0–100. 1 = the plain weighted share of hands played well.
     */
    penaltyScale: 1,
    /** Fewer graded hands than this: no score, just the counts. */
    minGradedHands: 10,
    /** Labels, best first: the first whose `min` the score reaches. */
    labels: [
      { min: 95, key: "solid" },
      { min: 90, key: "decent" },
      { min: 80, key: "leaky" },
      { min: 0, key: "puntProne" },
    ] as const,
  },

  mistakes: {
    /** A preflop mistake is "big" when its frequency gap is at least this. */
    bigGap: 0.75,
    /** Flop "questionable" verdicts always count as small mistakes. */
    flopIsBig: false,
  },

  filters: {
    tight: {
      /** Preflop `wrong_action` counts as tight when Hero was less aggressive than the chart. */
      includeWrongAction: true,
      /** Flop "questionable" fold or check (the check wanted more action). */
      includeFlop: true,
    },
    loose: {
      /** Preflop `wrong_action` counts as loose when Hero was more aggressive than the chart. */
      includeWrongAction: true,
      /** Flop "questionable" call, bet or raise. */
      includeFlop: true,
    },
    mixed: {
      /** A spot is mixed when at least `minActions` chart actions are each played ≥ `minFreq`. */
      minFreq: 0.1,
      minActions: 2,
    },
    big: {
      /** Pot of at least this many big blinds… */
      minPotBb: 20,
      /** …or within the top share of this tournament's pots (0.1 = top 10%). */
      topShare: 0.1,
      /** Only hands Hero put chips in (blinds included). */
      heroInvolvedOnly: true,
    },
  },

  /** Free plan: hands shown per list before the upgrade prompt. */
  freeTeaserHands: 2,
  /** Pro: tournaments in the score history. */
  historyLength: 10,
} as const;

export type ScoreLabelKey = (typeof SUMMARY_CONFIG.score.labels)[number]["key"];

/** Preflop aggressiveness, to place `wrong_action` as tight or loose. */
export const AGGRESSION: Record<string, number> = { fold: 0, limp: 1, call: 1, raise: 2, allin: 3 };

/**
 * Dashboard — every threshold in one place. The database returns raw counts
 * (my_dashboard); these numbers decide what the blocks say.
 */
export const DASHBOARD_CONFIG = {
  /** Trainer answers older than this don't count toward the Skill card. */
  skillDays: 30,
  /** Minimum answers before a percentage is shown ("Not enough hands yet" below). */
  min: {
    /** Preflop overall. */
    preflop: 20,
    /** One preflop kind (opens, defense, push/fold). */
    preflopKind: 10,
    /** Flop trainer overall. */
    flop: 10,
    /** One flop texture, to call it the weakest. */
    flopCategory: 5,
    /** One preflop chart, to call it the weakest spot. */
    preflopSpot: 5,
    /** Each of the two weeks, to show a trend. */
    week: 20,
  },
  /** A weekly change smaller than this (percentage points) reads as "steady". */
  trendSteadyPoints: 2,
  /** Plans without a daily limit still get a goal ring. */
  dailyGoalSpots: 50,
  /** A tournament's unreviewed mistakes stay "new" for this many days after the import. */
  newMistakesDays: 14,
} as const;

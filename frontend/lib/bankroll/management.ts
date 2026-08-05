export type BankrollCategory = "cash" | "tournament" | "spin_and_go" | "plo";

export interface BuyInRule {
  /** The buy-in-count safety threshold the player chose for themselves. */
  buyInCount: number;
  /** $ size of one buy-in at the stake they're currently playing, in this category. */
  currentBuyIn: number | null;
}

export type BuyInRules = Partial<Record<BankrollCategory, BuyInRule>>;

export type BankrollStatus = "safe" | "move_up" | "move_down" | "unknown";

export interface BankrollStatusResult {
  status: BankrollStatus;
  buyInsAvailable: number | null;
  warning: string | null;
}

/**
 * Preset buy-in-count chips shown per category, plus a display label.
 *
 * Source check (required by CLAUDE.md before implementing anything
 * poker-theory-adjacent): Modern Poker Theory ("MTT Bankroll Management",
 * p.264) states a bankroll figure for MTTs only — "at least 200 buy-ins",
 * "1,000... to minimize the risk of going broke" — and gives NO figure for
 * Cash Games, PLO, or Spin & Go anywhere in the book (confirmed by a
 * full-text search before writing this file). So:
 *   - cash / tournament presets below (30/40/50 and 100/150/200) are
 *     exactly the examples the user specified when requesting this feature
 *     — not something this code asserts as "the correct" numbers.
 *   - spin_and_go presets mirror the tournament shape (a Spin & Go is a
 *     hyper-turbo/jackpot SNG, closer in risk profile to a tournament than
 *     a cash game) and plo presets are the cash presets shifted up (PLO is
 *     conventionally higher-variance than NLHE) — both are this
 *     implementation's own reasonable defaults, filling a gap the book
 *     doesn't address, NOT a book citation.
 * Every category also accepts a fully custom count — the player always
 * has final say ("Gebruiker kiest eigen bankrollregels").
 */
export const CATEGORY_META: Record<BankrollCategory, { label: string; buyInPresets: number[] }> = {
  cash: { label: "Cash Games", buyInPresets: [30, 40, 50] },
  tournament: { label: "MTT", buyInPresets: [100, 150, 200] },
  spin_and_go: { label: "Spin & Go", buyInPresets: [100, 150, 200] },
  plo: { label: "PLO", buyInPresets: [40, 50, 60] },
};

export const CATEGORY_ORDER: BankrollCategory[] = ["cash", "tournament", "spin_and_go", "plo"];

/**
 * Maps a logged session onto one of the 4 bankroll-management categories.
 * bankroll_sessions.session_type separates FORMAT (cash/tournament/spin_and_go),
 * not VARIANT (NLHE/PLO) — PLO cash sessions are session_type "cash" with a
 * variant like "PLO"/"Omaha", so they're pulled into their own "plo" bucket
 * here by matching that free-text field. Sit & Go sessions are folded into
 * the "tournament" bucket (small-field tournaments); "other" is left
 * uncategorized (returns null) since it has no defined risk profile.
 * Implementation decision, not a rule from the book.
 */
export function categorizeSession(sessionType: string, variant: string | null): BankrollCategory | null {
  const v = (variant ?? "").toLowerCase();
  const isPlo = v.includes("plo") || v.includes("omaha");

  if (sessionType === "cash") return isPlo ? "plo" : "cash";
  if (sessionType === "tournament" || sessionType === "sit_and_go") return "tournament";
  if (sessionType === "spin_and_go") return "spin_and_go";
  return null;
}

/**
 * Classifies the player's current bankroll against their own chosen
 * buy-in-count rule for one category into 3 states. The 1.5x "move up"
 * margin is this implementation's own heuristic for turning a continuous
 * buy-in count into a 3-way status — not a number from the book.
 */
export function evaluateBankrollStatus(bankroll: number, rule: BuyInRule | undefined): BankrollStatusResult {
  if (!rule || rule.currentBuyIn == null || rule.currentBuyIn <= 0) {
    return { status: "unknown", buyInsAvailable: null, warning: null };
  }

  const buyInsAvailable = bankroll / rule.currentBuyIn;

  if (buyInsAvailable < rule.buyInCount) {
    return {
      status: "move_down",
      buyInsAvailable,
      warning: `${buyInsAvailable.toFixed(1)} buy-ins available — below your ${rule.buyInCount}-buy-in rule. Consider moving down in stakes.`,
    };
  }

  if (buyInsAvailable >= rule.buyInCount * 1.5) {
    return { status: "move_up", buyInsAvailable, warning: null };
  }

  return { status: "safe", buyInsAvailable, warning: null };
}

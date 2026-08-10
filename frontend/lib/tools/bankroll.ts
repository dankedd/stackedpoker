import {
  CATEGORY_META,
  CATEGORY_ORDER,
  evaluateBankrollStatus,
  type BankrollCategory,
  type BankrollStatus,
} from "@/lib/bankroll/management";

/**
 * Bankroll requirements.
 *
 * Reuses lib/bankroll/management.ts — the buy-in presets and the
 * safe/move-up/move-down classification the StackedPoker bankroll tracker
 * already runs on — rather than introducing a second, public set of numbers
 * that could drift from the product's own.
 *
 * PROVENANCE, and it matters here more than anywhere else in these tools.
 * That module's own docstring records the position after a full-text search
 * of Modern Poker Theory: the book states a bankroll figure for MTTs only
 * ("at least 200 buy-ins", p.264) and gives NO figure for cash games, PLO or
 * Spin & Go. So the cash/PLO/Spin presets are StackedPoker's own defaults,
 * not a book citation, and `BANKROLL_PROVENANCE` below says so on the page.
 * A bankroll number presented as authoritative when it is a house default is
 * exactly the kind of false precision that costs a player money.
 */

export type { BankrollCategory, BankrollStatus };

export const BANKROLL_CATEGORIES = CATEGORY_ORDER;
export const BANKROLL_CATEGORY_META = CATEGORY_META;

export interface BankrollProvenance {
  cited: boolean;
  note: string;
}

export const BANKROLL_PROVENANCE: Record<BankrollCategory, BankrollProvenance> = {
  tournament: {
    cited: true,
    note:
      "Modern Poker Theory (Acevedo, 2019), \"MTT Bankroll Management\" p.264 — \"at least 200 buy-ins\", with 1,000 cited to minimise the risk of going broke.",
  },
  cash: {
    cited: false,
    note:
      "StackedPoker's own default. Modern Poker Theory states no cash-game bankroll figure, so nothing here is presented as a book citation.",
  },
  plo: {
    cited: false,
    note:
      "StackedPoker's own default, set above the cash presets because PLO is conventionally higher-variance. Not a book figure.",
  },
  spin_and_go: {
    cited: false,
    note:
      "StackedPoker's own default, mirroring the tournament presets because a Spin & Go is a hyper-turbo SNG. Not a book figure.",
  },
};

export interface BankrollInput {
  bankroll: number;
  category: BankrollCategory;
  /** Cost of one buy-in at the stake being played. */
  buyIn: number;
  /** The player's own buy-in-count rule. Defaults to the middle preset. */
  buyInCount?: number;
}

export interface BankrollResult {
  /** Bankroll the chosen rule asks for at this stake. */
  recommendedBankroll: number;
  /** Buy-ins the current bankroll actually covers. */
  buyInsAvailable: number;
  /** Largest buy-in the current bankroll supports under the rule. */
  affordableBuyIn: number;
  status: BankrollStatus;
  warning: string | null;
  /** Bankroll at which moving up becomes reasonable under the rule. */
  moveUpAt: number;
  /** Bankroll below which the rule says drop down. */
  moveDownBelow: number;
  buyInCount: number;
  shortfall: number;
}

export type BankrollError =
  | { kind: "bankroll-negative" }
  | { kind: "buy-in-not-positive" }
  | { kind: "buy-in-count-not-positive" }
  | { kind: "unknown-category"; category: string };

export function validateBankroll(input: BankrollInput): BankrollError | null {
  // TypeScript cannot vouch for a category that arrived from a query string
  // or a saved preference, and an unknown one would otherwise fail deep
  // inside the preset lookup with an unreadable TypeError.
  if (!CATEGORY_META[input.category]) {
    return { kind: "unknown-category", category: String(input.category) };
  }
  if (!(input.bankroll >= 0)) return { kind: "bankroll-negative" };
  if (!(input.buyIn > 0)) return { kind: "buy-in-not-positive" };
  if (input.buyInCount !== undefined && !(input.buyInCount > 0)) {
    return { kind: "buy-in-count-not-positive" };
  }
  return null;
}

/** The middle preset — the default rule when the player has not chosen one. */
export function defaultBuyInCount(category: BankrollCategory): number {
  const presets = CATEGORY_META[category].buyInPresets;
  return presets[Math.floor(presets.length / 2)];
}

export function calculateBankroll(input: BankrollInput): BankrollResult {
  const invalid = validateBankroll(input);
  if (invalid) throw new Error(`Invalid bankroll input: ${invalid.kind}`);

  const buyInCount = input.buyInCount ?? defaultBuyInCount(input.category);
  const recommendedBankroll = buyInCount * input.buyIn;

  // The product's own classifier, so the public tool and the signed-in
  // bankroll tracker never disagree about the same numbers.
  const status = evaluateBankrollStatus(input.bankroll, {
    buyInCount,
    currentBuyIn: input.buyIn,
  });

  return {
    recommendedBankroll,
    buyInsAvailable: input.bankroll / input.buyIn,
    affordableBuyIn: input.bankroll / buyInCount,
    status: status.status,
    warning: status.warning,
    // 1.5x is management.ts's own move-up margin, reused rather than restated.
    moveUpAt: recommendedBankroll * 1.5,
    moveDownBelow: recommendedBankroll,
    buyInCount,
    shortfall: Math.max(0, recommendedBankroll - input.bankroll),
  };
}

export function explainBankroll(result: BankrollResult, category: BankrollCategory): string {
  const label = CATEGORY_META[category].label;
  const buyIns = result.buyInsAvailable.toFixed(1);

  if (result.status === "move_down") {
    return (
      `${buyIns} buy-ins covers less than your ${result.buyInCount}-buy-in rule for ${label}. ` +
      `Either add ${formatMoney(result.shortfall)} or drop to a stake where one buy-in is ` +
      `${formatMoney(result.affordableBuyIn)} or less.`
    );
  }
  if (result.status === "move_up") {
    return (
      `${buyIns} buy-ins is comfortably past your ${result.buyInCount}-buy-in rule for ${label}. ` +
      `You have the roll to take a shot at the next stake up.`
    );
  }
  return (
    `${buyIns} buy-ins meets your ${result.buyInCount}-buy-in rule for ${label}. ` +
    `Moving up becomes reasonable around ${formatMoney(result.moveUpAt)}; below ` +
    `${formatMoney(result.moveDownBelow)} the rule says drop back down.`
  );
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

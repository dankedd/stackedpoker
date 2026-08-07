import { computeSessionResult } from "./sessionForm";

export interface SessionForStats {
  session_type: string;
  started_at: string;
  buy_in_amount: number;
  cash_out_amount: number | null;
  hands_played: number | null;
  duration_minutes: number | null;
  site: string | null;
  stakes: string | null;
  variant: string | null;
  fee_amount: number | null;
  prize_amount: number | null;
  finishing_position: number | null;
}

function settledOf(sessions: SessionForStats[]): SessionForStats[] {
  return sessions.filter((s) => s.cash_out_amount != null);
}

/** Longest run of consecutive winning/losing sessions in chronological order. A push (result === 0) counts as a win. */
export function computeStreaks(sessions: SessionForStats[]): { longestWinStreak: number; longestLossStreak: number } {
  const chronological = settledOf(sessions)
    .slice()
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

  let longestWin = 0;
  let longestLoss = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const session of chronological) {
    if (computeSessionResult(session) >= 0) {
      currentWin += 1;
      currentLoss = 0;
    } else {
      currentLoss += 1;
      currentWin = 0;
    }
    longestWin = Math.max(longestWin, currentWin);
    longestLoss = Math.max(longestLoss, currentLoss);
  }

  return { longestWinStreak: longestWin, longestLossStreak: longestLoss };
}

export function computeBiggestWinLoss(sessions: SessionForStats[]): { biggestWin: number | null; biggestLoss: number | null } {
  const results = settledOf(sessions).map(computeSessionResult);
  if (results.length === 0) return { biggestWin: null, biggestLoss: null };
  return { biggestWin: Math.max(...results), biggestLoss: Math.min(...results) };
}

/** % of settled sessions with a non-negative result. Distinct from "Average Hour"/"Average Session" — this is a session win-rate, not a $/hour or bb/100 poker metric (stakes are free text here, not reliably bb-normalizable). */
export function computeWinRate(sessions: SessionForStats[]): number | null {
  const settled = settledOf(sessions);
  if (settled.length === 0) return null;
  const wins = settled.filter((s) => computeSessionResult(s) >= 0).length;
  return (wins / settled.length) * 100;
}

export interface TournamentStats {
  tournamentCount: number;
  totalBuyIns: number;
  avgBuyIn: number | null;
  avgFinish: number | null;
  itmPercent: number | null;
  roi: number | null;
  totalPrizes: number;
  biggestCash: number | null;
}

const EMPTY_TOURNAMENT_STATS: TournamentStats = {
  tournamentCount: 0,
  totalBuyIns: 0,
  avgBuyIn: null,
  avgFinish: null,
  itmPercent: null,
  roi: null,
  totalPrizes: 0,
  biggestCash: null,
};

/**
 * Tournament-only stats (buy-ins, average finish, ITM%, ROI, prizes). Never
 * throws on missing data — every field that can't be computed (no settled
 * tournaments yet, no finishing positions recorded, ...) comes back null/0
 * instead, so the dashboard can render "—" rather than crash.
 *
 * "Buy-ins" here means the pure buy-in a player paid, excluding the entry
 * fee — bankroll_sessions.buy_in_amount actually stores buy-in + fee (see
 * the comment on BankrollSessionRow in lib/bankroll/types.ts, and
 * supabase_bankroll_tournament_schema.sql, for why), so fee_amount is
 * subtracted back out here to report the number the player actually typed
 * into the "Buy-in" field. ROI's denominator deliberately uses the raw
 * buy_in_amount (buy-in + fee) instead — ROI is "return on money actually
 * spent", which should include the fee.
 */
export function computeTournamentStats(sessions: SessionForStats[]): TournamentStats {
  const tournaments = settledOf(sessions).filter((s) => s.session_type === "tournament");
  if (tournaments.length === 0) return EMPTY_TOURNAMENT_STATS;

  const pureBuyIns = tournaments.map((t) => t.buy_in_amount - (t.fee_amount ?? 0));
  const totalBuyIns = pureBuyIns.reduce((sum, b) => sum + b, 0);
  const totalCost = tournaments.reduce((sum, t) => sum + t.buy_in_amount, 0);
  const totalProfit = tournaments.reduce((sum, t) => sum + computeSessionResult(t), 0);
  const totalPrizes = tournaments.reduce((sum, t) => sum + (t.prize_amount ?? 0), 0);

  const finishes = tournaments.map((t) => t.finishing_position).filter((p): p is number => p != null);
  const avgFinish = finishes.length > 0 ? finishes.reduce((sum, p) => sum + p, 0) / finishes.length : null;

  const cashes = tournaments.filter((t) => (t.prize_amount ?? 0) > 0).length;

  const prizesRecorded = tournaments.filter((t) => t.prize_amount != null);
  const biggestCash = prizesRecorded.length > 0 ? Math.max(...prizesRecorded.map((t) => t.prize_amount!)) : null;

  return {
    tournamentCount: tournaments.length,
    totalBuyIns,
    avgBuyIn: totalBuyIns / tournaments.length,
    avgFinish,
    itmPercent: (cashes / tournaments.length) * 100,
    roi: totalCost > 0 ? (totalProfit / totalCost) * 100 : null,
    totalPrizes,
    biggestCash,
  };
}

export type BreakdownDimension = "site" | "stakes" | "variant" | "month" | "year";

export type BankrollDimensionBreakdowns = Record<BreakdownDimension, BreakdownGroup[]>;

export const BREAKDOWN_DIMENSIONS: { key: BreakdownDimension; label: string }[] = [
  { key: "site", label: "Site" },
  { key: "stakes", label: "Stake" },
  { key: "variant", label: "Variant" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export interface BreakdownGroup {
  label: string;
  profit: number;
  sessionCount: number;
  hours: number;
  hands: number;
  winRate: number;
}

function classify(session: SessionForStats, dimension: BreakdownDimension): { label: string; sortKey: number } {
  switch (dimension) {
    case "site":
      return { label: session.site?.trim() || "Unknown", sortKey: 0 };
    case "stakes":
      return { label: session.stakes?.trim() || "Unknown", sortKey: 0 };
    case "variant":
      return { label: session.variant?.trim() || "Unknown", sortKey: 0 };
    case "month": {
      const d = new Date(session.started_at);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        sortKey: d.getFullYear() * 12 + d.getMonth(),
      };
    }
    case "year": {
      const y = new Date(session.started_at).getFullYear();
      return { label: String(y), sortKey: y };
    }
  }
}

/**
 * Groups settled sessions by one dimension and aggregates each group's
 * profit/sessions/hours/hands/win-rate. Time-based dimensions (month, year)
 * sort most-recent-first; the free-text dimensions (site, stakes, variant)
 * sort by profit descending, since there's no inherent order to sort them by.
 */
export function groupSessionsBy(sessions: SessionForStats[], dimension: BreakdownDimension): BreakdownGroup[] {
  const buckets = new Map<string, { sortKey: number; sessions: SessionForStats[] }>();

  for (const session of settledOf(sessions)) {
    const { label, sortKey } = classify(session, dimension);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.sessions.push(session);
    } else {
      buckets.set(label, { sortKey, sessions: [session] });
    }
  }

  const groups: (BreakdownGroup & { sortKey: number })[] = [];
  for (const [label, { sortKey, sessions: group }] of buckets) {
    const results = group.map(computeSessionResult);
    const profit = results.reduce((sum, r) => sum + r, 0);
    const wins = results.filter((r) => r >= 0).length;
    const hours = group.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / 60;
    const hands = group.reduce((sum, s) => sum + (s.hands_played ?? 0), 0);
    groups.push({ label, profit, sessionCount: group.length, hours, hands, winRate: (wins / group.length) * 100, sortKey });
  }

  const isTimeBased = dimension === "month" || dimension === "year";
  groups.sort((a, b) => (isTimeBased ? b.sortKey - a.sortKey : b.profit - a.profit));

  return groups.map(({ label, profit, sessionCount, hours, hands, winRate }) => ({
    label, profit, sessionCount, hours, hands, winRate,
  }));
}

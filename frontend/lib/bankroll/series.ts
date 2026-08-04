import type {
  BankrollChartPoint,
  BankrollLedgerSession,
  BankrollLedgerTransaction,
} from "./types";

interface LedgerEvent {
  date: string;
  amount: number;
  evAmount: number;
}

/**
 * Builds the cumulative "bankroll over time" series: starting balance, then a
 * running total walked forward through every deposit/withdrawal and every
 * settled session's profit, in chronological order.
 *
 * Only settled sessions (cash_out_amount set) affect the line — an
 * in-progress session shouldn't move a historical chart until it's cashed
 * out, matching bankroll_overview()'s SQL (same rule, same reason).
 *
 * The EV line reuses the same walk, but adds each session's ev_amount where
 * present and otherwise falls back to that session's actual profit — so the
 * two lines only diverge where EV data was actually recorded, rather than
 * jumping discontinuously. This is a bookkeeping choice, not poker theory.
 */
export function buildBankrollSeries(
  startingBankroll: number,
  startingAt: string,
  sessions: BankrollLedgerSession[],
  transactions: BankrollLedgerTransaction[]
): { series: BankrollChartPoint[]; hasEvData: boolean } {
  const events: LedgerEvent[] = [];
  let hasEvData = false;

  for (const tx of transactions) {
    const delta = tx.type === "deposit" ? tx.amount : -tx.amount;
    events.push({ date: tx.occurred_at, amount: delta, evAmount: delta });
  }

  for (const s of sessions) {
    if (s.cash_out_amount == null) continue;
    const profit = s.cash_out_amount - s.buy_in_amount;
    const ev = s.ev_amount ?? profit;
    if (s.ev_amount != null) hasEvData = true;
    events.push({ date: s.started_at, amount: profit, evAmount: ev });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const series: BankrollChartPoint[] = [
    { date: startingAt, bankroll: startingBankroll, evBankroll: startingBankroll },
  ];

  let running = startingBankroll;
  let evRunning = startingBankroll;
  for (const e of events) {
    running += e.amount;
    evRunning += e.evAmount;
    series.push({ date: e.date, bankroll: running, evBankroll: evRunning });
  }

  return { series, hasEvData };
}

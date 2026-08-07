// Mirrors the columns returned by the public.bankroll_overview() RPC and the
// bankroll_* tables added in supabase_bankroll_schema.sql. The Supabase
// client in this project is untyped (no generated Database type — see
// lib/supabase/client.ts / server.ts), so callers cast query results to
// these interfaces, matching the existing convention (e.g. lib/types.ts).

export interface BankrollOverview {
  current_bankroll: number;
  starting_bankroll: number;
  total_deposits: number;
  total_withdrawals: number;
  total_session_profit: number;
  total_ev_profit: number;
  session_count: number;
  total_hands: number;
  total_minutes: number;
}

export interface RecentBankrollSession {
  stakes: string | null;
  variant: string | null;
  site: string | null;
  session_type: string;
  started_at: string;
}

export interface SettledBankrollSession {
  buy_in_amount: number;
  cash_out_amount: number | null;
}

export interface BankrollLedgerSession {
  started_at: string;
  buy_in_amount: number;
  cash_out_amount: number | null;
  ev_amount: number | null;
}

export interface BankrollLedgerTransaction {
  occurred_at: string;
  type: "deposit" | "withdrawal";
  amount: number;
}

/** One plotted point: the running bankroll (and EV-adjusted bankroll) as of `date`. */
export interface BankrollChartPoint {
  date: string;
  bankroll: number;
  evBankroll: number;
}

/**
 * A full bankroll_sessions row, as managed by the /bankroll/sessions page.
 * Every session's result is read the same way regardless of kind —
 * cash_out_amount - buy_in_amount (see computeSessionResult in
 * lib/bankroll/sessionForm.ts) — so bankroll_overview(), the chart, stats,
 * insights and goals never need to know cash from tournament:
 *
 * - Cash sessions (session_type: "cash"): the form only exposes a single
 *   "Resultaat" field, so buy_in_amount is fixed at 0 and cash_out_amount
 *   is the entered result directly.
 * - Tournament sessions (session_type: "tournament"): buy_in_amount stores
 *   buy-in + fee (the total cost to enter — always >= 0, matching this
 *   column's CHECK constraint), and cash_out_amount stores buy_in_amount +
 *   net result (auto-calculated as prize - buy-in - fee, or the player's
 *   manual override) — never the raw prize directly, and never negative.
 *   fee_amount/prize_amount below store the raw entered values so the edit
 *   form can split buy_in_amount back into its buy-in/fee parts and so
 *   in-money/prize based tournament stats have honest numbers to read,
 *   independent of whatever the net result ends up being.
 */
export interface BankrollSessionRow {
  id: string;
  session_type: string;
  variant: string | null;
  site: string | null;
  stakes: string | null;
  currency: string;
  buy_in_amount: number;
  cash_out_amount: number | null;
  ev_amount: number | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  hands_played: number | null;
  notes: string | null;
  tournament_name: string | null;
  fee_amount: number | null;
  prize_amount: number | null;
  field_size: number | null;
  finishing_position: number | null;
}

/** A bankroll_mental_entries row linked to a session (session_id is never null here). */
export interface BankrollMentalEntryRow {
  id: string;
  session_id: string;
  overall_score: number;
}

/** A full bankroll_transactions row, as managed by the /bankroll/wallet page. */
export interface BankrollTransactionRow {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
}

/**
 * A bankroll_goals row, as managed by the /bankroll/goals page. current_value
 * is intentionally not read here — for all 5 goal types this page exposes,
 * progress is computed live from bankroll_overview() (see lib/bankroll/goals.ts)
 * rather than trusted from a column that could go stale.
 */
export interface BankrollGoalRow {
  id: string;
  goal_type: string;
  title: string;
  target_value: number;
  currency: string | null;
  status: string;
  created_at: string;
}

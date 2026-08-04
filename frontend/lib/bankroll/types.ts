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
 * The session-management form only exposes a single "Resultaat" (result)
 * field rather than separate buy-in/cash-out amounts, so every session
 * written from that form has buy_in_amount fixed at 0 and cash_out_amount
 * set to the entered result — see lib/bankroll/sessionForm.ts. Display code
 * still computes the result as cash_out_amount - buy_in_amount so it reads
 * correctly even for rows written some other way.
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
}

/** A bankroll_mental_entries row linked to a session (session_id is never null here). */
export interface BankrollMentalEntryRow {
  id: string;
  session_id: string;
  overall_score: number;
}

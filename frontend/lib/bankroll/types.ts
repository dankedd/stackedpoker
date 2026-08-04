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

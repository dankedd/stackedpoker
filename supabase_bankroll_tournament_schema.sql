-- ============================================================
-- Bankroll — tournament session fields
-- Run this in the Supabase SQL Editor AFTER supabase_bankroll_schema.sql.
-- Idempotent: ADD COLUMN IF NOT EXISTS, safe to re-run.
--
-- Adds 5 columns to bankroll_sessions so a session can be logged as a
-- tournament, not just a cash game. session_type already existed and
-- already allowed 'tournament' (its CHECK constraint always included
-- 'tournament', 'sit_and_go', 'spin_and_go' — this was deliberately
-- future-proofed in supabase_bankroll_schema.sql before any of them had a
-- form UI). buy_in_amount also already existed and is reused as-is for a
-- tournament's buy-in.
--
-- HOW A TOURNAMENT'S RESULT REUSES THE EXISTING PROFIT ENGINE:
-- Every aggregate in this app (bankroll_overview() RPC, the bankroll chart,
-- stats, insights, goals) computes profit as cash_out_amount -
-- buy_in_amount and nothing else — see computeSessionResult() in
-- frontend/lib/bankroll/sessionForm.ts. Rather than teaching every one of
-- those call sites a second, tournament-shaped profit formula, the app
-- writes cash_out_amount = buy_in_amount + net_result for a tournament,
-- where net_result is either (prize - buy_in - fee) or the player's manual
-- override. That makes cash_out_amount - buy_in_amount equal net_result
-- again, so every existing aggregate keeps working, unmodified, for
-- tournaments too. prize_amount/fee_amount below are stored purely for
-- display and the tournament-specific stats (ITM%, avg buy-in, ...) — they
-- are not read by the general profit engine.
-- ============================================================

ALTER TABLE public.bankroll_sessions
  ADD COLUMN IF NOT EXISTS tournament_name    text,
  ADD COLUMN IF NOT EXISTS fee_amount         numeric(14,2) CHECK (fee_amount IS NULL OR fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS prize_amount       numeric(14,2) CHECK (prize_amount IS NULL OR prize_amount >= 0),
  ADD COLUMN IF NOT EXISTS field_size         integer       CHECK (field_size IS NULL OR field_size > 0),
  ADD COLUMN IF NOT EXISTS finishing_position integer       CHECK (finishing_position IS NULL OR finishing_position > 0);

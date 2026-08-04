-- ============================================================
-- Bankroll Management — database schema
-- Run this in the Supabase SQL Editor AFTER supabase_schema.sql
-- and supabase_security_hardening.sql (uses public.profiles and
-- public.set_updated_at()).
--
-- Idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP ... IF EXISTS + CREATE, so this file is safe to re-run.
--
-- WHAT THIS COVERS (per the 5 tables below):
--   bankroll_settings        starting bankroll, preferred currency
--   bankroll_transactions    deposits / withdrawals (money moved into or
--                             out of the poker bankroll, not tied to play)
--   bankroll_sessions        one row per played session: site, variant,
--                             stakes, buy-in/cash-out, EV, hours, hands,
--                             notes
--   bankroll_mental_entries  mental-game check-ins, optionally linked to
--                             a session
--   bankroll_goals           user-defined bankroll/volume goals
--
-- DESIGN NOTES (future-proofing decisions, so later changes don't need
-- destructive migrations):
--   - Deposits/withdrawals live in their OWN append-only-style ledger
--     table (bankroll_transactions), separate from session results
--     (bankroll_sessions). Mixing the two would make it impossible to
--     tell "money I added to my bankroll" apart from "money I won/lost
--     playing" — both are needed to compute a correct running bankroll.
--   - profit/loss is deliberately NOT stored as a column. It is always
--     `cash_out_amount - buy_in_amount`, computed at read time (see the
--     bankroll_overview() RPC below). Storing it redundantly risks the
--     same "cache vs. ledger" drift this schema's siblings (xp_events,
--     hand_analyses) avoid by computing from source columns.
--   - `session_type` and `goal_type` use CHECK-constrained enums (this
--     project's established convention — see profiles.subscription_tier,
--     hand_analyses.analysis_type) with an 'other'/'custom' escape hatch,
--     so a new session/goal kind can be added without a schema change.
--   - `variant`, `site` and `stakes` are deliberately free text with NO
--     CHECK constraint, exactly matching hand_analyses.site/stakes — the
--     set of poker variants and sites is open-ended and grows over time.
--   - Mental-game tracking uses one required `overall_score` (fast to
--     display) plus an open `scores jsonb` bag for sub-metrics (tilt,
--     focus, confidence, ...). New sub-metrics never require a migration.
--   - Every table follows this schema's universal ownership pattern:
--     `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`, RLS
--     enabled, granular per-operation "{table}_{verb}_own" policies
--     (the current standard here since supabase_security_hardening.sql
--     replaced the old catch-all USING/WITH CHECK policies).
--   - bankroll_overview() centralizes the "current bankroll" arithmetic
--     in one place (starting balance + deposits - withdrawals + session
--     results), the same way leaderboard_all_time()/leaderboard_24h()
--     centralize XP aggregation — one source of truth, callable from SQL
--     directly or from a future backend endpoint.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. BANKROLL_SETTINGS
--    One row per user. Auto-provisioned on profile creation (see
--    section 6) and backfilled for existing users below.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bankroll_settings (
  user_id            uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency text          NOT NULL DEFAULT 'USD' CHECK (char_length(preferred_currency) = 3),
  starting_bankroll  numeric(14,2) NOT NULL DEFAULT 0 CHECK (starting_bankroll >= 0),
  starting_at        timestamptz   NOT NULL DEFAULT now(),
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.bankroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_settings_select_own" ON public.bankroll_settings;
CREATE POLICY "bankroll_settings_select_own" ON public.bankroll_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_settings_insert_own" ON public.bankroll_settings;
CREATE POLICY "bankroll_settings_insert_own" ON public.bankroll_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_settings_update_own" ON public.bankroll_settings;
CREATE POLICY "bankroll_settings_update_own" ON public.bankroll_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No DELETE policy: settings is a singleton row per user, reset via UPDATE.

DROP TRIGGER IF EXISTS set_bankroll_settings_updated_at ON public.bankroll_settings;
CREATE TRIGGER set_bankroll_settings_updated_at
  BEFORE UPDATE ON public.bankroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 2. BANKROLL_TRANSACTIONS
--    Deposits and withdrawals — money moving into/out of the bankroll
--    that is NOT the result of a played session (e.g. adding funds,
--    cashing out to a bank account).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bankroll_transactions (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text          NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  currency    text          NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  occurred_at timestamptz   NOT NULL DEFAULT now(),
  note        text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.bankroll_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_transactions_select_own" ON public.bankroll_transactions;
CREATE POLICY "bankroll_transactions_select_own" ON public.bankroll_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_transactions_insert_own" ON public.bankroll_transactions;
CREATE POLICY "bankroll_transactions_insert_own" ON public.bankroll_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_transactions_update_own" ON public.bankroll_transactions;
CREATE POLICY "bankroll_transactions_update_own" ON public.bankroll_transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_transactions_delete_own" ON public.bankroll_transactions;
CREATE POLICY "bankroll_transactions_delete_own" ON public.bankroll_transactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bankroll_transactions_user_occurred_idx
  ON public.bankroll_transactions (user_id, occurred_at DESC);

DROP TRIGGER IF EXISTS set_bankroll_transactions_updated_at ON public.bankroll_transactions;
CREATE TRIGGER set_bankroll_transactions_updated_at
  BEFORE UPDATE ON public.bankroll_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 3. BANKROLL_SESSIONS
--    One row per played session (cash game, tournament, sit & go, ...).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bankroll_sessions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- game context
  session_type      text          NOT NULL DEFAULT 'cash'
                                   CHECK (session_type IN ('cash', 'tournament', 'sit_and_go', 'spin_and_go', 'other')),
  variant           text,                            -- e.g. 'NLHE', 'PLO', 'PLO5', 'Mixed' — open text, no CHECK
  site              text,                             -- poker site or venue, e.g. 'PokerStars', 'Live — Casino X'
  stakes            text,                             -- free text, matches hand_analyses.stakes, e.g. "$1/$2"
  currency          text          NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),

  -- money (profit/loss = cash_out_amount - buy_in_amount, computed at read time)
  buy_in_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (buy_in_amount >= 0),
  cash_out_amount   numeric(14,2) CHECK (cash_out_amount IS NULL OR cash_out_amount >= 0),
  ev_amount         numeric(14,2),                   -- optional EV-adjusted (all-in adjusted) result

  -- time & volume
  started_at        timestamptz   NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_minutes  integer       CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  hands_played      integer       CHECK (hands_played IS NULL OR hands_played >= 0),

  -- organization
  notes             text,
  tags              text[]        NOT NULL DEFAULT '{}',

  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bankroll_sessions_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

ALTER TABLE public.bankroll_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_sessions_select_own" ON public.bankroll_sessions;
CREATE POLICY "bankroll_sessions_select_own" ON public.bankroll_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_sessions_insert_own" ON public.bankroll_sessions;
CREATE POLICY "bankroll_sessions_insert_own" ON public.bankroll_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_sessions_update_own" ON public.bankroll_sessions;
CREATE POLICY "bankroll_sessions_update_own" ON public.bankroll_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_sessions_delete_own" ON public.bankroll_sessions;
CREATE POLICY "bankroll_sessions_delete_own" ON public.bankroll_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bankroll_sessions_user_started_idx
  ON public.bankroll_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS bankroll_sessions_user_type_idx
  ON public.bankroll_sessions (user_id, session_type);

DROP TRIGGER IF EXISTS set_bankroll_sessions_updated_at ON public.bankroll_sessions;
CREATE TRIGGER set_bankroll_sessions_updated_at
  BEFORE UPDATE ON public.bankroll_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 4. BANKROLL_MENTAL_ENTRIES
--    Mental-game / tilt check-ins. Optionally linked to a session, but
--    can also stand alone (e.g. a daily check-in with no session yet).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bankroll_mental_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    uuid        REFERENCES public.bankroll_sessions(id) ON DELETE SET NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  overall_score integer     NOT NULL CHECK (overall_score BETWEEN 1 AND 10),
  scores        jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- open sub-metrics, e.g. {"tilt":3,"focus":8,"confidence":7}
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bankroll_mental_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_mental_entries_select_own" ON public.bankroll_mental_entries;
CREATE POLICY "bankroll_mental_entries_select_own" ON public.bankroll_mental_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_mental_entries_insert_own" ON public.bankroll_mental_entries;
CREATE POLICY "bankroll_mental_entries_insert_own" ON public.bankroll_mental_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_mental_entries_update_own" ON public.bankroll_mental_entries;
CREATE POLICY "bankroll_mental_entries_update_own" ON public.bankroll_mental_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_mental_entries_delete_own" ON public.bankroll_mental_entries;
CREATE POLICY "bankroll_mental_entries_delete_own" ON public.bankroll_mental_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bankroll_mental_entries_user_recorded_idx
  ON public.bankroll_mental_entries (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS bankroll_mental_entries_session_idx
  ON public.bankroll_mental_entries (session_id);

DROP TRIGGER IF EXISTS set_bankroll_mental_entries_updated_at ON public.bankroll_mental_entries;
CREATE TRIGGER set_bankroll_mental_entries_updated_at
  BEFORE UPDATE ON public.bankroll_mental_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 5. BANKROLL_GOALS
--    User-defined bankroll / volume goals.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bankroll_goals (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type     text          NOT NULL DEFAULT 'custom'
                               CHECK (goal_type IN ('bankroll_amount', 'profit_target', 'hands_played', 'hours_played', 'sessions_count', 'custom')),
  title         text          NOT NULL,
  target_value  numeric(14,2) NOT NULL,
  current_value numeric(14,2),
  currency      text          CHECK (currency IS NULL OR char_length(currency) = 3),
  target_date   date,
  status        text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

ALTER TABLE public.bankroll_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankroll_goals_select_own" ON public.bankroll_goals;
CREATE POLICY "bankroll_goals_select_own" ON public.bankroll_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_goals_insert_own" ON public.bankroll_goals;
CREATE POLICY "bankroll_goals_insert_own" ON public.bankroll_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_goals_update_own" ON public.bankroll_goals;
CREATE POLICY "bankroll_goals_update_own" ON public.bankroll_goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bankroll_goals_delete_own" ON public.bankroll_goals;
CREATE POLICY "bankroll_goals_delete_own" ON public.bankroll_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bankroll_goals_user_status_idx
  ON public.bankroll_goals (user_id, status);

DROP TRIGGER IF EXISTS set_bankroll_goals_updated_at ON public.bankroll_goals;
CREATE TRIGGER set_bankroll_goals_updated_at
  BEFORE UPDATE ON public.bankroll_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 6. AUTO-PROVISION BANKROLL_SETTINGS ON PROFILE CREATION
--    Mirrors handle_new_user() in supabase_schema.sql, but as its own
--    trigger on public.profiles rather than editing the existing
--    auth.users trigger — keeps this migration fully additive and
--    isolated from the already-relied-upon signup path.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_profile_bankroll_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bankroll_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_bankroll_settings ON public.profiles;
CREATE TRIGGER on_profile_created_bankroll_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_bankroll_settings();

-- Backfill for users who already have a profile before this migration ran.
INSERT INTO public.bankroll_settings (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 7. BANKROLL_OVERVIEW RPC
--    Single source of truth for "current bankroll" and headline stats:
--    starting_bankroll + deposits - withdrawals + session results.
--    SECURITY DEFINER so it can join across the four tables above in one
--    call; hardened with the same self-ownership check used by
--    increment_analyses_used() in supabase_security_hardening.sql so an
--    authenticated user can only ever request their own numbers (the
--    service-role backend, where auth.uid() is NULL, is unrestricted).
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bankroll_overview(p_user_id uuid)
RETURNS TABLE (
  current_bankroll     numeric,
  starting_bankroll    numeric,
  total_deposits       numeric,
  total_withdrawals    numeric,
  total_session_profit numeric,
  total_ev_profit      numeric,
  session_count        integer,
  total_hands          integer,
  total_minutes        integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorised to view bankroll overview for this user';
  END IF;

  RETURN QUERY
  WITH settings AS (
    SELECT COALESCE(bs.starting_bankroll, 0) AS starting_bankroll
    FROM public.bankroll_settings bs
    WHERE bs.user_id = p_user_id
  ),
  tx AS (
    SELECT
      COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'deposit'), 0)    AS deposits,
      COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'withdrawal'), 0) AS withdrawals
    FROM public.bankroll_transactions bt
    WHERE bt.user_id = p_user_id
  ),
  sess AS (
    SELECT
      COALESCE(SUM(bsess.cash_out_amount - bsess.buy_in_amount) FILTER (WHERE bsess.cash_out_amount IS NOT NULL), 0) AS session_profit,
      COALESCE(SUM(bsess.ev_amount), 0)      AS ev_profit,
      COUNT(*)                                AS session_count,
      COALESCE(SUM(bsess.hands_played), 0)    AS total_hands,
      COALESCE(SUM(bsess.duration_minutes), 0) AS total_minutes
    FROM public.bankroll_sessions bsess
    WHERE bsess.user_id = p_user_id
  )
  SELECT
    COALESCE(settings.starting_bankroll, 0) + tx.deposits - tx.withdrawals + sess.session_profit,
    COALESCE(settings.starting_bankroll, 0),
    tx.deposits,
    tx.withdrawals,
    sess.session_profit,
    sess.ev_profit,
    sess.session_count::integer,
    sess.total_hands::integer,
    sess.total_minutes::integer
  FROM tx
  CROSS JOIN sess
  LEFT JOIN settings ON true;
END;
$$;

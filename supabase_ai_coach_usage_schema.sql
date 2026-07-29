-- ============================================================
-- AI Coach — daily usage quota (temporary flat limit, structured for a
-- later per-subscription-tier entitlement)
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Why a dedicated table instead of counting training_sessions.messages:
-- that column is a JSONB blob of the whole conversation per session, not
-- per-message rows — efficiently counting "accepted requests today across
-- all of a user's sessions" would mean parsing JSONB arrays across
-- potentially many rows on every single Coach message. This table exists
-- purely as a fast, atomically-incrementable daily counter; it does not
-- duplicate or replace the conversation history stored in training_sessions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_coach_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_coach_usage ENABLE ROW LEVEL SECURITY;

-- Users may read their own usage (e.g. if ever queried directly); all writes
-- go through the RPCs below via the backend's service-role key, which
-- bypasses RLS — no INSERT/UPDATE/DELETE policy is granted to
-- anon/authenticated, so a client can never edit its own usage row directly.
DROP POLICY IF EXISTS "ai_coach_usage_select_own" ON public.ai_coach_usage;
CREATE POLICY "ai_coach_usage_select_own" ON public.ai_coach_usage
  FOR SELECT USING (auth.uid() = user_id);


-- ── reserve_coach_usage — the concurrency-safe quota gate ───────────────────
--
-- A single atomic statement: INSERT ... ON CONFLICT DO UPDATE ... WHERE
-- <count < limit> RETURNING. Postgres takes a row-level lock on the
-- conflicting (user_id, usage_date) row for the duration of the statement,
-- so two simultaneous calls for the same user at, say, 9/10 are serialized
-- by the database itself — exactly one can ever land the 10th increment.
-- The loser's UPDATE...WHERE clause evaluates false, so neither the INSERT
-- nor the UPDATE branch touches the row, and RETURNING yields zero rows
-- (allowed=false) with no read-then-write race window in application code.
--
-- p_daily_limit is passed in from the backend (see
-- backend/app/engines/learn/coach_usage.py's get_ai_coach_entitlement) —
-- this function has no opinion on what the limit should be, which is what
-- lets a future subscription-tier lookup change the limit without ever
-- touching this SQL.
--
-- BUGFIX (post-deploy): the original version of this function declared
-- `RETURNS TABLE(message_count integer, usage_date date, allowed boolean)`.
-- In PL/pgSQL, every column named in RETURNS TABLE becomes an implicitly
-- declared variable in the function's own scope — so `usage_date` was
-- simultaneously "the OUT parameter" and "the ai_coach_usage table column",
-- and the unqualified `usage_date` reference in the fallback SELECT's WHERE
-- clause became ambiguous (Postgres error 42702). PL/pgSQL resolves every
-- statement's identifiers at first-call compile time, including inside
-- untaken IF branches — so this failed on every single call, not just the
-- "already at the limit" case, which is why the Coach was completely broken
-- rather than only breaking near the daily limit. Fixed by dropping the
-- unused `usage_date` output column entirely (the backend never reads it)
-- and fully qualifying every remaining table-column reference with an
-- explicit alias, so no output-parameter name can ever shadow a column
-- again. CREATE OR REPLACE is idempotent — re-running this file safely
-- replaces the broken function in place.
CREATE OR REPLACE FUNCTION public.reserve_coach_usage(p_user_id uuid, p_daily_limit integer)
RETURNS TABLE(message_count integer, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_count integer;
BEGIN
  INSERT INTO ai_coach_usage AS u (user_id, usage_date, message_count, updated_at)
  VALUES (p_user_id, v_today, 1, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET message_count = u.message_count + 1, updated_at = now()
    WHERE u.message_count < p_daily_limit
  RETURNING u.message_count INTO v_count;

  IF v_count IS NULL THEN
    -- Blocked (or, in principle, a same-row concurrent insert this
    -- statement lost to) — read back the authoritative current count.
    SELECT u.message_count INTO v_count
    FROM ai_coach_usage u
    WHERE u.user_id = p_user_id AND u.usage_date = v_today;
    RETURN QUERY SELECT COALESCE(v_count, 0), false;
  ELSE
    RETURN QUERY SELECT v_count, true;
  END IF;
END;
$$;


-- ── release_coach_usage — rollback for a reserved-but-never-processed request ──
--
-- Called only when a request already passed the quota gate (reserved a
-- slot) but the LLM call itself then failed (CoachUnavailableError) — a
-- genuinely failed request must cost 0, per spec, without reopening the
-- increment-then-check race the atomic reserve above closes. Floors at 0
-- so it can never go negative regardless of call order.
CREATE OR REPLACE FUNCTION public.release_coach_usage(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_coach_usage
  SET message_count = GREATEST(message_count - 1, 0), updated_at = now()
  WHERE user_id = p_user_id AND usage_date = (now() AT TIME ZONE 'utc')::date;
$$;

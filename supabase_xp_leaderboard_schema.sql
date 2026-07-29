-- ============================================================
-- Learn / Poker Journey — XP event ledger + global leaderboard
-- Run in Supabase SQL editor AFTER supabase_xp_atomic_increment.sql
-- and supabase_achievements_schema.sql have already been applied.
-- Safe to run more than once (CREATE OR REPLACE FUNCTION / IF NOT
-- EXISTS / NOT-EXISTS-guarded backfill throughout).
--
-- Why: user_skill_progress.total_xp is a single mutable counter — it has
-- never recorded WHEN XP was earned, only the running total. A true rolling
-- "last 24 hours" leaderboard cannot be derived from a total alone, so this
-- migration adds an append-only, timestamped XP event ledger and wires every
-- existing XP-award code path (step completion, lesson/module completion
-- bonus, achievement bonus, guest merge) to write to it atomically in the
-- SAME database call that increments total_xp — the ledger and the total
-- can never drift apart, because they're written by the same statement.
--
-- MIGRATION SAFETY / DEPLOYMENT ORDER — READ BEFORE DEPLOYING
-- -------------------------------------------------------------
-- This SQL migration MUST be applied BEFORE deploying the backend code that
-- calls increment_user_xp() with 4 arguments (p_source_type/p_source_id).
-- Reasoning: PostgREST resolves an RPC call by matching the JSON body's keys
-- against a function's parameter names.
--   - OLD backend code (2-arg call) against this NEW 4-arg function (with
--     DEFAULTs on the 2 new params): WORKS FINE — PostgREST fills in the
--     defaults for the params the caller didn't send.
--   - NEW backend code (4-arg call) against the OLD 2-arg function (this
--     migration not yet applied): FAILS — PostgREST cannot match 4 named
--     arguments against a 2-parameter function signature.
-- So: SQL first, backend code second. Applying this migration is always
-- backward-compatible with the code that's already running; deploying the
-- new code before the migration is not.
-- Every statement below is idempotent (CREATE TABLE/INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS + CREATE POLICY,
-- NOT-EXISTS-guarded backfill INSERTs) — safe to run more than once, and
-- safe to re-run after a partial failure. RLS on xp_events only grants
-- SELECT to the owning user (auth.uid() = user_id); every write path is a
-- SECURITY DEFINER function invoked exclusively by the backend's
-- service-role key, matching every other write path in this schema (no new
-- GRANT statements needed, consistent with award_achievement/
-- increment_analyses_used's existing precedent in this same file set).
-- Each RPC call is a single Postgres function invocation, hence a single
-- implicit transaction — the ledger insert and the total_xp update inside
-- increment_user_xp/award_achievement either both happen or neither does.
-- trg_check_streak/trg_check_level (supabase_achievements_schema.sql)
-- reference award_achievement() by name, not by a frozen body, so
-- CREATE OR REPLACE FUNCTION below updates their behavior automatically —
-- no trigger definition changes needed.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. XP EVENT LEDGER
--    Append-only. Never updated/deleted by app code — the leaderboard
--    reads are pure aggregates over this table plus user_skill_progress.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_events (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      integer     NOT NULL CHECK (amount > 0),
  source_type text        NOT NULL CHECK (source_type IN (
                            'step', 'lesson_completion', 'module_completion',
                            'achievement', 'guest_merge', 'unknown'
                          )),
  source_id   text,
  earned_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_events_select_own" ON public.xp_events;
CREATE POLICY "xp_events_select_own" ON public.xp_events
  FOR SELECT USING (auth.uid() = user_id);
-- No insert/update/delete policies for regular users — every write goes
-- through increment_user_xp()/award_achievement() (SECURITY DEFINER),
-- called only by the backend's service-role key.

-- Powers the rolling-24h aggregate (WHERE earned_at >= now() - interval)
-- without ever scanning the full historical ledger.
CREATE INDEX IF NOT EXISTS xp_events_earned_idx ON public.xp_events (earned_at DESC);
-- Powers a single user's own rolling-24h sum (GET /leaderboard/me).
CREATE INDEX IF NOT EXISTS xp_events_user_earned_idx ON public.xp_events (user_id, earned_at DESC);

-- Speeds the all-time leaderboard's sort/window function.
CREATE INDEX IF NOT EXISTS user_skill_progress_total_xp_idx
  ON public.user_skill_progress (total_xp DESC) WHERE total_xp > 0;


-- ──────────────────────────────────────────────────────────
-- 2. increment_user_xp: now also logs the atomic increment to the ledger.
--    Old 2-arg signature is dropped first — Postgres treats a changed
--    parameter list as a distinct overload, so a bare CREATE OR REPLACE
--    here would leave the old 2-arg function in place ALONGSIDE the new
--    4-arg one, making PostgREST's overload resolution ambiguous for any
--    caller still passing only {p_user_id, p_xp_delta}.
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.increment_user_xp(uuid, integer);

CREATE OR REPLACE FUNCTION public.increment_user_xp(
  p_user_id uuid,
  p_xp_delta integer,
  p_source_type text DEFAULT 'unknown',
  p_source_id text DEFAULT NULL
)
RETURNS TABLE(total_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_xp_delta > 0 THEN
    INSERT INTO public.xp_events (user_id, amount, source_type, source_id)
    VALUES (p_user_id, p_xp_delta, p_source_type, p_source_id);
  END IF;

  RETURN QUERY
  UPDATE public.user_skill_progress
  SET total_xp = public.user_skill_progress.total_xp + p_xp_delta
  WHERE user_id = p_user_id
  RETURNING public.user_skill_progress.total_xp;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 3. award_achievement: same signature, now also logs to the ledger.
--    Covers BOTH call paths that reach this function — the explicit
--    Python call from achievements.py AND the trg_check_streak /
--    trg_check_level triggers (supabase_achievements_schema.sql) that
--    call it directly on user_skill_progress updates — since both funnel
--    through this one function, fixing it here fixes both at once.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_xp_bonus INT;
BEGIN
  SELECT xp_bonus INTO v_xp_bonus FROM public.achievements WHERE id = p_achievement_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    UPDATE public.user_skill_progress
    SET total_xp = total_xp + v_xp_bonus
    WHERE user_id = p_user_id;

    IF v_xp_bonus > 0 THEN
      INSERT INTO public.xp_events (user_id, amount, source_type, source_id)
      VALUES (p_user_id, v_xp_bonus, 'achievement', p_achievement_id);
    END IF;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 4. Honest partial backfill of historical events.
--
--    Only backfilled where BOTH a real amount and a real timestamp
--    already exist elsewhere in the schema — never guessed/fabricated:
--      - user_step_progress.xp_awarded + .first_completed_at (real, both)
--      - user_module_progress.xp_awarded + .completed_at (real, both)
--      - user_achievements.earned_at (real) + achievements.xp_bonus (real,
--        catalog value at time of award — the catalog doesn't version
--        historical bonus amounts, but achievement bonus values have not
--        been rebalanced, so this is accurate, not fabricated)
--
--    NOT backfilled: lesson_completion bonus XP. Its amount was only ever
--    computed at award time (lesson_xp_reward * score%) and never
--    persisted as a column on user_lesson_progress — reconstructing it
--    now from today's curriculum.ts values would be fabrication if the
--    reward was ever rebalanced, so it's deliberately left out.
--
--    PRACTICAL IMPACT (temporary, self-resolving, ~24h): for roughly the
--    first 24 hours after this migration ships, the LAST 24 HOURS
--    leaderboard may under-count lesson-completion bonus XP a user earned
--    just before the ledger existed (their step XP and module/achievement
--    bonuses from that same window ARE captured correctly, via the
--    backfill above). Once a full 24h has elapsed since deployment, every
--    event inside any rolling window is a real, live-recorded xp_events
--    row, and this gap disappears permanently — no further action needed.
--
--    ALL TIME is completely unaffected by any of this, by design: it reads
--    user_skill_progress.total_xp directly (see leaderboard_all_time
--    below), never the ledger. The two rankings are deliberately sourced
--    from different tables — SUM(xp_events) must never be substituted for
--    ALL TIME even after ledger coverage is "complete," since achievement/
--    streak XP applied outside this backend's awareness (a manual SQL
--    fix, a future admin tool, etc.) would inflate total_xp without ever
--    producing a ledger row, silently desyncing the two if all-time ever
--    started trusting the ledger's sum instead of the real counter.
--
--    Each INSERT is guarded by NOT EXISTS so this block is safe to re-run.
-- ──────────────────────────────────────────────────────────

INSERT INTO public.xp_events (user_id, amount, source_type, source_id, earned_at)
SELECT usp.user_id, usp.xp_awarded, 'step', usp.lesson_id || ':' || usp.step_id, usp.first_completed_at
FROM public.user_step_progress usp
WHERE usp.xp_awarded > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.xp_events xe
    WHERE xe.user_id = usp.user_id
      AND xe.source_type = 'step'
      AND xe.source_id = usp.lesson_id || ':' || usp.step_id
  );

INSERT INTO public.xp_events (user_id, amount, source_type, source_id, earned_at)
SELECT ump.user_id, ump.xp_awarded, 'module_completion', ump.module_id, ump.completed_at
FROM public.user_module_progress ump
WHERE ump.xp_awarded > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.xp_events xe
    WHERE xe.user_id = ump.user_id
      AND xe.source_type = 'module_completion'
      AND xe.source_id = ump.module_id
  );

INSERT INTO public.xp_events (user_id, amount, source_type, source_id, earned_at)
SELECT ua.user_id, a.xp_bonus, 'achievement', ua.achievement_id, ua.earned_at
FROM public.user_achievements ua
JOIN public.achievements a ON a.id = ua.achievement_id
WHERE a.xp_bonus > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.xp_events xe
    WHERE xe.user_id = ua.user_id
      AND xe.source_type = 'achievement'
      AND xe.source_id = ua.achievement_id
  );


-- ──────────────────────────────────────────────────────────
-- 5. Leaderboard ranking RPCs.
--
--    RANK SEMANTICS — competition ranking, ties share a rank:
--      12,500 XP -> #1
--      11,900 XP -> #2
--      11,900 XP -> #2   (tied with the row above — same displayed rank)
--      10,800 XP -> #4   (gap after a tie, standard "1224" competition
--                          ranking — matches RANK()'s native behavior)
--    This is why the RANK() window function's OWN ORDER BY considers ONLY
--    the XP column (total_xp for all-time, period_xp for 24h) — account
--    age does NOT mean "earned the XP first," so it must never affect the
--    DISPLAYED rank number. (An earlier version of this migration included
--    created_at/user_id inside the RANK() window itself, which made ties
--    silently get sequential, non-tied ranks — fixed here.)
--
--    Row ORDER (and therefore pagination) is still fully deterministic —
--    the outer query's ORDER BY (used for LIMIT/OFFSET, separate from the
--    RANK() window) additionally sorts by username ASC then user_id ASC,
--    so which specific tied user appears "first" in the list never
--    changes between requests/pages, even though they display the same
--    rank number.
--
--    RANK() OVER (...) is computed over the FULL eligible set before
--    LIMIT/OFFSET is applied, so every returned row's rank is its true
--    global position — never a "rank within this page" number.
--
--    Rank-of-a-single-user (leaderboard_my_rank_*) is simply
--    `COUNT(users with strictly greater XP) + 1` — the same competition-
--    ranking semantics as RANK(), computed directly without needing to
--    materialize/rank the whole table.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.leaderboard_all_time(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(user_id uuid, username text, total_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    usp.user_id,
    p.username,
    usp.total_xp,
    RANK() OVER (ORDER BY usp.total_xp DESC)::integer AS rank
  FROM public.user_skill_progress usp
  JOIN public.profiles p ON p.id = usp.user_id
  WHERE usp.total_xp > 0
  ORDER BY usp.total_xp DESC, p.username ASC NULLS LAST, usp.user_id ASC
  LIMIT p_limit OFFSET p_offset;
$$;


CREATE OR REPLACE FUNCTION public.leaderboard_24h(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(user_id uuid, username text, total_xp integer, period_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_totals AS (
    SELECT xe.user_id, SUM(xe.amount)::integer AS period_xp
    FROM public.xp_events xe
    WHERE xe.earned_at >= now() - interval '24 hours'
    GROUP BY xe.user_id
  )
  SELECT
    pt.user_id,
    p.username,
    usp.total_xp,
    pt.period_xp,
    RANK() OVER (ORDER BY pt.period_xp DESC)::integer AS rank
  FROM period_totals pt
  JOIN public.profiles p ON p.id = pt.user_id
  JOIN public.user_skill_progress usp ON usp.user_id = pt.user_id
  ORDER BY pt.period_xp DESC, p.username ASC NULLS LAST, pt.user_id ASC
  LIMIT p_limit OFFSET p_offset;
$$;


CREATE OR REPLACE FUNCTION public.leaderboard_my_rank_all_time(p_user_id uuid)
RETURNS TABLE(username text, total_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.username,
    usp.total_xp,
    (
      SELECT COUNT(*) + 1
      FROM public.user_skill_progress usp2
      WHERE usp2.total_xp > usp.total_xp
    )::integer AS rank
  FROM public.user_skill_progress usp
  JOIN public.profiles p ON p.id = usp.user_id
  WHERE usp.user_id = p_user_id AND usp.total_xp > 0;
$$;


CREATE OR REPLACE FUNCTION public.leaderboard_my_rank_24h(p_user_id uuid)
RETURNS TABLE(username text, total_xp integer, period_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_period AS (
    SELECT COALESCE(SUM(amount), 0)::integer AS period_xp
    FROM public.xp_events
    WHERE user_id = p_user_id AND earned_at >= now() - interval '24 hours'
  ),
  others AS (
    SELECT xe2.user_id, SUM(xe2.amount)::integer AS period_xp
    FROM public.xp_events xe2
    WHERE xe2.earned_at >= now() - interval '24 hours'
    GROUP BY xe2.user_id
  )
  SELECT
    p.username,
    COALESCE(usp.total_xp, 0),
    mp.period_xp,
    (
      SELECT COUNT(*) + 1
      FROM others o
      WHERE o.period_xp > mp.period_xp
    )::integer AS rank
  FROM public.profiles p
  CROSS JOIN my_period mp
  LEFT JOIN public.user_skill_progress usp ON usp.user_id = p_user_id
  WHERE p.id = p_user_id AND mp.period_xp > 0;
$$;

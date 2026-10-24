-- ============================================================
-- Public display names — nothing derived from an email is ever shown publicly
-- Run this in the Supabase SQL Editor AFTER supabase_xp_leaderboard_schema.sql,
-- supabase_public_site_stats.sql and supabase_hand_history.sql.
-- Idempotent: safe to re-run. No existing row is changed.
--
-- Why: handle_new_user() (supabase_schema.sql) fills profiles.username with
-- the email's local part for every Google signup, and the leaderboards
-- returned that column as is. From here on, every public surface (the
-- leaderboard RPCs and public_site_stats(), which feed /leaderboard, /learn
-- and the homepage top 5) shows public_player_name():
--   profiles.display_name  when the user has set one (optional), else
--   "Player " + 4 hex characters of md5(user id)   e.g. "Player 3f9a"
-- profiles.username is no longer read by any public function.
--
-- display_name is validated by a trigger, so the rules hold for every write
-- path: 3–20 characters, letters/digits/_ . - (starting with a letter or
-- digit), not reserved, no profanity, not the user's own email local part,
-- unique ignoring case. Users set it in Settings via set_my_display_name().
-- A username typed on the email signup form becomes the display name when it
-- passes the same rules (Google signups start without one).
--
-- This file supersedes the definitions of leaderboard_all_time,
-- leaderboard_24h, leaderboard_my_rank_all_time, leaderboard_my_rank_24h
-- and public_site_stats: if one of those older files is ever re-run, run
-- this one again afterwards.
-- ============================================================

-- ── Column ─────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_lower_key
  ON public.profiles (lower(display_name));

-- ── Rules ──────────────────────────────────────────────────────────────────
-- NULL = fine. Otherwise the problem code the Settings form maps to a message
-- (frontend/lib/profile/strings.ts): length | characters | reserved | profanity.
-- The word lists live here and only here.
CREATE OR REPLACE FUNCTION public.display_name_problem(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_lower text := lower(p_name);
  -- Leetspeak folded and separators dropped: "St4cked_P0ker" → "stackedpoker".
  v_flat  text := regexp_replace(translate(lower(p_name), '013457', 'oieast'), '[^a-z0-9]', '', 'g');
  -- Blocked anywhere in the name.
  reserved_parts  text[] := ARRAY['admin', 'stackedpoker', 'support', 'moderator', 'official', 'helpdesk', 'customerservice'];
  -- Blocked only as the whole name (too short to match inside other words).
  reserved_whole  text[] := ARRAY['mod', 'mods', 'root', 'system', 'owner', 'staff', 'team', 'help', 'info', 'billing',
                                  'stacked', 'stackedpokerai', 'player', 'guest', 'anonymous', 'unknown', 'null',
                                  'undefined', 'deleted', 'you', 'coach', 'aicoach', 'bot'];
  profane_parts   text[] := ARRAY['fuck', 'fuk', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'bitch',
                                  'slut', 'retard', 'porn', 'pussy', 'asshole', 'bastard', 'nazi', 'hitler',
                                  'kanker', 'hoer'];
  profane_whole   text[] := ARRAY['ass', 'cock', 'dick', 'fag', 'rape', 'rapist', 'penis', 'vagina', 'tits', 'kut', 'lul', 'tering'];
  w text;
BEGIN
  IF p_name IS NULL THEN RETURN NULL; END IF;
  IF char_length(p_name) < 3 OR char_length(p_name) > 20 THEN RETURN 'length'; END IF;
  IF p_name !~ '^[A-Za-z0-9][A-Za-z0-9_.-]*$' THEN RETURN 'characters'; END IF;

  -- "Player 3f9a" is what users without a name are shown as.
  IF v_lower ~ '^player[_.-]?[0-9a-f]*$' THEN RETURN 'reserved'; END IF;
  IF v_flat = ANY (reserved_whole) THEN RETURN 'reserved'; END IF;
  FOREACH w IN ARRAY reserved_parts LOOP
    IF position(w IN v_flat) > 0 THEN RETURN 'reserved'; END IF;
  END LOOP;

  IF v_flat = ANY (profane_whole) THEN RETURN 'profanity'; END IF;
  FOREACH w IN ARRAY profane_parts LOOP
    IF position(w IN v_flat) > 0 THEN RETURN 'profanity'; END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- What every public surface shows for a player.
CREATE OR REPLACE FUNCTION public.public_player_name(p_display_name text, p_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_display_name, 'Player ' || left(md5(p_user_id::text), 4));
$$;

-- ── Trigger: validates every write; seeds the name from the signup form ────
-- SECURITY DEFINER to read auth.users (the user's own email + signup data).
-- On INSERT (handle_new_user creating the profile) a missing name is taken
-- from the signup form's username when it passes every rule; otherwise it
-- stays NULL — a signup never fails because of it.
CREATE OR REPLACE FUNCTION public.profiles_display_name_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local    text;
  v_meta     text;
  v_problem  text;
BEGIN
  SELECT lower(split_part(u.email, '@', 1)), NULLIF(btrim(u.raw_user_meta_data ->> 'username'), '')
    INTO v_local, v_meta
    FROM auth.users u WHERE u.id = NEW.id;

  IF TG_OP = 'INSERT' AND NEW.display_name IS NULL THEN
    IF v_meta IS NOT NULL
       AND public.display_name_problem(v_meta) IS NULL
       AND lower(v_meta) IS DISTINCT FROM v_local
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.display_name) = lower(v_meta)) THEN
      NEW.display_name := v_meta;
    END IF;
    RETURN NEW;
  END IF;

  NEW.display_name := NULLIF(btrim(NEW.display_name), '');
  IF NEW.display_name IS NULL THEN RETURN NEW; END IF;

  v_problem := public.display_name_problem(NEW.display_name);
  IF v_problem IS NULL AND lower(NEW.display_name) = v_local THEN v_problem := 'email'; END IF;
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'display_name:%', v_problem USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_display_name_guard ON public.profiles;
CREATE TRIGGER profiles_display_name_guard
  BEFORE INSERT OR UPDATE OF display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_display_name_guard();

-- ── Settings: set or clear (NULL / '') the caller's display name ───────────
-- {"ok": true, "display_name": "…"|null} or {"ok": false, "error": "<code>"},
-- code ∈ length | characters | reserved | profanity | email | taken.
CREATE OR REPLACE FUNCTION public.set_my_display_name(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text := NULLIF(btrim(p_name), '');
  v_msg  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.profiles SET display_name = v_name WHERE id = v_uid;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'taken');
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg NOT LIKE 'display_name:%' THEN RAISE; END IF;
      RETURN jsonb_build_object('ok', false, 'error', split_part(v_msg, ':', 2));
  END;
  RETURN jsonb_build_object('ok', true, 'display_name', v_name);
END;
$$;

-- ── Public functions, now on public_player_name() ──────────────────────────
-- Same signatures and column names as before (the backend reads `username`),
-- so CREATE OR REPLACE is enough. Ties are broken by user id only.

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
    public.public_player_name(p.display_name, p.id),
    usp.total_xp,
    RANK() OVER (ORDER BY usp.total_xp DESC)::integer AS rank
  FROM public.user_skill_progress usp
  JOIN public.profiles p ON p.id = usp.user_id
  WHERE usp.total_xp > 0
  ORDER BY usp.total_xp DESC, usp.user_id ASC
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
    public.public_player_name(p.display_name, p.id),
    usp.total_xp,
    pt.period_xp,
    RANK() OVER (ORDER BY pt.period_xp DESC)::integer AS rank
  FROM period_totals pt
  JOIN public.profiles p ON p.id = pt.user_id
  JOIN public.user_skill_progress usp ON usp.user_id = pt.user_id
  ORDER BY pt.period_xp DESC, pt.user_id ASC
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
    public.public_player_name(p.display_name, p.id),
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
    public.public_player_name(p.display_name, p.id),
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

CREATE OR REPLACE FUNCTION public.public_site_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'players', (SELECT count(*) FROM public.profiles),
    'hands',   (SELECT count(*) FROM public.hh_hands),
    'top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('rank', t.rank, 'username', t.username, 'total_xp', t.total_xp) ORDER BY t.rank, t.user_id)
        FROM (
          SELECT usp.user_id,
                 public.public_player_name(p.display_name, p.id) AS username,
                 usp.total_xp,
                 RANK() OVER (ORDER BY usp.total_xp DESC)::integer AS rank
            FROM public.user_skill_progress usp
            JOIN public.profiles p ON p.id = usp.user_id
           WHERE usp.total_xp > 0
           ORDER BY usp.total_xp DESC, usp.user_id ASC
           LIMIT 5
        ) t
    ), '[]'::jsonb)
  );
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.display_name_problem(text)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_display_name_guard()       FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_my_display_name(text)           FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_display_name(text)        TO authenticated;

REVOKE EXECUTE ON FUNCTION public.public_site_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_site_stats() TO anon, authenticated;

-- Check:
-- SELECT public.public_site_stats();
-- SELECT * FROM public.leaderboard_all_time(10, 0);

-- ============================================================
-- Social foundation (Phase 0): identity, privacy, blocks, reports,
-- notifications, rate limits, text filter, moderation.
-- Run in the Supabase SQL Editor AFTER supabase_subscriptions.sql,
-- supabase_display_name.sql (re-run it: moderation_wordlist() lives there)
-- and 20261024_01_profile_privileged_columns.sql.
-- Idempotent: safe to re-run.
--
-- Conventions every later social migration follows:
--   * All public reads go through SECURITY DEFINER functions that apply
--     can_view_profile()/are_blocked(); profiles keeps its own-row-only RLS,
--     so private columns (username = email local part, full_name, Google
--     avatar_url, Stripe ids) are never reachable by other users.
--   * Every user write passes social_rate_hit() (ban + rate limits) and
--     every user text passes social_check_text() (spam + profanity).
--   * Errors are raised as 'social:<code>' (frontend/lib/social/strings.ts
--     maps them to messages).
--   * Authored content references auth.users ON DELETE SET NULL and renders
--     as "[deleted user]"; per-user state (friendships, blocks,
--     notifications) cascades. Account deletion is auth.admin.deleteUser.
--   * Content tables register in moderation_targets so the moderation page
--     can preview and hide them without new code.
-- ============================================================

-- ── Profile columns ─────────────────────────────────────────────────────────
-- The public @handle. Not `username`: that column already exists and holds
-- the email local part for Google signups, which must never be public.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url          text,
  ADD COLUMN IF NOT EXISTS handle              text,
  ADD COLUMN IF NOT EXISTS handle_changed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS bio                 text,
  ADD COLUMN IF NOT EXISTS bio_hidden_at       timestamptz,
  ADD COLUMN IF NOT EXISTS sites               text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_visibility  text         NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS stats_visibility    text         NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS role                text         NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS banned_until        timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason          text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_handle_format
  CHECK (handle IS NULL OR handle ~ '^[a-z0-9_]{3,20}$');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 160);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sites_size;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_sites_size
  CHECK (cardinality(sites) <= 8);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_visibility;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_profile_visibility
  CHECK (profile_visibility IN ('public', 'friends', 'private'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_stats_visibility;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_stats_visibility
  CHECK (stats_visibility IN ('public', 'friends', 'private'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_role
  CHECK (role IN ('user', 'moderator', 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON public.profiles (handle);

-- The development account(s) start as admins of the social layer.
UPDATE public.profiles SET role = 'admin' WHERE subscription_tier = 'admin' AND role = 'user';

INSERT INTO public.plan_limits (key, value) VALUES ('handle_change_days', 30)
ON CONFLICT (key) DO NOTHING;

-- ── Friendships (UI in Phase 3; needed now for friends-only visibility) ────
CREATE TABLE IF NOT EXISTS public.friendships (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_key
  ON public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships (requester_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friendships_select_own ON public.friendships;
CREATE POLICY friendships_select_own ON public.friendships
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));
-- Writes only through the Phase 3 RPCs.

-- ── Blocks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id  uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks FOR SELECT USING (auth.uid() = blocker_id);
-- Writes only through block_user()/unblock_user().

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_moderator(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role IN ('moderator', 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_banned(p_user uuid, p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND banned_until > p_now);
$$;

-- Either side blocked the other.
CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
     WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
     WHERE status = 'accepted'
       AND least(requester_id, addressee_id) = least(a, b)
       AND greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- The visibility rule for anything gated by a public/friends/private setting.
-- p_viewer NULL = signed out. Blocked = nothing, either direction.
CREATE OR REPLACE FUNCTION public.can_view(p_viewer uuid, p_owner uuid, p_visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_owner IS NULL THEN false
    WHEN p_viewer = p_owner THEN true
    WHEN p_viewer IS NOT NULL AND public.are_blocked(p_viewer, p_owner) THEN false
    WHEN p_visibility = 'public' THEN true
    WHEN p_visibility = 'friends' THEN p_viewer IS NOT NULL AND public.are_friends(p_viewer, p_owner)
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(p_viewer uuid, p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_owner
       AND p.handle IS NOT NULL
       AND (p_viewer = p_owner
            OR public.is_moderator(p_viewer)
            OR (coalesce(p.banned_until, '-infinity') <> 'infinity'
                AND public.can_view(p_viewer, p_owner, p.profile_visibility)))
  );
$$;

-- How a user appears next to their content. NULL user = deleted account.
-- Never includes private columns.
CREATE OR REPLACE FUNCTION public.social_card(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
              'id', p.id,
              'handle', p.handle,
              'name', public.public_player_name(p.display_name, p.id),
              'role', p.role,
              'deleted', false)
       FROM public.profiles p WHERE p.id = p_user),
    jsonb_build_object('id', NULL, 'handle', NULL, 'name', '[deleted user]', 'role', 'user', 'deleted', true)
  );
$$;

-- ── Text filter (spam + profanity) ─────────────────────────────────────────
-- The one server-side filter for every user-written text (bios, messages,
-- posts, report details). Word lists: moderation_wordlist().
--   NULL                      fine
--   'empty' | 'length'        size
--   'hate'                    slur/hate word: always refused
--   'links'                   more than 3 links
--   'repeat'                  a character repeated 12+ times
-- Mild swearing is not a problem here; social_clean_text() masks it.
CREATE OR REPLACE FUNCTION public.social_text_problem(p_text text, p_max integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  w text;
  part text;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN 'empty'; END IF;
  IF char_length(p_text) > p_max THEN RETURN 'length'; END IF;
  IF (SELECT count(*) FROM regexp_matches(p_text, '(https?://|www\.)', 'gi')) > 3 THEN RETURN 'links'; END IF;
  IF p_text ~ '(.)\1{11,}' THEN RETURN 'repeat'; END IF;

  FOR w IN SELECT translate(m[1], '013457', 'oieast')
             FROM regexp_matches(lower(p_text), '([a-z0-9]+)', 'g') AS m LOOP
    IF w = ANY (public.moderation_wordlist('hate_whole')) THEN RETURN 'hate'; END IF;
    FOREACH part IN ARRAY public.moderation_wordlist('hate_parts') LOOP
      IF position(part IN w) > 0 THEN RETURN 'hate'; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Mild swear words → asterisks (same length), case-insensitive, whole tokens.
CREATE OR REPLACE FUNCTION public.social_clean_text(p_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_out text := p_text;
  tok text;
  flat text;
  part text;
  bad boolean;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  FOR tok IN SELECT DISTINCT m[1] FROM regexp_matches(p_text, '([A-Za-z0-9]+)', 'g') AS m LOOP
    flat := translate(lower(tok), '013457', 'oieast');
    bad := flat = ANY (public.moderation_wordlist('mild_whole'));
    IF NOT bad THEN
      FOREACH part IN ARRAY public.moderation_wordlist('mild_parts') LOOP
        IF position(part IN flat) > 0 THEN bad := true; EXIT; END IF;
      END LOOP;
    END IF;
    IF bad THEN
      v_out := regexp_replace(v_out, '\m' || tok || '\M', repeat('*', char_length(tok)), 'gi');
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

-- Trimmed + masked text, or raises social:text_<problem>.
CREATE OR REPLACE FUNCTION public.social_check_text(p_text text, p_max integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_problem text := public.social_text_problem(btrim(p_text), p_max);
BEGIN
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'social:text_%', v_problem USING ERRCODE = 'check_violation';
  END IF;
  RETURN public.social_clean_text(btrim(p_text));
END;
$$;

-- ── Rate limits ─────────────────────────────────────────────────────────────
-- The one place for per-action limits. plan: 'all' applies to everyone,
-- 'free'/'pro' per effective_plan(), 'new' to accounts younger than 24h
-- (on top of their plan's row). No row = unlimited.
CREATE TABLE IF NOT EXISTS public.social_limits (
  action          text     NOT NULL,
  plan            text     NOT NULL CHECK (plan IN ('all', 'free', 'pro', 'new')),
  max_count       integer  NOT NULL CHECK (max_count >= 0),
  window_seconds  integer  NOT NULL CHECK (window_seconds > 0),
  PRIMARY KEY (action, plan)
);
ALTER TABLE public.social_limits ENABLE ROW LEVEL SECURITY;
-- No policies: read through my_social_limits().

INSERT INTO public.social_limits (action, plan, max_count, window_seconds) VALUES
  ('message',        'all',  10,    60),
  ('report',         'all',  20, 86400),
  ('block',          'all',  50, 86400),
  ('friend_request', 'all',  30, 86400),
  ('share',          'free', 20, 86400),
  ('thread',         'new',   3, 86400),
  ('thread',         'all',  20, 86400),
  ('reply',          'all',  10,    60)
ON CONFLICT (action, plan) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.social_rate_events (
  id          bigserial    PRIMARY KEY,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_rate_events_lookup ON public.social_rate_events (user_id, action, created_at DESC);
ALTER TABLE public.social_rate_events ENABLE ROW LEVEL SECURITY;
-- No policies.

-- 'free' or 'pro' (the reverse trial counts as Pro, as everywhere else).
CREATE OR REPLACE FUNCTION public.social_plan(p_user uuid, p_now timestamptz DEFAULT now())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE coalesce(public.effective_plan(p_user, p_now), 'free') WHEN 'free' THEN 'free' ELSE 'pro' END;
$$;

-- Records one action for p_user, or raises social:banned /
-- social:rate_limited:<action>. Call it from every social write path.
CREATE OR REPLACE FUNCTION public.social_rate_hit(p_user uuid, p_action text, p_now timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan text;
  v_new  boolean;
  r      record;
  v_used integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501';
  END IF;
  IF public.is_banned(p_user, p_now) THEN
    RAISE EXCEPTION 'social:banned' USING ERRCODE = '42501';
  END IF;

  -- Serialise this user's hits for this action so two parallel requests
  -- cannot both squeeze under the limit.
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_action));

  v_plan := public.social_plan(p_user, p_now);
  SELECT u.created_at > p_now - interval '24 hours' INTO v_new FROM auth.users u WHERE u.id = p_user;

  FOR r IN
    SELECT l.max_count, l.window_seconds FROM public.social_limits l
     WHERE l.action = p_action
       AND (l.plan = 'all' OR l.plan = v_plan OR (l.plan = 'new' AND coalesce(v_new, false)))
  LOOP
    SELECT count(*) INTO v_used FROM public.social_rate_events e
     WHERE e.user_id = p_user AND e.action = p_action
       AND e.created_at > p_now - make_interval(secs => r.window_seconds);
    IF v_used >= r.max_count THEN
      RAISE EXCEPTION 'social:rate_limited:%', p_action USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.social_rate_events (user_id, action, created_at) VALUES (p_user, p_action, p_now);
  DELETE FROM public.social_rate_events
   WHERE user_id = p_user AND action = p_action AND created_at < p_now - interval '8 days';
END;
$$;

-- The caller's limits and current usage, for UI hints ("12/20 shares today").
CREATE OR REPLACE FUNCTION public.my_social_limits()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT auth.uid() AS id,
           public.social_plan(auth.uid()) AS plan,
           (SELECT u.created_at > now() - interval '24 hours' FROM auth.users u WHERE u.id = auth.uid()) AS is_new
  )
  SELECT coalesce(jsonb_object_agg(x.action, jsonb_build_object('max', x.max_count, 'window_seconds', x.window_seconds, 'used', x.used)), '{}'::jsonb)
    FROM (
      -- The tightest applicable row per action.
      SELECT DISTINCT ON (l.action) l.action, l.max_count, l.window_seconds,
             (SELECT count(*) FROM public.social_rate_events e
               WHERE e.user_id = me.id AND e.action = l.action
                 AND e.created_at > now() - make_interval(secs => l.window_seconds))::int AS used
        FROM public.social_limits l, me
       WHERE me.id IS NOT NULL
         AND (l.plan = 'all' OR l.plan = me.plan OR (l.plan = 'new' AND coalesce(me.is_new, false)))
       ORDER BY l.action, l.max_count
    ) x;
$$;

-- ── Moderation registry + audit log ─────────────────────────────────────────
-- Every reportable thing. hidden_column NULL = cannot be hidden (users are
-- banned instead). preview_columns are shown to moderators.
CREATE TABLE IF NOT EXISTS public.moderation_targets (
  target_type      text    PRIMARY KEY,
  table_name       text    NOT NULL,
  id_column        text    NOT NULL,
  owner_column     text    NOT NULL,
  hidden_column    text,
  preview_columns  text[]  NOT NULL DEFAULT '{}'
);
ALTER TABLE public.moderation_targets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.moderation_targets (target_type, table_name, id_column, owner_column, hidden_column, preview_columns) VALUES
  ('user',    'profiles', 'id', 'id', NULL,            ARRAY['handle', 'display_name']),
  ('profile', 'profiles', 'id', 'id', 'bio_hidden_at', ARRAY['handle', 'display_name', 'bio', 'sites'])
ON CONFLICT (target_type) DO UPDATE
  SET table_name = EXCLUDED.table_name, id_column = EXCLUDED.id_column, owner_column = EXCLUDED.owner_column,
      hidden_column = EXCLUDED.hidden_column, preview_columns = EXCLUDED.preview_columns;

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id            bigserial    PRIMARY KEY,
  moderator_id  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text         NOT NULL,   -- hide | unhide | ban | unban | set_role | resolve_report
  target_type   text         NOT NULL,
  target_id     text         NOT NULL,
  details       jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON public.moderation_actions (target_type, target_id);
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- ── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type  text         NOT NULL REFERENCES public.moderation_targets(target_type),
  target_id    text         NOT NULL,
  target_owner uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       text         NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'cheating', 'inappropriate', 'privacy', 'other')),
  details      text         CHECK (details IS NULL OR char_length(details) <= 500),
  status       text         NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  resolved_by  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);
-- One open report per reporter per target.
CREATE UNIQUE INDEX IF NOT EXISTS reports_open_once
  ON public.reports (reporter_id, target_type, target_id) WHERE status = 'open';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
-- Writes only through report_content() and the mod_* functions.

-- ── Notifications ───────────────────────────────────────────────────────────
-- payload holds ids only (actor_id, share_id, …), never names: names are
-- resolved when read, so a renamed or deleted account shows correctly.
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text         NOT NULL,
  payload     jsonb        NOT NULL DEFAULT '{}',
  read_at     timestamptz,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE USING (auth.uid() = user_id);
-- Created by social_notify(); marked read by mark_notifications_read().

-- Internal: called by other SECURITY DEFINER functions, never by clients.
-- Skips the notification when the actor and recipient have blocked each other.
CREATE OR REPLACE FUNCTION public.social_notify(p_user uuid, p_type text, p_payload jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := nullif(p_payload ->> 'actor_id', '')::uuid;
  v_id uuid;
BEGIN
  IF p_user IS NULL OR p_user = v_actor THEN RETURN NULL; END IF;
  IF v_actor IS NOT NULL AND public.are_blocked(p_user, v_actor) THEN RETURN NULL; END IF;
  INSERT INTO public.notifications (user_id, type, payload) VALUES (p_user, p_type, coalesce(p_payload, '{}'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- NULL ids = mark everything read. Returns the number changed.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.notifications SET read_at = now()
   WHERE user_id = auth.uid() AND read_at IS NULL AND (p_ids IS NULL OR id = ANY (p_ids));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ── Handle (the public @username) ───────────────────────────────────────────
-- NULL = fine; else length | characters | reserved | profanity.
CREATE OR REPLACE FUNCTION public.handle_problem(p_handle text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_handle IS NULL OR char_length(p_handle) < 3 OR char_length(p_handle) > 20 THEN RETURN 'length'; END IF;
  IF p_handle !~ '^[a-z0-9_]+$' THEN RETURN 'characters'; END IF;
  -- Same reserved/profanity rules (and "must start with a letter or digit")
  -- as display names.
  RETURN public.display_name_problem(p_handle);
END;
$$;

CREATE OR REPLACE FUNCTION public.email_local_part(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(split_part(email, '@', 1)) FROM auth.users WHERE id = p_user;
$$;

-- "jane.doe@…" → refuses jane.doe, jane_doe and janedoe.
CREATE OR REPLACE FUNCTION public.handle_reveals_email(p_handle text, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p_handle IN (l, regexp_replace(l, '[^a-z0-9_]', '_', 'g'), regexp_replace(l, '[^a-z0-9]', '', 'g')), false)
    FROM (SELECT public.email_local_part(p_user) AS l) x;
$$;

-- {"ok": true, "handle": "…"} or {"ok": false, "error": code[, "next_change_at": ts]}
-- code ∈ length | characters | reserved | profanity | email | taken | too_soon
CREATE OR REPLACE FUNCTION public.set_my_handle(p_handle text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_handle  text := lower(btrim(ltrim(btrim(coalesce(p_handle, '')), '@')));
  v_problem text;
  v_cur     record;
  v_next    timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_problem := public.handle_problem(v_handle);
  IF v_problem IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', v_problem); END IF;

  -- Never let the handle reveal the email address.
  IF public.handle_reveals_email(v_handle, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email');
  END IF;

  SELECT handle, handle_changed_at INTO v_cur FROM public.profiles WHERE id = v_uid;
  IF v_cur.handle = v_handle THEN
    RETURN jsonb_build_object('ok', true, 'handle', v_handle);
  END IF;
  IF v_cur.handle IS NOT NULL AND v_cur.handle_changed_at IS NOT NULL THEN
    v_next := v_cur.handle_changed_at + make_interval(days => coalesce(public.plan_limit('handle_change_days'), 30));
    IF v_next > now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too_soon', 'next_change_at', v_next);
    END IF;
  END IF;

  BEGIN
    -- Every pick, the first one included, starts the 30-day wait.
    UPDATE public.profiles SET handle = v_handle, handle_changed_at = now() WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'taken');
  END;
  RETURN jsonb_build_object('ok', true, 'handle', v_handle);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_available(p_handle text, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.handle_problem(p_handle) IS NULL
     AND NOT public.handle_reveals_email(p_handle, p_user)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE handle = p_handle AND id <> p_user);
$$;

-- A free handle for the caller, from their display name or full name.
-- Deliberately never from the email address (it would reveal it).
CREATE OR REPLACE FUNCTION public.suggest_my_handle()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_prof jsonb;
  v_base text;
  v_try  text;
  i      integer;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(p) INTO v_prof FROM public.profiles p WHERE p.id = v_uid;
  IF v_prof ->> 'handle' IS NOT NULL THEN RETURN v_prof ->> 'handle'; END IF;

  FOREACH v_base IN ARRAY ARRAY[v_prof ->> 'display_name', v_prof ->> 'full_name', 'grinder'] LOOP
    CONTINUE WHEN v_base IS NULL;
    v_base := left(btrim(regexp_replace(lower(v_base), '[^a-z0-9]+', '_', 'g'), '_'), 16);
    CONTINUE WHEN char_length(v_base) < 3;
    IF v_base <> 'grinder' AND public.handle_available(v_base, v_uid) THEN RETURN v_base; END IF;
    FOR i IN 1..20 LOOP
      v_try := v_base || (10 + floor(random() * 9990))::int;
      IF public.handle_available(v_try, v_uid) THEN RETURN v_try; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

-- The caller's own social settings.
CREATE OR REPLACE FUNCTION public.my_social_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
           'id', p.id,
           'handle', p.handle,
           'name', public.public_player_name(p.display_name, p.id),
           'next_handle_change_at',
             CASE WHEN p.handle_changed_at IS NULL THEN NULL
                  ELSE p.handle_changed_at + make_interval(days => coalesce(public.plan_limit('handle_change_days'), 30)) END,
           'bio', p.bio,
           'sites', to_jsonb(p.sites),
           'profile_visibility', p.profile_visibility,
           'stats_visibility', p.stats_visibility,
           'role', p.role,
           'banned_until', p.banned_until,
           'ban_reason', p.ban_reason)
    FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- ── Blocking + reporting (user RPCs) ────────────────────────────────────────

-- Blocking also ends any friendship or pending request between the two.
CREATE OR REPLACE FUNCTION public.block_user(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF p_user IS NULL OR p_user = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  -- Blocking is never refused for a ban: it protects the blocker.
  IF NOT public.is_banned(v_uid) THEN PERFORM public.social_rate_hit(v_uid, 'block'); END IF;
  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (v_uid, p_user) ON CONFLICT DO NOTHING;
  DELETE FROM public.friendships
   WHERE least(requester_id, addressee_id) = least(v_uid, p_user)
     AND greatest(requester_id, addressee_id) = greatest(v_uid, p_user);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_blocked_users()
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.social_card(b.blocked_id) || jsonb_build_object('blocked_at', b.created_at)
    FROM public.blocks b WHERE b.blocker_id = auth.uid()
   ORDER BY b.created_at DESC;
$$;

-- Resolves the owner of a registered target, or NULL when it does not exist.
CREATE OR REPLACE FUNCTION public.moderation_target_owner(p_type text, p_id text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
  v_owner uuid;
BEGIN
  SELECT * INTO t FROM public.moderation_targets WHERE target_type = p_type;
  IF NOT FOUND THEN RETURN NULL; END IF;
  BEGIN
    EXECUTE format('SELECT %I FROM public.%I WHERE %I::text = $1', t.owner_column, t.table_name, t.id_column)
      INTO v_owner USING p_id;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
  RETURN v_owner;
END;
$$;

-- {"ok": true} or {"ok": false, "error": invalid | not_found | duplicate | text_*}
CREATE OR REPLACE FUNCTION public.report_content(p_target_type text, p_target_id text, p_reason text, p_details text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_owner   uuid;
  v_details text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF p_reason NOT IN ('spam', 'harassment', 'hate', 'cheating', 'inappropriate', 'privacy', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  v_owner := public.moderation_target_owner(p_target_type, p_target_id);
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_owner = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;

  IF nullif(btrim(p_details), '') IS NOT NULL THEN
    IF public.social_text_problem(btrim(p_details), 500) IN ('length', 'links', 'repeat') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'text_' || public.social_text_problem(btrim(p_details), 500));
    END IF;
    -- Report details may quote the offending words, so no masking/refusal.
    v_details := btrim(p_details);
  END IF;

  PERFORM public.social_rate_hit(v_uid, 'report');
  BEGIN
    INSERT INTO public.reports (reporter_id, target_type, target_id, target_owner, reason, details)
    VALUES (v_uid, p_target_type, p_target_id, v_owner, p_reason, v_details);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate');
  END;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Moderation (moderators and admins) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.am_i_moderator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_moderator(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.mod_require(p_admin boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.profiles WHERE id = v_uid
          AND role = ANY (CASE WHEN p_admin THEN ARRAY['admin'] ELSE ARRAY['moderator', 'admin'] END)) THEN
    RAISE EXCEPTION 'social:forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderation_target_preview(p_type text, p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
  v jsonb;
  v_fields text;
BEGIN
  SELECT * INTO t FROM public.moderation_targets WHERE target_type = p_type;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT string_agg(format('%L, %I', c, c), ', ') INTO v_fields FROM unnest(t.preview_columns) AS c;
  BEGIN
    EXECUTE format('SELECT jsonb_build_object(%s) FROM public.%I WHERE %I::text = $1',
                   coalesce(v_fields, ''), t.table_name, t.id_column)
      INTO v USING p_id;
    IF t.hidden_column IS NOT NULL THEN
      EXECUTE format('SELECT %I FROM public.%I WHERE %I::text = $1', t.hidden_column, t.table_name, t.id_column)
        INTO STRICT v_fields USING p_id;
      v := v || jsonb_build_object('hidden_at', v_fields);
    END IF;
  EXCEPTION WHEN invalid_text_representation OR no_data_found THEN
    RETURN NULL;
  END;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_list_reports(p_status text DEFAULT 'open', p_before timestamptz DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, target_type text, target_id text, reason text, details text, status text,
  created_at timestamptz, resolved_at timestamptz,
  reporter jsonb, owner jsonb, target jsonb, open_reports integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mod_require();
  RETURN QUERY
    SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, r.resolved_at,
           public.social_card(r.reporter_id),
           public.social_card(r.target_owner) || jsonb_build_object(
             'banned_until', (SELECT p.banned_until FROM public.profiles p WHERE p.id = r.target_owner)),
           public.moderation_target_preview(r.target_type, r.target_id),
           (SELECT count(*)::int FROM public.reports o
             WHERE o.target_type = r.target_type AND o.target_id = r.target_id AND o.status = 'open')
      FROM public.reports r
     WHERE (p_status IS NULL OR r.status = p_status)
       AND (p_before IS NULL OR r.created_at < p_before)
     ORDER BY r.created_at DESC
     LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_resolve_report(p_report uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod uuid := public.mod_require();
  r record;
BEGIN
  IF p_status NOT IN ('open', 'actioned', 'dismissed') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  UPDATE public.reports
     SET status = p_status,
         resolved_by = CASE WHEN p_status = 'open' THEN NULL ELSE v_mod END,
         resolved_at = CASE WHEN p_status = 'open' THEN NULL ELSE now() END
   WHERE id = p_report
  RETURNING target_type, target_id INTO r;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  INSERT INTO public.moderation_actions (moderator_id, action, target_type, target_id, details)
  VALUES (v_mod, 'resolve_report', r.target_type, r.target_id,
          jsonb_build_object('report_id', p_report, 'status', p_status, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hides (or un-hides) one piece of content; hiding also closes its open reports.
CREATE OR REPLACE FUNCTION public.mod_set_hidden(p_type text, p_id text, p_hidden boolean, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod uuid := public.mod_require();
  t record;
  v_n integer;
BEGIN
  SELECT * INTO t FROM public.moderation_targets WHERE target_type = p_type;
  IF NOT FOUND OR t.hidden_column IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I::text = $2', t.table_name, t.hidden_column, t.id_column)
    USING CASE WHEN p_hidden THEN now() ELSE NULL END, p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF p_hidden THEN
    UPDATE public.reports SET status = 'actioned', resolved_by = v_mod, resolved_at = now()
     WHERE target_type = p_type AND target_id = p_id AND status = 'open';
  END IF;
  INSERT INTO public.moderation_actions (moderator_id, action, target_type, target_id, details)
  VALUES (v_mod, CASE WHEN p_hidden THEN 'hide' ELSE 'unhide' END, p_type, p_id, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- p_until NULL = permanent. Moderators may only ban regular users; admins
-- may ban anyone but themselves.
CREATE OR REPLACE FUNCTION public.mod_ban_user(p_user uuid, p_until timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod uuid := public.mod_require();
  v_target_role text;
  v_until timestamptz := coalesce(p_until, 'infinity');
BEGIN
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF p_user = v_mod THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF v_target_role <> 'user' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_mod AND role = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF v_until <= now() THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;

  UPDATE public.profiles SET banned_until = v_until, ban_reason = nullif(btrim(p_reason), '') WHERE id = p_user;
  UPDATE public.reports SET status = 'actioned', resolved_by = v_mod, resolved_at = now()
   WHERE target_owner = p_user AND status = 'open';
  INSERT INTO public.moderation_actions (moderator_id, action, target_type, target_id, details)
  VALUES (v_mod, 'ban', 'user', p_user::text, jsonb_build_object('until', v_until, 'reason', p_reason));
  PERFORM public.social_notify(p_user, 'moderation', jsonb_build_object('kind', 'ban', 'until', v_until));
  RETURN jsonb_build_object('ok', true, 'banned_until', v_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_unban_user(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod uuid := public.mod_require();
BEGIN
  UPDATE public.profiles SET banned_until = NULL, ban_reason = NULL WHERE id = p_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  INSERT INTO public.moderation_actions (moderator_id, action, target_type, target_id)
  VALUES (v_mod, 'unban', 'user', p_user::text);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_set_role(p_user uuid, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := public.mod_require(true);
BEGIN
  IF p_role NOT IN ('user', 'moderator', 'admin') OR p_user = v_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  INSERT INTO public.moderation_actions (moderator_id, action, target_type, target_id, details)
  VALUES (v_admin, 'set_role', 'user', p_user::text, jsonb_build_object('role', p_role));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Users by handle or display name, for the moderation page.
CREATE OR REPLACE FUNCTION public.mod_find_users(p_query text)
RETURNS TABLE (id uuid, handle text, name text, role text, banned_until timestamptz, ban_reason text, created_at timestamptz, open_reports integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q text := lower(btrim(ltrim(btrim(coalesce(p_query, '')), '@')));
BEGIN
  PERFORM public.mod_require();
  IF char_length(q) < 2 THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.handle, public.public_player_name(p.display_name, p.id), p.role, p.banned_until, p.ban_reason, p.created_at,
           (SELECT count(*)::int FROM public.reports r WHERE r.target_owner = p.id AND r.status = 'open')
      FROM public.profiles p
     WHERE p.handle LIKE '%' || replace(replace(q, '%', ''), '_', '\_') || '%'
        OR lower(p.display_name) LIKE '%' || replace(replace(q, '%', ''), '_', '\_') || '%'
     ORDER BY (p.handle = q) IS TRUE DESC, p.handle NULLS LAST
     LIMIT 20;
END;
$$;

-- ── Data export (social part; the API route adds hands and training data) ──
-- Later phases extend this function with their own tables.
CREATE OR REPLACE FUNCTION public.export_my_social_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'profile', public.my_social_profile(),
    'friendships', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'other', public.social_card(CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END),
        'direction', CASE WHEN f.requester_id = auth.uid() THEN 'sent' ELSE 'received' END,
        'status', f.status, 'created_at', f.created_at, 'responded_at', f.responded_at) ORDER BY f.created_at)
      FROM public.friendships f WHERE auth.uid() IN (f.requester_id, f.addressee_id)), '[]'),
    'blocks', coalesce((SELECT jsonb_agg(b ORDER BY (b ->> 'blocked_at')) FROM public.my_blocked_users() b), '[]'),
    'reports_made', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason,
        'details', r.details, 'status', r.status, 'created_at', r.created_at) ORDER BY r.created_at)
      FROM public.reports r WHERE r.reporter_id = auth.uid()), '[]'),
    'notifications', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'type', n.type, 'payload', n.payload, 'read_at', n.read_at, 'created_at', n.created_at) ORDER BY n.created_at)
      FROM public.notifications n WHERE n.user_id = auth.uid()), '[]')
  )
  WHERE auth.uid() IS NOT NULL;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Internal helpers: definer-only.
REVOKE ALL ON FUNCTION public.is_moderator(uuid)                         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_banned(uuid, timestamptz)               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.are_blocked(uuid, uuid)                    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid)                    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view(uuid, uuid, text)                 FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid, uuid)               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_card(uuid)                          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_text_problem(text, integer)         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_clean_text(text)                    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_check_text(text, integer)           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_plan(uuid, timestamptz)             FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_rate_hit(uuid, text, timestamptz)   FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_notify(uuid, text, jsonb)           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_problem(text)                       FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_local_part(uuid)                     FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_reveals_email(text, uuid)           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_available(text, uuid)               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.moderation_target_owner(text, text)        FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.moderation_target_preview(text, text)      FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mod_require(boolean)                       FROM public, anon, authenticated;

-- Signed-in user RPCs.
REVOKE ALL ON FUNCTION public.my_social_limits()                         FROM public, anon;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[])            FROM public, anon;
REVOKE ALL ON FUNCTION public.set_my_handle(text)                        FROM public, anon;
REVOKE ALL ON FUNCTION public.suggest_my_handle()                        FROM public, anon;
REVOKE ALL ON FUNCTION public.my_social_profile()                        FROM public, anon;
REVOKE ALL ON FUNCTION public.block_user(uuid)                           FROM public, anon;
REVOKE ALL ON FUNCTION public.unblock_user(uuid)                         FROM public, anon;
REVOKE ALL ON FUNCTION public.my_blocked_users()                         FROM public, anon;
REVOKE ALL ON FUNCTION public.report_content(text, text, text, text)     FROM public, anon;
REVOKE ALL ON FUNCTION public.am_i_moderator()                           FROM public, anon;
REVOKE ALL ON FUNCTION public.export_my_social_data()                    FROM public, anon;
-- Moderator RPCs (each checks the role itself).
REVOKE ALL ON FUNCTION public.mod_list_reports(text, timestamptz, integer)   FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_resolve_report(uuid, text, text)           FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_set_hidden(text, text, boolean, text)      FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_ban_user(uuid, timestamptz, text)          FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_unban_user(uuid)                           FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_set_role(uuid, text)                       FROM public, anon;
REVOKE ALL ON FUNCTION public.mod_find_users(text)                           FROM public, anon;

GRANT EXECUTE ON FUNCTION public.my_social_limits()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[])             TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_handle(text)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_my_handle()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_social_profile()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_blocked_users()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_content(text, text, text, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.am_i_moderator()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_social_data()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_list_reports(text, timestamptz, integer)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_resolve_report(uuid, text, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_set_hidden(text, text, boolean, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_ban_user(uuid, timestamptz, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_unban_user(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_set_role(uuid, text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_find_users(text)                            TO authenticated;

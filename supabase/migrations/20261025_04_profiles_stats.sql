-- ============================================================
-- Social Phase 2: profiles, skill stats, badges
-- Run in the Supabase SQL Editor AFTER 20261025_03_hand_shares.sql,
-- supabase_achievements_schema.sql, supabase_preflop_trainer_xp.sql,
-- supabase_flop_trainer*.sql, supabase_hand_history_preflop_defense.sql,
-- supabase_hand_history_flop.sql and supabase_retention.sql.
-- Idempotent: safe to re-run.
--
-- Skill stats are not computed live on every profile view: they live in
-- user_skill_stats (one jsonb per user) and are recomputed when they are
-- older than an hour and someone looks (refresh_profile_stats), daily for
-- recently active users (/api/cron/social-daily), and by the owner at most
-- every 5 minutes. Counts are stored raw; the minimum sample before a
-- percentage is shown is a UI rule (lib/social/stats.ts).
-- ============================================================

-- ── Profile: avatar ─────────────────────────────────────────────────────────
-- Path in the public 'avatars' bucket, always under the owner's folder.
-- (profiles.avatar_url is the Google picture: private, never shown publicly.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_path_own;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_avatar_path_own
  CHECK (avatar_path IS NULL OR avatar_path ~ ('^' || id::text || '/[A-Za-z0-9._-]{1,80}$'));

-- Bio, sites and avatar go through update_my_profile()/set_my_avatar() so the
-- text filter always runs: they join the client-protected columns
-- (20261024_01_profile_privileged_columns.sql).
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  protected text[] := ARRAY[
    'subscription_tier', 'analyses_limit', 'hands_analyzed_count', 'subscription_status',
    'stripe_customer_id', 'stripe_subscription_id', 'current_period_end',
    'role', 'banned_until', 'ban_reason', 'handle', 'handle_changed_at', 'bio_hidden_at',
    'bio', 'sites', 'avatar_path'
  ];
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  k text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF coalesce(v_new ->> 'subscription_tier', 'free') <> 'free'
       OR coalesce(v_new ->> 'role', 'user') <> 'user' THEN
      RAISE EXCEPTION 'profiles: % may not be set by the client', 'subscription_tier/role'
        USING ERRCODE = '42501';
    END IF;
    FOREACH k IN ARRAY protected LOOP
      CONTINUE WHEN k IN ('subscription_tier', 'role', 'analyses_limit', 'hands_analyzed_count', 'sites');
      IF v_new ? k AND v_new -> k <> 'null'::jsonb THEN
        RAISE EXCEPTION 'profiles: % may not be set by the client', k USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  FOREACH k IN ARRAY protected LOOP
    IF v_new ? k AND (v_new -> k) IS DISTINCT FROM (v_old -> k) THEN
      RAISE EXCEPTION 'profiles: % may not be changed by the client', k USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Avatar storage: public read, each user writes only their own folder.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE $q$
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
    $q$;
    EXECUTE 'DROP POLICY IF EXISTS avatars_insert_own ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS avatars_update_own ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS avatars_delete_own ON storage.objects';
    EXECUTE $q$CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)$q$;
    EXECUTE $q$CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)$q$;
    EXECUTE $q$CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)$q$;
  END IF;
END $$;

-- ── Badges ──────────────────────────────────────────────────────────────────
-- Earned badges are public now, so clients may no longer insert their own.
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;

-- New badges carry no XP bonus: the XP economy is tuned elsewhere.
-- streak_7 / streak_30 already exist (lesson streaks) and are also earned
-- from the daily activity streak.
INSERT INTO public.achievements (id, title, description, icon, category, condition, xp_bonus, tier) VALUES
  ('first_share',     'First share',     'Shared a hand for the first time',        '🔗', 'exploration', 'Share 1 hand',                                0, 'bronze'),
  ('spots_100',       '100 spots',       'Trained 100 spots',                       '💯', 'performance', 'Train 100 spots',                             0, 'bronze'),
  ('flop_master',     'Flop master',     '80%+ good answers on 50 flops',           '🃏', 'mastery',     '>= 80% good on 50+ flop trainer answers',     0, 'gold'),
  ('helpful',         'Helpful',         'Ten best answers in the forum',           '🤝', 'performance', '10 best answers',                             0, 'gold'),
  ('founding_member', 'Founding member', 'One of the first 500 Stacked Poker players', '⭐', 'exploration', 'Among the first 500 accounts',         0, 'platinum')
ON CONFLICT (id) DO NOTHING;

-- Shown first next to a name: founding member, then the rarest tier.
CREATE OR REPLACE FUNCTION public.badge_rank(p_id text, p_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_id = 'founding_member' THEN 0 ELSE
    CASE p_tier WHEN 'platinum' THEN 1 WHEN 'gold' THEN 2 WHEN 'silver' THEN 3 ELSE 4 END END;
$$;

-- How a user appears next to their content, now with avatar and top badges.
CREATE OR REPLACE FUNCTION public.social_card(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
              'id', p.id,
              'handle', p.handle,
              'name', public.public_player_name(p.display_name, p.id),
              'role', p.role,
              'avatar', CASE WHEN p.bio_hidden_at IS NULL THEN p.avatar_path END,
              'badges', coalesce((
                SELECT jsonb_agg(jsonb_build_object('id', a.id, 'icon', a.icon, 'title', a.title) ORDER BY public.badge_rank(a.id, a.tier), ua.earned_at)
                  FROM (SELECT * FROM public.user_achievements u WHERE u.user_id = p.id) ua
                  JOIN public.achievements a ON a.id = ua.achievement_id
                 WHERE public.badge_rank(a.id, a.tier) <= 2), '[]'),
              'deleted', false)
       FROM public.profiles p WHERE p.id = p_user),
    jsonb_build_object('id', NULL, 'handle', NULL, 'name', '[deleted user]', 'role', 'user', 'avatar', NULL, 'badges', '[]'::jsonb, 'deleted', true)
  );
$$;

-- ── Skill stats ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_skill_stats (
  user_id       uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stats         jsonb        NOT NULL,
  refreshed_at  timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE public.user_skill_stats ENABLE ROW LEVEL SECURITY;
-- No policies: read through get_profile() (visibility applied).

-- [n, ok] per time window: all, last 30 days, the 30 before, last 90, the 90 before.
-- Rows come in as {c, ok, at}; the result has one key per category plus
-- 'overall' (rows without a category only count toward 'overall').
CREATE OR REPLACE FUNCTION public.skill_windows(p_rows jsonb, p_now timestamptz)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  WITH r AS (
    SELECT x ->> 'c' AS cat, (x ->> 'ok')::boolean AS ok, (x ->> 'at')::timestamptz AS at
      FROM jsonb_array_elements(coalesce(p_rows, '[]')) x
  ), g AS (
    SELECT CASE WHEN grouping(cat) = 1 THEN 'overall' ELSE cat END AS k,
           count(*) AS n, count(*) FILTER (WHERE ok) AS c,
           count(*) FILTER (WHERE at > p_now - interval '30 days') AS n30,
           count(*) FILTER (WHERE ok AND at > p_now - interval '30 days') AS c30,
           count(*) FILTER (WHERE at <= p_now - interval '30 days' AND at > p_now - interval '60 days') AS np30,
           count(*) FILTER (WHERE ok AND at <= p_now - interval '30 days' AND at > p_now - interval '60 days') AS cp30,
           count(*) FILTER (WHERE at > p_now - interval '90 days') AS n90,
           count(*) FILTER (WHERE ok AND at > p_now - interval '90 days') AS c90,
           count(*) FILTER (WHERE at <= p_now - interval '90 days' AND at > p_now - interval '180 days') AS np90,
           count(*) FILTER (WHERE ok AND at <= p_now - interval '90 days' AND at > p_now - interval '180 days') AS cp90
      FROM r GROUP BY GROUPING SETS ((cat), ())
  )
  SELECT coalesce(jsonb_object_agg(k,
           jsonb_build_object('all', jsonb_build_array(n, c), 'd30', jsonb_build_array(n30, c30), 'p30', jsonb_build_array(np30, cp30),
                              'd90', jsonb_build_array(n90, c90), 'p90', jsonb_build_array(np90, cp90))), '{}')
    FROM g WHERE k IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.compute_skill_stats(p_user uuid, p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pre      jsonb;
  v_review   jsonb;
  v_ftrain   jsonb;
  v_weak     jsonb;
  v_hs       record;
  v_trained  integer;
  v_streak   integer;
  v_acc      jsonb;
BEGIN
  -- Preflop: graded hand-review decisions + preflop trainer answers. Mixed
  -- hands count as correct (either action is in the range).
  SELECT jsonb_agg(jsonb_build_object('c', c, 'ok', ok, 'at', at)) INTO v_pre FROM (
    SELECT CASE h.preflop_spot WHEN 'rfi' THEN 'opens' WHEN 'vs_push' THEN 'pushfold'
                               WHEN 'other' THEN 'other' ELSE 'defense' END AS c,
           h.preflop_check IN ('correct', 'mixed') AS ok, h.played_at::timestamptz AS at
      FROM public.hh_hands h
     WHERE h.user_id = p_user AND h.preflop_spot IS NOT NULL
       AND h.preflop_check IN ('correct', 'mixed', 'too_loose', 'too_tight', 'wrong_action')
    UNION ALL
    SELECT CASE split_part(t.hand_ref, ':', 1) WHEN 'open' THEN 'opens' WHEN 'pushfold' THEN 'pushfold'
                                               WHEN 'defense' THEN 'defense' ELSE 'other' END,
           t.verdict IN ('correct', 'mixed'), t.played_at
      FROM public.trainer_hand_log t WHERE t.user_id = p_user
  ) x;

  -- Flop play in reviewed hands: good / ok / questionable.
  SELECT jsonb_build_object(
           'all',  jsonb_build_object('n', count(*), 'good', count(*) FILTER (WHERE flop_check = 'good'),
                                      'ok', count(*) FILTER (WHERE flop_check = 'ok'),
                                      'questionable', count(*) FILTER (WHERE flop_check = 'questionable')),
           'windows', public.skill_windows(jsonb_agg(jsonb_build_object('c', NULL, 'ok', flop_check IN ('good', 'ok'), 'at', played_at::timestamptz)), p_now))
    INTO v_review
    FROM public.hh_hands WHERE user_id = p_user AND flop_check IN ('good', 'ok', 'questionable');

  -- Flop reading (flop trainer): equity guesses and flop-vs-flop picks.
  SELECT public.skill_windows(jsonb_agg(jsonb_build_object('c', NULL, 'ok', ok, 'at', at)), p_now) INTO v_ftrain FROM (
    SELECT verdict IN ('perfect', 'good') AS ok, created_at AS at FROM public.flop_trainer_answers WHERE user_id = p_user
    UNION ALL
    SELECT correct, created_at FROM public.flop_versus_answers WHERE user_id = p_user
  ) f;

  -- Weakest texture: lowest accuracy among textures with at least 10 answers.
  SELECT jsonb_build_object('category', category, 'n', n, 'ok', k) INTO v_weak FROM (
    SELECT category, count(*) AS n, count(*) FILTER (WHERE verdict IN ('perfect', 'good')) AS k
      FROM public.flop_trainer_answers WHERE user_id = p_user GROUP BY category HAVING count(*) >= 10
  ) t ORDER BY k::numeric / n, n DESC LIMIT 1;

  -- Trainer-only accuracy: preflop trainer + flop trainer answers.
  SELECT jsonb_build_array(count(*), count(*) FILTER (WHERE ok)) INTO v_acc FROM (
    SELECT verdict IN ('correct', 'mixed') AS ok FROM public.trainer_hand_log WHERE user_id = p_user
    UNION ALL SELECT verdict IN ('perfect', 'good') FROM public.flop_trainer_answers WHERE user_id = p_user
    UNION ALL SELECT correct FROM public.flop_versus_answers WHERE user_id = p_user
  ) a;

  SELECT current_streak, best_streak INTO v_hs
    FROM public.trainer_highscores WHERE user_id = p_user AND trainer_key = 'preflop-ranges';
  SELECT (SELECT count(*) FROM public.trainer_hand_log WHERE user_id = p_user)
       + (SELECT count(*) FROM public.flop_trainer_answers WHERE user_id = p_user)
       + (SELECT count(*) FROM public.flop_versus_answers WHERE user_id = p_user)
    INTO v_trained;
  v_streak := coalesce((public.activity_streak(p_user, p_now) ->> 'streak')::int, 0);

  RETURN jsonb_build_object(
    'v', 1,
    'computed_at', p_now,
    'preflop', CASE WHEN v_pre IS NULL THEN '{}'::jsonb ELSE public.skill_windows(v_pre, p_now) END,
    'flop_review', coalesce(v_review, '{}'),
    'flop_trainer', coalesce(v_ftrain, '{}'),
    'weakest_texture', v_weak,
    'trainer', jsonb_build_object('spots', v_trained, 'accuracy', v_acc, 'current_streak', coalesce(v_hs.current_streak, 0),
                                  'best_streak', coalesce(v_hs.best_streak, 0)),
    'day_streak', v_streak
  );
END;
$$;

-- Earned badges from facts the stats already know. Inserted directly (no XP).
CREATE OR REPLACE FUNCTION public.award_social_badges(p_user uuid, p_stats jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ft jsonb := p_stats -> 'flop_trainer' -> 'overall' -> 'all';
  v_ids text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS (SELECT 1 FROM public.hand_shares WHERE owner_id = p_user) THEN v_ids := array_append(v_ids, 'first_share'); END IF;
  IF coalesce((p_stats -> 'trainer' ->> 'spots')::int, 0) >= 100 THEN v_ids := array_append(v_ids, 'spots_100'); END IF;
  IF coalesce((p_stats ->> 'day_streak')::int, 0) >= 7 THEN v_ids := array_append(v_ids, 'streak_7'); END IF;
  IF coalesce((p_stats ->> 'day_streak')::int, 0) >= 30 THEN v_ids := array_append(v_ids, 'streak_30'); END IF;
  IF coalesce((v_ft ->> 0)::int, 0) >= 50 AND (v_ft ->> 1)::numeric / (v_ft ->> 0)::numeric >= 0.8 THEN
    v_ids := array_append(v_ids, 'flop_master');
  END IF;
  IF (SELECT count(*) FROM auth.users u WHERE u.created_at < (SELECT created_at FROM auth.users WHERE id = p_user)) < 500 THEN
    v_ids := array_append(v_ids, 'founding_member');
  END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT p_user, a.id FROM public.achievements a WHERE a.id = ANY (v_ids)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_skill_stats(p_user uuid, p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb := public.compute_skill_stats(p_user, p_now);
BEGIN
  INSERT INTO public.user_skill_stats (user_id, stats, refreshed_at) VALUES (p_user, v, p_now)
  ON CONFLICT (user_id) DO UPDATE SET stats = EXCLUDED.stats, refreshed_at = EXCLUDED.refreshed_at;
  PERFORM public.award_social_badges(p_user, v);
  RETURN v;
END;
$$;

-- Cron (service role): users active in the last 2 days, oldest cache first.
CREATE OR REPLACE FUNCTION public.refresh_active_skill_stats(p_limit integer DEFAULT 2000)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid;
  n integer := 0;
BEGIN
  FOR u IN
    SELECT a.user_id FROM (
      SELECT user_id FROM public.xp_events WHERE earned_at > now() - interval '2 days'
      UNION SELECT user_id FROM public.trainer_hand_log WHERE played_at > now() - interval '2 days'
      UNION SELECT user_id FROM public.hh_hands WHERE created_at > now() - interval '2 days'
    ) a LEFT JOIN public.user_skill_stats s ON s.user_id = a.user_id
    ORDER BY s.refreshed_at NULLS FIRST
    LIMIT p_limit
  LOOP
    PERFORM public.refresh_skill_stats(u);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- ── Profile read ────────────────────────────────────────────────────────────

-- NULL = no such handle, or the two have blocked each other (a 404 either way).
-- {visible: false, …card} = exists but the viewer may not see it.
CREATE OR REPLACE FUNCTION public.get_profile(p_handle text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p       record;
  v_uid   uuid := auth.uid();
  v_owner boolean;
  v_stats boolean;
  s       record;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE handle = lower(ltrim(btrim(coalesce(p_handle, '')), '@'));
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_owner := v_uid IS NOT NULL AND v_uid = p.id;
  IF NOT v_owner AND v_uid IS NOT NULL AND public.are_blocked(v_uid, p.id) THEN RETURN NULL; END IF;

  IF NOT public.can_view_profile(v_uid, p.id) THEN
    RETURN public.social_card(p.id) || jsonb_build_object(
      'visible', false, 'profile_visibility', p.profile_visibility,
      'banned', p.banned_until = 'infinity');
  END IF;

  v_stats := v_owner OR public.is_moderator(v_uid) OR public.can_view(v_uid, p.id, p.stats_visibility);
  SELECT * INTO s FROM public.user_skill_stats WHERE user_id = p.id;

  RETURN public.social_card(p.id) - 'badges' || jsonb_build_object(
    'visible', true,
    'is_owner', v_owner,
    'bio', CASE WHEN p.bio_hidden_at IS NULL THEN p.bio END,
    'sites', CASE WHEN p.bio_hidden_at IS NULL THEN to_jsonb(p.sites) ELSE '[]'::jsonb END,
    'member_since', p.created_at,
    'profile_visibility', p.profile_visibility,
    'stats_visibility', p.stats_visibility,
    'stats_visible', v_stats,
    'stats', CASE WHEN v_stats THEN s.stats END,
    'stats_refreshed_at', CASE WHEN v_stats THEN s.refreshed_at END,
    'badges', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description, 'icon', a.icon,
                                          'tier', a.tier, 'earned_at', ua.earned_at)
                       ORDER BY public.badge_rank(a.id, a.tier), ua.earned_at)
        FROM public.user_achievements ua JOIN public.achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = p.id), '[]'),
    -- Public shares only (links and friends-only shares are never listed).
    'shares', coalesce((
      SELECT jsonb_agg(x ORDER BY x ->> 'created_at' DESC) FROM (
        SELECT jsonb_build_object(
                 'slug', sh.id, 'question', sh.question, 'created_at', sh.created_at, 'guess_mode', sh.guess_mode,
                 'position', (SELECT pl ->> 'position' FROM jsonb_array_elements(sh.hand -> 'players') pl WHERE pl ->> 'name' = 'Hero' LIMIT 1),
                 'hero_cards', CASE WHEN sh.show_hero_cards THEN sh.hand -> 'heroCards' END,
                 -- Guess mode: the flop at most, so the list never spoils the spot.
                 'board', CASE WHEN sh.guess_mode THEN '[]'::jsonb ELSE
                   coalesce(sh.hand -> 'board' -> 'flop', '[]') ||
                   CASE WHEN jsonb_typeof(sh.hand -> 'board' -> 'turn') = 'string' THEN jsonb_build_array(sh.hand -> 'board' -> 'turn') ELSE '[]' END ||
                   CASE WHEN jsonb_typeof(sh.hand -> 'board' -> 'river') = 'string' THEN jsonb_build_array(sh.hand -> 'board' -> 'river') ELSE '[]' END END) AS x
          FROM public.hand_shares sh
         WHERE sh.owner_id = p.id AND sh.visibility = 'public' AND sh.revoked_at IS NULL AND sh.hidden_at IS NULL
         ORDER BY sh.created_at DESC LIMIT 12) q), '[]')
  );
END;
$$;

-- Recompute a profile's stats when the cache is old: an hour for visitors,
-- five minutes for the owner. Returns true when it refreshed.
CREATE OR REPLACE FUNCTION public.refresh_profile_stats(p_handle text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id    uuid;
  v_age   interval;
  v_prof  jsonb := public.get_profile(p_handle);
BEGIN
  IF v_prof IS NULL OR NOT coalesce((v_prof ->> 'stats_visible')::boolean, false) THEN RETURN false; END IF;
  SELECT id INTO v_id FROM public.profiles WHERE handle = lower(ltrim(btrim(p_handle), '@'));
  SELECT now() - refreshed_at INTO v_age FROM public.user_skill_stats WHERE user_id = v_id;
  IF v_age IS NOT NULL AND v_age < (CASE WHEN v_id = auth.uid() THEN interval '5 minutes' ELSE interval '1 hour' END) THEN
    RETURN false;
  END IF;
  PERFORM public.refresh_skill_stats(v_id);
  RETURN true;
END;
$$;

-- ── Profile edit ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.profile_sites_allowed()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ggpoker', 'pokerstars', '888poker', 'partypoker', 'wpt_global', 'acr', 'ipoker', 'winamax', 'coinpoker', 'live'];
$$;

-- {"ok": true} or {"ok": false, "error": invalid | text_*}
CREATE OR REPLACE FUNCTION public.update_my_profile(p_bio text, p_sites text[], p_profile_visibility text, p_stats_visibility text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bio text;
  v_sites text[];
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF p_profile_visibility NOT IN ('public', 'friends', 'private') OR p_stats_visibility NOT IN ('public', 'friends', 'private') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  SELECT coalesce(array_agg(DISTINCT s ORDER BY s), '{}') INTO v_sites
    FROM unnest(coalesce(p_sites, '{}')) s WHERE s = ANY (public.profile_sites_allowed());
  IF nullif(btrim(p_bio), '') IS NOT NULL THEN
    BEGIN
      v_bio := public.social_check_text(p_bio, 160);
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      RETURN jsonb_build_object('ok', false, 'error', replace(v_msg, 'social:', ''));
    END;
  END IF;
  UPDATE public.profiles
     SET bio = v_bio, sites = v_sites, profile_visibility = p_profile_visibility, stats_visibility = p_stats_visibility
   WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- p_path: '<user id>/<file>' already uploaded to the avatars bucket; NULL removes it.
CREATE OR REPLACE FUNCTION public.set_my_avatar(p_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF p_path IS NOT NULL AND p_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]{1,80}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  PERFORM public.social_rate_hit(auth.uid(), 'avatar');
  UPDATE public.profiles SET avatar_path = p_path WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

INSERT INTO public.social_limits (action, plan, max_count, window_seconds) VALUES ('avatar', 'all', 10, 3600)
ON CONFLICT (action, plan) DO NOTHING;

-- my_social_profile() gains the avatar.
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
           'avatar', p.avatar_path,
           'profile_visibility', p.profile_visibility,
           'stats_visibility', p.stats_visibility,
           'role', p.role,
           'banned_until', p.banned_until,
           'ban_reason', p.ban_reason)
    FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.badge_rank(text, text)                         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_windows(jsonb, timestamptz)              FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_skill_stats(uuid, timestamptz)         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_social_badges(uuid, jsonb)               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_skill_stats(uuid, timestamptz)         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_active_skill_stats(integer)            FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_sites_allowed()                        FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_skill_stats(integer)         TO service_role;

REVOKE ALL ON FUNCTION public.get_profile(text)                              FROM public;
REVOKE ALL ON FUNCTION public.refresh_profile_stats(text)                    FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile(text)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_stats(text)                 TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text[], text, text)    FROM public, anon;
REVOKE ALL ON FUNCTION public.set_my_avatar(text)                            FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_avatar(text)                         TO authenticated;

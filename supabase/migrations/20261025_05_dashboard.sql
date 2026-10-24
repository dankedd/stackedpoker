-- ============================================================
-- Dashboard: one read for every block on /dashboard
-- Run in the Supabase SQL Editor AFTER supabase_subscriptions.sql,
-- supabase_hand_history*.sql (incl. _summary and _flop),
-- supabase_preflop_trainer_xp.sql, supabase_flop_trainer.sql and
-- supabase_retention.sql. The social parts read their tables only when those
-- exist (20261024_02_social_foundation.sql, 20261025_03_hand_shares.sql), so
-- the order against the social migrations does not matter.
-- Idempotent: safe to re-run.
--
-- my_dashboard(p_skill_days) returns raw counts only. Every threshold
-- (minimum samples, how "new" a tournament is, how many leaks) lives in
-- frontend/lib/dashboard/config.ts, which also decides what the blocks say.
--
-- hh_tournaments.reviewed_at: when the user first looked at the tournament
-- (its summary page or one of its hands in the replayer). The dashboard's
-- "3 new mistakes found in your last tournament" only counts unreviewed ones.
-- ============================================================

ALTER TABLE public.hh_tournaments
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Existing tournaments: a computed summary means the summary page was opened;
-- anything older than a week is not news any more either way.
UPDATE public.hh_tournaments
   SET reviewed_at = COALESCE(summary_at, created_at)
 WHERE reviewed_at IS NULL
   AND (summary_at IS NOT NULL OR created_at < now() - interval '7 days');

-- Marks the caller's tournament as reviewed, by tournament id or by one of its
-- hands. Only the first call counts. Returns whether anything changed.
CREATE OR REPLACE FUNCTION public.hh_mark_reviewed(p_tournament uuid DEFAULT NULL, p_hand uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.hh_tournaments t
     SET reviewed_at = now()
   WHERE t.user_id = auth.uid()
     AND t.reviewed_at IS NULL
     AND (t.id = p_tournament
          OR EXISTS (SELECT 1 FROM public.hh_hands h
                      WHERE h.id = p_hand AND h.user_id = t.user_id
                        AND h.site = t.site AND h.tournament_id = t.tournament_id));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_mark_reviewed(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hh_mark_reviewed(uuid, uuid) TO authenticated;

-- ── The read ────────────────────────────────────────────────────────────────
--
-- {
--   hands:  { imported, tournaments }                     site <> 'manual'
--   last_tournament: { id, name, site, created_at, hand_count, reviewed,
--                      mistakes, score } | null            latest import
--   leaks:  [ { hand_id, tournament_id, played_at, hand, position, street,
--               verdict, chart, board, pot_bb } ]           3 newest mistakes
--   skill:  { days,
--             preflop: { open: [n, good], defense: [...], pushfold: [...] },
--             preflop_spots: [ [ref, n, wrong] ],          kind:chart, worst first
--             flop: { n, good, categories: { <category>: [n, good] } },
--             week: [ [n, good] this 7 days, [n, good] the 7 before ] }
--   social: null | { friends, requests: [card], unread: { <type>: n },
--                    shares: [...], feed: [...] }          only when the tables exist
-- }
--
-- Mistakes are the same as the tournament summary's (summary/compute.ts):
-- preflop too_loose / too_tight / wrong_action, flop questionable. Free users
-- only see their latest tournament's hands (the hh_hands RLS rule), so leaks
-- follow the same rule here.
CREATE OR REPLACE FUNCTION public.my_dashboard(p_skill_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_since  timestamptz := now() - make_interval(days => GREATEST(1, LEAST(p_skill_days, 365)));
  v_full   boolean;
  v_latest public.hh_tournaments;
  v_hands  jsonb;
  v_last   jsonb;
  v_leaks  jsonb;
  v_skill  jsonb;
  v_social jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  v_full := public.hh_full_history();

  -- Hands and tournaments imported (manual hands are entered, not imported).
  SELECT jsonb_build_object(
           'imported',    (SELECT count(*) FROM public.hh_hands h WHERE h.user_id = v_uid AND h.site <> 'manual'),
           'tournaments', (SELECT count(*) FROM public.hh_tournaments t WHERE t.user_id = v_uid AND t.site <> 'manual'))
    INTO v_hands;

  SELECT t.* INTO v_latest FROM public.hh_tournaments t
   WHERE t.user_id = v_uid AND t.site <> 'manual'
   ORDER BY t.created_at DESC, t.last_hand_at DESC NULLS LAST, t.id DESC
   LIMIT 1;
  IF v_latest.id IS NOT NULL THEN
    v_last := jsonb_build_object(
      'id', v_latest.id,
      'name', v_latest.name,
      'site', v_latest.site,
      'created_at', v_latest.created_at,
      'hand_count', v_latest.hand_count,
      'reviewed', v_latest.reviewed_at IS NOT NULL,
      'score', v_latest.score,
      'mistakes', (SELECT count(*) FROM public.hh_hands h
                    WHERE h.user_id = v_uid AND h.site = v_latest.site AND h.tournament_id = v_latest.tournament_id
                      AND (h.preflop_check IN ('too_loose', 'too_tight', 'wrong_action') OR h.flop_check = 'questionable')));
  END IF;

  -- The newest mistakes the user can open.
  SELECT COALESCE(jsonb_agg(x ORDER BY x.played_at DESC), '[]'::jsonb) INTO v_leaks
    FROM (
      SELECT h.id AS hand_id,
             t.id AS tournament_id,
             h.played_at,
             h.hero_hand AS hand,
             COALESCE(h.preflop_position, h.hero_position) AS position,
             CASE WHEN h.preflop_check IN ('too_loose', 'too_tight', 'wrong_action') THEN 'preflop' ELSE 'flop' END AS street,
             CASE WHEN h.preflop_check IN ('too_loose', 'too_tight', 'wrong_action') THEN h.preflop_check ELSE h.flop_check END AS verdict,
             NULLIF(concat_ws(':', h.preflop_detail #>> '{range,kind}', h.preflop_detail #>> '{range,chart}'), '') AS chart,
             h.board,
             h.pot_bb
        FROM public.hh_hands h
        LEFT JOIN public.hh_tournaments t
          ON t.user_id = h.user_id AND t.site = h.site AND t.tournament_id = h.tournament_id
       WHERE h.user_id = v_uid
         AND (h.preflop_check IN ('too_loose', 'too_tight', 'wrong_action') OR h.flop_check = 'questionable')
         AND (v_full OR (h.site = v_latest.site AND h.tournament_id = v_latest.tournament_id))
       ORDER BY h.played_at DESC, h.id DESC
       LIMIT 3
    ) x;

  -- Trainer skill over the last p_skill_days. Good preflop = correct or mixed
  -- (as in the day-3 email); good flop = within the trainer's "good" band.
  SELECT jsonb_build_object(
    'days', GREATEST(1, LEAST(p_skill_days, 365)),
    'preflop', (
      SELECT COALESCE(jsonb_object_agg(k.kind, jsonb_build_array(k.n, k.good)), '{}'::jsonb)
        FROM (SELECT split_part(l.hand_ref, ':', 1) AS kind, count(*) AS n, count(*) FILTER (WHERE l.verdict <> 'wrong') AS good
                FROM public.trainer_hand_log l
               WHERE l.user_id = v_uid AND l.played_at > v_since AND l.hand_ref IS NOT NULL
                 AND split_part(l.hand_ref, ':', 1) IN ('open', 'defense', 'pushfold')
               GROUP BY 1) k),
    'preflop_spots', (
      SELECT COALESCE(jsonb_agg(jsonb_build_array(s.ref, s.n, s.wrong) ORDER BY s.wrong::numeric / s.n DESC, s.wrong DESC, s.ref), '[]'::jsonb)
        FROM (SELECT split_part(l.hand_ref, ':', 1) || ':' || split_part(l.hand_ref, ':', 2) AS ref,
                     count(*) AS n, count(*) FILTER (WHERE l.verdict = 'wrong') AS wrong
                FROM public.trainer_hand_log l
               WHERE l.user_id = v_uid AND l.played_at > v_since AND l.hand_ref LIKE '%:%'
               GROUP BY 1
              HAVING count(*) FILTER (WHERE l.verdict = 'wrong') > 0
               ORDER BY count(*) FILTER (WHERE l.verdict = 'wrong')::numeric / count(*) DESC
               LIMIT 10) s),
    'flop', (
      SELECT jsonb_build_object(
               'n', COALESCE(sum(c.n), 0),
               'good', COALESCE(sum(c.good), 0),
               'categories', COALESCE(jsonb_object_agg(c.category, jsonb_build_array(c.n, c.good)) FILTER (WHERE c.category IS NOT NULL), '{}'::jsonb))
        FROM (SELECT a.category, count(*) AS n, count(*) FILTER (WHERE a.verdict IN ('perfect', 'good')) AS good
                FROM public.flop_trainer_answers a
               WHERE a.user_id = v_uid AND a.created_at > v_since
               GROUP BY 1) c),
    'week', jsonb_build_array(
      (SELECT jsonb_build_array(count(*), count(*) FILTER (WHERE g)) FROM (
         SELECT l.verdict <> 'wrong' AS g FROM public.trainer_hand_log l WHERE l.user_id = v_uid AND l.played_at > now() - interval '7 days'
         UNION ALL
         SELECT a.verdict IN ('perfect', 'good') FROM public.flop_trainer_answers a WHERE a.user_id = v_uid AND a.created_at > now() - interval '7 days') w),
      (SELECT jsonb_build_array(count(*), count(*) FILTER (WHERE g)) FROM (
         SELECT l.verdict <> 'wrong' AS g FROM public.trainer_hand_log l
          WHERE l.user_id = v_uid AND l.played_at > now() - interval '14 days' AND l.played_at <= now() - interval '7 days'
         UNION ALL
         SELECT a.verdict IN ('perfect', 'good') FROM public.flop_trainer_answers a
          WHERE a.user_id = v_uid AND a.created_at > now() - interval '14 days' AND a.created_at <= now() - interval '7 days') w))
  ) INTO v_skill;

  -- Social (Phase 0 tables: friendships, notifications; Phase 1: hand_shares).
  -- Statements in an untaken branch are never planned, so a missing table is fine.
  IF to_regclass('public.friendships') IS NOT NULL AND to_regclass('public.notifications') IS NOT NULL THEN
    v_social := jsonb_build_object(
      'friends', (SELECT count(*) FROM public.friendships f
                   WHERE f.status = 'accepted' AND v_uid IN (f.requester_id, f.addressee_id)),
      'requests', (SELECT COALESCE(jsonb_agg(public.social_card(f.requester_id) ORDER BY f.created_at DESC), '[]'::jsonb)
                     FROM (SELECT * FROM public.friendships f
                            WHERE f.addressee_id = v_uid AND f.status = 'pending'
                              AND NOT public.are_blocked(f.requester_id, v_uid)
                            ORDER BY f.created_at DESC LIMIT 5) f),
      'unread', (SELECT COALESCE(jsonb_object_agg(n.type, n.c), '{}'::jsonb)
                   FROM (SELECT type, count(*) AS c FROM public.notifications
                          WHERE user_id = v_uid AND read_at IS NULL GROUP BY type) n),
      'shares', '[]'::jsonb,
      'feed', '[]'::jsonb);

    IF to_regclass('public.hand_shares') IS NOT NULL THEN
      -- My shares: views, votes and the top choice.
      v_social := v_social || jsonb_build_object('shares', (
        SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
          SELECT s.id AS slug, s.question, s.guess_mode, s.created_at, s.view_count AS views,
                 s.hand -> 'heroCards' AS hero_cards,
                 (SELECT count(*) FROM public.hand_guesses g WHERE g.share_id = s.id) AS votes,
                 (SELECT jsonb_build_array(g.choice, count(*)) FROM public.hand_guesses g
                   WHERE g.share_id = s.id GROUP BY g.choice ORDER BY count(*) DESC, g.choice LIMIT 1) AS top
            FROM public.hand_shares s
           WHERE s.owner_id = v_uid AND s.revoked_at IS NULL
           ORDER BY s.created_at DESC
           LIMIT 3) x));

      -- Friends' hands I may see, newest first, with my vote if I voted.
      v_social := v_social || jsonb_build_object('feed', (
        SELECT COALESCE(jsonb_agg(x ORDER BY x.at DESC), '[]'::jsonb) FROM (
          SELECT 'share' AS kind, s.created_at AS at, public.social_card(s.owner_id) AS actor,
                 s.id AS slug, s.question, s.guess_mode, s.decision_options AS options,
                 public.share_viewer_guess(s.id, NULL) AS my_choice,
                 (SELECT count(*) FROM public.hand_guesses g WHERE g.share_id = s.id) AS votes
            FROM public.hand_shares s
           WHERE s.owner_id <> v_uid
             AND s.revoked_at IS NULL AND s.hidden_at IS NULL
             AND s.visibility IN ('friends', 'public')
             AND public.are_friends(v_uid, s.owner_id)
             AND NOT public.are_blocked(v_uid, s.owner_id)
             AND s.created_at > now() - interval '14 days'
           ORDER BY s.created_at DESC
           LIMIT 5) x));
    END IF;

    -- Friends' day streaks that just reached a milestone.
    v_social := jsonb_set(v_social, '{feed}', (v_social -> 'feed') || COALESCE((
      SELECT jsonb_agg(jsonb_build_object('kind', 'streak', 'at', now(), 'actor', public.social_card(m.friend), 'streak', m.streak))
        FROM (SELECT fr.friend, (public.activity_streak(fr.friend) ->> 'streak')::integer AS streak
                FROM (SELECT CASE WHEN f.requester_id = v_uid THEN f.addressee_id ELSE f.requester_id END AS friend
                        FROM public.friendships f
                       WHERE f.status = 'accepted' AND v_uid IN (f.requester_id, f.addressee_id)
                       ORDER BY f.responded_at DESC NULLS LAST
                       LIMIT 50) fr
               WHERE NOT public.are_blocked(v_uid, fr.friend)) m
       WHERE m.streak IN (7, 14, 30, 50, 100, 200, 365)), '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'hands', v_hands,
    'last_tournament', v_last,
    'leaks', v_leaks,
    'skill', v_skill,
    'social', v_social);
END;
$$;

REVOKE ALL ON FUNCTION public.my_dashboard(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_dashboard(integer) TO authenticated;

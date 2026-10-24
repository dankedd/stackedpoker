-- Tests for supabase/migrations/20261025_04_profiles_stats.sql (run by supabase/tests/run.sh,
-- after hand_shares.test.sql: dd1 = dan (dan_the_man), dd2 = eve (dan's friend),
-- dd3 = finn (stranger), dd4 = gus (blocked by dan), c55 = pro_player).
\set ON_ERROR_STOP on
\set QUIET on

-- Dan's history: hand review + trainers.
INSERT INTO public.hh_hands (id, user_id, site, hand_id, played_at, small_blind, big_blind, player_count, last_street,
                             pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown, hero_all_in,
                             data, raw_text, parser, parser_version, preflop_check, preflop_detail, flop_check)
VALUES
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'P1', now() - interval '2 days', 100, 200, 2, 'flop',
   600, 3, 0, 0, false, false, false, test.share_snapshot(), 'raw', 'ggpoker', 1, 'correct', '{"spot": {"kind": "rfi"}}', 'good'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'P2', now() - interval '3 days', 100, 200, 2, 'flop',
   600, 3, 0, 0, false, false, false, test.share_snapshot(), 'raw', 'ggpoker', 1, 'too_tight', '{"spot": {"kind": "vs_open"}}', 'questionable'),
  ('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'P3', now() - interval '4 days', 100, 200, 2, 'preflop',
   600, 3, 0, 0, false, false, false, test.share_snapshot(), 'raw', 'ggpoker', 1, 'correct', '{"spot": {"kind": "vs_push"}}', NULL),
  ('00000000-0000-0000-0000-0000000e0004', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'P4', now() - interval '5 days', 100, 200, 2, 'preflop',
   600, 3, 0, 0, false, false, false, test.share_snapshot(), 'raw', 'ggpoker', 1, 'not_evaluated', '{"spot": {"kind": "rfi"}}', NULL);
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at)
SELECT '00000000-0000-0000-0000-000000000dd1', r, v, at FROM (VALUES
  ('open:o1:25:AKo', 'correct', now()), ('open:o1:25:AQo', 'correct', now()), ('open:o1:25:AJo', 'correct', now()),
  ('open:o1:25:ATo', 'correct', now()), ('defense:d1:25:K9o', 'wrong', now()), ('defense:d1:25:Q9o', 'wrong', now() - interval '40 days'),
  ('pushfold:p1:10:A2o', 'mixed', now())) t(r, v, at);
INSERT INTO public.trainer_highscores (user_id, trainer_key, current_streak, best_streak)
VALUES ('00000000-0000-0000-0000-000000000dd1', 'preflop-ranges', 4, 11);
INSERT INTO public.flop_trainer_answers (user_id, category, verdict)
SELECT '00000000-0000-0000-0000-000000000dd1', 'paired', CASE WHEN i <= 6 THEN 'miss' ELSE 'good' END FROM generate_series(1, 12) i;
INSERT INTO public.flop_trainer_answers (user_id, category, verdict)
SELECT '00000000-0000-0000-0000-000000000dd1', 'ace_high', 'perfect' FROM generate_series(1, 12) i;
INSERT INTO public.flop_versus_answers (user_id, correct) VALUES
  ('00000000-0000-0000-0000-000000000dd1', true), ('00000000-0000-0000-0000-000000000dd1', true);
-- pro_player trained 100 spots.
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict)
SELECT '00000000-0000-0000-0000-000000000c55', 'open:o1:25:AKo', 'correct' FROM generate_series(1, 100);

\echo '── skill stats'
DO $$
DECLARE s jsonb := public.compute_skill_stats('00000000-0000-0000-0000-000000000dd1');
BEGIN
  PERFORM test.eq(s -> 'preflop' -> 'opens' -> 'all', '[5, 5]'::jsonb, 'opens: hand review + trainer');
  PERFORM test.eq(s -> 'preflop' -> 'defense' -> 'all', '[3, 0]'::jsonb, 'defense');
  PERFORM test.eq(s -> 'preflop' -> 'pushfold' -> 'all', '[2, 2]'::jsonb, 'push/fold (mixed counts as correct)');
  PERFORM test.eq(s -> 'preflop' -> 'overall' -> 'all', '[10, 7]'::jsonb, 'overall; not_evaluated left out');
  PERFORM test.eq(s -> 'preflop' -> 'defense' -> 'd30', '[2, 0]'::jsonb, 'last 30 days');
  PERFORM test.eq(s -> 'preflop' -> 'defense' -> 'p30', '[1, 0]'::jsonb, 'the 30 days before');
  PERFORM test.eq(s -> 'flop_review' -> 'all', '{"n": 2, "ok": 0, "good": 1, "questionable": 1}'::jsonb, 'flop verdicts');
  PERFORM test.eq(s -> 'flop_trainer' -> 'overall' -> 'all', '[26, 20]'::jsonb, 'flop trainer accuracy');
  PERFORM test.eq(s -> 'weakest_texture' ->> 'category', 'paired', 'weakest texture');
  PERFORM test.eq(s -> 'trainer', '{"spots": 33, "accuracy": [33, 25], "best_streak": 11, "current_streak": 4}'::jsonb, 'trainer totals and streaks');
  PERFORM test.eq((s ->> 'day_streak')::int >= 1, true, 'day streak counts today');
  PERFORM test.eq(public.compute_skill_stats('00000000-0000-0000-0000-000000000dd3') -> 'preflop', '{}'::jsonb, 'no data = empty');
END $$;

\echo '── profile visibility'
SET ROLE anon;
SELECT test.as_user(NULL);
DO $$
DECLARE p jsonb;
BEGIN
  p := public.get_profile('@Dan_The_Man');
  PERFORM test.eq(p ->> 'visible', 'false', 'friends-only profile: signed out sees only the card');
  PERFORM test.eq(p ->> 'handle', 'dan_the_man', 'handle shown');
  PERFORM test.eq(p ? 'stats', false, 'no stats');
  PERFORM test.eq(p ? 'bio', false, 'no bio');
  PERFORM test.eq(public.get_profile('nobody_here'), NULL::jsonb, 'unknown handle');
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), false, 'signed out cannot refresh hidden stats');
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd4');
DO $$ BEGIN
  PERFORM test.eq(public.get_profile('dan_the_man'), NULL::jsonb, 'blocked: profile does not exist');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$ BEGIN
  PERFORM test.eq(public.get_profile('dan_the_man') ->> 'visible', 'false', 'stranger: card only');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd2');
DO $$
DECLARE p jsonb;
BEGIN
  p := public.get_profile('dan_the_man');
  PERFORM test.eq(p ->> 'visible', 'true', 'friend sees the profile');
  PERFORM test.eq(p ->> 'stats_visible', 'true', 'friend may see stats');
  PERFORM test.eq(p -> 'stats', 'null'::jsonb, 'not computed yet');
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), true, 'a viewer triggers the first computation');
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), false, 'not again within the hour');
  p := public.get_profile('dan_the_man');
  PERFORM test.eq(p -> 'stats' -> 'preflop' -> 'opens' -> 'all', '[5, 5]'::jsonb, 'cached stats served');
  PERFORM test.eq(p ? 'username', false, 'private columns never in the profile');
  PERFORM test.eq(p ? 'avatar_url', false, 'Google picture never in the profile');
  PERFORM test.eq(jsonb_path_exists(p -> 'badges', '$[*] ? (@.id == "founding_member")'), true, 'founding member badge (first 500)');
  PERFORM test.eq((SELECT count(*) FROM public.user_skill_stats)::int, 0, 'stats table not readable directly');
END $$;

\echo '── editing'
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$
DECLARE p jsonb;
BEGIN
  PERFORM test.raises($q$UPDATE public.profiles SET bio = 'direct' WHERE id = auth.uid()$q$, 'bio may not be changed', 'bio only through the RPC');
  PERFORM test.eq(public.update_my_profile('nazi stuff', '{}', 'public', 'friends') ->> 'error', 'text_hate', 'bio passes the text filter');
  PERFORM test.eq(public.update_my_profile('MTT reg, shit run lately', ARRAY['ggpoker', 'myspace', 'live', 'ggpoker'], 'public', 'friends') ->> 'ok', 'true', 'profile saved');
  p := public.my_social_profile();
  PERFORM test.eq(p ->> 'bio', 'MTT reg, **** run lately', 'mild swearing masked');
  PERFORM test.eq(p -> 'sites', '["ggpoker", "live"]'::jsonb, 'unknown sites dropped, no duplicates');
  PERFORM test.eq(public.update_my_profile(NULL, NULL, 'everyone', 'friends') ->> 'error', 'invalid', 'bad visibility');
  PERFORM test.eq(public.set_my_avatar('00000000-0000-0000-0000-000000000dd2/me.webp') ->> 'error', 'invalid', 'cannot use someone else''s folder');
  PERFORM test.eq(public.set_my_avatar('00000000-0000-0000-0000-000000000dd1/a1.webp') ->> 'ok', 'true', 'avatar set');
  PERFORM test.eq(public.get_profile('dan_the_man') ->> 'avatar', '00000000-0000-0000-0000-000000000dd1/a1.webp', 'avatar on the card');
  PERFORM test.raises($q$INSERT INTO public.user_achievements VALUES (auth.uid(), 'streak_30')$q$, 'row-level security', 'cannot award yourself a badge');
  -- A public guess-mode share shows up on the profile without its board.
  PERFORM public.create_hand_share('00000000-0000-0000-0000-0000000e0001', test.share_snapshot(), 'public', true, true, true,
                                   'Spot?', 7, ARRAY['fold', 'call', 'raise'], 'call');
  PERFORM public.create_hand_share('00000000-0000-0000-0000-0000000e0001', test.share_snapshot(), 'link');
  p := public.get_profile('dan_the_man');
  PERFORM test.eq(p ->> 'is_owner', 'true', 'owner flag');
  PERFORM test.eq(jsonb_array_length(p -> 'shares'), 1, 'only public shares listed');
  PERFORM test.eq(p -> 'shares' -> 0 -> 'board', '[]'::jsonb, 'guess-mode share lists no board');
  PERFORM test.eq(p -> 'shares' -> 0 ->> 'position', 'BTN', 'hero position listed');
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), false, 'owner: not within 5 minutes either');
END $$;
RESET ROLE;
UPDATE public.user_skill_stats SET refreshed_at = now() - interval '6 minutes' WHERE user_id = '00000000-0000-0000-0000-000000000dd1';
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$ BEGIN
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), true, 'owner refreshes after 5 minutes');
  PERFORM test.eq(jsonb_path_exists(public.get_profile('dan_the_man') -> 'badges', '$[*] ? (@.id == "first_share")'), true, 'first share badge');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd2');
DO $$ BEGIN
  PERFORM test.eq(public.refresh_profile_stats('dan_the_man'), false, 'visitors wait an hour');
END $$;
RESET ROLE;

SET ROLE anon;
SELECT test.as_user(NULL);
DO $$
DECLARE p jsonb;
BEGIN
  p := public.get_profile('dan_the_man');
  PERFORM test.eq(p ->> 'visible', 'true', 'public profile: signed out sees it');
  PERFORM test.eq(p ->> 'stats_visible', 'false', 'stats stay friends-only');
  PERFORM test.eq(p -> 'stats', 'null'::jsonb, 'no stats payload');
  PERFORM test.eq(p ->> 'bio', 'MTT reg, **** run lately', 'bio shown');
END $$;
RESET ROLE;

\echo '── moderation + cron'
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c54');
DO $$ BEGIN
  PERFORM public.mod_set_hidden('profile', '00000000-0000-0000-0000-000000000dd1', true, 'ad');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$
DECLARE p jsonb;
BEGIN
  p := public.get_profile('dan_the_man');
  PERFORM test.eq(p ->> 'bio', NULL, 'hidden profile: no bio');
  PERFORM test.eq(p -> 'sites', '[]'::jsonb, 'no sites');
  PERFORM test.eq(p ->> 'avatar', NULL, 'no avatar');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM test.eq(public.refresh_active_skill_stats() >= 2, true, 'cron refreshes recently active users');
  PERFORM test.eq(EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = '00000000-0000-0000-0000-000000000c55' AND achievement_id = 'spots_100'), true, '100 spots badge');
END $$;
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$ BEGIN
  PERFORM test.raises($q$SELECT public.refresh_active_skill_stats()$q$, 'permission denied', 'only the cron may refresh everyone');
END $$;
RESET ROLE;
-- Leave the shared fixtures as later suites expect them: no extra shares.
DELETE FROM public.hand_shares WHERE hand_id = '00000000-0000-0000-0000-0000000e0001';
\echo 'social profiles: all tests passed'

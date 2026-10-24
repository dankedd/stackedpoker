-- Production-like state BEFORE the rebalance (run_xp_rebalance.sh).
--   a1  Learn + trainer XP, 900 XP without a ledger row, a Learn step today
--   a2  trainer only
--   a3  'unknown' + a little Learn
--   a4  no XP

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test'),
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test'),
  ('00000000-0000-0000-0000-0000000000a4', 'a4@test');
INSERT INTO public.profiles (id, display_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Learner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Grinder'),
  ('00000000-0000-0000-0000-0000000000a3', NULL),
  ('00000000-0000-0000-0000-0000000000a4', NULL);

INSERT INTO public.xp_events (user_id, amount, source_type, source_id, earned_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 1000, 'step',              'l1:s1',      now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000a1', 2000, 'lesson_completion', 'l1',         now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000a1',  500, 'module_completion', 'm1',         now() - interval '29 days'),
  ('00000000-0000-0000-0000-0000000000a1',   30, 'achievement',       'streak_3',   now() - interval '28 days'),
  ('00000000-0000-0000-0000-0000000000a1',   20, 'step',              'l2:s1',      now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000a1',  120, 'preflop_trainer',   'open:x:25:AKs', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a1',   60, 'flop_equity',       'srp:AcQd3h', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a2',  300, 'preflop_trainer',   'open:x:25:QQ',  now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a3',   50, 'unknown',           NULL,         now() - interval '80 days'),
  ('00000000-0000-0000-0000-0000000000a3',   10, 'step',              'l1:s1',      now() - interval '80 days');

INSERT INTO public.user_skill_progress (user_id, total_xp, level, streak_days) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 1000 + 2000 + 500 + 30 + 20 + 120 + 60 + 900, 9, 3),
  ('00000000-0000-0000-0000-0000000000a2', 300, 1, 0),
  ('00000000-0000-0000-0000-0000000000a3', 60, 1, 0),
  ('00000000-0000-0000-0000-0000000000a4', 0, 1, 0);

INSERT INTO public.user_achievements (user_id, achievement_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'streak_3');

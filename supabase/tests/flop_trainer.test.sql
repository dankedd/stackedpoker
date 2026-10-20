-- Flop Equity Trainer SQL: record_flop_trainer_answer, record_flop_versus_answer,
-- flop_trainer_state and the README's analytics queries, against a throwaway
-- Postgres (supabase/tests/run_flop_trainer.sh). Raises on the first failure.

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_skill_progress (user_id) VALUES ('00000000-0000-0000-0000-0000000000f1') ON CONFLICT DO NOTHING;

DO $$
DECLARE
  u  constant uuid := '00000000-0000-0000-0000-0000000000f1';
  r  record;
  i  integer;
BEGIN
  -- 1. One answer: 3 points -> 3 XP, one xp_event, one answer row.
  SELECT * INTO r FROM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', 'AcQd3h', 'ace_high', 60, 61.5, 'perfect', 'IP', 'IP', 3, 's1');
  ASSERT r.xp_awarded = 3 AND r.total_xp = 3 AND r.session_answers = 1 AND NOT r.too_fast, format('first answer: %s', r);
  ASSERT (SELECT count(*) FROM public.xp_events WHERE user_id = u AND source_type = 'flop_equity') = 1, 'xp_event written';

  -- 2. Too fast: nothing changes.
  SELECT * INTO r FROM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', 'Kc7d2h', 'king_high', 60, 58, 'perfect', 'IP', 'IP', 3, 's1');
  ASSERT r.too_fast AND r.xp_awarded = 0 AND r.session_answers = 1, format('too fast: %s', r);
  ASSERT (SELECT count(*) FROM public.flop_trainer_answers WHERE user_id = u) = 1, 'too-fast answer not stored';

  -- 3. A miss with the c-bet part: stored, no XP, no xp_event (amount must be > 0).
  UPDATE public.trainer_highscores SET last_hand_at = now() - interval '5 seconds' WHERE user_id = u AND trainer_key = 'flop-equity';
  SELECT * INTO r FROM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', '7c6d5h', 'connected', 70, 52, 'miss', 'IP', 'OOP', 0, 's1',
                                                         'high', 'big', false, true);
  ASSERT r.xp_awarded = 0 AND r.session_answers = 2, format('miss: %s', r);
  ASSERT (SELECT cbet_size_ok FROM public.flop_trainer_answers WHERE flop = '7c6d5h'), 'c-bet stored';
  ASSERT (SELECT count(*) FROM public.xp_events WHERE user_id = u) = 1, 'no xp_event for a miss';

  -- 4. Finish the 10-flop session: highscore set, counters reset.
  FOR i IN 3..10 LOOP
    UPDATE public.trainer_highscores SET last_hand_at = now() - interval '5 seconds' WHERE user_id = u AND trainer_key = 'flop-equity';
    SELECT * INTO r FROM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', 'Kc7d2h', 'king_high', 58, 58, 'perfect', 'IP', 'IP', 5, 's1',
                                                           'high', 'big', true, true);
  END LOOP;
  ASSERT r.session_complete AND r.new_record AND r.best_session_points = 3 + 0 + 8 * 5, format('session: %s', r);
  ASSERT (SELECT session_answers FROM public.trainer_highscores WHERE user_id = u AND trainer_key = 'flop-equity') = 0, 'session reset';

  -- 5. Points over 5 are refused.
  BEGIN
    PERFORM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', 'Kc7d2h', 'king_high', 58, 58, 'perfect', 'IP', 'IP', 6, 's2');
    RAISE EXCEPTION 'points 6 accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'invalid points%', SQLERRM;
  END;

  -- 6. Quick fire: right -> 1 XP and streak 1; wrong -> streak 0; shares the daily XP.
  SELECT * INTO r FROM public.record_flop_versus_answer(u, 'srp_bb_vs_bn_40', 'AcQd3h', '7c6d5h', 'a', true, 9.2);
  ASSERT r.xp_awarded = 1 AND r.streak = 1 AND r.best_streak = 1 AND r.daily_xp = 3 + 40 + 1, format('versus right: %s', r);
  UPDATE public.trainer_highscores SET last_hand_at = now() - interval '5 seconds' WHERE user_id = u AND trainer_key = 'flop-versus';
  SELECT * INTO r FROM public.record_flop_versus_answer(u, 'srp_bb_vs_bn_40', 'AcQd3h', '7c6d5h', 'b', false, 9.2);
  ASSERT r.xp_awarded = 0 AND r.streak = 0 AND r.best_streak = 1, format('versus wrong: %s', r);

  -- 7. State: categories with [answers, avg error, hit %] and the quick-fire streak.
  SELECT * INTO r FROM public.flop_trainer_state(u);
  ASSERT r.best_session_points = 43 AND r.versus_best = 1, format('state: %s', r);
  ASSERT (r.categories -> 'connected' ->> 2)::numeric = 0 AND (r.categories -> 'king_high' ->> 2)::numeric = 100, format('categories: %s', r.categories);

  -- 8. The daily cap holds across both modes.
  UPDATE public.trainer_highscores SET daily_xp = 299, last_hand_at = now() - interval '5 seconds' WHERE user_id = u AND trainer_key = 'flop-equity';
  SELECT * INTO r FROM public.record_flop_trainer_answer(u, 'srp_bb_vs_bn_40', 'Kc7d2h', 'king_high', 58, 58, 'perfect', 'IP', 'IP', 3, 's3');
  ASSERT r.xp_awarded = 1 AND r.daily_xp = 300, format('cap: %s', r);
  UPDATE public.trainer_highscores SET last_hand_at = now() - interval '5 seconds' WHERE user_id = u AND trainer_key = 'flop-versus';
  SELECT * INTO r FROM public.record_flop_versus_answer(u, 'srp_bb_vs_bn_40', 'AcQd3h', '7c6d5h', 'a', true, 9.2);
  ASSERT r.xp_awarded = 0 AND r.streak = 1, format('cap versus: %s', r);

  RAISE NOTICE 'flop trainer SQL: all checks passed';
END $$;

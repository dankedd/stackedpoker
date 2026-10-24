-- XP rebalance: voiding, recompute, level table, grant_trainer_xp, the
-- ledger invariant and the client lockdown (supabase/tests/run_xp_rebalance.sh).
-- `levels` = shared/levels.json, passed in by the runner. Raises on the first failure.

\o /dev/null
SELECT set_config('test.levels', :'levels', false);
\o

DO $$
DECLARE
  a1 constant uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 constant uuid := '00000000-0000-0000-0000-0000000000a2';
  a3 constant uuid := '00000000-0000-0000-0000-0000000000a3';
  a4 constant uuid := '00000000-0000-0000-0000-0000000000a4';
  cfg jsonb := current_setting('test.levels')::jsonb;
  r   record;
  n   integer;
  cap integer;
BEGIN
  -- 1. The SQL level table and rules are shared/levels.json.
  SELECT count(*) INTO n FROM public.xp_levels l
  WHERE l.min_xp = (cfg -> 'thresholds' ->> (l.level - 1))::integer;
  ASSERT n = jsonb_array_length(cfg -> 'thresholds') AND n = (cfg -> 'curve' ->> 'max_level')::integer,
    format('xp_levels differs from shared/levels.json (%s rows match)', n);
  ASSERT (SELECT title FROM public.xp_levels WHERE level = 10) = 'Grinder', 'tier title';
  ASSERT (SELECT value FROM public.xp_rules WHERE key = 'daily_cap') = (cfg -> 'xp' ->> 'daily_cap')::integer, 'daily cap';
  ASSERT (SELECT value FROM public.xp_rules WHERE key = 'streak_percent') = (cfg -> 'xp' -> 'streak_bonus' ->> 'percent')::integer, 'streak %';
  ASSERT (SELECT value FROM public.xp_rules WHERE key = 'hand_review_xp') = (cfg -> 'xp' -> 'hand_review_bonus' ->> 'xp')::integer, 'hand review';
  ASSERT public.xp_level_for(0) = 1 AND public.xp_level_for(1) = 1 AND public.xp_level_for(2) = 2, 'first levels';
  ASSERT public.xp_level_for(265) = 9 AND public.xp_level_for(266) = 10, 'level 10 boundary';
  ASSERT public.xp_level_for(10000000) = 50, 'max level';
  cap := (cfg -> 'xp' ->> 'daily_cap')::integer;

  -- 2. Backups are the state before the first run (the runner ran it twice).
  ASSERT (SELECT count(*) FROM public.xp_events_backup_2026_10) = 10, 'events backup';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'xp_events_backup_2026_10' AND column_name = 'voided_at'),
    'backup is the pre-migration table';
  ASSERT (SELECT total_xp FROM public.user_skill_progress_backup_2026_10 WHERE user_id = a1) = 4630, 'skill backup keeps old total';

  -- 3. Learn events voided, everything else kept.
  ASSERT (SELECT count(*) FROM public.xp_events WHERE void_reason = 'learn_offline') = 7, 'Learn + unknown events voided';
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_events WHERE voided_at IS NOT NULL
                     AND source_type IN ('preflop_trainer', 'flop_equity')), 'trainer XP kept';
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_events WHERE voided_at IS NULL
                     AND source_type IN ('step', 'lesson_completion', 'module_completion', 'achievement', 'guest_merge', 'unknown')), 'no live Learn XP';

  -- 4. Recomputed totals and levels, no level-up pending from the recompute.
  ASSERT (SELECT total_xp FROM public.user_skill_progress WHERE user_id = a1) = 180, 'a1 trainer XP only';
  ASSERT (SELECT total_xp FROM public.user_skill_progress WHERE user_id = a2) = 300, 'a2 unchanged';
  ASSERT (SELECT total_xp FROM public.user_skill_progress WHERE user_id = a3) = 0, 'a3 unknown voided';
  ASSERT NOT EXISTS (SELECT 1 FROM public.user_skill_progress
                     WHERE level <> public.xp_level_for(total_xp) OR level_seen IS DISTINCT FROM level), 'level = level_seen = new level';
  ASSERT (SELECT level FROM public.user_skill_progress WHERE user_id = a2) = 10, 'a2 is level 10';
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_ledger_drift()), 'total_xp = ledger after the recompute';
  ASSERT (SELECT old_total_xp FROM public.xp_rebalance_2026_10 WHERE user_id = a1) = 4630, 'log keeps first-run old total';
  ASSERT (SELECT levels_notice_pending FROM public.user_skill_progress WHERE user_id = a1), 'notice for a1';
  ASSERT NOT (SELECT levels_notice_pending FROM public.user_skill_progress WHERE user_id = a4), 'no notice without XP';

  -- 5. Trainer XP: preflop correct = 1, shared cap with the flop trainer.
  SELECT * INTO r FROM public.record_preflop_trainer_hand(a4, 'correct', 'open:x:25:AKs');
  ASSERT r.xp_awarded = 1 AND r.total_xp = 1 AND r.daily_xp = 1 AND r.daily_cap = cap AND r.level = 1 AND NOT r.leveled_up,
    format('first hand: %s', r);
  UPDATE public.trainer_highscores SET last_hand_at = NULL WHERE user_id = a4;
  SELECT * INTO r FROM public.record_preflop_trainer_hand(a4, 'correct', 'open:x:25:AKs');
  ASSERT r.total_xp = 2 AND r.level = 2 AND r.previous_level = 1 AND r.leveled_up, format('level 2: %s', r);
  UPDATE public.trainer_highscores SET last_hand_at = NULL WHERE user_id = a4;
  SELECT * INTO r FROM public.record_preflop_trainer_hand(a4, 'wrong', 'open:x:25:72o');
  ASSERT r.xp_awarded = 0 AND r.level = 2 AND NOT r.leveled_up, format('wrong, no repeat level-up: %s', r);

  UPDATE public.xp_daily SET trainer_xp = cap - 1 WHERE user_id = a4;
  SELECT * INTO r FROM public.record_flop_trainer_answer(a4, 'srp_bb_vs_bn_40', 'AcQd3h', 'ace_high', 60, 61.5, 'perfect', 'IP', 'IP', 3, 's1');
  ASSERT r.xp_awarded = 1 AND r.daily_xp = cap, format('flop answer capped by preflop XP: %s', r);
  ASSERT (SELECT xp_awarded FROM public.flop_trainer_answers WHERE user_id = a4) = 1, 'answer log has the capped XP';
  SELECT * INTO r FROM public.record_flop_versus_answer(a4, 'srp_bb_vs_bn_40', 'AcQd3h', '7c6d5h', 'a', true, 9.2);
  ASSERT r.xp_awarded = 0 AND r.daily_xp = cap AND r.streak = 1, format('quick fire after the cap: %s', r);
  SELECT * INTO r FROM public.preflop_trainer_state(a4);
  ASSERT r.daily_xp = cap AND r.daily_cap = cap, format('preflop state shows the shared cap: %s', r);
  SELECT * INTO r FROM public.flop_trainer_state(a4);
  ASSERT r.daily_xp = cap, format('flop state shows the shared cap: %s', r);

  -- 5b. "Today" is one day everywhere: trainer XP counts on the Amsterdam day,
  --     the same day as the daily spot limit (get_entitlements), not the UTC
  --     day. The dashboard showed "Today: 5 spots done" next to "Today 0/150
  --     trainer XP" while the two days differed.
  ASSERT public.xp_day('2026-07-01 22:30+00') = '2026-07-02', 'summer: 00:30 in Amsterdam is already the next day';
  ASSERT public.xp_day('2026-01-01 23:30+00') = '2026-01-02', 'winter: 00:30 in Amsterdam is already the next day';
  ASSERT public.xp_day('2026-07-01 21:59+00') = '2026-07-01', 'summer: 23:59 in Amsterdam is still the same day';
  ASSERT (SELECT bool_and(public.xp_day(t) = public.amsterdam_day(t))
            FROM generate_series('2026-03-28 00:00+00'::timestamptz, '2026-03-30 00:00+00', interval '15 minutes') t),
    'xp day = spot-limit day, also across the DST switch';
  ASSERT EXISTS (SELECT 1 FROM public.xp_daily WHERE user_id = a4 AND day = public.amsterdam_day()), 'XP was counted on the Amsterdam day';
  INSERT INTO public.xp_daily (user_id, day, trainer_xp) VALUES (a4, public.amsterdam_day() - 1, 99);
  SELECT * INTO r FROM public.xp_profile(a4);
  ASSERT r.daily_xp = cap, format('yesterday''s XP is not today''s: %s', r);
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname IN ('grant_trainer_xp', 'hand_review_daily_xp', 'preflop_trainer_state', 'flop_trainer_state', 'xp_profile')
       AND p.prosrc ILIKE '%time zone ''utc''%'
  ), 'no XP function counts the UTC day';

  -- 6. Day streak bonus (activity_streak): day 7 adds 10%, carried in 1/100 XP, max per day.
  INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at)
  SELECT a2, 'x', 'wrong', now() - k * interval '1 day' FROM generate_series(1, 6) k;
  SELECT * INTO r FROM public.grant_trainer_xp(a2, 4, 'preflop_trainer', 'x');
  ASSERT r.xp_awarded = 4 AND r.bonus_xp = 0 AND r.streak_days = 7, format('streak 7, 0.4 carried: %s', r);
  SELECT * INTO r FROM public.grant_trainer_xp(a2, 6, 'preflop_trainer', 'x');
  ASSERT r.bonus_xp = 1, format('carry reaches 1 XP: %s', r);
  ASSERT (SELECT count(*) FROM public.xp_events WHERE user_id = a2 AND source_type = 'streak_bonus') = 1, 'bonus is its own ledger row';
  SELECT * INTO r FROM public.grant_trainer_xp(a2, 140, 'preflop_trainer', 'x');
  ASSERT r.xp_awarded = cap - 10 AND r.bonus_xp = 14 AND (SELECT bonus_xp FROM public.xp_daily WHERE user_id = a2) = 15,
    format('cap + bonus up to the daily max: %s', r);
  SELECT * INTO r FROM public.grant_trainer_xp(a2, 5, 'preflop_trainer', 'x');
  ASSERT r.xp_awarded = 0 AND r.bonus_xp = 0, format('nothing after the cap: %s', r);
  UPDATE public.xp_daily SET trainer_xp = trainer_xp - 20 WHERE user_id = a2;
  SELECT * INTO r FROM public.grant_trainer_xp(a2, 20, 'preflop_trainer', 'x');
  ASSERT r.xp_awarded = 20 AND r.bonus_xp = 0, format('bonus max holds: %s', r);
  UPDATE public.xp_daily SET trainer_xp = cap WHERE user_id = a2;
  -- Below the streak: no bonus (a4 has played one day).
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_events WHERE user_id = a4 AND source_type = 'streak_bonus'), 'no bonus on day 1';
  BEGIN
    PERFORM public.grant_trainer_xp(a2, 5, 'step', 'x');
    RAISE EXCEPTION 'Learn source accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'not a trainer source%', SQLERRM;
  END;

  -- 7. Hand review: first new tournament of the day = +5, once.
  INSERT INTO public.hh_tournaments (user_id, site, tournament_id) VALUES (a3, 'gg', 't1'), (a3, 'gg', 't2');
  ASSERT (SELECT count(*) FROM public.xp_events WHERE user_id = a3 AND source_type = 'hand_review') = 1, 'one hand review bonus';
  ASSERT (SELECT total_xp FROM public.user_skill_progress WHERE user_id = a3) = 5, 'a3 + 5';

  -- 8. Achievements unlock without XP; the level trigger is gone.
  ASSERT public.award_achievement(a4, 'first_lesson'), 'achievement unlocks';
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_events WHERE user_id = a4 AND source_type = 'achievement'), 'no achievement XP';
  UPDATE public.user_skill_progress SET level = 20 WHERE user_id = a4;
  ASSERT NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = a4 AND achievement_id = 'level_20'), 'no level trigger';
  UPDATE public.user_skill_progress SET level = public.xp_level_for(total_xp) WHERE user_id = a4;

  -- 9. The 24h board has no voided XP (a1's Learn step from an hour ago).
  SELECT * INTO r FROM public.leaderboard_my_rank_24h(a1);
  ASSERT NOT FOUND, format('a1 earned nothing live in 24h: %s', r);
  ASSERT NOT EXISTS (SELECT 1 FROM public.leaderboard_24h(50, 0) WHERE user_id = a1), 'a1 not on the 24h board';
  ASSERT (SELECT period_xp FROM public.leaderboard_24h(50, 0) WHERE user_id = a2) = 4 + 6 + 140 + 20 + 15, '24h = live XP only';

  -- 10. Profile split.
  SELECT * INTO r FROM public.xp_profile(a1);
  ASSERT r.total_xp = 180 AND r.preflop_xp = 120 AND r.flop_xp = 60 AND r.levels_notice, format('a1 profile: %s', r);

  -- 11. The invariant still holds after every kind of grant.
  ASSERT NOT EXISTS (SELECT 1 FROM public.xp_ledger_drift()), format('drift: %s', (SELECT array_agg(d) FROM public.xp_ledger_drift() d));
END $$;

-- 12. Signed-in clients: no direct XP writes, own profile + notice only.
SET ROLE authenticated;
\o /dev/null
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
\o
DO $$
DECLARE
  r record;
BEGIN
  UPDATE public.user_skill_progress SET total_xp = 999999 WHERE user_id = auth.uid();
  ASSERT (SELECT total_xp FROM public.user_skill_progress WHERE user_id = auth.uid()) = 180, 'client cannot write total_xp';
  BEGIN
    INSERT INTO public.xp_events (user_id, amount, source_type) VALUES (auth.uid(), 100, 'preflop_trainer');
    RAISE EXCEPTION 'client inserted an xp_event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.grant_trainer_xp(auth.uid(), 10, 'preflop_trainer', 'x');
    RAISE EXCEPTION 'client called grant_trainer_xp';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.increment_user_xp(auth.uid(), 10, 'preflop_trainer', 'x');
    RAISE EXCEPTION 'client called increment_user_xp';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT * INTO r FROM public.my_xp_profile();
  ASSERT r.total_xp = 180 AND r.levels_notice, format('my profile: %s', r);
  PERFORM public.dismiss_levels_notice();
  SELECT * INTO r FROM public.my_xp_profile();
  ASSERT NOT r.levels_notice, 'notice dismissed';
END $$;
RESET ROLE;

DO $$
BEGIN
  ASSERT (SELECT levels_notice_dismissed_at IS NOT NULL FROM public.user_skill_progress
          WHERE user_id = '00000000-0000-0000-0000-0000000000a1'), 'dismissal stored';
END $$;

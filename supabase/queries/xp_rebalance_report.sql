-- Dry run of supabase_xp_rebalance.sql — READ-ONLY, changes nothing.
-- Needs supabase_xp_levels_data.sql (the new level table) to have run. Works
-- before and after the migration (voided_at is read via to_jsonb, so its
-- absence is fine): after it, the Learn rows simply no longer show up.
-- Paste into the Supabase SQL editor; each SELECT is one result set.

-- Old curve (sections 4-5): 500 * 1.10^(level-1) XP per level, xp_calculator before 2026-10.
WITH learn AS (
  SELECT e.*, (e.source_type IN ('step', 'lesson_completion', 'module_completion', 'guest_merge', 'achievement', 'unknown')) AS to_void
  FROM public.xp_events e
  WHERE (to_jsonb(e) ->> 'voided_at') IS NULL
)
-- 1. Per source_type: events and XP, and what gets voided.
SELECT source_type, count(*) AS events, sum(amount) AS xp, bool_or(to_void) AS voided
FROM learn GROUP BY source_type ORDER BY xp DESC;

-- 2. Achievements in the ledger (all are voided: every catalog achievement is a Learn one).
SELECT source_id AS achievement, count(*) AS events, sum(amount) AS xp
FROM public.xp_events e WHERE source_type = 'achievement' AND (to_jsonb(e) ->> 'voided_at') IS NULL
GROUP BY source_id ORDER BY xp DESC;

-- 3. 'unknown' (voided too: Learn awards from before source types): per user and day.
SELECT user_id, earned_at::date AS day, count(*) AS events, sum(amount) AS xp
FROM public.xp_events e WHERE source_type = 'unknown' AND (to_jsonb(e) ->> 'voided_at') IS NULL
GROUP BY 1, 2 ORDER BY xp DESC;

-- 4. Before/after per user, biggest shift first.
WITH RECURSIVE old_curve(level, min_xp) AS (
  SELECT 1, 0::bigint
  UNION ALL
  SELECT level + 1, min_xp + round(500 * power(1.10, level - 1))::bigint FROM old_curve WHERE level < 100
),
per_user AS (
  SELECT s.user_id, s.total_xp AS old_total,
         COALESCE(sum(e.amount) FILTER (WHERE (to_jsonb(e) ->> 'voided_at') IS NULL
           AND e.source_type NOT IN ('step', 'lesson_completion', 'module_completion', 'guest_merge', 'achievement', 'unknown')), 0)::integer AS new_total,
         COALESCE(sum(e.amount) FILTER (WHERE (to_jsonb(e) ->> 'voided_at') IS NULL), 0)::integer AS ledger_now
  FROM public.user_skill_progress s
  LEFT JOIN public.xp_events e ON e.user_id = s.user_id
  GROUP BY s.user_id, s.total_xp
)
SELECT u.user_id,
       public.public_player_name(p.display_name, u.user_id) AS name,
       u.old_total, (SELECT max(level) FROM old_curve WHERE min_xp <= u.old_total) AS old_level,
       u.new_total, public.xp_level_for(u.new_total) AS new_level,
       u.old_total - u.ledger_now AS xp_without_ledger_row,
       u.new_total - u.old_total AS shift
FROM per_user u LEFT JOIN public.profiles p ON p.id = u.user_id
ORDER BY abs(u.new_total - u.old_total) DESC
LIMIT 10;

-- 5. How many users' displayed level number goes down.
WITH RECURSIVE old_curve(level, min_xp) AS (
  SELECT 1, 0::bigint
  UNION ALL
  SELECT level + 1, min_xp + round(500 * power(1.10, level - 1))::bigint FROM old_curve WHERE level < 100
),
per_user AS (
  SELECT s.user_id, s.total_xp AS old_total,
         COALESCE(sum(e.amount) FILTER (WHERE (to_jsonb(e) ->> 'voided_at') IS NULL
           AND e.source_type NOT IN ('step', 'lesson_completion', 'module_completion', 'guest_merge', 'achievement', 'unknown')), 0)::integer AS new_total
  FROM public.user_skill_progress s
  LEFT JOIN public.xp_events e ON e.user_id = s.user_id
  GROUP BY s.user_id, s.total_xp
)
SELECT count(*) FILTER (WHERE public.xp_level_for(new_total) < (SELECT max(level) FROM old_curve WHERE min_xp <= old_total)) AS level_drops,
       count(*) FILTER (WHERE public.xp_level_for(new_total) > (SELECT max(level) FROM old_curve WHERE min_xp <= old_total)) AS level_rises,
       count(*) AS users
FROM per_user;

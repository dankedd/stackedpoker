-- Day-1 / day-3 / day-7 retention per signup_utm.utm_content.
-- Read-only. Run in the Supabase SQL Editor (needs supabase_retention.sql).
--
-- "Active on day N" = at least one xp_event or trainer hand on the user's
-- local calendar day signup_day + N (same definition as the day streak,
-- public.activity_days). A user only counts towards day N once that day has
-- started for them, so young cohorts are not diluted by days that haven't
-- happened yet. Test accounts (@example.invalid, the admin account) are left out.

WITH u AS (
  SELECT au.id,
         COALESCE(NULLIF(au.raw_user_meta_data -> 'signup_utm' ->> 'utm_content', ''), '(none)') AS utm_content,
         public.user_tz(au.id) AS tz,
         (au.created_at AT TIME ZONE public.user_tz(au.id))::date AS signup_day,
         (now() AT TIME ZONE public.user_tz(au.id))::date AS today
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
   WHERE au.email IS NOT NULL
     AND lower(au.email) NOT LIKE '%@example.invalid'
     AND COALESCE(p.subscription_tier, 'free') <> 'admin'
), a AS (
  SELECT u.id, a.day - u.signup_day AS n
    FROM u, public.activity_days(u.id, u.tz) a
)
SELECT
  u.utm_content,
  count(*)                                                                    AS signups,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.id = u.id AND a.n = 0)) AS active_day0,
  count(*) FILTER (WHERE u.today >= u.signup_day + 1)                         AS eligible_d1,
  round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.id = u.id AND a.n = 1))
        / NULLIF(count(*) FILTER (WHERE u.today >= u.signup_day + 1), 0), 1)  AS d1_pct,
  count(*) FILTER (WHERE u.today >= u.signup_day + 3)                         AS eligible_d3,
  round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.id = u.id AND a.n = 3))
        / NULLIF(count(*) FILTER (WHERE u.today >= u.signup_day + 3), 0), 1)  AS d3_pct,
  count(*) FILTER (WHERE u.today >= u.signup_day + 7)                         AS eligible_d7,
  round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.id = u.id AND a.n = 7))
        / NULLIF(count(*) FILTER (WHERE u.today >= u.signup_day + 7), 0), 1)  AS d7_pct,
  -- Looser: came back at all after the signup day.
  round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM a WHERE a.id = u.id AND a.n >= 1))
        / NULLIF(count(*) FILTER (WHERE u.today >= u.signup_day + 1), 0), 1)  AS returned_ever_pct
FROM u
GROUP BY u.utm_content
ORDER BY signups DESC, u.utm_content;

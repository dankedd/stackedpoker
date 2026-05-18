-- ============================================================
-- Achievements Schema
-- Tables: achievements (catalog), user_achievements (earned)
-- Idempotent: ON CONFLICT DO UPDATE throughout
-- ============================================================

-- ── Catalog ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.achievements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '🏆',
  category    TEXT NOT NULL CHECK (category IN ('learning','consistency','mastery','exploration','performance')),
  condition   TEXT NOT NULL,
  xp_bonus    INT  NOT NULL DEFAULT 0,
  tier        TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User earned achievements ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT        NOT NULL REFERENCES public.achievements(id),
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;

CREATE POLICY "user_achievements_select" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_achievements_insert" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON public.achievements (category);
CREATE INDEX IF NOT EXISTS idx_achievements_tier ON public.achievements (tier);

-- ── Seed achievement catalog ───────────────────────────────────────────────

INSERT INTO public.achievements (id, title, description, icon, category, condition, xp_bonus, tier) VALUES

-- Learning
('first_lesson',           'First Steps',             'Completed your first lesson',              '🎯', 'learning',     'Complete 1 lesson',                        25,   'bronze'),
('ten_lessons',            'Knowledge Seeker',        'Completed 10 lessons',                     '📚', 'learning',     'Complete 10 lessons',                      100,  'silver'),
('fifty_lessons',          'Scholar',                 'Completed 50 lessons',                     '🎓', 'learning',     'Complete 50 lessons',                      500,  'gold'),
('path_complete_beginner', 'Foundation Builder',      'Completed the Foundations path',           '🏗️', 'learning',     'Complete all Foundations modules',          300,  'silver'),
('path_complete_intermediate','Range Thinker',        'Completed the Range Thinking path',        '🎰', 'learning',     'Complete all Range Thinking modules',       600,  'gold'),
('path_complete_advanced', 'GTO Warrior',             'Completed the GTO Mastery path',           '⚔️', 'mastery',      'Complete all GTO Mastery modules',          1000, 'gold'),
('path_complete_pro',      'Solver Elite',            'Completed the Pro/Elite path',             '👑', 'mastery',      'Complete all Pro/Elite modules',            2000, 'platinum'),

-- Consistency
('streak_3',               'Consistent',              '3-day learning streak',                    '🔥', 'consistency',  'Study 3 days in a row',                    30,   'bronze'),
('streak_7',               'On Fire',                 '7-day learning streak',                    '🔥', 'consistency',  'Study 7 days in a row',                    100,  'silver'),
('streak_30',              'Unstoppable',             '30-day learning streak',                   '⚡', 'consistency',  'Study 30 days in a row',                   500,  'gold'),

-- Performance
('perfect_lesson',         'Flawless',                'Perfect score on a lesson',                '💎', 'performance',  'Score 100% on any lesson',                 50,   'silver'),
('five_perfects',          'Sharp Mind',              'Five perfect lesson scores',               '🧠', 'performance',  'Score 100% on 5 different lessons',         200,  'gold'),

-- Mastery
('concept_mastered',       'Concept Locked In',       'Mastered a concept (level 5)',             '🔒', 'mastery',      'Reach mastery level 5 on any concept',     75,   'bronze'),
('ten_concepts_mastered',  'Poker Scholar',           'Mastered 10 concepts',                     '📖', 'mastery',      'Reach mastery level 5 on 10 concepts',     400,  'gold'),
('level_10',               'Rising Star',             'Reached Level 10',                         '⭐', 'mastery',      'Reach Level 10',                            250,  'silver'),
('level_20',               'Elite Player',            'Reached Level 20',                         '🌟', 'mastery',      'Reach Level 20',                            1000, 'platinum'),

-- Exploration
('leak_resolved',          'Leak Plugged',            'Resolved your first detected leak',        '🔧', 'exploration',  'Fix a leak identified from hand analysis',  100,  'bronze'),
('coach_conversation',     'Student of the Game',     'Had your first AI coaching session',       '🤝', 'exploration',  'Complete an AI coaching conversation',      50,   'bronze')

ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  category    = EXCLUDED.category,
  condition   = EXCLUDED.condition,
  xp_bonus    = EXCLUDED.xp_bonus,
  tier        = EXCLUDED.tier;


-- ── Helper: award_achievement (called from app logic or triggers) ───────────

CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_xp_bonus INT;
BEGIN
  -- Get XP bonus
  SELECT xp_bonus INTO v_xp_bonus FROM public.achievements WHERE id = p_achievement_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Insert (ignore if already earned)
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    -- Apply XP bonus to user skill progress
    UPDATE public.user_skill_progress
    SET total_xp = total_xp + v_xp_bonus
    WHERE user_id = p_user_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- ── Trigger: auto-award streak achievements after lesson completion ─────────

CREATE OR REPLACE FUNCTION public.check_streak_achievements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_streak INT;
BEGIN
  SELECT streak_days INTO v_streak
  FROM public.user_skill_progress
  WHERE user_id = NEW.user_id;

  IF v_streak >= 3  THEN PERFORM public.award_achievement(NEW.user_id, 'streak_3'); END IF;
  IF v_streak >= 7  THEN PERFORM public.award_achievement(NEW.user_id, 'streak_7'); END IF;
  IF v_streak >= 30 THEN PERFORM public.award_achievement(NEW.user_id, 'streak_30'); END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_streak ON public.user_skill_progress;
CREATE TRIGGER trg_check_streak
  AFTER UPDATE OF streak_days ON public.user_skill_progress
  FOR EACH ROW
  WHEN (NEW.streak_days IS DISTINCT FROM OLD.streak_days)
  EXECUTE FUNCTION public.check_streak_achievements();


-- ── Trigger: auto-award level achievements ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_level_achievements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.level >= 10 THEN PERFORM public.award_achievement(NEW.user_id, 'level_10'); END IF;
  IF NEW.level >= 20 THEN PERFORM public.award_achievement(NEW.user_id, 'level_20'); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_level ON public.user_skill_progress;
CREATE TRIGGER trg_check_level
  AFTER UPDATE OF level ON public.user_skill_progress
  FOR EACH ROW
  WHEN (NEW.level IS DISTINCT FROM OLD.level)
  EXECUTE FUNCTION public.check_level_achievements();


-- ── View: user achievement summary ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_achievement_summary AS
SELECT
  ua.user_id,
  COUNT(*)                                              AS total_earned,
  COUNT(*) FILTER (WHERE a.tier = 'platinum')           AS platinum_count,
  COUNT(*) FILTER (WHERE a.tier = 'gold')               AS gold_count,
  COUNT(*) FILTER (WHERE a.tier = 'silver')             AS silver_count,
  COUNT(*) FILTER (WHERE a.tier = 'bronze')             AS bronze_count,
  SUM(a.xp_bonus)                                       AS total_xp_from_achievements,
  ARRAY_AGG(ua.achievement_id ORDER BY ua.earned_at)    AS earned_ids
FROM public.user_achievements ua
JOIN public.achievements a ON a.id = ua.achievement_id
GROUP BY ua.user_id;

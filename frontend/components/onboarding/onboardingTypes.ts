// Shared onboarding types — the string literals here MUST match the CHECK
// constraints in supabase_skill_assessment_migration.sql exactly, since they
// round-trip straight through to the DB with no server-side remapping.

export type SelfExperience =
  | 'never_played' | 'friends_only' | 'recreational_online'
  | 'regular_cash' | 'studies_poker' | 'advanced' | 'professional'

export type SelfStakes =
  | 'never_played' | 'play_money' | 'nl2' | 'nl5' | 'nl10'
  | 'nl25' | 'nl50' | 'nl100_plus' | 'live_only'

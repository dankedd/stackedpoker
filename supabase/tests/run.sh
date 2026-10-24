#!/usr/bin/env bash
# Runs the billing SQL tests against a throwaway Postgres in Docker:
#   stub of Supabase's auth/roles → existing users → real migrations → tests.
# Never touches a real Supabase project.
#
#   bash supabase/tests/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="billing-sql-test-$$"

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

until docker exec "$NAME" pg_isready -U postgres -q; do sleep 1; done
sleep 1

psql_file() {
  docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X "$@"
}

psql_file < "$ROOT/supabase/tests/_local_supabase_stub.sql"

# Accounts that exist before the migration: no reverse trial for them.
psql_file <<'SQL'
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@test'),
  ('00000000-0000-0000-0000-00000000000e', 'p@test'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test');
INSERT INTO public.profiles (id, subscription_tier) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'free'),
  ('00000000-0000-0000-0000-00000000000e', 'free'),
  ('00000000-0000-0000-0000-00000000000d', 'admin');
SQL

psql_file < "$ROOT/supabase_hand_history.sql"
psql_file < "$ROOT/supabase_hand_history_involved.sql"
psql_file < "$ROOT/supabase_hand_history_preflop.sql"
psql_file < "$ROOT/supabase_hand_history_english.sql"
psql_file < "$ROOT/supabase_hand_history_favorites.sql"
psql_file < "$ROOT/supabase_hand_history_coach.sql"
psql_file < "$ROOT/supabase_hand_history_cards.sql"
psql_file < "$ROOT/supabase_hand_history_unsupported.sql"
psql_file < "$ROOT/supabase_subscriptions.sql"
# Re-running must be safe.
psql_file < "$ROOT/supabase_subscriptions.sql"
psql_file < "$ROOT/supabase/tests/subscriptions.test.sql"
psql_file < "$ROOT/supabase_onboarding.sql"
psql_file < "$ROOT/supabase_onboarding.sql"
psql_file < "$ROOT/supabase/tests/onboarding.test.sql"
psql_file < "$ROOT/supabase_manual_hands.sql"
psql_file < "$ROOT/supabase_manual_hands.sql"
psql_file < "$ROOT/supabase/tests/manual_hands.test.sql"
psql_file < "$ROOT/supabase_hand_history_preflop_defense.sql"
psql_file < "$ROOT/supabase_hand_history_preflop_defense.sql"
psql_file < "$ROOT/supabase/tests/preflop_defense.test.sql"
psql_file < "$ROOT/supabase_hand_history_flop.sql"
psql_file < "$ROOT/supabase_hand_history_flop.sql"
psql_file < "$ROOT/supabase/tests/flop_check.test.sql"
psql_file < "$ROOT/supabase/tests/retention.fixture.sql"
psql_file < "$ROOT/supabase_retention.sql"
psql_file < "$ROOT/supabase_retention.sql"
psql_file < "$ROOT/supabase/tests/retention.test.sql"
psql_file < "$ROOT/supabase/tests/display_name.fixture.sql"
psql_file < "$ROOT/supabase_display_name.sql"
psql_file < "$ROOT/supabase_display_name.sql"
psql_file < "$ROOT/supabase/tests/display_name.test.sql"
psql_file < "$ROOT/supabase/migrations/20261024_01_profile_privileged_columns.sql"
psql_file < "$ROOT/supabase/migrations/20261024_02_social_foundation.sql"
psql_file < "$ROOT/supabase/migrations/20261024_01_profile_privileged_columns.sql"
psql_file < "$ROOT/supabase/migrations/20261024_02_social_foundation.sql"
psql_file < "$ROOT/supabase/tests/social_foundation.test.sql"
psql_file < "$ROOT/supabase/migrations/20261025_01_promo_3m_50.sql"
psql_file < "$ROOT/supabase/migrations/20261025_01_promo_3m_50.sql"
psql_file < "$ROOT/supabase/tests/promo_campaign.test.sql"
psql_file < "$ROOT/supabase/migrations/20261025_03_hand_shares.sql"
psql_file < "$ROOT/supabase/migrations/20261025_03_hand_shares.sql"
psql_file < "$ROOT/supabase/tests/hand_shares.test.sql"
psql_file < "$ROOT/supabase_hand_history_summary.sql"
psql_file < "$ROOT/supabase/migrations/20261025_05_dashboard.sql"
psql_file < "$ROOT/supabase/migrations/20261025_05_dashboard.sql"
psql_file < "$ROOT/supabase/tests/dashboard.test.sql"

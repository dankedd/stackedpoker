/**
 * GDPR data export: everything a user owns, as one JSON document.
 *
 * Read with the user's own session (RLS applies) and always filtered on the
 * owner column, so even a table with a broader SELECT policy only returns
 * the caller's rows. A table that does not exist (yet) or that the user may
 * not read is skipped and listed under `skipped`. Social tables come from
 * export_my_social_data(), which each social migration extends.
 *
 * Add new user-owned tables here.
 */

export const EXPORT_TABLES: { table: string; owner: string }[] = [
  { table: "profiles", owner: "id" },
  { table: "subscriptions", owner: "user_id" },
  { table: "user_onboarding", owner: "user_id" },
  // Hands
  { table: "hh_imports", owner: "user_id" },
  { table: "hh_tournaments", owner: "user_id" },
  { table: "hh_hands", owner: "user_id" },
  { table: "hh_hand_notes", owner: "user_id" },
  { table: "hh_manual_events", owner: "user_id" },
  { table: "hand_analyses", owner: "user_id" },
  // Training
  { table: "xp_events", owner: "user_id" },
  { table: "user_skill_progress", owner: "user_id" },
  { table: "user_achievements", owner: "user_id" },
  { table: "trainer_hand_log", owner: "user_id" },
  { table: "trainer_highscores", owner: "user_id" },
  { table: "flop_trainer_answers", owner: "user_id" },
  { table: "flop_versus_answers", owner: "user_id" },
  { table: "training_sessions", owner: "user_id" },
  { table: "user_skill_assessment", owner: "user_id" },
  { table: "skill_check_history", owner: "user_id" },
  { table: "user_lesson_progress", owner: "user_id" },
  { table: "user_module_progress", owner: "user_id" },
  { table: "user_step_progress", owner: "user_id" },
  { table: "user_concept_mastery", owner: "user_id" },
  { table: "user_leaks", owner: "user_id" },
  // Bankroll
  { table: "bankroll_settings", owner: "user_id" },
  { table: "bankroll_sessions", owner: "user_id" },
  { table: "bankroll_transactions", owner: "user_id" },
  { table: "bankroll_goals", owner: "user_id" },
  { table: "bankroll_mental_entries", owner: "user_id" },
];

const PAGE = 1000;

type Result<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
type Query = { eq(col: string, v: string): { range(from: number, to: number): Result<Record<string, unknown>> } };
export interface ExportClient {
  from(table: string): { select(cols: string): Query };
  rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

async function readAll(client: ExportClient, table: string, owner: string, userId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").eq(owner, userId).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function buildExport(client: ExportClient, user: { id: string; email?: string | null; created_at?: string }) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const skipped: string[] = [];
  for (const { table, owner } of EXPORT_TABLES) {
    try {
      tables[table] = await readAll(client, table, owner, user.id);
    } catch {
      skipped.push(table);
    }
  }
  const social = await client.rpc("export_my_social_data");
  if (social.error) skipped.push("social");

  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at ?? null },
    tables,
    social: social.error ? null : social.data,
    skipped,
  };
}

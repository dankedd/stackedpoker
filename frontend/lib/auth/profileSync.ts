/**
 * Copies the name and avatar an OAuth provider (Google) sends into the
 * user's profile row, on every OAuth sign-in.
 *
 * The profile row itself is created by the `on_auth_user_created` trigger
 * (supabase_schema.sql) the moment the auth user exists — before the callback
 * runs. So this never relies on an insert: it reads the row and fills only
 * the fields that are still empty, never overwriting a name or avatar the
 * user already has. Email is deliberately not copied: it lives in auth.users
 * and nothing reads it from profiles.
 *
 * Errors are returned with the Postgres code and message (no ids, no
 * values), so the callback can log the real cause instead of a vague warning.
 */

export interface ProfileFields {
  full_name: string | null;
  avatar_url: string | null;
}

export type ProfileSyncResult =
  | { status: "updated" | "created"; fields: (keyof ProfileFields)[] }
  | { status: "unchanged" }
  | { status: "error"; step: "read" | "update" | "insert"; error: string };

interface DbError {
  code?: string;
  message: string;
}

/** The slice of the Supabase client this needs — kept small so tests can fake it. */
export interface ProfilesClient {
  from(table: "profiles"): {
    select(columns: "full_name, avatar_url"): {
      eq(column: "id", value: string): { maybeSingle(): PromiseLike<{ data: ProfileFields | null; error: DbError | null }> };
    };
    update(values: Partial<ProfileFields>): {
      eq(column: "id", value: string): PromiseLike<{ error: DbError | null }>;
    };
    insert(values: { id: string } & Partial<ProfileFields>): PromiseLike<{ error: DbError | null }>;
  };
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Google sends `full_name`/`name` and `avatar_url`/`picture`. */
export function providerProfile(meta: Record<string, unknown> | undefined): ProfileFields {
  return {
    full_name: text(meta?.full_name) ?? text(meta?.name),
    avatar_url: text(meta?.avatar_url) ?? text(meta?.picture),
  };
}

/** What to write: only fields the provider has and the profile still lacks. */
export function missingFields(current: ProfileFields | null, provider: ProfileFields): Partial<ProfileFields> {
  const patch: Partial<ProfileFields> = {};
  for (const key of ["full_name", "avatar_url"] as const) {
    if (provider[key] && !current?.[key]) patch[key] = provider[key];
  }
  return patch;
}

const describe = (e: DbError) => `${e.code ?? ""} ${e.message}`.trim();

export async function syncOAuthProfile(
  supabase: ProfilesClient,
  user: { id: string; user_metadata?: Record<string, unknown> },
): Promise<ProfileSyncResult> {
  const provider = providerProfile(user.user_metadata);
  if (!provider.full_name && !provider.avatar_url) return { status: "unchanged" };

  const read = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
  if (read.error) return { status: "error", step: "read", error: describe(read.error) };

  const patch = missingFields(read.data, provider);
  const fields = Object.keys(patch) as (keyof ProfileFields)[];
  if (!fields.length) return { status: "unchanged" };

  if (!read.data) {
    // The trigger did not run (should not happen): create the row ourselves.
    const { error } = await supabase.from("profiles").insert({ id: user.id, ...patch });
    return error ? { status: "error", step: "insert", error: describe(error) } : { status: "created", fields };
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  return error ? { status: "error", step: "update", error: describe(error) } : { status: "updated", fields };
}

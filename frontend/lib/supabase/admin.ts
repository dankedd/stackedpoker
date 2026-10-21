import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only code (cron routes, the
 * no-login unsubscribe link). Bypasses RLS — never import this from a
 * client component. SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so
 * Next.js never ships it to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

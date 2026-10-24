import { cache } from "react";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSharedHand, SLUG_RE, type SharedHandPayload } from "./api";

/** The share as the signed-in (or signed-out) visitor may see it; one query per request. */
export const loadShareForViewer = cache(async (slug: string): Promise<SharedHandPayload | null> => {
  if (!SLUG_RE.test(slug)) return null;
  const supabase = await createClient();
  return getSharedHand(supabase, slug).catch(() => null);
});

/** The share as a signed-out crawler sees it (OG image): no cookies. */
export async function loadShareAnonymously(slug: string): Promise<SharedHandPayload | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SLUG_RE.test(slug) || !url || !key) return null;
  const supabase = createAnonClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return getSharedHand(supabase, slug).catch(() => null);
}

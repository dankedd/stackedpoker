/**
 * Real numbers for the homepage — players, imported hands and the live top 5
 * — from the public_site_stats() RPC (supabase_public_site_stats.sql).
 * Cached for an hour. Any failure (RPC not deployed yet, network) returns
 * null and the homepage simply leaves those elements out: no number is ever
 * made up.
 */

/** Below these, a count is not shown (a small number is weak social proof). */
export const MIN_PLAYERS_SHOWN = 50;
export const MIN_HANDS_SHOWN = 1000;

export interface LeaderRow {
  rank: number;
  username: string;
  total_xp: number;
}

export interface SiteStats {
  players: number | null;
  hands: number | null;
  top: LeaderRow[];
}

export async function getSiteStats(): Promise<SiteStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/public_site_stats`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as { players?: number; hands?: number; top?: LeaderRow[] };
    return {
      players: typeof raw.players === "number" && raw.players >= MIN_PLAYERS_SHOWN ? raw.players : null,
      hands: typeof raw.hands === "number" && raw.hands >= MIN_HANDS_SHOWN ? raw.hands : null,
      top: Array.isArray(raw.top) ? raw.top.slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}

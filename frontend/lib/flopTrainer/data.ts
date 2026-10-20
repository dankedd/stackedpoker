import { createClient } from "@/lib/supabase/client";
import type { BucketKey, FlopDetail, FlopIndexRow, FlopSpot } from "./logic";

/**
 * Precomputed flop data, read straight from Supabase (public read on
 * flop_spots and flop_equity — supabase_flop_equity.sql). Works signed out.
 */

/** The spots the MVP deals, in menu order. */
export const MVP_SPOTS = ["srp_bb_vs_bn_40", "srp_bb_vs_utg_40"] as const;

const PAGE = 1000; // PostgREST's default row cap

export async function fetchSpots(): Promise<FlopSpot[]> {
  const { data, error } = await createClient()
    .from("flop_spots")
    .select("spot_id,spot_type,ip,oop,stack_bb,action,ip_range_pct,oop_range_pct,source_pages")
    .in("spot_id", [...MVP_SPOTS]);
  if (error) throw error;
  const rows = (data ?? []) as FlopSpot[];
  return MVP_SPOTS.map((id) => rows.find((r) => r.spot_id === id)).filter((r): r is FlopSpot => Boolean(r));
}

const indexCache = new Map<string, Promise<FlopIndexRow[]>>();

/** Every flop of a spot, lean columns only (~1,755 rows), cached per visit. */
export function fetchIndex(spotId: string): Promise<FlopIndexRow[]> {
  let p = indexCache.get(spotId);
  if (!p) {
    p = (async () => {
      const out: FlopIndexRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await createClient()
          .from("flop_equity")
          .select("flop,flop_weight,equity_ip,nut_adv,texture")
          .eq("spot_id", spotId)
          .order("flop")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as FlopIndexRow[];
        out.push(...rows.map((r) => ({ ...r, equity_ip: Number(r.equity_ip) })));
        if (rows.length < PAGE) break;
      }
      return out;
    })();
    p.catch(() => indexCache.delete(spotId));
    indexCache.set(spotId, p);
  }
  return p;
}

export async function fetchDetail(spotId: string, flop: string): Promise<FlopDetail> {
  const { data, error } = await createClient()
    .from("flop_equity")
    .select("equity_oop,buckets_ip,buckets_oop")
    .eq("spot_id", spotId)
    .eq("flop", flop)
    .single();
  if (error) throw error;
  return { ...(data as FlopDetail), equity_oop: Number((data as FlopDetail).equity_oop) };
}

export type BucketExamples = Record<"ip" | "oop", Record<BucketKey, string[]>>;

/** A few typical hands per bucket (backend, public). */
export async function fetchExamples(spotId: string, flop: string): Promise<BucketExamples> {
  const res = await fetch(`/api/flop-trainer/examples?spot_id=${encodeURIComponent(spotId)}&flop=${encodeURIComponent(flop)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as BucketExamples;
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron/auth";

/**
 * Daily social upkeep, triggered by Vercel Cron (vercel.json): recomputes the
 * skill stats (and earned badges) of everyone active in the last two days
 * (refresh_active_skill_stats in supabase/migrations/20261025_04_profiles_stats.sql).
 * Profiles also refresh themselves when viewed, so this only keeps the
 * active players' cards warm.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("refresh_active_skill_stats", { p_limit: 2000 });
  if (error) {
    console.error(JSON.stringify({ job: "social-daily", error: error.message }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(JSON.stringify({ job: "social-daily", refreshed: data }));
  return NextResponse.json({ refreshed: data });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExport, type ExportClient } from "@/lib/account/export";

export const dynamic = "force-dynamic";

/** GET /api/account/export — the signed-in user's data as a JSON download. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const body = await buildExport(supabase as unknown as ExportClient, user);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stacked-poker-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

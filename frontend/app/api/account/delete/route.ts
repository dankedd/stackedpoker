import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount, type SubscriptionRow } from "@/lib/account/delete";

export const dynamic = "force-dynamic";

/** POST /api/account/delete  body {"confirm": "DELETE"} — deletes the signed-in account. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return NextResponse.json({ ok: false, error: "not_confirmed" }, { status: 400 });

  const admin = createAdminClient();
  const outcome = await deleteAccount(user.id, {
    async getSubscription(userId) {
      const { data } = await admin
        .from("subscriptions")
        .select("status, stripe_subscription_id, cancel_at_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      return data as SubscriptionRow;
    },
    async removeStorageFolder(bucket, userId) {
      const { data } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
    },
    deleteAuthUser: (userId) => admin.auth.admin.deleteUser(userId),
  });

  if (!outcome.ok) {
    return NextResponse.json(outcome, { status: outcome.error === "active_subscription" ? 409 : 500 });
  }
  // The session cookie now points at a user that no longer exists.
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}

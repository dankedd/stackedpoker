/**
 * Account deletion. Deleting the auth user is the whole operation: every
 * user-owned table references auth.users ON DELETE CASCADE, and authored
 * social content (messages, posts, reports) uses ON DELETE SET NULL so it
 * stays in place and renders as "[deleted user]"
 * (supabase/migrations/20261024_02_social_foundation.sql).
 *
 * Refused while a paid Stripe subscription would keep billing: the user
 * cancels in the billing portal first. The reverse trial has no Stripe
 * subscription and does not block.
 */

export type DeleteOutcome = { ok: true } | { ok: false; error: "active_subscription" | "failed" };

export type SubscriptionRow = {
  status: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
} | null;

/** True when deleting now would leave a subscription that charges again. */
export function blocksDeletion(sub: SubscriptionRow): boolean {
  if (!sub?.stripe_subscription_id) return false;
  if (!["active", "trialing", "past_due", "unpaid"].includes(sub.status ?? "")) return false;
  return !sub.cancel_at_period_end;
}

/** Storage buckets whose `<user id>/` folder belongs to the user. */
export const USER_STORAGE_BUCKETS = ["avatars"];

export interface DeleteDeps {
  getSubscription(userId: string): Promise<SubscriptionRow>;
  removeStorageFolder(bucket: string, userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<{ error: unknown }>;
}

export async function deleteAccount(userId: string, deps: DeleteDeps): Promise<DeleteOutcome> {
  if (blocksDeletion(await deps.getSubscription(userId))) return { ok: false, error: "active_subscription" };
  for (const bucket of USER_STORAGE_BUCKETS) {
    // Best effort: a missing bucket or folder must not block the deletion.
    await deps.removeStorageFolder(bucket, userId).catch(() => undefined);
  }
  const { error } = await deps.deleteAuthUser(userId);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

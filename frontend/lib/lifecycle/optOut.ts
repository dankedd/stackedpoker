import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "./token";

/**
 * Sets profiles.email_opt_out from a signed unsubscribe token (no login).
 * Returns false when the token is not one of ours.
 */
export async function setOptOutByToken(token: string | null | undefined, optOut: boolean): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ email_opt_out: optOut, email_opt_out_at: optOut ? new Date().toISOString() : null })
    .eq("id", userId);
  if (error) throw new Error(`opt-out update failed: ${error.message}`);
  return true;
}

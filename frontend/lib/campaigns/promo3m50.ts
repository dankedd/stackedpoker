import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWithResend } from "@/lib/lifecycle/resend";
import { excludedEmails, siteUrlForEmails } from "@/lib/lifecycle/run";
import { renderPromo3m50, type RenderedEmail } from "@/lib/lifecycle/templates";
import { TEST_PREFIX } from "@/lib/lifecycle/testSend";
import { unsubscribeToken } from "@/lib/lifecycle/token";

/**
 * One-time promo email: 50% off Pro for 3 months (€3.99, then €7.99), code
 * STACKED50, valid 7 days. Run by frontend/scripts/promo-3m-50.ts — never
 * by a cron.
 *
 * The audience comes from promo_email_candidates()
 * (supabase/migrations/20261025_01_promo_3m_50.sql): confirmed, not opted
 * out, on Free right now, never paid, not sent this campaign yet.
 * selectAudience() re-checks the plan, drops duplicates and the
 * LIFECYCLE_EXCLUDE_EMAILS test accounts, so a wrong row from the database
 * still can't get mailed.
 *
 * At most once per user, like the lifecycle emails (run.ts): the email_log
 * row is claimed BEFORE the send (unique per user and template) and removed
 * again if Resend refuses, so a re-run retries only the failures.
 */

export const CAMPAIGN = "promo_3m_50" as const;
export const PROMO_CODE = "STACKED50";

/** Needed in every mode; the script refuses to start without them. Names only, never values. */
export const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "EMAIL_TOKEN_SECRET",
  "STRIPE_SECRET_KEY",
  "LIFECYCLE_REPLY_TO",
] as const;

export function missingEnv(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_ENV.filter((k) => !env[k]?.trim());
}

// ── Audience ────────────────────────────────────────────────────────────────

export interface Recipient {
  userId: string;
  email: string;
  name: string | null;
  timezone: string;
  plan: string | null;
}

export interface Skipped {
  email: string;
  reason: string;
}

export function parseRecipient(r: Record<string, unknown>): Recipient {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    userId: String(r.user_id),
    email: String(r.email ?? "").trim(),
    name: str(r.name),
    timezone: str(r.timezone) ?? "Europe/Amsterdam",
    plan: str(r.plan),
  };
}

/** Who gets the email, from the candidate rows. Pure, so it is unit-tested. */
export function selectAudience(
  rows: Record<string, unknown>[],
  opts: { excluded?: ReadonlySet<string>; alreadySent?: ReadonlySet<string> } = {},
): { recipients: Recipient[]; skipped: Skipped[] } {
  const excluded = opts.excluded ?? new Set<string>();
  const alreadySent = opts.alreadySent ?? new Set<string>();
  const seenUsers = new Set<string>();
  const seenEmails = new Set<string>();
  const recipients: Recipient[] = [];
  const skipped: Skipped[] = [];

  for (const raw of rows) {
    const r = parseRecipient(raw);
    const email = r.email.toLowerCase();
    const skip = (reason: string) => skipped.push({ email: r.email, reason });
    if (!email.includes("@")) skip("no email address");
    else if (r.plan !== "free") skip(`plan is ${r.plan ?? "unknown"}, not free`);
    else if (excluded.has(email)) skip("test account (LIFECYCLE_EXCLUDE_EMAILS)");
    else if (alreadySent.has(r.userId)) skip(`already in email_log (${CAMPAIGN})`);
    else if (seenUsers.has(r.userId) || seenEmails.has(email)) skip("duplicate");
    else {
      seenUsers.add(r.userId);
      seenEmails.add(email);
      recipients.push(r);
    }
  }
  return { recipients, skipped };
}

export async function loadAudience(sb: SupabaseClient, now: number) {
  const { data, error } = await sb.rpc("promo_email_candidates", { p_template: CAMPAIGN, p_now: new Date(now).toISOString() });
  if (error) throw new Error(`promo_email_candidates: ${error.message}`);
  // The function already leaves these out; read them anyway so a stale or
  // edited function can't cause a second email.
  const { data: logged, error: logErr } = await sb.from("email_log").select("user_id").eq("template", CAMPAIGN).limit(100_000);
  if (logErr) throw new Error(`email_log: ${logErr.message}`);
  const alreadySent = new Set(((logged ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return selectAudience((data ?? []) as Record<string, unknown>[], { excluded: excludedEmails(), alreadySent });
}

// ── Stripe promotion code ───────────────────────────────────────────────────

export interface PromoState {
  id: string;
  code: string;
  active: boolean;
  /** The earlier of the code's expires_at and the coupon's redeem_by. */
  expiresAt: string | null;
  amountOff: number | null;
  currency: string | null;
  months: number | null;
}

/** Reads the code from Stripe (no SDK in the frontend). null = no such code. */
export async function fetchPromo(code: string, stripeKey: string, fetchImpl: typeof fetch = fetch): Promise<PromoState | null> {
  const url = `https://api.stripe.com/v1/promotion_codes?code=${encodeURIComponent(code)}&limit=1&expand[]=data.coupon`;
  // Same API version as the backend's stripe library (stripe==10.12.0).
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${stripeKey}`, "Stripe-Version": "2024-06-20" } });
  const body = (await res.json().catch(() => null)) as { data?: Record<string, unknown>[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${body?.error?.message ?? "promotion code lookup failed"}`);
  const pc = body?.data?.[0];
  if (!pc) return null;
  const coupon = (pc.coupon ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const ends = [num(pc.expires_at), num(coupon.redeem_by)].filter((x): x is number => x !== null);
  return {
    id: String(pc.id),
    code: String(pc.code),
    active: pc.active === true && coupon.valid !== false,
    expiresAt: ends.length ? new Date(Math.min(...ends) * 1000).toISOString() : null,
    amountOff: num(coupon.amount_off),
    currency: typeof coupon.currency === "string" ? coupon.currency : null,
    months: num(coupon.duration_in_months),
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Why a real send must not start with this code, or null when it may.
 * "Valid for 7 days after sending": the code is created right before the
 * send, so it must end between 6 days and 7 days + 1 hour from now.
 */
export function promoProblem(promo: PromoState | null, now: number): string | null {
  if (!promo) return `promotion code ${PROMO_CODE} not found in Stripe — run backend/scripts/create_promo_3m_50.py --create first`;
  if (!promo.active) return `promotion code ${promo.code} is not active`;
  if (promo.amountOff !== 400 || promo.currency !== "eur" || promo.months !== 3) {
    return `coupon is not €4.00 off for 3 months (got ${promo.amountOff} ${promo.currency} for ${promo.months} months)`;
  }
  if (!promo.expiresAt) return "promotion code has no expiry — the email promises 7 days";
  const left = new Date(promo.expiresAt).getTime() - now;
  if (left < 6 * DAY || left > 7 * DAY + HOUR) {
    return `promotion code ends ${promo.expiresAt}, ${(left / DAY).toFixed(1)} days from now; the email promises 7 days — create a fresh code right before sending`;
  }
  return null;
}

// ── Sending ─────────────────────────────────────────────────────────────────

export function renderFor(r: Pick<Recipient, "userId" | "name" | "timezone">, expiresAt: string): RenderedEmail {
  const site = siteUrlForEmails();
  return renderPromo3m50(
    { name: r.name, timezone: r.timezone, expiresAt, promoCode: PROMO_CODE },
    { siteUrl: site, unsubscribeUrl: `${site}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(r.userId))}`, seed: CAMPAIGN },
  );
}

function oneClickUrl(userId: string): string {
  return `${siteUrlForEmails()}/api/email/unsubscribe?t=${encodeURIComponent(unsubscribeToken(userId))}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resend answers 429 when we go over its rate limit: wait and try again. */
async function sendWithRetry(send: typeof sendWithResend, input: Parameters<typeof sendWithResend>[0], waitMs: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send(input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.startsWith("Resend 429") || attempt >= 3) throw e;
      await sleep(waitMs * 2 ** attempt);
    }
  }
}

export interface SendRow {
  email: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  resendId?: string;
}

export async function sendCampaign(
  sb: SupabaseClient,
  recipients: Recipient[],
  opts: {
    expiresAt: string;
    now: number;
    send?: typeof sendWithResend;
    /** Between sends. Resend's default limit is 2 requests per second. */
    spacingMs?: number;
    onProgress?: (done: number, row: SendRow) => void;
  },
): Promise<{ sent: number; failed: number; rows: SendRow[] }> {
  const send = opts.send ?? sendWithResend;
  const spacing = opts.spacingMs ?? 600;
  const nowIso = new Date(opts.now).toISOString();
  const rows: SendRow[] = [];
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const row: SendRow = { email: r.email, status: "skipped" };
    rows.push(row);

    const { data: claim, error: claimErr } = await sb
      .from("email_log")
      .upsert({ user_id: r.userId, template: CAMPAIGN, sent_at: nowIso }, { onConflict: "user_id,template", ignoreDuplicates: true })
      .select("id");
    if (claimErr) {
      row.status = "failed";
      row.reason = `claim: ${claimErr.message}`;
      failed++;
    } else if (!claim?.length) {
      row.reason = "already in email_log";
    } else {
      try {
        const { id } = await sendWithRetry(
          send,
          { to: r.email, email: renderFor(r, opts.expiresAt), oneClickUrl: oneClickUrl(r.userId), idempotencyKey: `${CAMPAIGN}-${r.userId}` },
          Math.max(spacing, 1) * 2,
        );
        const { error: logErr } = await sb.from("email_log").update({ provider_id: id }).eq("id", claim[0].id);
        row.status = "sent";
        row.resendId = id;
        if (logErr) row.reason = `sent, but provider_id not stored: ${logErr.message}`;
        sent++;
      } catch (e) {
        await sb.from("email_log").delete().eq("id", claim[0].id);
        row.status = "failed";
        row.reason = e instanceof Error ? e.message : String(e);
        failed++;
      }
      await sleep(spacing);
    }
    opts.onProgress?.(rows.length, row);
  }
  return { sent, failed, rows };
}

/** Test send: one email, "[TEST] " subject, to one address; reads and writes no user data. */
export async function sendPromoTest(
  to: string,
  opts: { expiresAt: string; send?: typeof sendWithResend },
): Promise<{ to: string; subject: string; resendId: string }> {
  const send = opts.send ?? sendWithResend;
  // A made-up user id: the test email's unsubscribe link opts nobody out.
  const userId = "00000000-0000-4000-8000-000000000000";
  const rendered = renderFor({ userId, name: "Manuel", timezone: "Europe/Amsterdam" }, opts.expiresAt);
  const email: RenderedEmail = { ...rendered, subject: TEST_PREFIX + rendered.subject };
  const { id } = await send({ to, email, oneClickUrl: oneClickUrl(userId), idempotencyKey: `${CAMPAIGN}-test-${randomUUID()}` });
  return { to, subject: email.subject, resendId: id };
}

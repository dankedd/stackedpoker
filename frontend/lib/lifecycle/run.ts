import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { decide, parseCandidate, type Template } from "./plan";
import { sendWithResend } from "./resend";
import { renderEmail } from "./templates";
import { unsubscribeToken } from "./token";

/**
 * One lifecycle-email run: read the candidates, decide, then (unless dry)
 * claim → send → record. Called by app/api/cron/lifecycle-emails.
 *
 * At most once per (user, template): the email_log row is inserted BEFORE
 * the send (the unique constraint makes a concurrent or retried run skip
 * it) and deleted again if Resend refuses, so a failed send is retried on
 * the next run instead of being lost.
 */

export interface RunResult {
  dry: boolean;
  now: string;
  candidates: number;
  sent: number;
  failed: number;
  results: RunRow[];
}

export interface RunRow {
  email: string;
  signedUp: string;
  template: Template | null;
  status: "would_send" | "sent" | "skipped" | "failed";
  reason: string;
  subject?: string;
  summary?: string;
  error?: string;
}

export function siteUrlForEmails(): string {
  // Links in emails always point at production, also in a local dry run.
  return (process.env.LIFECYCLE_SITE_URL || CANONICAL_SITE_URL).replace(/\/$/, "");
}

export function excludedEmails(): Set<string> {
  return new Set(
    (process.env.LIFECYCLE_EXCLUDE_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runLifecycleEmails(
  sb: SupabaseClient,
  opts: { now: number; dry: boolean; send?: typeof sendWithResend; spacingMs?: number },
): Promise<RunResult> {
  const send = opts.send ?? sendWithResend;
  const nowIso = new Date(opts.now).toISOString();
  const { data, error } = await sb.rpc("lifecycle_email_candidates", { p_now: nowIso });
  if (error) throw new Error(`lifecycle_email_candidates: ${error.message}`);

  const site = siteUrlForEmails();
  const excluded = excludedEmails();
  const day = nowIso.slice(0, 10);
  const results: RunRow[] = [];
  let sent = 0;
  let failed = 0;

  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const c = parseCandidate(raw);
    const d = decide(c, opts.now, excluded);
    const row: RunRow = { email: c.email, signedUp: c.signedUpAt, template: d.template, status: "skipped", reason: d.reason };
    results.push(row);
    if (!d.template) continue;

    const token = unsubscribeToken(c.userId);
    const email = renderEmail(d.template, c, {
      siteUrl: site,
      unsubscribeUrl: `${site}/unsubscribe?t=${encodeURIComponent(token)}`,
      seed: `${c.userId}:${day}`,
    });
    row.subject = email.subject;
    row.summary = email.summary;
    if (opts.dry) {
      row.status = "would_send";
      continue;
    }

    const { data: claim, error: claimErr } = await sb
      .from("email_log")
      .upsert({ user_id: c.userId, template: d.template, sent_at: nowIso }, { onConflict: "user_id,template", ignoreDuplicates: true })
      .select("id");
    if (claimErr) {
      row.status = "failed";
      row.error = `claim: ${claimErr.message}`;
      failed++;
      continue;
    }
    if (!claim?.length) {
      row.reason = "already in email_log (another run sent it)";
      continue;
    }

    try {
      const { id } = await send({
        to: c.email,
        email,
        oneClickUrl: `${site}/api/email/unsubscribe?t=${encodeURIComponent(token)}`,
        idempotencyKey: `lifecycle-${d.template}-${c.userId}`,
      });
      await sb.from("email_log").update({ provider_id: id }).eq("id", claim[0].id);
      row.status = "sent";
      sent++;
    } catch (e) {
      await sb.from("email_log").delete().eq("id", claim[0].id);
      row.status = "failed";
      row.error = e instanceof Error ? e.message : String(e);
      failed++;
    }
    // Resend's default limit is 2 requests per second.
    await sleep(opts.spacingMs ?? 600);
  }

  return { dry: opts.dry, now: nowIso, candidates: results.length, sent, failed, results };
}

/** "ma***@gmail.com" — for server logs, which should not hold full addresses. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain ?? ""}`;
}

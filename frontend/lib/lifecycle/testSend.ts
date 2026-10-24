import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPEN_CHARTS } from "@/lib/ranges/data";
import type { Candidate, Template } from "./plan";
import { sendWithResend } from "./resend";
import { siteUrlForEmails } from "./run";
import { spotInfo } from "./spots";
import { renderEmail, type RenderedEmail } from "./templates";
import { unsubscribeToken } from "./token";

/**
 * Test send: renders one lifecycle template and sends it to one allow-listed
 * address, so a template can be checked in a real inbox without waiting for
 * the cron. Writes nothing (no email_log row) and never reads or mails other
 * users — the only account it looks at is SAMPLE_ACCOUNT, for realistic
 * stats; when that account is missing, dummy data is used instead.
 */

export const SAMPLE_ACCOUNT = "manueladema33@gmail.com";
export const TEST_PREFIX = "[TEST] ";

export function testRecipients(): Set<string> {
  return new Set(
    (process.env.LIFECYCLE_TEST_RECIPIENTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Env vars the lifecycle emails need in production — names only, never values. */
export const REQUIRED_ENV = [
  "RESEND_API_KEY",
  "CRON_SECRET",
  "EMAIL_TOKEN_SECRET",
  "EMAIL_FROM_ADDRESS",
  "LIFECYCLE_REPLY_TO",
  "LIFECYCLE_TEST_RECIPIENTS",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}

const DUMMY_USER_ID = "00000000-0000-4000-8000-000000000000";

/** A weakest-spot ref the current chart data resolves (refs are "kind:<chart key>"). */
function dummyWeakestRef(): string | null {
  for (const c of OPEN_CHARTS) {
    for (const key of [(c as { id?: unknown }).id, (c as { page?: unknown }).page]) {
      if (key != null && spotInfo(`open:${key}`)) return `open:${key}`;
    }
  }
  return null;
}

export function dummyCandidate(now: number): Candidate {
  const weakestRef = dummyWeakestRef();
  return {
    userId: DUMMY_USER_ID,
    email: "sample@example.invalid",
    name: "Sam",
    signedUpAt: new Date(now - 3 * 86_400_000).toISOString(),
    timezone: "Europe/Amsterdam",
    lastActiveAt: new Date(now - 2 * 86_400_000).toISOString(),
    activeToday: false,
    streak: 2,
    handsTotal: 64,
    handsGood: 47,
    handsSource: "log",
    weakestRef,
    weakestHands: weakestRef ? 9 : null,
    weakestWrong: weakestRef ? 5 : null,
    emailsSent: {},
    lastEmailAt: null,
  };
}

async function findUser(sb: SupabaseClient, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/**
 * The sample account's facts, read the same way lifecycle_email_candidates()
 * reads them (supabase_retention.sql): exact counts from trainer_hand_log,
 * else the trainer_highscores estimate; the weakest chart needs 3+ hands and
 * 2+ mistakes. The SQL function itself can't be used — it skips admin
 * accounts and accounts older than 15 days.
 */
export async function sampleCandidate(sb: SupabaseClient, now: number): Promise<{ candidate: Candidate; source: string }> {
  const user = await findUser(sb, SAMPLE_ACCOUNT);
  if (!user) return { candidate: dummyCandidate(now), source: "dummy (sample account not found)" };
  const nowIso = new Date(now).toISOString();

  const [streakRes, logRes, hsRes, xpRes, lastXpRes] = await Promise.all([
    sb.rpc("activity_streak", { p_user_id: user.id, p_now: nowIso }),
    sb.from("trainer_hand_log").select("hand_ref, verdict, played_at").eq("user_id", user.id).lte("played_at", nowIso).limit(20000),
    sb.from("trainer_highscores").select("hands_played").eq("user_id", user.id).eq("trainer_key", "preflop-ranges").maybeSingle(),
    sb.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("source_type", "preflop_trainer").lte("earned_at", nowIso),
    sb.from("xp_events").select("earned_at").eq("user_id", user.id).lte("earned_at", nowIso).order("earned_at", { ascending: false }).limit(1),
  ]);
  for (const r of [streakRes, logRes, hsRes, xpRes, lastXpRes]) if (r.error) throw new Error(`sample account: ${r.error.message}`);

  const log = (logRes.data ?? []) as { hand_ref: string | null; verdict: string; played_at: string }[];
  const streak = (streakRes.data ?? {}) as { streak?: number; active_today?: boolean };
  const highscore = (hsRes.data as { hands_played?: number } | null)?.hands_played ?? 0;

  const byRef = new Map<string, { total: number; wrong: number }>();
  for (const h of log) {
    if (!h.hand_ref) continue;
    const ref = h.hand_ref.split(":").slice(0, 2).join(":");
    const s = byRef.get(ref) ?? { total: 0, wrong: 0 };
    s.total++;
    if (h.verdict === "wrong") s.wrong++;
    byRef.set(ref, s);
  }
  const weakest = [...byRef.entries()]
    .filter(([, s]) => s.total >= 3 && s.wrong >= 2)
    .sort(([ra, a], [rb, b]) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong || ra.localeCompare(rb))[0];

  const lastLog = log.reduce<string | null>((m, h) => (!m || h.played_at > m ? h.played_at : m), null);
  const lastXp = (lastXpRes.data?.[0] as { earned_at?: string } | undefined)?.earned_at ?? null;
  const lastActiveAt = [lastLog, lastXp].filter((x): x is string => Boolean(x)).sort().pop() ?? null;
  const meta = user.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? "").trim() || null;

  return {
    source: "sample account",
    candidate: {
      userId: user.id,
      email: user.email!,
      name,
      signedUpAt: user.created_at,
      timezone: "Europe/Amsterdam",
      lastActiveAt,
      activeToday: streak.active_today === true,
      streak: streak.streak ?? 0,
      handsTotal: log.length > 0 ? log.length : highscore,
      handsGood: log.length > 0 ? log.filter((h) => h.verdict !== "wrong").length : Math.min(xpRes.count ?? 0, highscore),
      handsSource: log.length > 0 ? "log" : "estimate",
      weakestRef: weakest?.[0] ?? null,
      weakestHands: weakest?.[1].total ?? null,
      weakestWrong: weakest?.[1].wrong ?? null,
      emailsSent: {},
      lastEmailAt: null,
    },
  };
}

export interface TestSendResult {
  test: Template;
  to: string;
  data: string;
  subject: string;
  summary: string;
  resendId: string;
}

export async function sendTestEmail(
  sb: SupabaseClient,
  opts: { template: Template; to: string; now: number; send?: typeof sendWithResend },
): Promise<TestSendResult> {
  const send = opts.send ?? sendWithResend;
  const { candidate: c, source } = await sampleCandidate(sb, opts.now).catch((e) => ({
    candidate: dummyCandidate(opts.now),
    source: `dummy (${e instanceof Error ? e.message : String(e)})`,
  }));

  const site = siteUrlForEmails();
  const token = unsubscribeToken(c.userId);
  const rendered = renderEmail(opts.template, c, {
    siteUrl: site,
    unsubscribeUrl: `${site}/unsubscribe?t=${encodeURIComponent(token)}`,
    seed: `test:${randomUUID()}`,
  });
  const email: RenderedEmail = { ...rendered, subject: TEST_PREFIX + rendered.subject };

  const { id } = await send({
    to: opts.to,
    email,
    oneClickUrl: `${site}/api/email/unsubscribe?t=${encodeURIComponent(token)}`,
    // Unique per call: a repeated test must really send again.
    idempotencyKey: `lifecycle-test-${opts.template}-${randomUUID()}`,
  });
  return { test: opts.template, to: opts.to, data: source, subject: email.subject, summary: email.summary, resendId: id };
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATES, type Template } from "@/lib/lifecycle/plan";
import { maskEmail, runLifecycleEmails } from "@/lib/lifecycle/run";
import { missingEnv, sendTestEmail, testRecipients } from "@/lib/lifecycle/testSend";

/**
 * Daily lifecycle emails (day 1 / 3 / 7), triggered by Vercel Cron
 * (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 *
 *   ?dry=1             decide and render, send nothing, write nothing
 *   ?dry=1&now=<ISO>   the same, as if it ran at that moment
 *   ?test=day1|day3|day7&to=<email>
 *                      send that one template, "[TEST] " subject, to an
 *                      address in LIFECYCLE_TEST_RECIPIENTS only; writes nothing
 *
 * A Next.js route, not the FastAPI backend: this file wins over the /api/*
 * rewrite in next.config.ts because filesystem routes are matched first.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  if (q.has("test")) return testSend(q);
  const dry = q.get("dry") === "1";
  const nowParam = q.get("now");
  if (nowParam && !dry) return NextResponse.json({ error: "now= is only allowed with dry=1" }, { status: 400 });
  const now = nowParam ? Date.parse(nowParam) : Date.now();
  if (!Number.isFinite(now)) return NextResponse.json({ error: "now= must be an ISO date" }, { status: 400 });

  try {
    const result = await runLifecycleEmails(createAdminClient(), { now, dry });
    // Logs keep addresses masked; the authorised response has them in full.
    console.log(
      JSON.stringify({
        job: "lifecycle-emails",
        dry: result.dry,
        now: result.now,
        candidates: result.candidates,
        sent: result.sent,
        failed: result.failed,
        rows: result.results.map((r) => ({ ...r, email: maskEmail(r.email) })),
      }),
    );
    return NextResponse.json(result, { status: result.failed ? 207 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ job: "lifecycle-emails", error: message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function testSend(q: URLSearchParams) {
  const template = q.get("test") as Template;
  if (!TEMPLATES.includes(template)) return NextResponse.json({ error: "test= must be day1, day3, day7 or trial_ending" }, { status: 400 });
  const to = (q.get("to") ?? "").trim().toLowerCase();
  if (!to || !testRecipients().has(to)) {
    return NextResponse.json({ error: "to= is not listed in LIFECYCLE_TEST_RECIPIENTS" }, { status: 403 });
  }
  try {
    const result = await sendTestEmail(createAdminClient(), { template, to, now: Date.now() });
    console.log(JSON.stringify({ job: "lifecycle-emails", ...result, to: maskEmail(to) }));
    return NextResponse.json({ ...result, missingEnv: missingEnv() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ job: "lifecycle-emails", test: template, error: message }));
    return NextResponse.json({ error: message, missingEnv: missingEnv() }, { status: 500 });
  }
}

/**
 * One-time promo email "promo_3m_50" (50% off Pro for 3 months, code STACKED50).
 *
 *   npx tsx scripts/promo-3m-50.ts                       dry run: recipient count, a sample,
 *                                                        an HTML preview file; sends and writes nothing
 *   npx tsx scripts/promo-3m-50.ts --test-to me@x.com    one "[TEST] " email to an address in
 *                                                        LIFECYCLE_TEST_RECIPIENTS; writes nothing
 *   npx tsx scripts/promo-3m-50.ts --send                the real send to the whole audience
 *   npx tsx scripts/promo-3m-50.ts --send --limit 200    the real send, first 200 only (re-run for the rest)
 *
 * Reads frontend/.env.local; variables already set in the shell win. Refuses
 * to start when any of REQUIRED_ENV is missing, and never prints a key.
 * The real send also refuses unless the Stripe code is active and ends 6–7
 * days from now (create it with backend/scripts/create_promo_3m_50.py right
 * before sending). Every send is logged in email_log; a re-run skips
 * everyone already logged.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import {
  CAMPAIGN,
  PROMO_CODE,
  fetchPromo,
  loadAudience,
  missingEnv,
  promoProblem,
  renderFor,
  sendCampaign,
  sendPromoTest,
} from "../lib/campaigns/promo3m50";
import { maskEmail } from "../lib/lifecycle/run";
import { testRecipients } from "../lib/lifecycle/testSend";

try {
  process.loadEnvFile(path.join(__dirname, "..", ".env.local"));
} catch {
  // No .env.local: everything must come from the shell.
}

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const value = (name: string) => (flag(name) ? argv[argv.indexOf(name) + 1] : undefined);

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const known = new Set(["--send", "--test-to", "--limit"]);
for (const [i, a] of argv.entries()) {
  if (a.startsWith("--") && !known.has(a)) fail(`Unknown option ${a}`);
  if (!a.startsWith("--") && !["--test-to", "--limit"].includes(argv[i - 1])) fail(`Unexpected argument ${a}`);
}
const testTo = value("--test-to")?.trim().toLowerCase();
const realSend = flag("--send");
const limitRaw = value("--limit");
const limit = limitRaw === undefined ? null : Number(limitRaw);
if (flag("--test-to") && !testTo?.includes("@")) fail("Usage: --test-to you@example.com");
if (realSend && testTo) fail("--send and --test-to can't be combined");
if (limit !== null && (!Number.isInteger(limit) || limit < 1)) fail("--limit must be a positive whole number");
if (limit !== null && !realSend) fail("--limit only applies to --send");

const missing = missingEnv();
if (missing.length) fail(`Missing environment variables: ${missing.join(", ")}. Nothing was read or sent.`);

async function main() {
  const now = Date.now();
  const mode = process.env.STRIPE_SECRET_KEY!.startsWith("sk_live_") || process.env.STRIPE_SECRET_KEY!.startsWith("rk_live_") ? "LIVE" : "test";
  const promo = await fetchPromo(PROMO_CODE, process.env.STRIPE_SECRET_KEY!);
  const problem = promoProblem(promo, now);
  console.log(`Campaign ${CAMPAIGN} · Stripe ${mode} mode · code ${PROMO_CODE}: ${promo ? `${promo.active ? "active" : "INACTIVE"}, ends ${promo.expiresAt ?? "never"}` : "not created yet"}`);
  if (mode !== "LIVE") console.log("  Note: a test-mode Stripe key — the link only works against test-mode checkout.");
  // Before the code exists, previews and test sends show a deadline 7 days from now.
  const expiresAt = promo?.expiresAt ?? new Date(now + 7 * 86_400_000).toISOString();

  // ── Test send ───────────────────────────────────────────────────────────
  if (testTo) {
    if (!testRecipients().has(testTo)) fail(`${testTo} is not listed in LIFECYCLE_TEST_RECIPIENTS`);
    if (problem) console.log(`  Warning (would block --send): ${problem}`);
    const r = await sendPromoTest(testTo, { expiresAt });
    console.log(`\n✓ Test sent to ${r.to}: "${r.subject}" (Resend id ${r.resendId}). Nothing written to email_log.`);
    return;
  }

  // ── Audience ────────────────────────────────────────────────────────────
  const sb = createAdminClient();
  const { recipients, skipped } = await loadAudience(sb, now);
  const batch = limit === null ? recipients : recipients.slice(0, limit);
  console.log(`\nRecipients: ${recipients.length}${limit !== null ? ` (this run: ${batch.length})` : ""} · skipped by the script: ${skipped.length}`);
  for (const r of recipients.slice(0, 10)) console.log(`  ${maskEmail(r.email)}  ${r.timezone}`);
  if (recipients.length > 10) console.log(`  … and ${recipients.length - 10} more`);
  for (const s of skipped.slice(0, 10)) console.log(`  skipped ${maskEmail(s.email)}: ${s.reason}`);

  if (!realSend) {
    const sample = renderFor(recipients[0] ?? { userId: "00000000-0000-4000-8000-000000000000", name: null, timezone: "Europe/Amsterdam" }, expiresAt);
    const dir = path.join(os.tmpdir(), "stackedpoker-promo-3m-50");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "preview.html"), sample.html);
    fs.writeFileSync(path.join(dir, "preview.txt"), `Subject: ${sample.subject}\n\n${sample.text}`);
    console.log(`\nSubject:   ${sample.subject}\nPreheader: ${sample.preheader}\nPreview:   ${path.join(dir, "preview.html")} (and preview.txt)`);
    if (problem) console.log(`\n  Would block --send: ${problem}`);
    console.log("\nDry run — nothing sent, nothing written. Add --send to send for real.");
    return;
  }

  // ── Real send ───────────────────────────────────────────────────────────
  if (problem) fail(`Not sending: ${problem}`);
  if (!batch.length) return console.log("\nNobody left to send to.");
  const minutes = Math.ceil((batch.length * 0.65) / 60);
  console.log(`\nSending ${batch.length} emails, about ${minutes} min at 2/s. Ctrl+C is safe: a re-run skips everyone already logged.\n`);
  const result = await sendCampaign(sb, batch, {
    expiresAt: promo!.expiresAt!,
    now,
    onProgress: (done, row) => {
      if (row.status !== "sent") console.log(`  ${row.status} ${maskEmail(row.email)}: ${row.reason ?? ""}`);
      if (done % 50 === 0 || done === batch.length) console.log(`  ${done}/${batch.length}`);
    },
  });
  console.log(`\n✓ Sent ${result.sent}, failed ${result.failed}, skipped ${batch.length - result.sent - result.failed}.`);
  if (result.failed) console.log("  Failed sends were removed from email_log; re-run --send to retry them.");
  if (recipients.length > batch.length) console.log(`  ${recipients.length - batch.length} recipients left for the next run.`);
}

// No top-level await: the frontend package is CommonJS for tsx.
main().catch((e) => fail(e instanceof Error ? e.message : String(e)));

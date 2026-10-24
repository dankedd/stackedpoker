/**
 * Preview the lifecycle emails (day 1 / 3 / 7, trial ending) with a made-up user, without
 * touching the database or any real user.
 *
 *   npx tsx scripts/lifecycle-preview.ts                  → HTML files in the OS temp dir
 *   npx tsx scripts/lifecycle-preview.ts --send me@x.com  → also sends all four to that
 *                                                           address via Resend
 *
 * Sending needs RESEND_API_KEY in the environment (and stackedpokerai.com
 * verified in Resend). Subjects get a "[Preview]" prefix and the unsubscribe
 * links point nowhere, so a preview can never opt anyone out.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TEMPLATES, type Candidate } from "../lib/lifecycle/plan";
import { sendWithResend } from "../lib/lifecycle/resend";
import { renderEmail } from "../lib/lifecycle/templates";

const sendTo = process.argv.includes("--send") ? process.argv[process.argv.indexOf("--send") + 1] : null;
if (process.argv.includes("--send") && !sendTo?.includes("@")) {
  console.error("Usage: npx tsx scripts/lifecycle-preview.ts --send you@example.com");
  process.exit(1);
}

const now = Date.now();
const day = 86_400_000;
// A believable user a week in: active today, a 3-day streak, 12 trainer hands.
const sample: Candidate = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: sendTo ?? "preview@example.invalid",
  name: "Alex",
  signedUpAt: new Date(now - 7 * day).toISOString(),
  timezone: "Europe/Amsterdam",
  lastActiveAt: new Date(now - 3 * 3_600_000).toISOString(),
  activeToday: true,
  streak: 3,
  handsTotal: 12,
  handsGood: 9,
  handsSource: "log",
  weakestRef: null,
  weakestHands: null,
  weakestWrong: null,
  emailsSent: {},
  lastEmailAt: null,
  plan: "trial",
  trialEndsAt: new Date(now + 2 * day).toISOString(),
};

const site = "https://stackedpokerai.com";
const outDir = path.join(os.tmpdir(), "stackedpoker-lifecycle-preview");
fs.mkdirSync(outDir, { recursive: true });

// No top-level await: the frontend package is CommonJS for tsx.
async function main() {
  for (const template of TEMPLATES) {
    const email = renderEmail(template, sample, {
      siteUrl: site,
      unsubscribeUrl: `${site}/unsubscribe?preview=1`,
      seed: `${sample.userId}:preview`,
    }, now);
    const file = path.join(outDir, `${template}.html`);
    fs.writeFileSync(file, email.html);
    console.log(`${template}: "${email.subject}" → ${file}`);
    if (sendTo) {
      const { id } = await sendWithResend({
        to: sendTo,
        email: { ...email, subject: `[Preview] ${email.subject}` },
        oneClickUrl: `${site}/api/email/unsubscribe?preview=1`,
        idempotencyKey: `preview-${template}-${randomUUID()}`,
      });
      console.log(`  sent to ${sendTo} (Resend id ${id})`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

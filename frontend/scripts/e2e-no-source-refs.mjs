#!/usr/bin/env node
/**
 * Browser check that no screen names the theory source (book, author, chapter,
 * diagram, hand-range or page number). Companion to check-no-source-refs.mjs,
 * which greps the build: this one reads what a signed-in user actually sees —
 * document.body.innerText plus every title / aria-label / alt / placeholder —
 * on Hand Review (example tournament, a hand in the replayer with EVERY option
 * of the villain range picker), the Preflop Trainer answer screen, the Flop
 * Trainer answer screen and the Flop Explorer.
 *
 *   SITE=http://localhost:3100 \
 *   E2E_EMAIL=… E2E_PASSWORD=…            # a real test account, or:
 *   E2E_SESSION_MODULE=path/to/mock.mjs   # exports session() for a mock Supabase
 *   [E2E_HAND_FILE=hand-history.txt]      # imported when the account has no hands
 *   node scripts/e2e-no-source-refs.mjs
 *
 * Exits 1 on any hit or when a screen could not be reached. Screenshots land in
 * E2E_OUT (default: ./e2e-out), including the range picker opened as a list.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scanText } from "./check-no-source-refs.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SITE = process.env.SITE ?? "http://localhost:3000";
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-out");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const failures = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) failures.push(name);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Everything a user can read on the page, attributes included. */
async function visibleText(page) {
  return page.evaluate(() => {
    const attrs = [];
    for (const el of document.querySelectorAll("[title],[aria-label],[alt],[placeholder],[aria-description]")) {
      for (const a of ["title", "aria-label", "alt", "placeholder", "aria-description"]) {
        const v = el.getAttribute(a);
        if (v) attrs.push(v);
      }
    }
    const options = [...document.querySelectorAll("option,optgroup")].map((o) => o.label || o.textContent || "");
    return [document.title, document.body.innerText, ...attrs, ...options].join("\n");
  });
}

async function check(page, name) {
  const text = await visibleText(page);
  const hits = scanText(name, text);
  record(`${name}: no source references`, hits.length === 0, hits.map((h) => `"${h.match}" in …${h.snippet}…`).join(" | "));
  return text;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", bypassCSP: true });
await context.addInitScript(() => {
  try {
    localStorage.setItem("sp_consent", "denied");
  } catch {}
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const go = async (p) => {
  await page.goto(new URL(p, SITE).href, { waitUntil: "load", timeout: 180_000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" }).catch(() => {});
};

// ── Sign in ──────────────────────────────────────────────────────────────────
if (process.env.E2E_SESSION_MODULE) {
  const { session } = await import(pathToFileURL(path.resolve(process.env.E2E_SESSION_MODULE)).href);
  const host = new URL(SITE).hostname.split(".")[0];
  await context.addCookies([{ name: `sb-${host}-auth-token`, value: "base64-" + Buffer.from(JSON.stringify(session())).toString("base64url"), url: SITE }]);
} else if (process.env.E2E_EMAIL) {
  await go("/login");
  await page.fill('input[type="email"]', process.env.E2E_EMAIL);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD ?? "");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
} else {
  console.error("Set E2E_EMAIL/E2E_PASSWORD or E2E_SESSION_MODULE to sign in.");
  process.exit(2);
}

// ── Hand Review: example tournament ─────────────────────────────────────────
await go("/hands/example");
await check(page, "/hands/example");

// ── Hand Review: a hand in the replayer, range editor with every option ─────
await go("/hands?minPot=0");
// The list loads after the client knows the user (and may re-check stored hands first).
await page.waitForSelector('a[href^="/hands/"][href*="-"]', { timeout: 120_000 }).catch(() => {});
let href = await page.locator('a[href^="/hands/"]').evaluateAll((as) =>
  as.map((a) => a.getAttribute("href")).find((h) => /^\/hands\/[0-9a-f-]{36}(\?|$)/.test(h ?? "")),
);
if (!href && process.env.E2E_HAND_FILE) {
  await go("/hands/import");
  await page.setInputFiles('input[type="file"]', path.resolve(process.env.E2E_HAND_FILE));
  await page.waitForFunction(() => /import complete|imported|saved/i.test(document.body.innerText), null, { timeout: 120_000 }).catch(() => {});
  await go("/hands");
  href = await page.locator('a[href^="/hands/"]').evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")).find((h) => /^\/hands\/[0-9a-f-]{36}(\?|$)/.test(h ?? "")),
  );
}
record("a hand to open in the replayer", Boolean(href), href ?? "no hand in this account (set E2E_HAND_FILE)");
await check(page, "/hands");
if (href) {
  await go(href);
  await check(page, "replayer");
  const editor = page.getByRole("button", { name: /villain's range/i }).first();
  if (await editor.count()) {
    await editor.click();
    await page.waitForSelector("select#preset", { timeout: 30_000 });
    const options = await page.locator("select#preset option, select#preset optgroup").evaluateAll((els) =>
      els.map((e) => (e.tagName === "OPTGROUP" ? `[${e.getAttribute("label")}]` : e.textContent ?? "")),
    );
    fs.writeFileSync(path.join(OUT, "range-picker-options.txt"), options.join("\n") + "\n");
    const hits = scanText("range picker", options.join("\n"));
    record(`range picker: ${options.length} options, none with a source reference`, options.length > 1 && hits.length === 0, hits.map((h) => h.match).join(", "));
    // A native <select> cannot be photographed open: show it as a list box instead.
    await page.locator("select#preset").evaluate((s) => {
      s.size = Math.min(24, s.options.length + 3);
      s.style.height = "auto";
    });
    await page.locator("select#preset").screenshot({ path: path.join(OUT, "range-picker.png") });
    await check(page, "range editor");
  } else {
    record("range editor button found", false, "no “Villain's range” button on this hand");
  }
}

// ── Preflop Trainer: answer screen ──────────────────────────────────────────
await go("/preflop-trainer");
const action = page.locator('[data-tour="trainer-actions"] button').first();
if (await action.count()) {
  await action.click();
  await page.waitForSelector('[data-tour="trainer-result"]', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  record("preflop trainer answer screen", await page.locator('[data-tour="trainer-result"]').count() > 0);
  await page.screenshot({ path: path.join(OUT, "preflop-trainer-answer.png"), fullPage: true });
} else {
  record("preflop trainer answer screen", false, "no action buttons");
}
await check(page, "/preflop-trainer (answer)");

// ── Flop Trainer: answer screen ─────────────────────────────────────────────
await go("/flop-trainer");
for (const group of await page.locator('[role="radiogroup"]').all()) {
  await group.locator("button").first().click().catch(() => {});
}
const submit = page.getByRole("button", { name: /^(check|submit|answer|lock in)/i }).first();
if (await submit.count()) await submit.click().catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, "flop-trainer-answer.png"), fullPage: true });
await check(page, "/flop-trainer (answer)");

// ── Flop Explorer ───────────────────────────────────────────────────────────
await go("/flop-trainer/explorer");
await check(page, "/flop-trainer/explorer");

// ── Range browser ───────────────────────────────────────────────────────────
await go("/ranges");
await check(page, "/ranges");

await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(failures.length ? `\n${failures.length} check(s) failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failures.length ? 1 : 0);

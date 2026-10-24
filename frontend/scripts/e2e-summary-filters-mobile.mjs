#!/usr/bin/env node
/**
 * Mobile check for the tournament summary filters (/hands/summary/[id]): at
 * 375 and 390 px with touch, every filter chip must be on top (nothing
 * covering it), at least 44 px tall, reachable by horizontal scroll, and a
 * tap must switch the hand list and bring it into view.
 *
 * Runs against a tiny in-process stand-in for Supabase (auth + the few
 * queries the page makes), so no account or real data is needed. Start the
 * site against it first:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54499 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock npx next dev -p 3200
 *   SITE=http://localhost:3200 node scripts/e2e-summary-filters-mobile.mjs
 *
 * The signed-in user is a Free account whose trial just ended, so the trial
 * banner and the cookie banner are both on screen, as on a first visit.
 * Exits 1 on any failure; screenshots land in E2E_OUT (default ./e2e-out).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The `@/*` alias, as in scripts/run-ts.js (jiti's own alias misses .json imports).
const Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return resolve.call(this, request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request, ...rest);
};
const jiti = require("jiti")(fileURLToPath(import.meta.url));
const { SUMMARY_FILTERS, SUMMARY_VERSION } = jiti(path.join(ROOT, "lib/handHistory/summary/compute.ts"));

const SITE = process.env.SITE ?? "http://localhost:3200";
const MOCK_PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54499);
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-out");
fs.mkdirSync(OUT, { recursive: true });

// ── Fixture: one tournament with a current stored summary ───────────────────
const TOUR_ID = "11111111-2222-4333-8444-555555555555";
const hid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LIST_SIZES = { misplayed: 6, tight: 3, loose: 2, mixed: 4, big: 5 };
const hands = {};
const lists = {};
let n = 0;
for (const f of SUMMARY_FILTERS) {
  lists[f] = [];
  for (let i = 0; i < LIST_SIZES[f]; i++) {
    const id = hid(++n);
    lists[f].push(id);
    hands[id] = { id, cards: ["As", "Kd"], pos: "CO", potBb: 3 + n, playedAt: "2026-10-20T20:00:00", penalty: 0, mistake: null };
  }
}
const summary = { version: SUMMARY_VERSION, handCount: 40, graded: 30, score: 88, mistakes: { total: 6, small: 4, big: 2 }, lists, hands };
const tournament = {
  id: TOUR_ID, site: "ggpoker", tournament_id: "T-1", name: "Mobile Filter Test", hand_count: 40,
  first_hand_at: "2026-10-20T19:00:00", last_hand_at: "2026-10-20T22:00:00", score: 88, summary,
};

// ── Mock Supabase ───────────────────────────────────────────────────────────
const b64url = (s) => Buffer.from(s).toString("base64url");
const USER = { id: "00000000-0000-4000-8000-00000000e2e0", aud: "authenticated", role: "authenticated", email: "e2e@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-10-01T10:00:00Z" };
const ACCESS_TOKEN = [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify({ sub: USER.id, aud: "authenticated", role: "authenticated", exp: 4102444800 })), b64url("sig")].join(".");
const session = { access_token: ACCESS_TOKEN, token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, refresh_token: "r", user: USER };
const TABLES = {
  profiles: [{ id: USER.id, email: USER.email, username: "e2e", display_name: "e2e", subscription_tier: "free", assessment_completed: true, xp: 0, level: 1 }],
  user_onboarding: [{ user_id: USER.id, onboarding_choice_seen_at: "2026-10-01T10:05:00Z", hand_review_tour_done_at: "2026-10-01T10:06:00Z" }],
  hh_tournaments: [tournament],
};
const RPC = {
  my_entitlements: () => ({
    plan: "free", trial_ends_at: new Date(Date.now() - 86400000).toISOString(), trial_ended: true, trial_ended_seen: true,
    subscription: { status: null, current_period_end: null, cancel_at_period_end: false, has_customer: false },
    limits: { trainer_hands_per_day: 50, tournaments_per_week: 1, ai_questions_per_day: 3 },
    usage: { trainer_hands_today: 0, ai_questions_today: 0, tournaments_this_week: 1 },
  }),
  hh_previous_tournament_score: () => [],
};
const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => {
    res.writeHead(status, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  if (url.pathname === "/auth/v1/user") return send(200, USER);
  if (url.pathname === "/auth/v1/token") return send(200, session);
  if (url.pathname.startsWith("/auth/v1/")) return send(200, {});
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) return send(200, RPC[rpc[1]]?.() ?? null);
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m) return send(404, { message: "not found" });
  const rows = (TABLES[m[1]] ?? []).filter((r) =>
    [...url.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3)),
  );
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
    return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
  }
  send(200, rows);
});
await new Promise((r) => mock.listen(MOCK_PORT, r));

// ── Checks ──────────────────────────────────────────────────────────────────
const failures = [];
const record = (name, ok, detail = "") => {
  if (!ok) failures.push(name);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
try {
  for (const width of [375, 390]) {
    const context = await browser.newContext({
      ...devices["iPhone 12"],
      viewport: { width, height: 740 },
      colorScheme: "dark",
      bypassCSP: true,
    });
    const host = new URL(`http://localhost:${MOCK_PORT}`).hostname.split(".")[0];
    await context.addCookies([{ name: `sb-${host}-auth-token`, value: "base64-" + b64url(JSON.stringify(session)), url: SITE }]);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    await page.goto(new URL(`/hands/summary/${TOUR_ID}`, SITE).href, { waitUntil: "load", timeout: 180_000 });
    await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" }).catch(() => {});
    await page.waitForSelector("[data-summary-filter]", { timeout: 120_000 });
    await page.waitForTimeout(1500);

    const tag = `${width}px`;
    record(`${tag}: no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

    const chipTops = await page.locator("[data-summary-filter]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    record(`${tag}: chips in one (scrollable) row`, new Set(chipTops).size === 1, `tops ${chipTops.join(",")}`);

    // Where a user first meets the chips: the row just above the fixed bottom
    // banners, with the list below it hidden behind them.
    await page.evaluate(() => {
      const chips = document.querySelector('[role="tablist"]').getBoundingClientRect();
      const banners = [...document.querySelectorAll("body *")]
        .filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().bottom >= window.innerHeight - 1 && e.getBoundingClientRect().height > 0)
        .map((e) => e.getBoundingClientRect().top);
      const floor = Math.min(window.innerHeight, ...banners);
      window.scrollBy(0, chips.bottom - floor + 8);
    });
    await page.waitForTimeout(300);

    /** What a finger at the element's centre would actually hit. */
    const hitTest = (loc) =>
      loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { onTop: !!top && el.contains(top), what: top ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 80)}` : "off screen" };
      });

    // Misplayed is selected on load, so start elsewhere: every tap must change the list.
    let shown = [];
    for (const f of [...SUMMARY_FILTERS.filter((x) => x !== "misplayed"), "misplayed"]) {
      const chip = page.locator(`[data-summary-filter="${f}"]`);
      const box = await chip.boundingBox();
      record(`${tag} ${f}: at least 44px tall`, !!box && box.height >= 44, box ? `${Math.round(box.height)}px` : "no box");
      await chip.evaluate((el) => el.scrollIntoView({ inline: "nearest", block: "nearest" })); // horizontal scroll only
      const hit = await hitTest(chip);
      record(`${tag} ${f}: not covered`, hit.onTop, hit.onTop ? "" : `covered by ${hit.what}`);

      await chip.tap({ timeout: 5000 }).catch((e) => record(`${tag} ${f}: tap`, false, e.message.split("\n")[0]));
      await page.waitForTimeout(900); // smooth scroll
      const state = await page.evaluate(() => {
        const sel = document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-summary-filter");
        const section = document.querySelector("[data-summary-filter]")?.closest("section");
        const links = [...(section?.querySelectorAll('ul a[href^="/hands/"]') ?? [])].map((a) => a.getAttribute("href").split("/").pop());
        return { sel, links };
      });
      record(`${tag} ${f}: selected after tap`, state.sel === f, `selected=${state.sel}`);
      const changed = state.links.join() !== shown.join();
      record(`${tag} ${f}: list switched to its hands`, changed && state.links.length > 0 && state.links.every((id) => lists[f].includes(id)), `${state.links.length} rows`);
      shown = state.links;
      const row = await hitTest(page.locator("[data-summary-filter]").first().locator("xpath=ancestor::section//ul/li[1]"));
      record(`${tag} ${f}: first row visible after tap`, row.onTop, row.onTop ? "" : `hit ${row.what}`);
    }
    await page.screenshot({ path: path.join(OUT, `summary-filters-${width}.png`) });
    await context.close();
  }
} finally {
  await browser.close();
  mock.close();
}

console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall passed");
process.exit(failures.length ? 1 : 0);

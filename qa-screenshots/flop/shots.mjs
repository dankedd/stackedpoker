/**
 * Flop analysis in Hand Review, end to end on the local site (mock Supabase,
 * demo tournament from make-tournament.mjs — no real user data):
 *
 *   import → overview backfill (flop verdicts stored through hh_set_flop_checks)
 *   → summary line + "Flop: Questionable" filter
 *   → replayer: step to Hero's flop action → panel (spot, hand position,
 *     verdict + explanation) and the badge next to Hero's action
 *   → "coming soon" for a matched spot without precomputed flops
 *
 * The flop row for the demo flop is seeded into the mock from the real
 * precomputed file; Hero's hand position (a backend call) is answered with the
 * backend's formula output stored in demo.json. Checks fail loudly.
 *
 *   node qa-screenshots/flop/shots.mjs            (site :3100, mock :54399)
 *   → qa-screenshots/flop/out/*.png + checks printed
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const require = createRequire(path.join(ROOT, "frontend/package.json"));
const { chromium, webkit, devices } = require("playwright");
const { session } = await import(pathToFileURL(path.join(ROOT, "ads/rusty-video/scripts/mock-supabase.mjs")).href);

const SITE = process.env.SITE ?? "http://localhost:3100";
const MOCK = process.env.MOCK ?? "http://localhost:54399";
const OUT = path.join(here, "out");
fs.mkdirSync(OUT, { recursive: true });
const demo = JSON.parse(fs.readFileSync(path.join(here, "data/demo.json"), "utf8"));
const TXT = path.join(here, "data/GG20261021-1500 - Demo Flop Cup.txt");
const checks = [];
const ok = (name, cond, detail = "") => {
  checks.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── Seed the flop row(s) for the demo flop (once per spot+flop) ─────────────
for (const row of [demo.good.row, demo.questionable.row]) {
  const have = await (await fetch(`${MOCK}/rest/v1/flop_equity?spot_id=eq.${demo.spot}&flop=eq.${row.flop}&select=flop`)).json();
  if (have.length) continue;
  const r = await fetch(`${MOCK}/rest/v1/flop_equity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`seed flop_equity: ${r.status}`);
}

const POSITIONS = { [demo.good.cls]: demo.good.position, [demo.questionable.cls]: demo.questionable.position };

async function newContext(type, ctx) {
  const browser = await type.launch();
  const context = await browser.newContext({ ...ctx, colorScheme: "dark", bypassCSP: true });
  await context.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session())).toString("base64url"), url: SITE }]);
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("sp_consent", "denied");
    } catch {}
  });
  // Backend calls: Hero's hand position from demo.json, everything else empty.
  await context.route(`${SITE}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/flop-trainer/hand-position") {
      const pos = POSITIONS[url.searchParams.get("hand")];
      return route.fulfill(pos ? { json: pos } : { status: 404, json: { detail: "Unknown spot or flop." } });
    }
    return route.fulfill({ json: {} });
  });
  // WebKit ignores bypassCSP for the CSP's upgrade-insecure-requests, so strip
  // the header there. Not in Chromium: a page Playwright fulfils counts as
  // "public" for Chrome's Local Network Access, which then blocks its calls to
  // the mock on localhost.
  if (type === webkit) {
    await context.route(`${SITE}/**`, async (route) => {
      if (new URL(route.request().url()).pathname.startsWith("/api/")) return route.fallback();
      // next dev compiles a route on its first visit: give it time.
      const res = await route.fetch({ timeout: 240_000 });
      const headers = { ...res.headers() };
      delete headers["content-security-policy"];
      await route.fulfill({ response: res, headers });
    });
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn("[page error]", e.message));
  return { browser, page };
}
const hideDevUi = (page) => page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }" }).catch(() => {});
const rowId = async (handId) => (await (await fetch(`${MOCK}/rest/v1/hh_hands?hand_id=eq.${handId}&select=id`)).json())[0]?.id;

// ── 1. Import + backfill (desktop) ──────────────────────────────────────────
{
  const { browser, page } = await newContext(chromium, { viewport: { width: 1280, height: 900 } });
  // The importer refuses until the client knows the user, and next dev may reload
  // the page while it compiles: upload, then check the mock, up to five times.
  for (let attempt = 1; attempt <= 5 && !(await rowId(demo.good.handId)); attempt++) {
    await page.goto(`${SITE}/hands/import`, { waitUntil: "load", timeout: 180_000 }).catch(() => {});
    await page.waitForFunction(() => document.body.innerText.includes("rusty"), null, { timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.setInputFiles('input[type="file"]', TXT).catch((e) => console.log(`import attempt ${attempt}: ${e.message.slice(0, 160)}`));
    await page.waitForFunction(() => /import complete|imported|saved|not signed in/i.test(document.body.innerText), null, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`import attempt ${attempt}: ${(await rowId(demo.good.handId)) ? "hands in the mock" : "no hands yet"}`);
  }
  ok("demo tournament imported", await rowId(demo.good.handId));
  await page.goto(`${SITE}/hands`, { waitUntil: "load", timeout: 180_000 });
  await page.waitForSelector("[data-flop-summary]", { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const summary = await page.evaluate(() => document.body.innerText.match(/Flop: \d+ analysed · \d+ questionable/)?.[0] ?? "");
  ok("overview summary line", summary, summary);
  const stored = await (await fetch(`${MOCK}/rest/v1/hh_hands?select=hand_id,flop_check,flop_version&flop_check=not.is.null`)).json();
  ok("verdicts stored by the backfill", stored.length >= 2, stored.map((r) => `${r.hand_id}:${r.flop_check}`).join(" "));
  await hideDevUi(page);
  await page.screenshot({ path: path.join(OUT, "desktop-overview.png") });
  await page.goto(`${SITE}/hands?flop=questionable`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await hideDevUi(page);
  const listed = await page.evaluate(() => document.body.innerText);
  ok("filter Flop: Questionable shows only the questionable hand", listed.includes("Flop decisions: Questionable") && /\b1 of \d+ hands\b/.test(listed), listed.match(/\b\d+ of \d+ hands\b/)?.[0] ?? "");
  await page.screenshot({ path: path.join(OUT, "desktop-overview-flop-questionable.png"), fullPage: true });
  await browser.close();
}

// ── 2. Replayer per state, desktop + phones ─────────────────────────────────
const STATES = [
  { key: "good", handId: demo.good.handId, expect: "Good" },
  { key: "questionable", handId: demo.questionable.handId, expect: "Questionable" },
  { key: "coming-soon", handId: demo.comingSoon.handId, expect: "Analysis for this spot is coming soon." },
];
const VIEWS = [
  { name: "desktop", type: chromium, ctx: { viewport: { width: 1280, height: 900 } } },
  // iPhone 14 profile (Safari's toolbars taken off the 844px screen) and Pixel 7 (Chrome's toolbar).
  { name: "iphone-390", type: webkit, ctx: { ...devices["iPhone 14"] } },
  { name: "pixel-412", type: chromium, ctx: { ...devices["Pixel 7"] } },
];
for (const v of VIEWS) {
  const { browser, page } = await newContext(v.type, v.ctx);
  for (const s of STATES) {
    const id = await rowId(s.handId);
    await page.goto(`${SITE}/hands/${id}`, { waitUntil: "load", timeout: 180_000 });
    await page.waitForTimeout(2000);
    // Step to Hero's flop action: the step that carries the flop badge.
    await page.keyboard.press("Home");
    const badge = page.locator('span[title="Flop decision check"]');
    for (let i = 0; i < 40 && !(await badge.count()); i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(250);
    }
    ok(`${v.name} ${s.key}: badge next to Hero's flop action`, await badge.count(), (await badge.first().innerText().catch(() => "")).trim());
    await page.waitForTimeout(1500);
    await hideDevUi(page);
    const panel = page.locator("section, div").filter({ hasText: "The flop for both ranges" }).last();
    const body = await page.evaluate(() => document.body.innerText);
    ok(`${v.name} ${s.key}: panel shows "${s.expect}"`, body.toLowerCase().includes(s.expect.toLowerCase()));
    if (s.key !== "coming-soon") {
      const pos = s.key === "good" ? demo.good.position : demo.questionable.position;
      ok(`${v.name} ${s.key}: hand position (bucket + top %)`, new RegExp(`top ${Math.round(pos.top_pct)}% of your range`).test(body), `${pos.bucket}, top ${pos.top_pct}%`);
    }
    // Phones: no sideways scroll, nothing fixed/sticky over the panel.
    if (v.name !== "desktop") {
      const layout = await page.evaluate(() => {
        const el = [...document.querySelectorAll("*")].find((e) => e.children.length < 40 && /The flop for both ranges/.test(e.textContent ?? "") && e.getBoundingClientRect().height > 60 && e.getBoundingClientRect().height < 2000);
        const p = el?.getBoundingClientRect();
        const covers = [...document.querySelectorAll("body *")].filter((e) => {
          const st = getComputedStyle(e);
          if (!(st.position === "fixed" || st.position === "sticky") || st.display === "none" || st.visibility === "hidden") return false;
          const r = e.getBoundingClientRect();
          if (!p || r.height === 0 || r.width === 0) return false;
          return r.top < p.bottom && r.bottom > p.top && r.left < p.right && r.right > p.left && !e.contains(el) && !el.contains(e) && !/header|nav/i.test(e.tagName);
        });
        return { sideways: document.documentElement.scrollWidth - window.innerWidth, covers: covers.map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`) };
      });
      ok(`${v.name} ${s.key}: no horizontal scroll`, layout.sideways <= 0, `${layout.sideways}px`);
      ok(`${v.name} ${s.key}: nothing fixed/sticky over the panel`, layout.covers.length === 0, layout.covers.join(", "));
    }
    // The panel itself: <section aria-labelledby="flop-spot-title"> (components/flop-trainer/FlopSpotPanel.tsx).
    const flopPanel = page.locator('section[aria-labelledby="flop-spot-title"]');
    await flopPanel.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await flopPanel.screenshot({ path: path.join(OUT, `panel-${v.name}-${s.key}.png`) }).catch((e) => ok(`${v.name} ${s.key}: panel screenshot`, false, e.message));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${v.name}-${s.key}.png`) });
    await page.screenshot({ path: path.join(OUT, `${v.name}-${s.key}-full.png`), fullPage: true });
  }
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "checks.json"), JSON.stringify(checks, null, 1));
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks ok`);
process.exit(failed.length ? 1 : 0);

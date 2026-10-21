/**
 * Before/after screenshots of /preflop-trainer on phones (and desktop, to prove
 * it is unchanged). Guest session, deal forced through a stack-gated
 * Math.random queue (only the trainer's dealing functions read it).
 *
 *   node qa-screenshots/preflop-mobile/shots.mjs before
 *   node qa-screenshots/preflop-mobile/shots.mjs after
 *
 * Phones (Playwright device emulation, mobile UA, touch, DPR):
 *  - iphone:  WebKit, iPhone 14 profile, screen 375×812. Visible viewport
 *             375×632: the screen minus Safari's status bar and toolbars, the
 *             same 180 px Playwright's own iPhone 14 profile reserves (844 → 664).
 *  - android: Chromium, Pixel 7 profile, screen 412×915, visible 412×839
 *             (Playwright's profile, i.e. with Chrome's toolbar).
 * States: 1-question, 2-answer (range screen), 3-range-bottom (scrolled to the end).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "../../frontend");
const require = createRequire(path.join(FRONTEND, "package.json"));
const { chromium, webkit, devices } = require("playwright");
const DEFENSE = JSON.parse(fs.readFileSync(path.join(FRONTEND, "data/ranges/defense.json"), "utf8"));

const SITE = process.env.SITE ?? "http://localhost:3100";
const phase = process.argv[2] ?? "before";
const OUT = path.join(here, phase);
fs.mkdirSync(OUT, { recursive: true });

// UTG+1 3-bet UTG's open, UTG 4-bets (60bb, not all-in): Hand Range 135-ish chart in defense.json.
const SPOT = process.env.SPOT ? JSON.parse(process.env.SPOT) : { hero: "UTG+1", vil: "UTG", spot: "4bet", stack: 60, hand: "QQ", cards: ["Q", "h", "Q", "s"], group: "mtt" };
const SUITS = ["s", "h", "d", "c"];
const combos = (h) => (h.length === 2 ? 6 : h[2] === "s" ? 4 : 12);
function rngQueue() {
  const pool = DEFENSE.filter((c) => c.group === (SPOT.group ?? "mtt")); // defensePool(game), all weight 1
  const ci = pool.findIndex((c) => c.hero === SPOT.hero && c.vil === SPOT.vil && c.spot === SPOT.spot && c.stack === SPOT.stack);
  if (ci < 0) throw new Error("spot not found");
  const chart = pool[ci];
  const q = [(ci + 0.5) / pool.length];
  const hands = Object.keys(chart.grid).filter((h) => chart.grid[h] !== null);
  let before = 0;
  for (const h of hands) {
    if (h === SPOT.hand) break;
    before += combos(h);
  }
  q.push((before + combos(SPOT.hand) / 2) / hands.reduce((s, h) => s + combos(h), 0));
  q.push((SUITS.indexOf(SPOT.cards[1]) + 0.5) / 4);
  if (SPOT.hand.length === 2 || SPOT.hand[2] === "o") q.push((SUITS.indexOf(SPOT.cards[3]) + 0.5) / 4);
  return { q, chart };
}
const { q, chart } = rngQueue();
console.log(`spot: HR ${chart.n} p.${chart.page} ${chart.title}; actions ${chart.actions.map((a) => a.label).join("/")}`);

const TARGETS = [
  { name: "iphone-375x812", type: webkit, ctx: { ...devices["iPhone 14"], viewport: { width: 375, height: 632 }, screen: { width: 375, height: 812 } } },
  { name: "android-412x915", type: chromium, ctx: { ...devices["Pixel 7"], viewport: { width: 412, height: 839 }, screen: { width: 412, height: 915 } } },
  { name: "desktop-1280x900", type: chromium, ctx: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 } },
  ...(process.env.LAPTOP ? [{ name: "laptop-1341x843", type: chromium, ctx: { viewport: { width: 1341, height: 843 }, deviceScaleFactor: 1 } }] : []),
];

/** Phone table: no seat, chip, Hero's cards or center text may overlap another (360–430px). */
async function collisions(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-phone-table] [data-phone]")].map((el) => {
      const kind = el.getAttribute("data-phone");
      // A seat's box is its plate (the hero's cards are measured separately).
      const target = kind === "seat" ? el.querySelector(":scope > div > div:last-child") ?? el : kind === "chip" || kind === "dealer" ? el.firstElementChild ?? el : el;
      const r = target.getBoundingClientRect();
      return { kind, pos: el.getAttribute("data-pos") ?? "", r: { l: r.left, t: r.top, rt: r.right, b: r.bottom } };
    });
    const d = document.querySelector("[data-phone-table] [data-tt=dealer]");
    if (d) {
      const r = d.getBoundingClientRect();
      items.push({ kind: "dealer", pos: "", r: { l: r.left, t: r.top, rt: r.right, b: r.bottom } });
    }
    const hit = (a, b) => a.l < b.rt - 1 && b.l < a.rt - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const out = [];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j];
        if (A.kind === "seat" && B.kind === "seat") continue; // fixed oval, measured below via chips/cards
        // Hero's cards are tucked 8px into Hero's own plate on purpose.
        if ([A, B].some((x) => x.kind === "cards") && [A, B].some((x) => x.kind === "seat" && x.pos === document.querySelector("[data-phone=cards]")?.closest("[data-pos]")?.getAttribute("data-pos"))) continue;
        if (hit(A.r, B.r)) out.push(`${A.kind}${A.pos ? ":" + A.pos : ""} × ${B.kind}${B.pos ? ":" + B.pos : ""}`);
      }
    return out;
  });
}

if (phase === "after") {
  const browser = await chromium.launch();
  for (const w of [360, 375, 390, 412, 430]) {
    const context = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: w, height: 800 }, colorScheme: "dark" });
    await context.route(`${SITE}/**`, async (route) => {
      const res = await route.fetch();
      const headers = { ...res.headers() };
      delete headers["content-security-policy"];
      await route.fulfill({ response: res, headers });
    });
    await context.addInitScript((q) => {
      window.__dealQueue = q;
      const real = Math.random.bind(Math);
      Math.random = () => (window.__dealQueue.length && /newDeal|pickWeighted|pickScenario|dealHand|cardsFor/.test(new Error().stack ?? "") ? window.__dealQueue.shift() : real());
    }, q);
    const page = await context.newPage();
    await page.goto(`${SITE}/preflop-trainer?type=def&game=${SPOT.group ?? "mtt"}`, { waitUntil: "load", timeout: 180_000 });
    await page.waitForSelector("[data-phone-table]", { timeout: 120_000 });
    await page.waitForTimeout(800);
    const c = await collisions(page);
    console.log(`width ${w}: ${c.length ? "OVERLAP " + c.join(", ") : "no overlaps"}`);
    if (process.argv.includes("--boxes"))
      console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-phone-table] [data-phone]")].map((el) => { const r = (el.getAttribute("data-phone") === "chip" ? el.firstElementChild : el.getAttribute("data-phone") === "seat" ? el.querySelector(":scope > div > div:last-child") : el).getBoundingClientRect(); return `${el.getAttribute("data-phone")}:${el.getAttribute("data-pos") ?? ""} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; }))));
    await context.close();
  }
  await browser.close();
}

if (process.argv.includes("--check-only")) process.exit(0);

for (const t of TARGETS) {
  const browser = await t.type.launch();
  const context = await browser.newContext({ ...t.ctx, colorScheme: "dark", bypassCSP: true });
  await context.addInitScript((q) => {
    try {
      window.localStorage.setItem("sp_consent", "denied");
    } catch {}
    window.__dealQueue = q;
    const real = Math.random.bind(Math);
    Math.random = () => {
      if (window.__dealQueue.length && /newDeal|pickWeighted|pickScenario|dealHand|cardsFor/.test(new Error().stack ?? "")) return window.__dealQueue.shift();
      return real();
    };
  }, q);
  // WebKit ignores bypassCSP for the header's upgrade-insecure-requests (http://localhost → https fails): drop the header locally.
  await context.route(`${SITE}/**`, async (route) => {
    const res = await route.fetch();
    const headers = { ...res.headers() };
    delete headers["content-security-policy"];
    await route.fulfill({ response: res, headers });
  });
  const page = await context.newPage();
  await page.goto(`${SITE}/preflop-trainer?type=def&game=${SPOT.group ?? "mtt"}`, { waitUntil: "load", timeout: 180_000 });
  await page.waitForSelector('[data-tour="trainer-actions"] button', { timeout: 120_000 });
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }" });
  await page.waitForTimeout(1500);
  const spot = await page.evaluate(() => document.querySelector('[data-tour="trainer-spot"]')?.textContent ?? "");
  if (!/60/.test(spot)) throw new Error(`${t.name}: unexpected spot ${spot}`);
  // 1. Question: table + buttons in view.
  await page.evaluate(() => document.querySelector('[data-tour="trainer-spot"]')?.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -12));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${t.name}-1-question.png`) });
  // 2. Answer: Call.
  await page.evaluate(() => [...document.querySelectorAll('[data-tour="trainer-actions"] button')].find((b) => /^Call/.test(b.textContent ?? ""))?.click());
  await page.waitForSelector('[data-tour="trainer-result"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${t.name}-2-answer.png`) });
  // 3. Scrolled to the end of the result (its own scroll box, or the page).
  await page.evaluate(() => {
    const r = document.querySelector('[data-tour="trainer-result"]');
    let el = r;
    while (el && el !== document.body && !(el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (el && el !== document.body) el.scrollTop = el.scrollHeight;
    // Inline result (phone, after): the end of the result — range + "Next hand" — at the bottom of the screen.
    else if (window.innerWidth <= 480) r?.scrollIntoView({ block: "end" });
    else window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${t.name}-3-range-bottom.png`) });
  console.log("done", t.name);
  await browser.close();
}

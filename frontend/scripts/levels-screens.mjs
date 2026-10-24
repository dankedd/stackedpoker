#!/usr/bin/env node
/**
 * Screenshots of the level screens at 390 px (iPhone, touch) and 1280 px:
 * dashboard level card (+ the one-time rebalance note), leaderboard badges,
 * the trainer's +XP feedback and the level-up moment. Also checks there is no
 * horizontal page scroll. Supabase AND the backend are one in-process stand-in,
 * so no account or data is needed:
 *
 *   NEXT_DIST_DIR=.next-levels NEXT_PUBLIC_SUPABASE_URL=http://localhost:54510 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=mock NEXT_PUBLIC_API_URL=http://localhost:54510 \
 *     NEXT_PUBLIC_FEATURE_PREFLOP_RANGES=true npx next dev -p 3300
 *   SITE=http://localhost:3300 node scripts/levels-screens.mjs [screen…]
 *
 * PNGs land in E2E_OUT (default ./e2e-out/levels).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const SITE = process.env.SITE ?? "http://localhost:3300";
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 54510);
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-out/levels");
fs.mkdirSync(OUT, { recursive: true });

// ── Fixture ─────────────────────────────────────────────────────────────────
const b64url = (s) => Buffer.from(s).toString("base64url");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = {
  id: uid(1), aud: "authenticated", role: "authenticated", email: "player@example.com",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-01T10:00:00Z",
};
const ACCESS_TOKEN = [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify({ sub: USER.id, aud: "authenticated", role: "authenticated", exp: 4102444800 })), b64url("sig")].join(".");
const session = { access_token: ACCESS_TOKEN, token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, refresh_token: "r", user: USER };
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();

// Level 9 (Calling Station), 2 XP short of level 10 (266).
const TOTAL = 264;
let levelUp = false;

const board = [
  ["RiverRat", 2238], ["NitNinja", 1923], ["ValueTown", 852], ["Grinder42", 482], ["You", TOTAL], ["SpewKing", 66], ["FoldPre", 10],
].map(([username, total_xp]) => ({ username, total_xp }));

const tables = {
  profiles: [{ id: USER.id, username: "player", display_name: "Player One", subscription_tier: "free", hands_analyzed_count: 0, analyses_limit: 3, handle: "player_one" }],
  user_onboarding: [{ user_id: USER.id, onboarding_choice_seen_at: ago(500), hand_review_tour_done_at: ago(500), trainer_tour_done_at: ago(500) }],
};
const rpc = {
  my_entitlements: () => ({
    plan: "free", trial_ends_at: null, trial_ended: true, trial_ended_seen: true,
    subscription: { status: null, current_period_end: null, cancel_at_period_end: false, has_customer: false },
    limits: { trainer_hands_per_day: 50, tournaments_per_week: 1, ai_questions_per_day: 3 },
    usage: { trainer_hands_today: 12, ai_questions_today: 0, tournaments_this_week: 0 },
  }),
  my_streak: () => ({ streak: 8, active_today: true, today: "2026-10-24", timezone: "Europe/Amsterdam" }),
  my_xp_profile: () => [{
    total_xp: TOTAL, preflop_xp: 198, flop_xp: 51, bonus_xp: 10, hand_review_xp: 5, streak_days: 8,
    daily_xp: 23, daily_cap: 150, levels_notice: true,
  }],
  dismiss_levels_notice: () => null,
  suggest_my_handle: () => "player_one",
  my_social_profile: () => null,
};

// Same table as lib/levels (shared/levels.json).
const THRESHOLDS = JSON.parse(fs.readFileSync(new URL("../lib/levels/levels.json", import.meta.url), "utf8")).thresholds;
const level = (xp) => {
  let l = 1;
  while (l < THRESHOLDS.length && THRESHOLDS[l] <= xp) l++;
  return l;
};

function api(pathname, url, body) {
  if (pathname === "/api/learn/progress") {
    return { skill: { total_xp: TOTAL, level: level(TOTAL), streak_days: 0, last_active: null }, lessons: {}, completed_steps: {}, concepts: {}, leaks: [], achievements: [], completed_modules: [], continue: null };
  }
  if (pathname === "/api/leaderboard") {
    const period = url.searchParams.get("period");
    return {
      period, has_more: false,
      rows: board.map((r, i) => ({
        rank: i + 1, username: r.username, level: level(r.total_xp), total_xp: r.total_xp,
        period_xp: period === "24h" ? Math.max(5, Math.round(r.total_xp / 12)) : null, is_you: r.username === "You",
      })),
    };
  }
  if (pathname === "/api/leaderboard/me") {
    return { period: url.searchParams.get("period"), rank: 5, username: "You", level: level(TOTAL), total_xp: TOTAL, period_xp: null };
  }
  if (pathname === "/api/preflop-trainer/state") {
    return { streak: 3, best_streak: 14, daily_xp: 23, daily_cap: 150, xp_per_correct: 1, next_tier_at: 10 };
  }
  if (pathname === "/api/preflop-trainer/hands") {
    const xp = 1, bonus = 1;
    const total = TOTAL + xp + bonus;
    return {
      streak: 4, best_streak: 14, daily_xp: 24, daily_cap: 150, xp_per_correct: 1, next_tier_at: 10,
      verdict: "correct", xp_awarded: xp, bonus_xp: bonus, too_fast: false, total_xp: total,
      level: level(total), previous_level: 9, leveled_up: levelUp,
      usage: { used: 13, limit: 50, reset_at: new Date(Date.now() + 36e5).toISOString() },
    };
  }
  return null;
}

const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => {
    res.writeHead(status, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  if (url.pathname.startsWith("/api/")) {
    const out = api(url.pathname, url);
    return out ? send(200, out) : send(404, { detail: "not mocked" });
  }
  if (url.pathname === "/auth/v1/user") return send(200, USER);
  if (url.pathname === "/auth/v1/token") return send(200, session);
  if (url.pathname.startsWith("/auth/v1/")) return send(200, {});
  const fn = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (fn) return rpc[fn[1]] ? send(200, rpc[fn[1]]()) : send(404, { code: "PGRST202", message: `function ${fn[1]} not found` });
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m) return send(404, { message: "not found" });
  const rows = (tables[m[1]] ?? []).filter((r) => [...url.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3)));
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
    return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
  }
  send(200, rows);
});

// Answer one hand: the first action button.
async function answer(page) {
  await page.locator('[aria-label="Your action"] button').first().click();
}

const SCREENS = {
  dashboard: { path: "/dashboard", ready: "section[aria-label='Your level']", scrollTo: "section[aria-label='Your level']" },
  leaderboard: { path: "/leaderboard", ready: "text=RiverRat" },
  "trainer-xp": {
    path: "/preflop-trainer", ready: '[aria-label="Your action"] button',
    prepare: async (page) => {
      levelUp = false;
      await answer(page);
      await page.waitForSelector("text=+1 XP");
      await page.locator("text=+1 XP").first().scrollIntoViewIfNeeded();
    },
  },
  "level-up": {
    path: "/preflop-trainer", ready: '[aria-label="Your action"] button',
    prepare: async (page) => {
      levelUp = true;
      await answer(page);
      await page.waitForSelector("text=+1 XP");
      await page.getByRole("button", { name: /next hand/i }).first().click();
      await page.waitForSelector("#level-up-heading");
    },
  },
};

const failures = [];
const record = (name, ok, detail = "") => {
  if (!ok) failures.push(name);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await new Promise((r) => mock.listen(MOCK_PORT, r));
const browser = await chromium.launch();
const wanted = process.argv.slice(2);
try {
  for (const [name, screen] of Object.entries(SCREENS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    for (const vp of [{ tag: "390", device: devices["iPhone 12"], viewport: { width: 390, height: 844 } }, { tag: "desktop", viewport: { width: 1280, height: 860 } }]) {
      const context = await browser.newContext({ ...(vp.device ?? {}), viewport: vp.viewport, colorScheme: "dark", bypassCSP: true });
      await context.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + b64url(JSON.stringify(session)), url: SITE }]);
      await context.addInitScript(() => localStorage.setItem("sp_consent", "denied"));
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      await page.goto(new URL(screen.path, SITE).href, { waitUntil: "load", timeout: 180_000 });
      await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" }).catch(() => {});
      try {
        await page.waitForSelector(screen.ready, { timeout: 120_000 });
        if (screen.prepare) await screen.prepare(page);
        if (screen.scrollTo) await page.locator(screen.scrollTo).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(900);
        const tag = `${name} @${vp.tag}`;
        record(`${tag}: no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}.png`) });
      } catch (e) {
        record(`${name} @${vp.tag}: renders`, false, e.message.split("\n")[0]);
        await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}-FAILED.png`) }).catch(() => {});
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  mock.close();
}
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall passed");
process.exit(failures.length ? 1 : 0);

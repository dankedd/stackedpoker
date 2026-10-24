#!/usr/bin/env node
/**
 * Screenshots of /dashboard at 390 px (iPhone, touch) and 1280 px in four
 * states, plus the mobile checks (hero button above the fold at 390×844, no
 * horizontal page scroll, nothing fixed or sticky over the content). Runs
 * against an in-process stand-in for Supabase like scripts/social-screens.mjs,
 * so no account or data is needed:
 *
 *   NEXT_DIST_DIR=.next-dash NEXT_PUBLIC_SUPABASE_URL=http://localhost:54499 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=mock NEXT_PUBLIC_SOCIAL_PHASES_PREVIEW=all npx next dev -p 3220
 *   SITE=http://localhost:3220 node scripts/dashboard-screens.mjs [state…]
 *
 * States 1–3 are a normal account (social is admin-only for now, so no
 * social blocks); state 4 is an admin account with every social phase
 * previewed (NEXT_PUBLIC_SOCIAL_PHASES_PREVIEW=all, dev only). PNGs land in
 * E2E_OUT (default ./e2e-out/dashboard).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const SITE = process.env.SITE ?? "http://localhost:3220";
const MOCK_PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54499);
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-out/dashboard");
fs.mkdirSync(OUT, { recursive: true });

// ── Fixture ─────────────────────────────────────────────────────────────────
const b64url = (s) => Buffer.from(s).toString("base64url");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = {
  id: uid(1), aud: "authenticated", role: "authenticated", email: "manuel@example.com",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-08-14T10:00:00Z",
};
const ACCESS_TOKEN = [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify({ sub: USER.id, aud: "authenticated", role: "authenticated", exp: 4102444800 })), b64url("sig")].join(".");
const session = { access_token: ACCESS_TOKEN, token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, refresh_token: "r", user: USER };
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const inH = (h) => new Date(Date.now() + h * 3600_000).toISOString();
const card = (n, handle, name) => ({ id: uid(n), handle, name, role: "user", deleted: false });

const ent = ({ plan = "free", spots = 0, tournaments = 0 } = {}) => ({
  plan, trial_ends_at: null, trial_ended: false, trial_ended_seen: true,
  subscription: plan === "pro"
    ? { status: "active", current_period_end: "2026-11-24T10:00:00Z", cancel_at_period_end: false, has_customer: true }
    : { status: null, current_period_end: null, cancel_at_period_end: false, has_customer: false },
  limits: { trainer_hands_per_day: plan === "free" ? 50 : null, tournaments_per_week: plan === "free" ? 1 : null, ai_questions_per_day: plan === "free" ? 3 : null },
  usage: { trainer_hands_today: spots, ai_questions_today: 0, tournaments_this_week: tournaments },
  daily_reset_at: inH(4.2), next_upload_at: null, hidden_tournaments: 0,
});
const xp = (total, preflop, flop, bonus = 0, daily = 0) => ({
  total_xp: total, preflop_xp: preflop, flop_xp: flop, bonus_xp: bonus, hand_review_xp: total - preflop - flop - bonus,
  streak_days: 6, daily_xp: daily, daily_cap: 150, levels_notice: false,
});
const EMPTY_SKILL = { days: 30, preflop: {}, preflop_spots: [], flop: { n: 0, good: 0, categories: {} }, week: [[0, 0], [0, 0]] };
const SKILL = {
  days: 30,
  preflop: { open: [412, 351], defense: [188, 139], pushfold: [64, 58] },
  preflop_spots: [["defense:def_mtt_bb_vs_co_open_25", 31, 13], ["open:open_mtt_utg_25", 40, 9]],
  flop: { n: 96, good: 61, categories: { paired: [18, 8], ace_high: [22, 17], king_high: [15, 11], low_dry: [16, 11], connected: [14, 9], monotone: [11, 5] } },
  week: [[160, 131], [140, 108]],
};
const LEAKS = [
  { hand_id: uid(201), tournament_id: uid(101), played_at: "2026-10-23T22:41:00", hand: "KJo", position: "UTG", street: "preflop", verdict: "too_loose", chart: "open:open_mtt_utg_25", board: [], pot_bb: 9.5 },
  { hand_id: uid(202), tournament_id: uid(101), played_at: "2026-10-23T22:12:00", hand: "QTs", position: "BTN", street: "flop", verdict: "questionable", chart: null, board: ["9h", "8c", "6d"], pot_bb: 14 },
  { hand_id: uid(203), tournament_id: uid(101), played_at: "2026-10-23T21:55:00", hand: "A5o", position: "BB", street: "preflop", verdict: "too_tight", chart: "defense:def_mtt_bb_vs_bn_open_25", board: [], pot_bb: 6 },
];
const lastTour = (reviewed) => ({ id: uid(101), name: "Bounty Hunters $10.80", site: "ggpoker", created_at: ago(5), hand_count: 186, reviewed, mistakes: 3, score: 86 });

const SOCIAL = {
  friends: 4,
  requests: [card(11, "river_rat", "RiverRat")],
  unread: { message: 2, share_comment: 3 },
  shares: [
    { slug: "Ab3dE9x", question: "Call the river shove?", guess_mode: true, created_at: ago(20), views: 48, votes: 21, top: ["call", 13], hero_cards: ["Ah", "Qd"] },
    { slug: "Zx81kQm", question: "3-bet or flat KQs vs CO?", guess_mode: true, created_at: ago(70), views: 12, votes: 0, top: null, hero_cards: null },
  ],
  feed: [
    { kind: "share", at: ago(2), actor: card(12, "fold_equity", "FoldEquity"), slug: "Fe7Gh2k", question: "Jam 12bb A9s from the HJ?", guess_mode: true, options: ["fold", "raise"], my_choice: null, votes: 7 },
    { kind: "streak", at: ago(3), actor: card(13, "tilted_tom", "TiltedTom"), streak: 30 },
    { kind: "share", at: ago(9), actor: card(14, "nit_queen", "NitQueen"), slug: "Nq55Pl0", question: "Hero call on a paired river?", guess_mode: true, options: ["fold", "call", "raise"], my_choice: "call", votes: 15 },
  ],
  community: {
    handOfWeek: { slug: "HoW4243", question: "Hand of the week: AKo facing a 4-bet jam at 30bb", options: ["fold", "call"], myChoice: null, votes: 312 },
    groups: [
      { id: uid(301), name: "Sunday Grinders", rank: 3, members: 18, weeklyHand: "Gr8Wk01" },
      { id: uid(302), name: "MTT Study NL", rank: 11, members: 42, weeklyHand: null },
    ],
    challenges: [
      { id: uid(401), title: "500 preflop spots this week", endsAt: inH(60), progress: 312, goal: 500 },
      { id: uid(402), title: "Flop: 80% good on paired boards", endsAt: inH(130), progress: 64, goal: 80 },
    ],
  },
};

export const STATES = {
  "1-new-user": {
    tier: "free",
    rpc: {
      my_dashboard: () => ({ hands: { imported: 0, tournaments: 0 }, last_tournament: null, leaks: [], skill: EMPTY_SKILL, social: null }),
      my_entitlements: () => ent({ spots: 0 }),
      my_xp_profile: () => ({ ...xp(0, 0, 0), streak_days: 0 }),
      my_streak: () => ({ streak: 0, active_today: false }),
    },
  },
  "2-not-trained-today": {
    tier: "free",
    rpc: {
      my_dashboard: () => ({ hands: { imported: 225, tournaments: 12 }, last_tournament: lastTour(true), leaks: LEAKS, skill: SKILL, social: null }),
      my_entitlements: () => ent({ spots: 0, tournaments: 1 }),
      my_xp_profile: () => xp(640, 455, 160, 15, 0),
      my_streak: () => ({ streak: 6, active_today: false }),
    },
  },
  "3-limit-reached": {
    tier: "free",
    rpc: {
      my_dashboard: () => ({ hands: { imported: 225, tournaments: 12 }, last_tournament: lastTour(true), leaks: LEAKS, skill: SKILL, social: null }),
      my_entitlements: () => ent({ spots: 50, tournaments: 1 }),
      my_xp_profile: () => xp(706, 505, 176, 15, 66),
      my_streak: () => ({ streak: 7, active_today: true }),
    },
  },
  "4-friends-activity": {
    tier: "admin",
    handle: "manuel",
    rpc: {
      my_dashboard: () => ({ hands: { imported: 225, tournaments: 12 }, last_tournament: lastTour(false), leaks: LEAKS, skill: SKILL, social: SOCIAL }),
      my_entitlements: () => ent({ plan: "pro", spots: 12 }),
      my_xp_profile: () => xp(706, 505, 176, 15, 30),
      my_streak: () => ({ streak: 7, active_today: true }),
    },
  },
};

let current = STATES["1-new-user"];
const tables = () => ({
  profiles: [{ id: USER.id, username: "manuel", display_name: "Manuel", subscription_tier: current.tier, hands_analyzed_count: 0, analyses_limit: 3, handle: current.handle ?? "manuel" }],
  // Onboarding done; the Hand Review tour still open (the tip shows).
  user_onboarding: [{ user_id: USER.id, onboarding_choice: "preflop", onboarding_choice_seen_at: ago(500), tour_preflop_completed_at: ago(500), tour_hands_completed_at: null, tour_skipped_at: null, tour_tip_dismissed_at: null, level_prompt_seen_at: ago(500) }],
});

const mock = http.createServer(async (req, res) => {
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
  if (rpc) {
    const fn = current.rpc[rpc[1]];
    return fn ? send(200, fn() ?? null) : send(404, { code: "PGRST202", message: `function ${rpc[1]} not found` });
  }
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m) return send(404, { message: "not found" });
  const rows = (tables()[m[1]] ?? []).filter((r) => [...url.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3)));
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
    return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
  }
  send(200, rows);
});

// ── Run ─────────────────────────────────────────────────────────────────────
const failures = [];
const record = (name, ok, detail = "") => {
  if (!ok) failures.push(name);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await new Promise((r) => mock.listen(MOCK_PORT, r));
const browser = await chromium.launch();
const wanted = process.argv.slice(2);
try {
  for (const [name, st] of Object.entries(STATES)) {
    if (wanted.length && !wanted.includes(name)) continue;
    current = st;
    for (const vp of [{ tag: "390", device: devices["iPhone 12"], viewport: { width: 390, height: 844 } }, { tag: "desktop", viewport: { width: 1280, height: 900 } }]) {
      const context = await browser.newContext({ ...(vp.device ?? {}), viewport: vp.viewport, colorScheme: "dark", bypassCSP: true });
      await context.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + b64url(JSON.stringify(session)), url: SITE }]);
      await context.addInitScript(() => localStorage.setItem("sp_consent", "denied"));
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      const tag = `${name} @${vp.tag}`;
      try {
        await page.goto(new URL("/dashboard", SITE).href, { waitUntil: "load", timeout: 180_000 });
        await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" }).catch(() => {});
        await page.waitForSelector("#today-title", { timeout: 120_000 });
        await page.waitForSelector("footer");
        await page.waitForTimeout(1200);
        record(`${tag}: no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        if (vp.tag === "390") {
          const box = await page.locator("#today-title").locator("xpath=ancestor::section[1]").locator("a").first().boundingBox();
          record(`${tag}: hero button fully above the fold`, Boolean(box && box.y >= 0 && box.y + box.height <= 844), box ? `bottom at ${Math.round(box.y + box.height)}px` : "no button");
          const covering = await page.evaluate(() =>
            [...document.querySelectorAll("main *")].filter((el) => ["fixed", "sticky"].includes(getComputedStyle(el).position)).length,
          );
          record(`${tag}: nothing fixed or sticky in the content`, covering === 0, `${covering} element(s)`);
        }
        await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}.png`), fullPage: true });
        if (vp.tag === "390") await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}-fold.png`) });
      } catch (e) {
        record(`${tag}: renders`, false, e.message.split("\n")[0]);
        await page.screenshot({ path: path.join(OUT, `${name}-${vp.tag}-FAILED.png`), fullPage: true }).catch(() => {});
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

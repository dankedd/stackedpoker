#!/usr/bin/env node
/**
 * Screenshots of the social screens at 390 px (iPhone, touch) and 1280 px,
 * plus basic mobile checks (no horizontal page scroll, nothing fixed over
 * content). Runs against an in-process stand-in for Supabase, the same way
 * as scripts/e2e-summary-filters-mobile.mjs, so no account or data is needed:
 *
 *   NEXT_DIST_DIR=.next-social NEXT_PUBLIC_SUPABASE_URL=http://localhost:54498 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=mock npx next dev -p 3200
 *   SITE=http://localhost:3200 node scripts/social-screens.mjs [screen…]
 *
 * The signed-in user is an admin-tier account (social is a "dev" feature in
 * lib/features.ts) with the moderator role. Screens are listed in SCREENS;
 * each later phase adds its own. PNGs land in E2E_OUT (default ./e2e-out/social).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { installShareFixtures } from "./social-fixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const SITE = process.env.SITE ?? "http://localhost:3200";
const MOCK_PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54498);
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-out/social");
fs.mkdirSync(OUT, { recursive: true });

// ── Fixture ─────────────────────────────────────────────────────────────────
const b64url = (s) => Buffer.from(s).toString("base64url");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = {
  id: uid(1), aud: "authenticated", role: "authenticated", email: "mod@example.com",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-01T10:00:00Z",
};
const ACCESS_TOKEN = [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify({ sub: USER.id, aud: "authenticated", role: "authenticated", exp: 4102444800 })), b64url("sig")].join(".");
const session = { access_token: ACCESS_TOKEN, token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, refresh_token: "r", user: USER };
const card = (n, handle, name, extra = {}) => ({ id: uid(n), handle, name, role: "user", deleted: false, ...extra });
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();

export const state = {
  handle: null,
  tables: {
    profiles: [{ id: USER.id, username: "mod", display_name: "RiverRat", subscription_tier: "admin", hands_analyzed_count: 0, analyses_limit: 3, handle: null }],
    user_onboarding: [{ user_id: USER.id, onboarding_choice_seen_at: ago(500), hand_review_tour_done_at: ago(500), trainer_tour_done_at: ago(500) }],
  },
  rpc: {
    my_entitlements: () => ({
      plan: "pro", trial_ends_at: null, trial_ended: false, trial_ended_seen: true,
      subscription: { status: null, current_period_end: null, cancel_at_period_end: false, has_customer: false },
      limits: { trainer_hands_per_day: null, tournaments_per_week: null, ai_questions_per_day: null },
      usage: { trainer_hands_today: 0, ai_questions_today: 0, tournaments_this_week: 0 },
    }),
    my_social_profile: () => ({
      id: USER.id, handle: state.handle, name: "RiverRat", next_handle_change_at: null, bio: null, sites: [],
      profile_visibility: "friends", stats_visibility: "friends", role: "admin", banned_until: null, ban_reason: null,
    }),
    suggest_my_handle: () => "riverrat",
    am_i_moderator: () => true,
    mod_list_reports: () => [
      {
        id: uid(901), target_type: "profile", target_id: uid(2), reason: "spam", details: "Bio links to a rakeback site",
        status: "open", created_at: ago(2), resolved_at: null,
        reporter: card(3, "fold_equity", "FoldEquity"), owner: card(2, "cheap_rakeback", "Player 3f9a", { banned_until: null }),
        target: { handle: "cheap_rakeback", display_name: null, bio: "Best rakeback deals, DM me, link in profile", sites: ["ggpoker"], hidden_at: null },
        open_reports: 3,
      },
      {
        id: uid(902), target_type: "user", target_id: uid(4), reason: "harassment", details: null,
        status: "open", created_at: ago(26), resolved_at: null,
        reporter: { id: null, handle: null, name: "[deleted user]", role: "user", deleted: true },
        owner: card(4, "tilted_tom", "TiltedTom", { banned_until: ago(-30) }),
        target: { handle: "tilted_tom", display_name: "TiltedTom" },
        open_reports: 1,
      },
    ],
    mod_find_users: () => [
      { id: uid(4), handle: "tilted_tom", name: "TiltedTom", role: "user", banned_until: ago(-30), ban_reason: "spam", created_at: ago(900), open_reports: 1 },
      { id: uid(5), handle: "tommy_gun", name: "Player 77c1", role: "moderator", banned_until: null, ban_reason: null, created_at: ago(2000), open_reports: 0 },
    ],
  },
};

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
    let body = "";
    for await (const chunk of req) body += chunk;
    const args = body ? JSON.parse(body) : Object.fromEntries(url.searchParams);
    const fn = state.rpc[rpc[1]];
    return fn ? send(200, fn(args) ?? null) : send(404, { code: "PGRST202", message: `function ${rpc[1]} not found` });
  }
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m) return send(404, { message: "not found" });
  const rows = (state.tables[m[1]] ?? []).filter((r) =>
    [...url.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3)),
  );
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
    return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
  }
  send(200, rows);
});

// ── Screens ─────────────────────────────────────────────────────────────────
// name → { path, ready (selector), prepare?(page) }
export const SCREENS = {
  "handle-prompt": { path: "/dashboard", ready: "#handle-prompt-title", clip: "section[aria-labelledby=handle-prompt-title]" },
  settings: { path: "/settings", ready: "#handle", scrollTo: "#handle" },
  "settings-data": { path: "/settings", ready: "text=Your data", scrollTo: "text=Your data" },
  moderation: { path: "/admin/moderation", ready: "article" },
  "moderation-users": {
    path: "/admin/moderation", ready: "article",
    prepare: async (page) => {
      await page.getByRole("tab", { name: "Users" }).click();
      await page.fill("input[type=search]", "tom");
      await page.keyboard.press("Enter");
      await page.waitForSelector("article");
    },
  },
  ...installShareFixtures(state, { uid, ago, userId: USER.id }),
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
    const viewports = [{ tag: "390", device: devices["iPhone 12"], viewport: { width: 390, height: 844 } }, { tag: "desktop", viewport: { width: 1280, height: 860 } }];
    // raw: an image route (OG), shown at its own size.
    for (const vp of screen.raw ? [{ tag: "image", viewport: { width: 1200, height: 630 } }] : viewports) {
      screen.before?.();
      const context = await browser.newContext({ ...(vp.device ?? {}), viewport: vp.viewport, colorScheme: "dark", bypassCSP: true });
      await context.addCookies([
        { name: "sb-localhost-auth-token", value: "base64-" + b64url(JSON.stringify(session)), url: SITE },
      ]);
      // Consent already answered (lib/metaPixel.ts keeps it in localStorage), so no banner.
      await context.addInitScript(() => localStorage.setItem("sp_consent", "denied"));
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      await page.goto(new URL(screen.path, SITE).href, { waitUntil: "load", timeout: 180_000 });
      await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" }).catch(() => {});
      try {
        await page.waitForSelector(screen.ready, { timeout: 120_000 });
        if (screen.prepare) await screen.prepare(page);
        if (screen.scrollTo) await page.locator(screen.scrollTo).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        const tag = `${name} @${vp.tag}`;
        if (!screen.raw) record(`${tag}: no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
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

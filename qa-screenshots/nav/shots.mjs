/**
 * Navigation screenshots, desktop and phone, logged out and logged in.
 *
 *   node qa-screenshots/nav/shots.mjs
 *
 * Needs the site on :3100 running against the mock Supabase on :54399
 * (ads/rusty-video/scripts/mock-supabase.mjs). Logged in = the mock's demo
 * user (free tier, so no dev menu) via its session cookie.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const require = createRequire(path.join(ROOT, "frontend/package.json"));
const { chromium, devices } = require("playwright");
const { session } = await import(pathToFileURL(path.join(ROOT, "ads/rusty-video/scripts/mock-supabase.mjs")).href);

const SITE = process.env.SITE ?? "http://localhost:3100";
const OUT = path.join(here, "out");
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: "desktop", ctx: { viewport: { width: 1280, height: 800 } } },
  { name: "mobile-390", ctx: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } } },
];
const STATES = [
  { name: "logged-out", path: "/tools", cookie: false },
  { name: "logged-in", path: "/dashboard", cookie: true },
];

const browser = await chromium.launch();
for (const v of VIEWS) {
  for (const st of STATES) {
    const context = await browser.newContext({ ...v.ctx, colorScheme: "dark" });
    await context.route(`${SITE}/**`, async (route) => {
      const res = await route.fetch();
      const headers = { ...res.headers() };
      delete headers["content-security-policy"];
      await route.fulfill({ response: res, headers });
    });
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("sp_consent", "denied");
      } catch {}
    });
    if (st.cookie)
      await context.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session())).toString("base64url"), url: SITE }]);
    const page = await context.newPage();
    await page.goto(`${SITE}${st.path}`, { waitUntil: "load", timeout: 180_000 });
    await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }" });
    await page.waitForTimeout(2500);
    if (!page.url().includes(st.path)) throw new Error(`${v.name}/${st.name}: ended on ${page.url()}`);
    const base = `${v.name}-${st.name}`;
    if (v.name === "desktop") {
      await page.screenshot({ path: path.join(OUT, `${base}.png`) });
      if (st.cookie) await page.screenshot({ path: path.join(OUT, `${base}-full.png`), fullPage: true });
    } else {
      await page.click('button[aria-label="Toggle menu"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `${base}-menu-open.png`) });
    }
    const links = await page.evaluate(() => [...document.querySelectorAll("header a, nav a")].map((a) => `${a.textContent?.trim()} → ${a.getAttribute("href")}`));
    console.log(base, "|", [...new Set(links)].join(" | "));
    await context.close();
  }
}
await browser.close();

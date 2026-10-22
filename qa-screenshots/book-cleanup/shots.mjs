// Phone screenshots of the Flop Explorer and the site footer (book-reference cleanup).
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../frontend/package.json"));
const { chromium, devices } = require("playwright");
const SITE = "http://localhost:3100";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
// Dismiss the consent banner so it does not cover the footer.
await ctx.addInitScript(() => localStorage.setItem("sp_consent", "denied"));
const page = await ctx.newPage();
await page.goto(`${SITE}/flop-trainer/explorer`, { waitUntil: "load", timeout: 180_000 });
await page.waitForTimeout(4000);
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await page.screenshot({ path: path.join(here, "explorer-pixel-412.png") });
await page.screenshot({ path: path.join(here, "explorer-pixel-412-full.png"), fullPage: true });
const body = await page.evaluate(() => document.body.innerText);
const footer = await page.locator("footer").innerText();
console.log("book refs outside footer:", (body.replace(footer, "").match(/Modern Poker Theory|Acevedo|\bbook\b|p\.\s?\d+|Hand Range \d|Chapter \d|Diagram \d/gi) ?? []).join(", ") || "none");
console.log("footer credit:", footer.match(/Preflop ranges adapted from[^\n]*/)?.[0]);
await page.locator("footer").scrollIntoViewIfNeeded();
await page.locator("footer").screenshot({ path: path.join(here, "footer-pixel-412.png") });
// Signed in as Pro (mock session + entitlements stubbed to "pro"), on a flop the mock has rows for.
const { session } = await import(pathToFileURL(path.join(here, "../../ads/rusty-video/scripts/mock-supabase.mjs")).href);
const pctx = await browser.newContext({ ...devices["Pixel 7"], bypassCSP: true });
await pctx.addInitScript(() => localStorage.setItem("sp_consent", "denied"));
await pctx.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session())).toString("base64url"), url: SITE }]);
await pctx.route("**/rest/v1/rpc/my_entitlements", async (route) => {
  const res = await route.fetch();
  const body = { ...(await res.json()), plan: "pro" };
  await route.fulfill({ response: res, body: JSON.stringify(body) });
});
// The mock starts with no flop_spots; seed the BTN spot (QA placeholder values, not chart data).
await fetch("http://localhost:54399/rest/v1/flop_spots?spot_id=eq.srp_bb_vs_bn_40const pro = await pctx.newPage();select=spot_id").then((r) => r.json()).then((have) => have.length || fetch("http://localhost:54399/rest/v1/flop_spots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spot_id: "srp_bb_vs_bn_40", spot_type: "srp", ip: "BN", oop: "BB", stack_bb: 40, action: "BN opens, BB calls", ip_range_pct: 45, oop_range_pct: 60, source_pages: [] }) }));
const pro = await pctx.newPage();
await pro.goto(`${SITE}/flop-trainer/explorer?spot=bn&flop=3c2c2d`, { waitUntil: "load", timeout: 180_000 });
await pro.waitForTimeout(6000);
await pro.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const proBody = await pro.evaluate(() => document.body.innerText);
const proFooter = await pro.locator("footer").innerText();
console.log("pro explorer locked:", proBody.includes("part of Pro"));
console.log("pro explorer book refs outside footer:", (proBody.replace(proFooter, "").match(/Modern Poker Theory|Acevedo|\bbook\b|p\.\s?\d+|Hand Range \d|Chapter \d|Diagram \d/gi) ?? []).join(", ") || "none");
await pro.screenshot({ path: path.join(here, "explorer-pro-pixel-412-full.png"), fullPage: true });
await browser.close();

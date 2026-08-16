// Did content-visibility change the page's layout height? A/B on the SAME build.
import { chromium } from 'playwright'
const URL = process.argv[2] || 'http://localhost:3111/'
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })

for (const [label, css] of [
  ['as built (content-visibility ON)', null],
  ['content-visibility DISABLED', '.sp-landing-main > *{content-visibility:visible!important;contain-intrinsic-size:auto!important}'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 823 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  if (css) await page.addStyleTag && await page.addInitScript((c) => {
    const s = document.createElement('style'); s.textContent = c
    new MutationObserver((m, o) => { if (document.head) { document.head.appendChild(s); o.disconnect() } }).observe(document.documentElement, { childList: true, subtree: true })
  }, css)
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1500)
  // Scroll the whole page so every section gets rendered at its true size.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(1200)
  const d = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    secs: [...document.querySelectorAll('main > *')].map((s) => Math.round(s.getBoundingClientRect().height)),
  }))
  console.log(`${label.padEnd(34)} doc=${String(d.doc).padStart(6)}px  sections=[${d.secs.join(', ')}]`)
  await ctx.close()
}
await browser.close()

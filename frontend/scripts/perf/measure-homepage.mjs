// Reusable local benchmark, tuned for LOW VARIANCE:
//  - one browser process reused (launch cost was the dominant noise source)
//  - fresh context + cleared cache per run
//  - warm-up runs discarded, trimmed mean reported
import { chromium } from 'playwright'

const URL = process.argv[2] || 'http://localhost:3111/'
const RUNS = Number(process.argv[3] || 9)
const LABEL = process.argv[4] || 'run'
const NET = { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 }
const WARMUP = 2

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox', '--disable-backgrounding-occluded-windows'] })
const fcps = [], lcps = [], clss = [], longs = []
let nodes = 0, htmlKb = 0, lastEl = '', layoutMed = 0

for (let i = 0; i < RUNS + WARMUP; i++) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.emulateNetworkConditions', NET)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__p = { lcp: [], fcp: null, cls: 0, longPreFcp: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__p.lcp.push({ t: e.startTime, tag: e.element?.tagName, txt: (e.element?.innerText || '').replace(/\s+/g, ' ').slice(0, 42) }) }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__p.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
    // CLS: sum of layout shifts without recent user input (same definition CrUX uses).
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__p.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    // Long tasks that land before FCP never show up in TBT, which is exactly
    // how a 0ms-TBT page can still be slow to first paint.
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!window.__p.fcp || e.startTime < window.__p.fcp) window.__p.longPreFcp += e.duration }).observe({ type: 'longtask', buffered: true })
  })
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(3500)
  const d = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {}
    const t = []
    for (let k = 0; k < 5; k++) { document.body.style.zoom = k % 2 ? '1' : '0.999999'; const a = performance.now(); document.body.offsetHeight; t.push(performance.now() - a) }
    document.body.style.zoom = '1'; t.sort((x, y) => x - y)
    // Guard: a stale/racing build makes the hashed CSS 404, which renders an
    // unstyled page that measures artificially fast. Any number taken from such
    // a run is worthless, so detect it rather than silently reporting it.
    const h1 = document.querySelector('h1')
    const styled = !!h1 && getComputedStyle(h1).fontWeight >= '700' &&
      getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'
    const sheets = [...document.styleSheets].length
    return { p: window.__p, nodes: document.querySelectorAll('*').length, layout: +t[2].toFixed(1), html: Math.round((nav.decodedBodySize || 0) / 1024), styled, sheets }
  })
  if (!d.styled) throw new Error(`CSS did not load (styleSheets=${d.sheets}) — rebuild is racing; measurement aborted`)
  await ctx.close()
  if (i < WARMUP) continue
  fcps.push(Math.round(d.p.fcp || 0)); lcps.push(Math.round(d.p.lcp.at(-1)?.t || 0))
  clss.push(+(d.p.cls || 0).toFixed(4)); longs.push(Math.round(d.p.longPreFcp || 0))
  nodes = d.nodes; htmlKb = d.html; layoutMed = d.layout
  lastEl = `${d.p.lcp.at(-1)?.tag}: ${d.p.lcp.at(-1)?.txt}`
}
await browser.close()

// Trimmed mean: drop highest+lowest, then average. Robust to a single stall.
const trimmed = (a) => { const s = a.slice().sort((x, y) => x - y).slice(1, -1); return Math.round(s.reduce((p, c) => p + c, 0) / s.length) }
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
console.log(`\n=== ${LABEL} — ${URL} — ${RUNS} runs (mobile, 1.6Mbps/150ms, 4x CPU) ===`)
console.log(`FCP   trimmed-mean ${String(trimmed(fcps)).padStart(5)}ms   median ${med(fcps)}ms   [${fcps.slice().sort((a, b) => a - b).join(',')}]`)
console.log(`LCP   trimmed-mean ${String(trimmed(lcps)).padStart(5)}ms   median ${med(lcps)}ms   [${lcps.slice().sort((a, b) => a - b).join(',')}]`)
console.log(`forced layout ${layoutMed}ms | DOM nodes ${nodes} | HTML ${htmlKb} KB`)
console.log(`CLS   max ${Math.max(...clss)}  [${clss.join(',')}]`)
console.log(`long tasks before FCP: median ${med(longs)}ms  [${longs.slice().sort((a,b)=>a-b).join(',')}]`)
console.log(`LCP element: ${lastEl}`)

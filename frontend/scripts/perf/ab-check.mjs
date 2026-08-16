// Honest before/after on ONE build: neutralise each fix at runtime and measure.
// Avoids comparing across builds/machine states, which drift.
import { chromium } from 'playwright'
const URL = process.argv[2] || 'http://localhost:3111/'
const RUNS = 7, WARMUP = 2
const NET = { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 }

// Restore the pre-sprint behaviour exactly:
//  - the hero's critical text goes back to the opacity-gated entrance
//  - below-the-fold sections go back to being laid out eagerly
const UNDO_GATE = `.animate-reveal-up-critical{opacity:0;animation-name:reveal-up!important}`
const UNDO_CV = `.sp-landing-main > *{content-visibility:visible!important;contain-intrinsic-size:auto!important}`

const VARIANTS = {
  'BEFORE (both fixes undone)': [UNDO_GATE, UNDO_CV],
  'only opacity-gate fix': [UNDO_CV],
  'only content-visibility fix': [UNDO_GATE],
  'AFTER (as shipped)': [],
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })
const out = {}
for (const [label, css] of Object.entries(VARIANTS)) {
  const fcps = [], lcps = []
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
    if (css.length) await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `const s=document.createElement('style');s.textContent=${JSON.stringify(css.join('\n'))};
        new MutationObserver((m,o)=>{if(document.head){document.head.appendChild(s);o.disconnect();}}).observe(document.documentElement,{childList:true,subtree:true});`,
    })
    await page.addInitScript(() => {
      window.__p = { lcp: [], fcp: null }
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__p.lcp.push({ t: e.startTime, tag: e.element?.tagName }) }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__p.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
    })
    await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
    await page.waitForTimeout(3500)
    const r = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      return { p: window.__p, styled: !!h1 && getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)' }
    })
    await ctx.close()
    if (!r.styled) throw new Error('CSS did not load — measurement aborted')
    if (i < WARMUP) continue
    fcps.push(Math.round(r.p.fcp || 0)); lcps.push(Math.round(r.p.lcp.at(-1)?.t || 0))
  }
  const tm = (a) => { const s = a.slice().sort((x, y) => x - y).slice(1, -1); return Math.round(s.reduce((p, c) => p + c, 0) / s.length) }
  out[label] = { fcp: tm(fcps), lcp: tm(lcps) }
  console.log(`${label.padEnd(30)} FCP ${String(tm(fcps)).padStart(5)}ms   LCP ${String(tm(lcps)).padStart(5)}ms   gap ${String(tm(lcps) - tm(fcps)).padStart(4)}ms   lcp[${lcps.slice().sort((a, b) => a - b).join(',')}]`)
}
await browser.close()
const b = out['BEFORE (both fixes undone)'], a = out['AFTER (as shipped)']
console.log(`\nNET: FCP ${b.fcp} -> ${a.fcp}ms (${(((a.fcp - b.fcp) / b.fcp) * 100).toFixed(0)}%)   LCP ${b.lcp} -> ${a.lcp}ms (${(((a.lcp - b.lcp) / b.lcp) * 100).toFixed(0)}%)`)

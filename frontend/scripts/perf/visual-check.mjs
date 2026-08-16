// Visual + functional regression check for the homepage after the LCP sprint.
// Verifies the hero renders, the CTA works, offscreen sections still render on
// scroll (content-visibility correctness), and analytics/SEO tags survive.
import { chromium } from 'playwright'
const URL = process.argv[2] || 'http://localhost:3111/'
const OUT = process.argv[3] || '.'

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })
for (const w of [360, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 823 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/home-${w}.png` })

  const above = await page.evaluate(() => {
    const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { top: Math.round(r.top), h: Math.round(r.height), opacity: s.opacity, visible: r.top < innerHeight && r.bottom > 0 && s.opacity !== '0' && s.visibility !== 'hidden' } }
    const h1 = document.querySelector('h1')
    return {
      h1Text: h1?.innerText.replace(/\s+/g, ' '),
      h1: vis(h1),
      sub: vis(document.querySelector('h1')?.parentElement?.parentElement?.querySelector('p')),
      cta: vis([...document.querySelectorAll('a')].find((a) => /start learning/i.test(a.innerText))),
      sections: document.querySelectorAll('main > *').length,
      docHeight: document.documentElement.scrollHeight,
    }
  })
  console.log(`\n[${w}px] h1="${above.h1Text}"`)
  console.log(`  h1  ${JSON.stringify(above.h1)}`)
  console.log(`  sub ${JSON.stringify(above.sub)}`)
  console.log(`  CTA ${JSON.stringify(above.cta)}`)
  console.log(`  sections=${above.sections}  docHeight=${above.docHeight}px`)

  if (w === 390) {
    // Offscreen sections must still render properly once scrolled into view.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.55))
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/home-mid.png` })
    const mid = await page.evaluate(() => {
      const secs = [...document.querySelectorAll('main > *')]
      return secs.map((s, i) => ({ i, h: Math.round(s.getBoundingClientRect().height), text: (s.innerText || '').replace(/\s+/g, ' ').slice(0, 34) }))
    })
    console.log('  after scrolling to 55%:')
    mid.forEach((m) => console.log(`    [${m.i}] h=${String(m.h).padStart(5)}px  "${m.text}"`))

    // CTA navigation still works.
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)
    await page.click('a:has-text("Start learning")')
    await page.waitForLoadState('domcontentloaded')
    console.log('  CTA click ->', page.url())
  }
  await ctx.close()
}

// SEO/analytics tags intact
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
const head = await page.evaluate(() => ({
  title: document.title,
  desc: document.querySelector('meta[name="description"]')?.getAttribute('content')?.slice(0, 70),
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
  og: document.querySelectorAll('meta[property^="og:"]').length,
  twitter: document.querySelectorAll('meta[name^="twitter:"]').length,
  jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
  gaTag: [...document.querySelectorAll('script')].some((s) => (s.src || '').includes('googletagmanager')),
  h1Count: document.querySelectorAll('h1').length,
  fontPreloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href')?.split('/').pop()),
}))
console.log('\n=== head / SEO / analytics ===')
console.log(JSON.stringify(head, null, 2))
await browser.close()

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Guards against dead links on the homepage. Reads the section sources
 * (components/home + the footer) and checks every internal href against the
 * real app/ routes, so a renamed or gated page shows up here.
 */

const FRONTEND = path.resolve(__dirname, '../../..')
const HOME_DIR = path.join(FRONTEND, 'components/home')
const FILES = [
  ...fs.readdirSync(HOME_DIR).filter((f) => f.endsWith('.tsx')).map((f) => path.join(HOME_DIR, f)),
  path.join(FRONTEND, 'components/landing/LandingFooter.tsx'),
]

/** True when app/ has a page for this path (static or dynamic segments). */
function routeExists(href: string): boolean {
  const clean = href.split(/[?#]/)[0]
  if (clean === '/' || clean === '') return true
  const parts = clean.replace(/^\//, '').split('/')
  const walk = (dir: string, i: number): boolean => {
    if (i === parts.length) return fs.existsSync(path.join(dir, 'page.tsx')) || fs.existsSync(path.join(dir, 'route.ts'))
    const exact = path.join(dir, parts[i])
    if (fs.existsSync(exact) && walk(exact, i + 1)) return true
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\[.+\]$/.test(d.name))
      .some((d) => walk(path.join(dir, d.name), i + 1))
  }
  return walk(path.join(FRONTEND, 'app'), 0)
}

function internalHrefs(source: string): string[] {
  const attr = [...source.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1])
  const objects = [...source.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1])
  const consts = [...source.matchAll(/_PATH\s*=\s*"(\/[^"]*)"/g)].map((m) => m[1])
  return [...attr, ...objects, ...consts]
}

describe('Homepage — no dead links', () => {
  for (const file of FILES) {
    it(`${path.basename(file)} only links to existing routes`, () => {
      for (const href of internalHrefs(fs.readFileSync(file, 'utf-8'))) {
        expect(routeExists(href), `${path.basename(file)} links to ${href}, which has no page in app/`).toBe(true)
      }
    })
  }

  it('never links into Learn or Puzzles while they are dev-only', () => {
    for (const file of FILES.filter((f) => !f.endsWith('LandingFooter.tsx'))) {
      const src = fs.readFileSync(file, 'utf-8')
      expect(src, path.basename(file)).not.toMatch(/href[=:]\s*["'`]\/(learn|puzzles)\b/)
    }
  })
})

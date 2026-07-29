import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Guards against dead `<Link href="...">`s on the redesigned homepage.
 * Parses the section source files directly (rather than rendering them)
 * because `Navbar`/`Footer` require `AuthContext`, which none of these
 * landing sections should need to import just to be link-checked.
 */

const LANDING_DIR = path.resolve(__dirname, '..')

const SECTION_FILES = [
  'Hero.tsx',
  'ProofStrip.tsx',
  'HowDecisionsWork.tsx',
  'DecisionShowcase.tsx',
  'RangeThinking.tsx',
  'LearningPath.tsx',
  'CoachSection.tsx',
  'ProgressionSection.tsx',
  'LeaderboardPreview.tsx',
  'CtaSection.tsx',
  'LandingFooter.tsx',
]

// Every real route confirmed to exist under app/ at the time this test was
// written, plus in-page anchors the homepage itself defines.
const KNOWN_ROUTES = new Set([
  '/',
  '/learn',
  '/train/ranges',
  '/leaderboard',
  '/pricing',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/terms#disclaimer',
  '#curriculum',
  '#how-it-works',
  '/learn/module/poker-fundamentals-module',
])

function isKnownRoute(href: string): boolean {
  if (KNOWN_ROUTES.has(href)) return true
  // Dynamic module route — app/learn/module/[slug]/page.tsx is a real,
  // generic route, so any slug-shaped path under it is valid.
  if (/^\/learn\/module\/[a-z0-9-]+$/.test(href)) return true
  return false
}

describe('Homepage sections — no dead links', () => {
  for (const file of SECTION_FILES) {
    it(`${file} only links to known routes`, () => {
      const source = fs.readFileSync(path.join(LANDING_DIR, file), 'utf-8')
      const hrefMatches = [...source.matchAll(/href="([^"{]+)"/g)].map((m) => m[1])
      for (const href of hrefMatches) {
        expect(isKnownRoute(href), `${file} links to unknown route "${href}"`).toBe(true)
      }
    })
  }
})

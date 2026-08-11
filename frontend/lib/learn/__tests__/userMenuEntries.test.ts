import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Guards navigation to unreleased features, and the account menu's shape.
 *
 * "Hand History" pointed at /history, which is not a finished feature. It sat
 * in three places a user could reach it from: the account dropdown, the
 * dashboard's Account row, and the recommended-actions widget. All three are
 * gone; these assertions stop any of them coming back by accident.
 *
 * Source assertions rather than a rendered tree: UserMenu needs auth,
 * subscription and learn-progress contexts plus a DOM portal, and this suite
 * runs under `environment: "node"` with no jsdom (see
 * lessonPlayerLayoutRegression.test.tsx).
 */

const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf-8')

/** Source with comments stripped — these files explain in prose that the
 *  feature was removed, and that prose must not trip the guards below. */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const SURFACES = [
  'components/layout/UserMenu.tsx',
  'app/dashboard/page.tsx',
  'components/dashboard/PersonalizedActionsWidget.tsx',
]

describe('no navigation into the unreleased hand-history feature', () => {
  it.each(SURFACES)('%s links nowhere near /history', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/href=["'`]\/history/)
    expect(src).not.toMatch(/href:\s*["'`]\/history/)
  })

  it.each(SURFACES)('%s never labels anything "Hand History"', (file) => {
    expect(readCode(file)).not.toMatch(/Hand History/i)
  })
})

describe('account dropdown', () => {
  const SRC = read('components/layout/UserMenu.tsx')

  it('keeps Dashboard -> subscription -> Settings in the menu array', () => {
    // Assert order inside the array literal itself, not by position in the
    // file — constants and types above the component would skew that.
    const start = SRC.indexOf('const menuItems')
    // `const dropdown = (` — not `const dropdown`, which also prefixes the
    // `dropdownRef` declared further up and would slice backwards to nothing.
    const arr = SRC.slice(start, SRC.indexOf('const dropdown = (', start))
    expect(arr.length).toBeGreaterThan(0)
    const order = ['/dashboard', 'Manage subscription', '/pricing', '/settings']
      .map((s) => arr.indexOf(s))
    expect(order.every((i) => i > -1), `missing entry in ${arr}`).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('renders Sign out after the nav rows, below its own divider', () => {
    expect(SRC.indexOf('{/* Sign out */}')).toBeGreaterThan(SRC.indexOf('{/* Nav links */}'))
    expect(SRC).toMatch(/\{\/\* Sign out \*\/\}[\s\S]{0,120}border-t/)
  })

  it('offers the billing portal to paying accounts and the upgrade to everyone else', () => {
    expect(SRC).toContain('isPaidTier(subscription?.tier)')
    expect(SRC).toMatch(/isPaid[\s\S]{0,200}Manage subscription/)
    expect(SRC).toMatch(/Upgrade to Plus/)
    expect(SRC).toContain('onClick: handleManage')
  })

  it('shows progress while the billing portal opens, and blocks a double click', () => {
    expect(SRC).toContain('busy: managingSubscription')
    expect(SRC).toContain('disabled={item.busy}')
    expect(SRC).toMatch(/Loader2[^\n]*animate-spin/)
  })

  it('styles the link and the button rows identically', () => {
    // One shared constant — a button that looked different from its
    // neighbours would read as a different kind of thing.
    expect(SRC).toContain('const ROW_CLASS')
    expect((SRC.match(/className=\{ROW_CLASS\}/g) ?? []).length).toBe(2)
  })

  it('imports no icon it no longer renders', () => {
    expect(SRC).not.toContain('BookOpen')
  })
})

describe('surfaces rebalance instead of leaving a hole', () => {
  it('the dashboard Account row is a single column now that Settings is alone', () => {
    const src = read('app/dashboard/page.tsx')
    const account = src.slice(src.indexOf('{/* Account */}'), src.indexOf('{/* Account */}') + 900)
    expect(account).toContain('grid grid-cols-1 gap-3')
    expect(account).not.toContain('sm:grid-cols-2')
  })

  it('the actions widget sizes its grid from the real action count', () => {
    const src = read('components/dashboard/PersonalizedActionsWidget.tsx')
    expect(src).toContain('COLUMNS[actions.length]')
    // Literal classes only — an interpolated column count is invisible to
    // Tailwind's scanner.
    expect(src).not.toMatch(/grid-cols-\$\{/)
    for (const n of [1, 2, 3, 4]) expect(src).toContain(`${n}: "sm:grid-cols-${n}"`)
  })
})

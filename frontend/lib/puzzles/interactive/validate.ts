import { SOURCES } from './sources'
import type {
  InteractivePuzzle,
  PuzzleDecision,
  RangeExhibit,
  SourceId,
  StatExhibit,
  TheoryBlock,
} from './types'
import { STREET_ORDER } from './types'

/**
 * Content validation — the gate a puzzle must pass to be publishable.
 *
 * This runs at module load (see data/index.ts), not in a test only, because the
 * failure it guards against is a content failure, not a code failure: a puzzle
 * that asserts a frequency with no citation is broken in exactly the way that
 * matters for a poker education product, and it should be impossible to ship it
 * by forgetting to run the suite. A bad puzzle takes the build down with a
 * message naming the puzzle, the path to the offending field, and what to fix.
 *
 * The rules are deliberately mechanical. They cannot check that a citation is
 * HONEST — only a human reading the source can do that, which is why
 * `SourceRef.scope` exists and is rendered — but they can guarantee that every
 * claim is at least anchored to a real, specific place in the source, and that
 * no claim can be added later without one.
 */

export class PuzzleValidationError extends Error {
  readonly issues: string[]
  constructor(puzzleId: string, issues: string[]) {
    super(
      `Puzzle "${puzzleId}" is not publishable — ${issues.length} content ${
        issues.length === 1 ? 'error' : 'errors'
      }:\n` + issues.map((i) => `  • ${i}`).join('\n')
    )
    this.name = 'PuzzleValidationError'
    this.issues = issues
  }
}

/** Minimum answer choices per decision. A binary choice is not a puzzle. */
const MIN_OPTIONS = 3
/** Above this, a decision is more likely a taxonomy dump than a real choice. */
const MAX_OPTIONS = 5

export function validatePuzzle(puzzle: InteractivePuzzle): string[] {
  const issues: string[] = []

  const requireSources = (where: string, sources: SourceId[] | undefined) => {
    if (!sources || sources.length === 0) {
      issues.push(`${where}: no source reference. Every poker claim must cite lib/puzzles/interactive/sources.ts.`)
      return
    }
    for (const id of sources) {
      if (!SOURCES[id]) {
        issues.push(`${where}: unknown source id "${id}". Add it to sources.ts or fix the reference.`)
      }
    }
  }

  const checkStat = (where: string, exhibit: StatExhibit) => {
    requireSources(`${where} exhibit "${exhibit.caption}"`, exhibit.sources)
    if (!exhibit.scope.trim()) {
      issues.push(
        `${where} exhibit "${exhibit.caption}": empty scope. State which simulation the numbers describe — ` +
          `an unscoped percentage is how a BB-vs-UTG number ends up presented as a BB-vs-BN answer.`
      )
    }
    if (exhibit.rows.length === 0) {
      issues.push(`${where} exhibit "${exhibit.caption}": no rows.`)
    }
    for (const row of exhibit.rows) {
      if (row.pct !== undefined && (row.pct < 0 || row.pct > 100)) {
        issues.push(`${where} exhibit "${exhibit.caption}" row "${row.label}": pct ${row.pct} is outside 0-100.`)
      }
    }
  }

  const checkTheory = (where: string, block: TheoryBlock) => {
    const at = `${where} theory "${block.title}"`
    requireSources(at, block.sources)
    if (!block.body.trim()) issues.push(`${at}: empty body.`)
    block.bullets?.forEach((b, i) => requireSources(`${at} bullet #${i + 1}`, b.sources))
    if (block.exhibit) checkStat(at, block.exhibit)
    block.unsourced?.forEach((n, i) => {
      if (!n.answer.trim()) {
        issues.push(`${at} unsourced note #${i + 1}: empty answer. Say what CAN be stated instead.`)
      }
      n.nearestSources?.forEach((id) => {
        if (!SOURCES[id]) issues.push(`${at} unsourced note #${i + 1}: unknown source id "${id}".`)
      })
    })
  }

  const checkDecision = (decision: PuzzleDecision, index: number) => {
    const at = `decision #${index + 1} (${decision.id})`

    if (decision.options.length < MIN_OPTIONS) {
      issues.push(
        `${at}: ${decision.options.length} answer ${
          decision.options.length === 1 ? 'choice' : 'choices'
        } — at least ${MIN_OPTIONS} are required.`
      )
    }
    if (decision.options.length > MAX_OPTIONS) {
      issues.push(`${at}: ${decision.options.length} answer choices — at most ${MAX_OPTIONS} are allowed.`)
    }

    const ids = decision.options.map((o) => o.id)
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (duplicates.length > 0) {
      issues.push(`${at}: duplicate option id(s) ${[...new Set(duplicates)].join(', ')}.`)
    }

    const best = decision.options.filter((o) => o.verdict === 'best')
    if (best.length === 0) {
      issues.push(`${at}: no option marked 'best'.`)
    } else if (best.length > 1) {
      issues.push(`${at}: ${best.length} options marked 'best' — exactly one is required.`)
    }
    if (!ids.includes(decision.bestOptionId)) {
      issues.push(`${at}: bestOptionId "${decision.bestOptionId}" does not match any option.`)
    } else if (best.length === 1 && best[0].id !== decision.bestOptionId) {
      issues.push(
        `${at}: bestOptionId is "${decision.bestOptionId}" but the option marked 'best' is "${best[0].id}".`
      )
    }

    decision.options.forEach((o, i) => {
      requireSources(`${at} option #${i + 1} ("${o.label}")`, o.sources)
      if (!o.shortWhy.trim()) {
        issues.push(`${at} option #${i + 1} ("${o.label}"): empty shortWhy — every option needs its own feedback.`)
      }
    })

    if (!decision.explanation.trim()) issues.push(`${at}: empty explanation.`)
    if (decision.theory.length === 0) {
      issues.push(`${at}: no theory blocks. Every decision must be able to explain itself.`)
    }
    decision.theory.forEach((b) => checkTheory(at, b))

    decision.unsourced?.forEach((n, i) => {
      if (!n.answer.trim()) issues.push(`${at} unsourced note #${i + 1}: empty answer.`)
    })

    const expectedBoard = { preflop: 0, flop: 3, turn: 4, river: 5 }[decision.street]
    if (decision.board.length !== expectedBoard) {
      issues.push(
        `${at}: street "${decision.street}" needs ${expectedBoard} board card(s), found ${decision.board.length}.`
      )
    }

    /* ── Money arithmetic ─────────────────────────────────────────────────
     * The specific bug this exists to make unshippable: showing the button's
     * "raise TO 2.5bb" as the big blind's call amount, when the blind is
     * already in for 1 and owes 1.5. Whenever a decision states enough to
     * check that subtraction, it gets checked. */
    const { facingBetBb, heroInvestedBb, toCallBb } = decision
    if (facingBetBb !== undefined && heroInvestedBb !== undefined) {
      const expected = round2(facingBetBb - heroInvestedBb)
      if (toCallBb === undefined) {
        issues.push(`${at}: facingBetBb and heroInvestedBb are set but toCallBb is missing (should be ${expected}).`)
      } else if (round2(toCallBb) !== expected) {
        issues.push(
          `${at}: toCallBb is ${toCallBb}, but ${facingBetBb} (bet TO) − ${heroInvestedBb} (already in) = ${expected}. ` +
            `A "raise to" amount is not a call amount.`
        )
      }
    }
    if (toCallBb !== undefined && toCallBb < 0) {
      issues.push(`${at}: toCallBb is negative (${toCallBb}).`)
    }
    if (facingBetBb !== undefined && facingBetBb > decision.potBb) {
      issues.push(
        `${at}: facingBetBb ${facingBetBb} exceeds potBb ${decision.potBb}. ` +
          `potBb must include the bet Hero is facing.`
      )
    }
    if (decision.potBb < 0) issues.push(`${at}: potBb is negative.`)
    if (decision.effectiveStackBb < 0) issues.push(`${at}: effectiveStackBb is negative.`)
    if (toCallBb !== undefined && toCallBb > decision.effectiveStackBb) {
      issues.push(
        `${at}: toCallBb ${toCallBb} exceeds Hero's ${decision.effectiveStackBb}bb stack — a call cannot cost more than the stack.`
      )
    }

    // No option label may carry a money amount: the button is the verb, the
    // hand-info panel carries the numbers. Catches "Call 2.5bb" regressions.
    for (const o of decision.options) {
      if (/\d\s*(bb|BB)\b/.test(o.label)) {
        issues.push(
          `${at} option "${o.label}": action buttons must not display bb amounts. ` +
            `Put the number in the decision's money fields; the button shows the action.`
        )
      }
    }
  }

  /** Money is authored in tenths of a blind; compare at that precision. */
  function round2(n: number): number {
    return Math.round(n * 100) / 100
  }

  const checkRange = (range: RangeExhibit, index: number) => {
    const at = `range #${index + 1} ("${range.label}")`
    requireSources(at, range.sources)
    if (!range.description.trim()) issues.push(`${at}: empty description.`)
    if (range.kind === 'composition' && (!range.bars || range.bars.length === 0)) {
      issues.push(`${at}: kind 'composition' requires bars.`)
    }
    if (range.kind === 'aggregate' && !range.headline) {
      issues.push(`${at}: kind 'aggregate' requires a headline percentage.`)
    }
    range.bars?.forEach((b) => {
      if (b.pct < 0 || b.pct > 100) issues.push(`${at} bar "${b.label}": pct ${b.pct} is outside 0-100.`)
    })
  }

  /* ── Structure ─────────────────────────────────────────────────────── */

  if (puzzle.decisions.length === 0) issues.push('no decisions.')
  if (!puzzle.slug.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
    issues.push(`slug "${puzzle.slug}" is not kebab-case.`)
  }
  if (puzzle.setup.heroCards.length !== 2) {
    issues.push(`setup.heroCards has ${puzzle.setup.heroCards.length} cards, expected 2.`)
  }

  // Streets must run forward without gaps: a flop decision cannot precede preflop.
  let lastStreetIndex = -1
  for (const decision of puzzle.decisions) {
    const idx = STREET_ORDER.indexOf(decision.street)
    if (idx < lastStreetIndex) {
      issues.push(`decision "${decision.id}": street "${decision.street}" goes backwards.`)
    }
    lastStreetIndex = idx
  }

  // A hand that stops before the river must say why — see `endsEarlyBecause`.
  const lastStreet = puzzle.decisions[puzzle.decisions.length - 1]?.street
  if (lastStreet && lastStreet !== 'river' && !puzzle.endsEarlyBecause?.trim()) {
    issues.push(
      `the hand ends on the ${lastStreet} but endsEarlyBecause is empty. State why — an unexplained stop ` +
        `reads as truncation, and "the source gives no exact strategy past here" is a legitimate reason worth showing.`
    )
  }

  puzzle.decisions.forEach(checkDecision)
  puzzle.ranges.forEach(checkRange)

  if (puzzle.takeaways.length === 0) issues.push('no takeaways.')
  puzzle.takeaways.forEach((t, i) => requireSources(`takeaway #${i + 1}`, t.sources))
  requireSources('takeawayHeadline', puzzle.headlineSources)

  return issues
}

/** Throws unless the puzzle is publishable. Used by the registry at module load. */
export function assertPublishable(puzzle: InteractivePuzzle): InteractivePuzzle {
  const issues = validatePuzzle(puzzle)
  if (issues.length > 0) throw new PuzzleValidationError(puzzle.id, issues)
  return puzzle
}

import type { InteractivePuzzle } from '../types'
import { assertPublishable } from '../validate'
import { DONK_BET_654R } from './donk-bet-654r'

/**
 * The puzzle registry.
 *
 * Every puzzle passes `assertPublishable` at module load, so a puzzle with an
 * uncited frequency, a missing correct answer or fewer than three choices takes
 * the build down with a message naming the field — rather than shipping and
 * teaching someone a number nobody could source. Adding a puzzle is: write the
 * data file, add any new citations to ../sources.ts, add one line here.
 */
const ALL: InteractivePuzzle[] = [DONK_BET_654R].map(assertPublishable)

export const PUZZLES: readonly InteractivePuzzle[] = ALL

export const PUZZLES_BY_SLUG: ReadonlyMap<string, InteractivePuzzle> = new Map(
  ALL.map((p) => [p.slug, p])
)

export function getPuzzle(slug: string): InteractivePuzzle | undefined {
  return PUZZLES_BY_SLUG.get(slug)
}

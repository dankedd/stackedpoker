import type { InteractivePuzzle } from '../types'
import { assertPublishable } from '../validate'
import { BB_DEFENDS_WIDE_VS_BTN } from './bb-defends-wide-vs-btn'
import { BB_FOUR_DEFENCES_25BB } from './bb-four-defences-25bb'
import { BIG_BET_LOW_FREQUENCY_862 } from './big-bet-low-frequency-862'
import { BOUNDARY_MOVES_BY_OPENER } from './boundary-moves-by-opener'
import { CBET_BY_TOP_CARD } from './cbet-by-top-card'
import { CBET_CONNECTED_BOARDS } from './cbet-connected-boards'
import { CBET_SIMPLIFY_AQ3 } from './cbet-simplify-aq3'
import { DEPOLARIZED_RANGE_554 } from './depolarized-range-554'
import { DONK_BET_BANDS } from './donk-bet-bands'
import { DONK_BET_654R } from './donk-bet-654r'
import { JAM_3BET_OR_CALL_BY_DEPTH } from './jam-3bet-or-call-by-depth'
import { MDF_ARITHMETIC_AQ3R } from './mdf-arithmetic-aq3r'
import { MIN_BET_DEFENCE_QJT } from './min-bet-defence-qjt'
import { MIN_BET_PAIRED_J66 } from './min-bet-paired-j66'
import { NO_DONK_A76R } from './no-donk-a76r'
import { POSITION_FLIP_654R } from './position-flip-654r'
import { RANGE_ADVANTAGE_SMALL_BET } from './range-advantage-small-bet'
import { RIVER_STRUCTURE_BLUFFCATCHER } from './river-structure-bluffcatcher'
import { TURN_AFTER_CHECK_BACK_984 } from './turn-after-check-back-984'
import { TURN_CATEGORIES_984 } from './turn-categories-984'
import { TURN_CHECK_RAISE_ALL_IN } from './turn-check-raise-all-in'
import { TURN_DONK_984 } from './turn-donk-984'

/**
 * The puzzle registry.
 *
 * Every puzzle passes `assertPublishable` at module load, so a puzzle with an
 * uncited frequency, a missing correct answer or fewer than three choices takes
 * the build down with a message naming the field — rather than shipping and
 * teaching someone a number nobody could source. Adding a puzzle is: write the
 * data file, add any new citations to ../sources.ts, add one line here.
 */
const ALL: InteractivePuzzle[] = [
  DONK_BET_654R,
  TURN_DONK_984,
  BB_DEFENDS_WIDE_VS_BTN,
  BB_FOUR_DEFENCES_25BB,
  JAM_3BET_OR_CALL_BY_DEPTH,
  BOUNDARY_MOVES_BY_OPENER,
  MIN_BET_PAIRED_J66,
  NO_DONK_A76R,
  DONK_BET_BANDS,
  CBET_SIMPLIFY_AQ3,
  POSITION_FLIP_654R,
  CBET_BY_TOP_CARD,
  CBET_CONNECTED_BOARDS,
  RANGE_ADVANTAGE_SMALL_BET,
  BIG_BET_LOW_FREQUENCY_862,
  DEPOLARIZED_RANGE_554,
  TURN_CHECK_RAISE_ALL_IN,
  TURN_CATEGORIES_984,
  TURN_AFTER_CHECK_BACK_984,
  MIN_BET_DEFENCE_QJT,
  MDF_ARITHMETIC_AQ3R,
  RIVER_STRUCTURE_BLUFFCATCHER,
].map(assertPublishable)

export const PUZZLES: readonly InteractivePuzzle[] = ALL

export const PUZZLES_BY_SLUG: ReadonlyMap<string, InteractivePuzzle> = new Map(
  ALL.map((p) => [p.slug, p])
)

export function getPuzzle(slug: string): InteractivePuzzle | undefined {
  return PUZZLES_BY_SLUG.get(slug)
}

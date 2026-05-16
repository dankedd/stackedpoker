import { PUZZLES_STARTER } from './starter'
import { PUZZLES_PREFLOP } from './preflop'
import { PUZZLES_POSTFLOP } from './postflop'
import { PUZZLES_TOURNAMENT } from './tournament'
import { PUZZLES_CASH_SRP } from './cash_srp'
import { PUZZLES_CASH_3BET } from './cash_3bet'
import { PUZZLES_CASH_DYNAMICS } from './cash_dynamics'
import { PUZZLES_CASH_EXPERT } from './cash_expert'

export const PUZZLES = [
  ...PUZZLES_STARTER,
  ...PUZZLES_PREFLOP,
  ...PUZZLES_POSTFLOP,
  ...PUZZLES_TOURNAMENT,
  ...PUZZLES_CASH_SRP,
  ...PUZZLES_CASH_3BET,
  ...PUZZLES_CASH_DYNAMICS,
  ...PUZZLES_CASH_EXPERT,
]

import type { LessonSource } from './types'

// ── New-user onboarding skill assessment — question bank ───────────────────
// Data-driven, flat-array convention matching curriculum.ts. Every question's
// `explanation` is traceable to a real passage in docs/Modern Poker Theory.pdf
// (extracted text at docs/mpt_fulltext.txt) via `source` — see CLAUDE.md's
// "never fabricate poker theory" rule. `source.type` follows the same
// SourceEvidenceType used throughout curriculum.ts:
//   'exact_derived'        — a direct definition/figure from the book
//   'source_reconstructed' — synthesized from a book passage/example, not a
//                            single quoted sentence (e.g. applying a book
//                            formula to new numbers, or combining two related
//                            passages into one MCQ)
//   'pedagogical_model'    — the underlying principle IS in the book, but the
//                            question uses a term the book itself doesn't use
//                            (flagged explicitly, never presented as a quote)

export type AssessmentLeague = 'foundation' | 'intermediate' | 'advanced' | 'expert' | 'master'
export type AssessmentDifficulty = 1 | 2 | 3 | 4
export type AssessmentTopic =
  | 'hand_rankings' | 'positions' | 'betting_order'
  | 'opening_ranges' | 'position_advantage' | 'pot_odds'
  | 'range_advantage' | 'continuation_betting' | 'equity_realization'
  | 'blockers' | 'polarization' | 'range_construction'
  | 'multi_street_ranges' | 'delayed_cbets' | 'range_protection' | 'bluff_selection' | 'elite_board_analysis'

export interface AssessmentOption {
  id: string
  label: string
  correct: boolean
}

export interface AssessmentQuestion {
  id: string
  difficulty: AssessmentDifficulty
  isFinalChallenge: boolean
  topic: AssessmentTopic
  prompt: string
  options: AssessmentOption[]
  explanation: string
  source: LessonSource
}

const MPT: Pick<LessonSource, 'book' | 'author'> = { book: 'Modern Poker Theory', author: 'Michael Acevedo' }

// Includes the 4 final-challenge questions (isFinalChallenge: true) alongside
// the regular ladder pool — assessmentEngine.ts's regular question-selection
// must filter `!q.isFinalChallenge` when picking ladder questions; the final
// challenge step draws from FINAL_CHALLENGE_QUESTIONS below instead.
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ── Level 1 — hand rankings, positions, betting order ─────────────────────
  {
    id: 'l1-nuts', difficulty: 1, isFinalChallenge: false, topic: 'hand_rankings',
    prompt: 'A poker hand is considered "the nuts" when it is...',
    options: [
      { id: 'a', label: 'The strongest possible hand at that specific moment', correct: true },
      { id: 'b', label: 'Any pocket pair', correct: false },
      { id: 'c', label: 'A hand that has already won at showdown', correct: false },
    ],
    explanation: 'The nuts is the strongest possible hand given the current board — e.g. AA pre-flop, or J♣T♣ for a straight on 9♥8♥7♦ (until a heart, 9, 8, or 7 turns and a stronger hand becomes possible).',
    source: { ...MPT, section: 'Ch.1 Poker Terms (p.19)', type: 'exact_derived' },
  },
  {
    id: 'l1-effective-nuts', difficulty: 1, isFinalChallenge: false, topic: 'hand_rankings',
    prompt: 'On a board of 8♥7♦2♦, which hand is described as the "effective nuts" — strong enough to be played as if it were the nuts, even though it technically isn\'t?',
    options: [
      { id: 'a', label: '7♣7♥ (a set of sevens)', correct: true },
      { id: 'b', label: '9♠6♠ (an open-ended straight draw)', correct: false },
      { id: 'c', label: 'A♦K♦ (ace-king of diamonds, a flush draw)', correct: false },
    ],
    explanation: 'This is the book\'s own example: 7♣7♥ is not the literal nuts on 8♥7♦2♦ (a flush or higher set beats it), but it\'s strong enough to be played as though it were.',
    source: { ...MPT, section: 'Ch.1 Poker Terms (p.19)', type: 'exact_derived' },
  },
  {
    id: 'l1-utg', difficulty: 1, isFinalChallenge: false, topic: 'positions',
    prompt: 'At a full 9-handed table, which position is the first to act pre-flop?',
    options: [
      { id: 'a', label: 'UTG (Under the Gun)', correct: true },
      { id: 'b', label: 'The Button', correct: false },
      { id: 'c', label: 'The Small Blind', correct: false },
    ],
    explanation: 'UTG sits directly to the left of the blinds and is the first player to act pre-flop.',
    source: { ...MPT, section: 'Ch.1 Table Positions (p.17)', type: 'exact_derived' },
  },
  {
    id: 'l1-button', difficulty: 1, isFinalChallenge: false, topic: 'positions',
    prompt: 'Which position acts LAST on every post-flop betting round?',
    options: [
      { id: 'a', label: 'The Button', correct: true },
      { id: 'b', label: 'The Cutoff', correct: false },
      { id: 'c', label: 'The Big Blind', correct: false },
    ],
    explanation: 'The Button is the last player to act on every post-flop street — the single most positionally advantaged seat at the table.',
    source: { ...MPT, section: 'Ch.1 Table Positions (p.18)', type: 'exact_derived' },
  },
  {
    id: 'l1-3bet', difficulty: 1, isFinalChallenge: false, topic: 'betting_order',
    prompt: 'What is a "3-bet"?',
    options: [
      { id: 'a', label: 'A re-raise — increasing the bet after someone else has already raised', correct: true },
      { id: 'b', label: 'Betting three times the size of the pot', correct: false },
      { id: 'c', label: 'The third player to act in a hand', correct: false },
    ],
    explanation: 'The blinds count as the "first bet," so the first raise is a "2-bet" and a re-raise over that is a "3-bet."',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Player Actions (p.22)', type: 'exact_derived' },
  },
  {
    id: 'l1-relative-position', difficulty: 1, isFinalChallenge: false, topic: 'betting_order',
    prompt: 'In a heads-up pot between the Big Blind (BB) and the Button (BN), who is "in position" for the rest of the hand?',
    options: [
      { id: 'a', label: 'The Button — it acts last on every remaining street', correct: true },
      { id: 'b', label: 'The Big Blind — it posted first', correct: false },
      { id: 'c', label: 'Neither — position resets every street', correct: false },
    ],
    explanation: 'The book gives this exact pairing as its example of relative position: in BB vs BN, BN acts last on every street for the rest of the hand, so BN is in position and BB is out of position.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Relative Position (p.19)', type: 'exact_derived' },
  },

  // ── Level 2 — opening ranges, position advantage, pot odds ────────────────
  {
    id: 'l2-pot-odds-basic', difficulty: 2, isFinalChallenge: false, topic: 'pot_odds',
    prompt: 'The pot is $100. Villain goes all-in for another $100, so you\'d risk $100 to win a $200 pot. What is the minimum equity you need to make calling profitable?',
    options: [
      { id: 'a', label: '33.3%', correct: true },
      { id: 'b', label: '50%', correct: false },
      { id: 'c', label: '66.7%', correct: false },
    ],
    explanation: 'Pot odds as a percentage = amount to call ÷ final pot size = 100 ÷ (100 + 100 + 100) = 33.3%. This is the book\'s own worked example (Q♥J♥ vs. an all-in on A♣8♥7♥).',
    source: { ...MPT, section: 'Ch.1 Pot Odds and Outs (p.36)', type: 'exact_derived' },
  },
  {
    id: 'l2-pot-odds-applied', difficulty: 2, isFinalChallenge: false, topic: 'pot_odds',
    prompt: 'Villain bets $50 into a $100 pot. Applying the same pot-odds formula, what equity do you need to call profitably?',
    options: [
      { id: 'a', label: '25%', correct: true },
      { id: 'b', label: '33%', correct: false },
      { id: 'c', label: '50%', correct: false },
    ],
    explanation: 'Final pot after your call = 100 + 50 + 50 = 200. Equity needed = 50 ÷ 200 = 25%. Same formula as the book\'s worked example, applied to a smaller bet-size.',
    source: { ...MPT, section: 'Ch.1 Pot Odds and Outs (p.36)', type: 'exact_derived' },
  },
  {
    id: 'l2-flush-draw-odds', difficulty: 2, isFinalChallenge: false, topic: 'pot_odds',
    prompt: 'You have a 9-out flush draw on the flop and will see both the turn and river (Villain is all-in). Roughly what is your probability of completing the flush?',
    options: [
      { id: 'a', label: '~35%', correct: true },
      { id: 'b', label: '~20%', correct: false },
      { id: 'c', label: '~50%', correct: false },
    ],
    explanation: 'The book calculates this exact scenario (9 outs, two cards to come) at approximately 35% — comfortably ahead of the 33% pot odds needed in that example, making the call profitable.',
    source: { ...MPT, section: 'Ch.1 Pot Odds and Outs (p.38-40)', type: 'exact_derived' },
  },
  {
    id: 'l2-pot-committed', difficulty: 2, isFinalChallenge: false, topic: 'pot_odds',
    prompt: 'What does it mean to be "pot committed"?',
    options: [
      { id: 'a', label: 'The pot odds from your remaining stack are better than your odds of winning, so folding would be a mistake', correct: true },
      { id: 'b', label: 'You have already won the pot', correct: false },
      { id: 'c', label: 'You are forced to go all-in by the table rules', correct: false },
    ],
    explanation: 'Being pot committed means the pot odds generated by your remaining stack exceed your odds of winning the hand, so folding to any bet or raise would be incorrect.',
    source: { ...MPT, section: 'Ch.1 Pot Odds and Outs — Further Drawing Concepts (p.44)', type: 'exact_derived' },
  },
  {
    id: 'l2-opening-range-width', difficulty: 2, isFinalChallenge: false, topic: 'opening_ranges',
    prompt: 'Why does a standard opening range from UTG (Under the Gun) tend to be much tighter than one from the Button?',
    options: [
      { id: 'a', label: 'More players are still left to act, so more hands can wake up with a better one', correct: true },
      { id: 'b', label: 'UTG is dealt worse cards on average', correct: false },
      { id: 'c', label: 'The blinds are only allowed to defend against tight ranges', correct: false },
    ],
    explanation: 'The book\'s own early-position example range is deliberately narrow — with the whole table still to act, more speculative hands become unprofitable to open compared to a late-position steal from the Button, Cutoff, or Small Blind.',
    source: { ...MPT, section: 'Ch.1 Hand Range (p.28), Poker Terms — Steal (p.22)', type: 'source_reconstructed' },
  },
  {
    id: 'l2-isolate', difficulty: 2, isFinalChallenge: false, topic: 'opening_ranges',
    prompt: 'What does it mean to "isolate" after a player limps into the pot?',
    options: [
      { id: 'a', label: 'Raise, with the intention of playing the pot heads-up against the limper', correct: true },
      { id: 'b', label: 'Fold to avoid a multiway pot', correct: false },
      { id: 'c', label: 'Limp behind to keep the pot small', correct: false },
    ],
    explanation: 'Isolating means raising after someone has entered the pot, specifically to try to play that pot heads-up against them post-flop.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Player Actions (p.22)', type: 'exact_derived' },
  },
  {
    id: 'l2-position-advantage', difficulty: 2, isFinalChallenge: false, topic: 'position_advantage',
    prompt: 'What is the core reason acting last on every street is considered a structural advantage?',
    options: [
      { id: 'a', label: 'You get to see what your opponent does before you have to decide', correct: true },
      { id: 'b', label: 'You are dealt stronger starting hands', correct: false },
      { id: 'c', label: 'You automatically win more pots at showdown', correct: false },
    ],
    explanation: 'Acting last (in position) means having more information — you see your opponent\'s action before committing to your own, on every remaining street.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — In Position / Out of Position (p.19)', type: 'exact_derived' },
  },
  {
    id: 'l2-bb-vs-bn-postflop', difficulty: 2, isFinalChallenge: false, topic: 'position_advantage',
    prompt: 'In a BB vs. Button pot, which player is out of position (OOP) on the flop?',
    options: [
      { id: 'a', label: 'The Big Blind', correct: true },
      { id: 'b', label: 'The Button', correct: false },
      { id: 'c', label: 'Whoever raised pre-flop', correct: false },
    ],
    explanation: 'The Button acts last on every post-flop street in this matchup, so the Big Blind is out of position for the rest of the hand — regardless of who raised pre-flop.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Relative Position (p.19)', type: 'exact_derived' },
  },

  // ── Level 3 — range advantage, continuation betting, equity realization ───
  {
    id: 'l3-range-advantage-def', difficulty: 3, isFinalChallenge: false, topic: 'range_advantage',
    prompt: 'When you have range advantage on a flop, what does that let the WEAKER hands in your own range do?',
    options: [
      { id: 'a', label: 'See more free cards, since Villain can\'t bet too aggressively into a stronger range', correct: true },
      { id: 'b', label: 'Automatically become the nuts', correct: false },
      { id: 'c', label: 'Bluff more profitably than the strong hands in the range', correct: false },
    ],
    explanation: 'Range advantage helps the weak end of your range specifically: because your overall range is strong, the opponent can\'t attack it too aggressively, which lets your weaker holdings realize more equity by seeing free cards.',
    source: { ...MPT, section: 'Ch.2 Range Advantage (p.74)', type: 'exact_derived' },
  },
  {
    id: 'l3-range-advantage-cbet', difficulty: 3, isFinalChallenge: false, topic: 'range_advantage',
    prompt: 'On a flop where Hero has a strong range advantage over Villain, Hero\'s continuation-bet frequency tends to be...',
    options: [
      { id: 'a', label: 'Much higher than on a flop where the ranges run close to even', correct: true },
      { id: 'b', label: 'Exactly the same regardless of range advantage', correct: false },
      { id: 'c', label: 'Lower, to avoid over-betting a strong range', correct: false },
    ],
    explanation: 'The book\'s A76r vs. 654r comparison shows this directly: on a flop favoring Hero\'s range, betting frequency is high (near-range betting); on a flop favoring Villain, Hero\'s betting frequency drops sharply (down to ~9% in one example).',
    source: { ...MPT, section: 'Chapter 12, The Flop Continuation-bet', type: 'source_reconstructed' },
  },
  {
    id: 'l3-cbet-def', difficulty: 3, isFinalChallenge: false, topic: 'continuation_betting',
    prompt: 'What is a Continuation Bet (C-bet)?',
    options: [
      { id: 'a', label: 'A post-flop bet made by the player who was the last aggressor on the previous betting round', correct: true },
      { id: 'b', label: 'Any bet made on the flop, regardless of who raised pre-flop', correct: false },
      { id: 'c', label: 'A bet that continues to increase in size on every street', correct: false },
    ],
    explanation: 'A c-bet is specifically a follow-up bet by whoever was the aggressor on the previous street — e.g. the pre-flop raiser betting again on the flop.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Player Actions (p.22)', type: 'exact_derived' },
  },
  {
    id: 'l3-donk-bet', difficulty: 3, isFinalChallenge: false, topic: 'continuation_betting',
    prompt: 'What is a "donk bet" (lead out)?',
    options: [
      { id: 'a', label: 'The out-of-position player betting into the previous street\'s aggressor, denying them the option to c-bet', correct: true },
      { id: 'b', label: 'A small, weak bet made purely as a bluff', correct: false },
      { id: 'c', label: 'Betting out of turn', correct: false },
    ],
    explanation: 'A donk bet is when the OOP player bets into the player who was aggressive on the previous street, taking away that player\'s option to continuation-bet.',
    source: { ...MPT, section: 'Ch.1 Poker Terms — Player Actions (p.22)', type: 'exact_derived' },
  },
  {
    id: 'l3-eqr-def', difficulty: 3, isFinalChallenge: false, topic: 'equity_realization',
    prompt: 'A hand that wins a bigger share of the pot on average than its raw equity share is said to...',
    options: [
      { id: 'a', label: 'Over-realize its equity', correct: true },
      { id: 'b', label: 'Under-realize its equity', correct: false },
      { id: 'c', label: 'Have negative equity', correct: false },
    ],
    explanation: 'Equity realization (EqR) compares a hand\'s raw equity share to the fraction of the pot it actually captures on average — capturing more than your equity share is over-realizing.',
    source: { ...MPT, section: 'Ch.1 Equity Realization (p.64)', type: 'exact_derived' },
  },
  {
    id: 'l3-suited-eqr', difficulty: 3, isFinalChallenge: false, topic: 'equity_realization',
    prompt: 'On average, roughly how much MORE equity do suited hands realize compared to their offsuit equivalents?',
    options: [
      { id: 'a', label: '~16%', correct: true },
      { id: 'b', label: '~2%', correct: false },
      { id: 'c', label: '~50%', correct: false },
    ],
    explanation: 'Suited hands realize about 16% more equity than offsuit hands on average, due to their access to both front-door and backdoor flush draws.',
    source: { ...MPT, section: 'Ch.2 Hand Suitedness (p.74)', type: 'exact_derived' },
  },
  {
    id: 'l3-spr-nuttiness', difficulty: 3, isFinalChallenge: false, topic: 'equity_realization',
    prompt: 'As Stack-to-Pot Ratio (SPR) increases from low to high, a hand\'s value increasingly comes from...',
    options: [
      { id: 'a', label: 'Its potential to make the nuts ("nuttiness") rather than raw high-card strength', correct: true },
      { id: 'b', label: 'Its ability to win uncontested with a single bet', correct: false },
      { id: 'c', label: 'Pure card strength before the flop', correct: false },
    ],
    explanation: 'At high SPR, hands with nut potential (sets, nut draws) gain value because they can cooler an opponent, while single-pair hands increasingly struggle to get to showdown profitably.',
    source: { ...MPT, section: 'Ch.2 Stack to Pot Ratio (p.75-76)', type: 'exact_derived' },
  },
  {
    id: 'l3-linear-range', difficulty: 3, isFinalChallenge: false, topic: 'range_advantage',
    prompt: 'A "linear" range is best described as...',
    options: [
      { id: 'a', label: 'The highest-equity hands, taken without gaps in between', correct: true },
      { id: 'b', label: 'Only the very best and very worst hands, with nothing in the middle', correct: false },
      { id: 'c', label: 'A range with exactly 13 hands', correct: false },
    ],
    explanation: 'A linear range is composed of the top equity hands in order, with no gaps skipped — the simplest range shape to construct.',
    source: { ...MPT, section: 'Ch.2 Range Morphology (p.76)', type: 'exact_derived' },
  },

  // ── Level 4 — blockers, polarization, range construction ──────────────────
  {
    id: 'l4-polarized-def', difficulty: 4, isFinalChallenge: false, topic: 'polarization',
    prompt: 'A "perfectly polarized" range consists of...',
    options: [
      { id: 'a', label: 'Only the nuts and bluffs, with nothing in between', correct: true },
      { id: 'b', label: 'Only medium-strength hands', correct: false },
      { id: 'c', label: 'Every hand that could plausibly be dealt', correct: false },
    ],
    explanation: 'A polarized range is made of high-equity value hands and low-equity bluffs; a PERFECTLY polarized range contains only the nuts and bluffs, no middling hands at all.',
    source: { ...MPT, section: 'Ch.2 Range Morphology — Polarized Range (p.76-77)', type: 'exact_derived' },
  },
  {
    id: 'l4-depolarized-def', difficulty: 4, isFinalChallenge: false, topic: 'polarization',
    prompt: 'What is a "depolarized" (or condensed) range?',
    options: [
      { id: 'a', label: 'A range with the top and bottom hands removed, made up of middle-equity hands', correct: true },
      { id: 'b', label: 'A range that has been folded away entirely', correct: false },
      { id: 'c', label: 'The same thing as a polarized range', correct: false },
    ],
    explanation: 'A depolarized/condensed range is the opposite of polarized — it has both the strongest AND the weakest hands removed, leaving only the middle-equity holdings.',
    source: { ...MPT, section: 'Ch.2 Range Morphology — Depolarized/Condensed Range (p.78)', type: 'exact_derived' },
  },
  {
    id: 'l4-capped-def', difficulty: 4, isFinalChallenge: false, topic: 'range_construction',
    prompt: 'On A♥J♦T♠, the BB\'s range is missing straights, sets, and most two pairs. This range is described as...',
    options: [
      { id: 'a', label: 'Capped — missing the strongest possible hands', correct: true },
      { id: 'b', label: 'Uncapped — it has every relevant hand class', correct: false },
      { id: 'c', label: 'Polarized', correct: false },
    ],
    explanation: 'This is the book\'s own example: a range missing the top-end (nut) hands for that board is described as capped.',
    source: { ...MPT, section: 'Ch.2 Capped/Uncapped Range (p.79)', type: 'exact_derived' },
  },
  {
    id: 'l4-uncapped-def', difficulty: 4, isFinalChallenge: false, topic: 'range_construction',
    prompt: 'What does it mean for a range to be "uncapped"?',
    options: [
      { id: 'a', label: 'It contains all of the strongest possible hands for that board', correct: true },
      { id: 'b', label: 'It contains an unlimited number of combos', correct: false },
      { id: 'c', label: 'It has no bluffs in it', correct: false },
    ],
    explanation: 'Uncapped is the direct opposite of capped: the range has all the nut-class hands available for that board texture.',
    source: { ...MPT, section: 'Ch.2 Capped/Uncapped Range (p.79)', type: 'exact_derived' },
  },
  {
    id: 'l4-blocker-concept', difficulty: 4, isFinalChallenge: false, topic: 'blockers',
    prompt: 'Holding the A♥ on a board with a heart flush possible removes a combo of the nut flush from Villain\'s range. This card is acting as a...',
    options: [
      { id: 'a', label: 'Blocker', correct: true },
      { id: 'b', label: 'Kicker', correct: false },
      { id: 'c', label: 'Dead out', correct: false },
    ],
    explanation: 'A blocker is a card in your own hand that reduces the number of combos of a specific hand class in your opponent\'s range — here, holding the A♥ removes nut-flush combos from Villain\'s possible range.',
    source: { ...MPT, section: 'Chapter 12, Blocker Effects (p.803)', type: 'source_reconstructed' },
  },
  {
    id: 'l4-blocker-why-villain-checks', difficulty: 4, isFinalChallenge: false, topic: 'blockers',
    prompt: 'In the book\'s Blocker Effects example, Villain holds nothing but flush combos yet NEVER leads/bets into Hero. Why?',
    options: [
      { id: 'a', label: 'Hero\'s range is polarized to the nuts and bluffs — Villain\'s medium flushes are largely bluff-catchers, not hands that want to bet first', correct: true },
      { id: 'b', label: 'Villain is simply playing incorrectly', correct: false },
      { id: 'c', label: 'The betting structure doesn\'t allow Villain to bet', correct: false },
    ],
    explanation: 'Since Hero\'s range is polarized (nuts + bluffs), Villain\'s range — all flushes, but mostly not the nuts — is best played passively, letting Hero\'s range dictate the betting.',
    source: { ...MPT, section: 'Chapter 12, Blocker Effects — Blocker Example 1 (p.804)', type: 'exact_derived' },
  },
  {
    id: 'l4-range-construction-bluffs', difficulty: 4, isFinalChallenge: false, topic: 'range_construction',
    prompt: 'When constructing a polarized betting range, roughly how many bluff combos are needed for each value combo?',
    options: [
      { id: 'a', label: 'Enough to make the ratio match the pot odds offered by the bet-size — not a fixed number', correct: true },
      { id: 'b', label: 'Always exactly one bluff per value combo', correct: false },
      { id: 'c', label: 'Bluffs should never be included in a "real" range', correct: false },
    ],
    explanation: 'The correct bluff-to-value ratio scales with bet-size (via Alpha, the pot odds offered) — there is no single fixed ratio that applies to every bet-size.',
    source: { ...MPT, section: 'Ch.1 Pot Odds and Outs — applied to range construction (p.36)', type: 'source_reconstructed' },
  },
  {
    id: 'l4-polarized-checking-range', difficulty: 4, isFinalChallenge: false, topic: 'range_construction',
    prompt: 'Why does a range that bets very aggressively (a high c-bet frequency) usually still need to keep SOME strong hands in its checking range?',
    options: [
      { id: 'a', label: 'To protect the checking range — otherwise the opponent can attack every check profitably, knowing it\'s pure air', correct: true },
      { id: 'b', label: 'Because strong hands are always better played passively', correct: false },
      { id: 'c', label: 'There is no reason — a checking range should always be as weak as possible', correct: false },
    ],
    explanation: 'A checking range needs some real strength in it (able to check-raise), or the opponent can bet into it profitably knowing it can never fight back.',
    source: { ...MPT, section: 'Chapter 12, The Flop Continuation-bet (p.651-652)', type: 'exact_derived' },
  },

  // ── Final Challenge — advanced/elite only ──────────────────────────────────
  {
    id: 'fc-bluff-selection', difficulty: 4, isFinalChallenge: true, topic: 'bluff_selection',
    prompt: 'Hero\'s polarized flush-or-bluff range is missing the nut flush blocker (the A♥). Counter-intuitively, which combos does the solver prefer to use as bluffs instead of the SECOND-nut blocker (K♥ combos)?',
    options: [
      { id: 'a', label: 'Low, non-flush-blocking spade combos — using the 2nd-nut blocker lets Villain overfold king-high flushes and call more with weaker ones', correct: true },
      { id: 'b', label: 'The 2nd-nut (K♥) blocker combos — the next best blocker is always correct', correct: false },
      { id: 'c', label: 'Any random combo not currently in Hero\'s range', correct: false },
    ],
    explanation: 'The book\'s own solver analysis: without the nut blocker, bluffing with the 2nd-nut blocker lets Villain\'s strategy adjust — overfolding king-high flushes while calling more with lower ones. The solver actually prefers non-blocking low combos instead.',
    source: { ...MPT, section: 'Chapter 12, Blocker Effects — Blocker Example 2 (p.805-806)', type: 'exact_derived' },
  },
  {
    id: 'fc-range-protection', difficulty: 4, isFinalChallenge: true, topic: 'range_protection',
    prompt: 'Out of position with a range disadvantage on 654r, Hero must check some strong hands rather than betting all of them. In the book\'s GTO simulation, what happens to Hero\'s equity realization if this checking range is NOT protected?',
    options: [
      { id: 'a', label: 'It drops from 100% to 79%, costing 9.7% of the pot on average', correct: true },
      { id: 'b', label: 'Nothing changes — protecting the checking range is only a minor consideration', correct: false },
      { id: 'c', label: 'Hero\'s equity realization actually improves', correct: false },
    ],
    explanation: 'This is the book\'s exact measured figure for this scenario — failing to protect the OOP checking range on 654r costs Hero a full 9.7% of the pot in equity realization.',
    source: { ...MPT, section: 'Chapter 12, The Flop Continuation-bet (p.652)', type: 'exact_derived' },
  },
  {
    id: 'fc-elite-board-analysis', difficulty: 4, isFinalChallenge: true, topic: 'elite_board_analysis',
    prompt: 'On A♥J♦T♠, the pre-flop caller\'s range is capped (no straights/sets/most two pairs) while the pre-flop raiser\'s range is uncapped. What does this asymmetry let the raiser do on later streets?',
    options: [
      { id: 'a', label: 'Apply pressure with much larger bet-sizes, since their range can credibly hold the hands needed to justify it', correct: true },
      { id: 'b', label: 'Nothing different — capped and uncapped ranges play identically', correct: false },
      { id: 'c', label: 'Only the capped range can bet large, to represent hands it doesn\'t have', correct: false },
    ],
    explanation: 'An uncapped range can credibly barrel big because it genuinely contains the nutted hands a large bet represents; a capped range risks being exploited if it tries the same, since it provably cannot hold those hands.',
    source: { ...MPT, section: 'Ch.2 Capped/Uncapped Range (p.79)', type: 'source_reconstructed' },
  },
  {
    id: 'fc-delayed-cbet', difficulty: 4, isFinalChallenge: true, topic: 'delayed_cbets',
    prompt: 'A player checks a strong hand on the flop, planning to bet the turn once one more card has narrowed both ranges. This deferred-aggression play is commonly known as a...',
    options: [
      { id: 'a', label: 'Delayed c-bet', correct: true },
      { id: 'b', label: 'Donk bet', correct: false },
      { id: 'c', label: 'Squeeze', correct: false },
    ],
    explanation: 'Note: Modern Poker Theory does not use the specific term "delayed c-bet" — this question tests the underlying mechanism (deferring aggression to a later street as ranges narrow), which the book does cover extensively via its street-by-street range-advantage analysis, using this commonly-used poker-community label for it.',
    source: { ...MPT, section: 'Terminology not in this book — see Chapter 12 street-by-street range analysis for the underlying mechanism', type: 'pedagogical_model' },
  },
]

export const FINAL_CHALLENGE_QUESTIONS: AssessmentQuestion[] = ASSESSMENT_QUESTIONS.filter(q => q.isFinalChallenge)

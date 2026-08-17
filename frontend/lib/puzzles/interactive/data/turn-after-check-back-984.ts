import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 18 — "When the flop checks through, the ranges change places"
 * (BB vs UTG on 9♥8♥4♦, 40bb, turn only)
 *
 * ONE idea: a check-back is a range statement. In-position's checking-back range
 * is capped and depolarized because the strong hands were already c-bet;
 * out-of-position's range is untouched, so it is wide and still uncapped. The
 * book's own conclusion from that pair of facts is the whole puzzle:
 *
 *   'The way the ranges are constructed is somewhat reverse of the flop
 *    situation… This range distribution generally results in OOP developing a
 *    turn betting strategy.'  (p.749)
 *
 * WHY THE SAME BOARD AS PUZZLES 2 AND 17, AND WHY THAT IS NOT A REPEAT.
 * Modern Poker Theory carries 9♥8♥4♦ at 40bb down TWO separate turn lines and
 * solves each on its own:
 *
 *   x/x    the flop checks through   pp.760-764, Tables 134-137  ← this puzzle
 *   x/b/c  UTG c-bets, BB calls      pp.765-771, Tables 138-141  ← puzzle 2
 *
 * They are different nodes with different numbers, and the sentences describing
 * them read almost identically. Puzzle 2's `ex3.turn-*` refs belong to the other
 * line and are deliberately not cited here; the `xx.*` and `turn.984-*-xx` refs
 * are this one. Puzzle 17 reads the same board without a hand; this puzzle is
 * that reading turned into an action.
 *
 * WHY 5♦5♣ AND THE 5♠. The source names the good turn groups for OOP on this
 * board — 'low cards that complete straights, a 9, 8 or 4 pairing the board, and
 * hearts' (p.763) — and then names the single best card in the deck: 'offsuit 5x
 * such as 5♠/5♣' (p.764). The 5♠ is in the group AND is the extreme case, which
 * is what lets the puzzle say which named family the card belongs to instead of
 * asserting that some card 'looks good'. Hero's fives are dealt so the same card
 * that is best for the whole range also does something for this hand — and so
 * that the hand is not the nuts, because the 5 that makes the set is the same 5
 * that completes 7-6.
 *
 * WHAT IS NOT SOURCED, and is labelled as such in the flow:
 *   - NO BET-SIZE for this node. The book names the three sizes that exist at
 *     this decision point (p.751) and prints no split between them for any
 *     single turn card. The 1/3-pot grade is our reading of p.752, where the
 *     book says OOP's bet-size on THIS board is smaller than on J♠6♥6♦ because
 *     OOP's betting range here is more condensed. 2/3-pot is graded defensible,
 *     not wrong.
 *   - THE 25.8% AND 64.17% ARE WHOLE-RANGE FIGURES. They are the EV of the big
 *     blind's entire range as a share of the pot on that turn card. They are not
 *     this hand's EV, and the puzzle says so three times: in the exhibit scope,
 *     in an UnsourcedNote and in the takeaway.
 *   - NO PER-COMBO CONFIRMATION that 5♦5♣ is in the 49.1%. The chart is an image
 *     and only the aggregate is printed.
 *   - NO BUCKET IS PRINTED FOR THIS HOLDING. 'Strong' is the book's definition
 *     (≥75% hand vs range equity, p.596) applied by us to a set on this runout,
 *     not a figure read off a table.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante) — identical to puzzles 2 and 17,
 * which sit on this same flop, so the three cannot disagree on screen:
 *   preflop  UTG to 2.5, BB calls, SB folds  →  pot 5.5, hero 37.5 behind
 *   flop     checks through                  →  pot 5.5 unchanged
 * The 2.5bb open size is an implementation decision; the book gives none here.
 */
export const TURN_AFTER_CHECK_BACK_984: InteractivePuzzle = {
  id: 'turn-after-check-back-984',
  slug: 'when-the-flop-checks-through',
  number: 18,
  title: 'When the flop checks through, the ranges change places',
  topic: 'Turn Play',
  difficulty: 'intermediate',
  description:
    'One decision, out of position on the turn. The pre-flop raiser checked the flop back — and that single passive action hands you a betting range you did not have a moment earlier.',

  setup: {
    format: 'MTT, 40bb effective',
    // Six-handed, so the folded small blind's dead 0.5bb is in the pot.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    heroCards: ['5d', '5c'],
    effectiveStackBb: 40,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'turn',
      street: 'turn',
      board: ['9h', '8h', '4d', '5s'],
      // 2.5 + 2.5 + the folded SB's 0.5. The flop checked through, so nothing
      // was added to it — which is the point of the whole hand.
      potBb: 5.5,
      effectiveStackBb: 37.5,
      toCallBb: 0,
      actionBeforeHero: [
        'UTG raises to 2.5bb',
        'HJ folds',
        'CO folds',
        'BTN folds',
        'SB folds',
        'Hero calls',
      ],
      // Empty because you are first to act on THIS street — a real state, and
      // different from "unknown". The flop's check-check is in the history.
      postflopAction: [],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♥ 8♥ 4♦ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Checks' },
        { street: 'turn', actor: '', text: '5♠ — pot 5.5 bb' },
      ],
      situation:
        'You called UTG’s open in the big blind and checked the 9♥ 8♥ 4♦ flop. UTG checked behind. The turn is the 5♠: it gives you a set of fives — and it is also the card that completes 7-6 for a straight. The pot is still 5.5bb, you have 37.5bb behind, and you are first to act.',
      question: 'The flop checked through. What is your action on this turn?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'The check-back changed the ranges, not just the pot. Their range is now capped and depolarized — the strong hands would have c-bet the flop — while yours is the whole range you called with, wide and still uncapped. The source’s conclusion from exactly that pair of facts is that out-of-position develops a turn betting strategy, and on this board it prints a high betting frequency.',
          sources: ['xx.ip-checkback-capped', 'xx.oop-range-uncapped', 'xx.ranges-invert', 'xx.984-polarization-advantage'],
        },
        {
          id: 'bet-33',
          label: 'Bet 1/3 pot',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'best',
          shortWhy:
            'Bet — the ranges inverted when the flop checked through, and the 5♠ is in the group the book names as good turns for you: low cards that complete straights. The size is our reading, not a printed split: 1/3-pot is one of the three sizes the solution uses at this decision point, and on this board specifically the book says the bet-size is smaller than on the more polarized J♠6♥6♦.',
          sources: ['xx.ranges-invert', 'turn.984-good-cards-xx', 'xx.oop-turn-bet-sizes', 'xx.984-condensed-vs-j66'],
        },
        {
          id: 'bet-67',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'defensible',
          shortWhy:
            'Betting is right, and 2/3-pot is a real size at this node — the solution uses three. It is graded below the small size only because the book, comparing this board with J♠6♥6♦, says out-of-position’s betting frequency and bet-size are smaller here. No split between the sizes is printed, so this is a reading, not a correction.',
          sources: ['xx.oop-turn-bet-sizes', 'xx.984-condensed-vs-j66'],
        },
      ],
      bestOptionId: 'bet-33',
      explanation:
        'Bet, small. WHY: nothing about your cards changed when UTG checked, but everything about the two ranges did. Their checking-back range is capped and a lot more depolarized than their c-betting range, because they would have c-bet most of their strong hands on the flop — on this exact board the source has UTG checking back AA, top set and middle set only about 8% of the time. Yours is untouched: with no donk-betting range on this flop you arrive on the turn with exactly the range you called the pre-flop raise with, which is wide compared to theirs and still uncapped. THE RANGE THEORY: capped and depolarized on one side, wide and uncapped on the other, is the reverse of how the flop was set up, and the book states the consequence in one sentence — "The way the ranges are constructed is somewhat reverse of the flop situation, making OOP’s range more polarized than IP’s and IP’s range more condensed than OOP’s. This range distribution generally results in OOP developing a turn betting strategy" (p.749). THE CARD: the 5♠ belongs to the first family the book names as good turns for you here — low cards that complete straights — and among those, offsuit 5s are the best turn card in the deck for the big blind on this board. SIZING AND FREQUENCY: on 9♥8♥4♦ out-of-position has the polarization advantage on many turn cards, resulting in a high betting frequency (p.761). A bet-size for this node is not specified in the source; the small size is graded best as our reading of p.752, where the book says the bet-size on this board is smaller than on J♠6♥6♦ because the betting range here is more condensed.',
      unsourced: [
        {
          question: 'Does the book give a bet-size for this turn lead?',
          answer:
            'A bet-size for this node is not specified in the source. What is printed is that the solution has three sizes available at out-of-position’s first turn action — 1.2x-pot, 2/3-pot and 1/3-pot (p.751) — and, for this board compared with J♠6♥6♦, that the betting frequency and bet-size are smaller here because the betting range is more condensed (p.752). Grading 1/3-pot above 2/3-pot is our reading of those two sentences, not a frequency the book prints. Both bet options are correct in substance; only the check contradicts the source.',
          nearestSources: ['xx.oop-turn-bet-sizes', 'xx.984-condensed-vs-j66', 'xx.984-polarization-advantage'],
        },
        {
          question: 'Is 64.17% what my set of fives is worth?',
          answer:
            'No, and this is the easiest number in the chapter to misread. The 25.8% and 64.17% figures are the EV of the big blind’s WHOLE RANGE, expressed as a share of the pot, on that turn card — what every hand you could hold is worth on average once the 5 or the ace lands. They say nothing about one holding. The book prints no EV for 5♦5♣ on this runout, and neither does this puzzle.',
          nearestSources: ['turn.984-worst-card-xx'],
        },
        {
          question: 'Is 5♦5♣ specifically inside the 49.1% the big blind calls with?',
          answer:
            'No per-combo confirmation exists in the text. The chart for BB vs UTG at 40bb is printed as an image and only the aggregate — call 49.1%, 3-bet 5.8%, fold 45% — is stated in words. The bucket label on this hand has the same status: "strong" is the book’s definition (hand vs range equity of 75% or more) applied by us to a set on this runout, not a figure read off a table.',
          nearestSources: ['ex3.preflop-bb-vs-utg-40bb', 'eqb.definitions'],
        },
      ],
      theory: [
        {
          id: 'ranges-swap',
          title: 'A check-back is a range statement',
          body:
            'The instinct after check-check is that nothing happened: same pot, same position, one more card. What actually happened is that your opponent told you which half of their range they no longer have. A GTO checking-back range is still balanced and still covers the board — this is not the capped, face-up range a weak player leaves behind — but it is capped, because most of the strong hands took the c-bet branch on the flop. Your range did not go through that filter at all.',
          exhibit: {
            caption: 'What UTG leaves behind when they check this flop back',
            scope:
              'UTG’s FLOP c-betting strategy on 9♥8♥4♦ at 40bb, read for what it does NOT bet. These are per-hand-class check-back frequencies from the flop chapter, not slices of one range and not turn figures.',
            rows: [
              {
                label: 'AA, top set, middle set — checked back',
                value: '~8%',
                pct: 8,
                note: 'capped does not mean empty: the nutted hands are still there, just rarely',
              },
              {
                label: 'Top pair — checked back',
                value: '24%',
                pct: 24,
                note: 'and c-bet in reverse-linear fashion, A9 at 100% down to T9s at 66%',
              },
              {
                label: 'Middle pairs, weaker draws such as OESD',
                value: 'mostly checked',
                note: 'the depolarizing half — made hands that do not want to build a pot',
              },
            ],
            sources: ['ex3.utg-checkback-composition'],
          },
          bullets: [
            {
              text: 'The source states the cap directly: a GTO checking-back range has the right board coverage and is fairly balanced, but is still somewhat capped and a lot more depolarized than the c-betting range, because most strong hands were c-bet on the flop.',
              sources: ['xx.ip-checkback-capped'],
            },
            {
              text: 'And it states what your range is, conditionally: with no donk-betting range on this flop, you have exactly the range you called the pre-flop raise with — very wide compared to theirs, and still uncapped.',
              sources: ['xx.oop-range-uncapped'],
            },
            {
              text: 'Put together, the shapes have traded places: yours is now the more polarized range and theirs the more condensed one, which is the reverse of the flop. The book’s conclusion is that out-of-position develops a turn betting strategy.',
              sources: ['xx.ranges-invert'],
            },
          ],
          sources: ['xx.ip-checkback-capped', 'xx.oop-range-uncapped', 'xx.ranges-invert'],
        },
        {
          id: 'why-this-card',
          title: 'Why the 5♠ and not just any turn',
          body:
            'The inversion gives you a betting strategy; the card decides how hard you use it. On this board the book sorts the turns into families and says plainly which side each favours — and the 5♠ sits in the family at the top of that list, low cards that complete straights. Among them, offsuit 5s are the best card in the deck for the big blind here. The figures below are the swing that classification is worth to your whole range.',
          exhibit: {
            caption: 'What the turn card is worth to the big blind’s range',
            scope:
              'BB vs UTG on 9♥8♥4♦ at 40bb, turn, after the flop CHECKED THROUGH (x/x) — not the x/b/c line, which the book solves separately with its own tables. Every figure is the EV of OOP’s WHOLE RANGE as a share of the pot on that card. None of them is the EV of a hand.',
            rows: [
              {
                label: 'Average turn card — EV, share of pot',
                value: '53%',
                pct: 53,
                note: '48% equity, over-realized',
              },
              {
                label: 'Best turn card, offsuit 5 — EV',
                value: '64.17%',
                pct: 64.17,
                note: 'the card you were dealt',
              },
              {
                label: 'Worst turn card, offsuit ace — EV',
                value: '25.8%',
                pct: 25.8,
                note: 'the same range, one card later, worth less than half as much',
              },
            ],
            sources: ['turn.984-worst-card-xx'],
          },
          bullets: [
            {
              text: 'The named families: low cards that complete straights, a 9, 8 or 4 pairing the board, and hearts are good turns for out-of-position; overcards that do not complete many straights, and particularly aces, are good for in-position.',
              sources: ['turn.984-good-cards-xx'],
            },
            {
              text: 'And the frequency that follows from it: on 9♥8♥4♦ out-of-position has the polarization advantage on many turn cards, resulting in a high betting frequency.',
              sources: ['xx.984-polarization-advantage'],
            },
            {
              text: 'In the book’s own turn-grouping scheme this card is a "Straight" — a turn that completes an OESD. That is the classification; what it is worth here comes from this board’s tables, not from the category.',
              sources: ['turn.categories'],
            },
            {
              text: 'One check on the size: in-position is not helpless on this board. The book raises a 1/3-pot bet 19% of the time here, precisely because out-of-position’s betting range is more condensed than on a board like J♠6♥6♦ and in-position keeps more strong hands.',
              sources: ['xx.984-condensed-vs-j66'],
            },
          ],
          sources: ['turn.984-good-cards-xx', 'turn.984-worst-card-xx', 'turn.984-xx-setup'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'oop-turn-range',
      label: 'Your range on this turn',
      kind: 'aggregate',
      seat: 'hero',
      headline: '49.1%',
      description:
        'There is nothing to compute. The source says that with no donk-betting range on the flop you arrive on the turn holding exactly the range you called the pre-flop raise with — and for BB vs UTG at 40bb that range is the 49.1% the book prints. Wide compared to theirs, and untouched by any filter, which is what "still uncapped" means.',
      unsourced: [
        {
          question: 'Which hands make up the 49.1%?',
          answer:
            'The chart is a colour-coded image; only the aggregate is stated in words — call 49.1%, 3-bet 5.8%, fold 45%. Your hand is marked on the grid below as a location, never as a claimed frequency. Note also that the "same range as pre-flop" statement is conditional in the source: it holds where the big blind has no donk-betting range on the flop, which is the line this hand played.',
          nearestSources: ['ex3.preflop-bb-vs-utg-40bb', 'xx.oop-range-uncapped'],
        },
      ],
      sources: ['xx.oop-range-uncapped', 'ex3.preflop-bb-vs-utg-40bb'],
    },
    {
      id: 'ip-checkback-range',
      label: 'What UTG checked back with',
      kind: 'composition',
      seat: 'villain',
      description:
        'Not slices of one range — two check-back frequencies for two hand classes, which is what the source prints for this flop. Read them as the shape of the cap: the very top of UTG’s range almost always bet, top pair stayed behind a quarter of the time, and middle pairs and weaker draws mostly checked. That is a range with its strong end thinned out and its middle intact.',
      bars: [
        { label: 'AA, top set, middle set checked back', pct: 8, note: 'the cap — rare, not absent' },
        { label: 'Top pair checked back', pct: 24, note: 'the depolarized middle that stays' },
      ],
      unsourced: [
        {
          question: 'What are the rest of the percentages?',
          answer:
            'Not printed. The book describes the other classes in words — middle pairs mostly checked, combo draws and flush draws mostly c-bet, weaker draws such as OESD mostly checked — without attaching a number to them, and it prints no bucket breakdown of the checking-back range as a whole. These two figures are the only ones stated for this flop, which is why the bars do not add to 100.',
          nearestSources: ['ex3.utg-checkback-composition', 'xx.ip-checkback-capped'],
        },
      ],
      sources: ['ex3.utg-checkback-composition'],
    },
  ],

  takeawayHeadline:
    'A check-back is not a quiet street — it is the moment the two ranges trade shapes, and the out-of-position player inherits the bet.',
  headlineSources: ['xx.ip-checkback-capped', 'xx.ranges-invert'],
  takeaways: [
    {
      text: 'A GTO checking-back range is balanced and covers the board, but it is still somewhat capped and a lot more depolarized than a c-betting range — most of the strong hands bet the flop.',
      sources: ['xx.ip-checkback-capped'],
    },
    {
      text: 'With no donk-betting range, out-of-position arrives on the turn with exactly the range that called pre-flop: very wide compared to in-position’s, and still uncapped.',
      sources: ['xx.oop-range-uncapped'],
    },
    {
      text: 'That is the reverse of the flop — out-of-position is now the more polarized range and in-position the more condensed one — and the book’s conclusion is that out-of-position develops a turn betting strategy. On 9♥8♥4♦ that shows up as a polarization advantage on many turn cards and a high betting frequency.',
      sources: ['xx.ranges-invert', 'xx.984-polarization-advantage'],
    },
    {
      text: 'Which turn card lands still decides everything: low straight-completing cards, a 9, 8 or 4, and hearts are good for you; aces are the worst. Across that spread the big blind’s WHOLE RANGE swings from 25.8% to 64.17% of the pot in EV — a range figure, never a hand’s.',
      sources: ['turn.984-good-cards-xx', 'turn.984-worst-card-xx'],
    },
  ],

  endsEarlyBecause:
    'One decision, on purpose. The idea is the inversion the check-back creates, and the source answers exactly that question at the turn’s first action. What UTG does facing the lead — they raise a 1/3-pot bet 19% of the time on this board — is the next node along with its own printed strategy, and putting it here would teach a second thing badly instead of this one well.',

  xp: 50,
}

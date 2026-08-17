import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 19 — "The check-raise that is already all-in"
 * (BB vs UTG, 9♥8♥4♦ 2♦, 40bb, facing a turn second barrel)
 *
 * ONE idea: on the turn, out of position, after checking twice, the check-raise
 * is not a size you pick. It is all-in or it is nothing — and over 40% of the
 * range is not raising at all, it is folding.
 *
 * The node is the book's own. Modern Poker Theory carries this exact hand
 * (BB vs UTG on 9♥8♥4♦ at 40bb) through the turn chapter one branch at a time,
 * and this puzzle sits on the last branch it solves:
 *
 *   x/b/c        flop check, c-bet, call            (pp.766-769)
 *   x/b/c/x      turn checked to IP                 (pp.771-774)
 *   x/b/c/x/b67  IP fires 2/3-pot — THIS PUZZLE     (pp.775-778)
 *   river        no solution printed. The hand stops.
 *
 * WHY THIS HAND. J♥T♥ is not a convenient invention: p.744 names it, by name, at
 * the flop node this line passes through — "J♥T♥ and J♥7♥ are x/r about 1/3 and
 * lower combo draws are mostly x/c" — so the book itself puts this combo in the
 * BB's range with check-calling as its majority flop action. It is also exactly
 * the profile p.777 describes for the weaker check-raising hands: a semi-bluff
 * with the equity to call an all-in bet, and thus committed.
 *
 * THE TRAP THIS PUZZLE IS EXPOSED TO. The book prints a per-combo figure for
 * this very hand — 1/3 — one street earlier. Reusing it as "J♥T♥ check-raises
 * the turn a third of the time" would look impeccably sourced and would be
 * fabrication: different street, different node. The 14% and the over-40% are
 * WHOLE-RANGE averages across turn cards, and the puzzle says so in three
 * places rather than one.
 *
 * NOT SOURCED, and labelled as such in the flow:
 *   - No per-combo turn x/r frequency exists in this section, for any hand.
 *   - No strategy is printed for the 2♦ specifically. The book prints per-card
 *     heatmaps at this node but states its strategy figures as averages, so the
 *     turn check is given to the learner as history, not argued from the card.
 *   - The 2.5bb open is the book's 100bb 6-max cash sizing recommendation
 *     (pp.179-180), which does not cover a 40bb MTT UTG open. Same disclosure
 *     as the other puzzles on this line.
 *   - No river. p.779 begins the river chapter, which works in abstract models
 *     and never returns to this board.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante) — the same model as the
 * four-street puzzle on this board, continued one branch further:
 *   preflop  pot 4.0   = 2.5 + 1 + 0.5   hero in for 1, owes 1.5
 *   flop     pot 5.5 → UTG bets 3.7 (2/3) → hero calls 3.7
 *   turn     pot 12.9 → hero checks → UTG bets 8.6 (2/3) → 21.5 faced
 *            hero owes 8.6 with 33.8 behind; the raise is 33.8, all of it
 */
export const TURN_CHECK_RAISE_ALL_IN: InteractivePuzzle = {
  id: 'turn-check-raise-all-in',
  slug: 'the-check-raise-that-is-all-in',
  number: 19,
  title: 'The check-raise that is already all-in',
  topic: 'Turn Play',
  difficulty: 'advanced',
  description:
    'You check the turn, UTG barrels a second time, and the raise available to you is your entire stack. This puzzle is about why that is not a choice — and why more than 40% of the range facing this bet simply folds.',

  setup: {
    format: '40bb effective',
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    heroCards: ['Jh', 'Th'],
    effectiveStackBb: 40,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1. The flop and turn action so far is history, not your decision.',
  },

  decisions: [
    {
      id: 'turn-vs-second-barrel',
      street: 'turn',
      board: ['9h', '8h', '4d', '2d'],
      potBb: 21.5,
      effectiveStackBb: 33.8,
      facingBetBb: 8.6,
      heroInvestedBb: 0,
      toCallBb: 8.6,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: ['BB checks', 'UTG bets 8.6bb'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♥ 8♥ 4♦ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 3.7 bb (2/3 pot)' },
        { street: 'flop', actor: 'BB', text: 'Calls 3.7 bb', isHero: true },
        { street: 'turn', actor: '', text: '2♦ — pot 12.9 bb' },
        { street: 'turn', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'turn', actor: 'UTG', text: 'Bets 8.6 bb (2/3 pot)' },
      ],
      situation:
        'You hold J♥ T♥ — a heart flush draw plus an open-ended straight draw, with a queen or a seven making your straight. You checked the flop and called; the turn is the 2♦, a brick that pairs nothing and completes nothing. You checked again, and UTG has fired a second barrel of 8.6bb into 12.9bb. The pot is 21.5bb, it costs 8.6bb to continue, and you have 33.8bb behind.',
      question: 'You face the second barrel. What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Over 40% of the range does fold here — but the source names the hands that raise instead, and they are semi-bluffs with the equity to call an all-in bet. A flush draw plus an open-ender is that description, not the trash the 40% is made of.',
          sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 8.6 bb',
          tableAction: { label: 'Calls', betBb: 8.6 },
          verdict: 'defensible',
          shortWhy:
            'A real branch, not a blunder: the source keeps a check-calling range here and says it stays protected because some strong hands are still slowplayed. But it also says the semi-bluffs with enough equity to be committed are the ones check-raising — and yours is one of them.',
          sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
        },
        {
          id: 'check-raise-all-in',
          label: 'Check-raise all-in',
          historyText: 'Raises all-in for 33.8 bb',
          tableAction: { label: 'All-in', betBb: 33.8 },
          verdict: 'best',
          shortWhy:
            'The source’s own description of this hand class: the weaker check-raising hands are semi-bluffs that have the equity to call an all-in bet and are therefore committed. And the size is not a choice — OOP is mostly going all-in, because a smaller raise would commit too many chips anyway.',
          sources: ['ex3.turn-xr-all-in'],
        },
      ],
      bestOptionId: 'check-raise-all-in',
      explanation:
        'Check-raise all-in. The book describes the hands that check-raise this node in one sentence, and it is a description of your hand: the weaker check-raising hands are semi-bluffs that will have the equity to call an all-in bet and thus be committed. J♥T♥ is a flush draw plus an open-ender — it is not raising because it is strong, it is raising because it cannot be pushed off the pot. And the size follows from the stack rather than from taste: on average OOP check-raises the turn 14% of the time and is mostly going all-in, because a smaller raise size would commit too many chips. Once a raise leaves you unable to fold to the jam behind it, the smaller raise is not a cheaper version of the shove. It is the shove, with the fold equity removed.',
      unsourced: [
        {
          question: 'How often does J♥T♥ specifically check-raise this turn?',
          answer:
            'Exact combo frequency is not specified in the source. The 14% check-raise and the over-40% fold are whole-range averages at this node, printed as averages across turn cards — not frequencies for any one holding. There is a trap worth naming: the book DOES print a per-combo figure for this exact hand one street earlier, where J♥T♥ is check-raised about a third of the time on the flop. That is the flop node, before UTG had barrelled again and before both ranges had split several more times. Carrying it onto the turn would produce a number that looks perfectly cited and is not in the book.',
          nearestSources: ['ex3.turn-xr-all-in', 'ex3.flop-combo-draws-jhth'],
        },
        {
          question: 'Is the 2♦ specifically a card the big blind should be checking?',
          answer:
            'The book prints equity and EV heatmaps for every turn card at this node, but it states its strategy figures — the 14%, the over-40%, the equity and realization numbers — as averages across turn cards. So this puzzle does not argue the check from the card. Your check is given to you as history, and the question asked is the one the source actually answers: what does OOP do facing the second barrel. For what it is worth about the card itself, the book’s list of the worst turn cards to lead on this board includes diamonds that hand UTG a backdoor flush draw, which the 2♦ does; it also lists blank low cards among the best. That tension is genuinely unresolved in the text and is not resolved here.',
          nearestSources: ['ex3.turn-donk-best-cards', 'ex3.turn-second-barrel-oop'],
        },
        {
          question: 'Where do the bet-sizes in this hand come from?',
          answer:
            'The 2/3-pot flop and turn c-bets are the book’s own: this is Flop Strategy Example 3 — "BB vs 2/3-pot c-bet" — and the turn node is labelled x/b/c/x/b67 in the source’s own table titles. The 2.5bb preflop open is not from these pages. The book’s recommended opening sizes (pp.179-180) are given for a 100bb 6-max cash game and do not cover a 40bb MTT open from UTG, so 2.5bb is an implementation decision, consistent with the other puzzles on this board.',
          nearestSources: ['ex3.utg-cbet-big', 'ex3.turn-xr-all-in'],
        },
      ],
      theory: [
        {
          id: 'why-the-raise-is-all-in',
          title: 'Why a smaller raise is the worse version of the same thing',
          body:
            'The source gives the reason in half a sentence: OOP is mostly going all-in, "as a smaller raise size would commit too many chips." Read that as a statement about what is left behind rather than about what goes in. By the turn the pot has been built by three bets, so any raise big enough to be a raise leaves you with a stack too small to fold. You would then be facing a jam you have to call — which means the chips were never really yours to keep. A smaller raise does not buy you an exit; it just gives UTG a cheaper price to shove into. So the raise is sized at the only point where the decision is honest: all of it, now.',
          exhibit: {
            caption: 'What is left behind after a raise that is not all-in',
            scope:
              'The 14% and the preference for all-in are the source’s (p.777). The bb amounts and equity figures in this table are NOT in the book — they are arithmetic from this puzzle’s own 40bb money model, shown only to make the source’s stated reason concrete.',
            rows: [
              { label: 'Pot you are raising into', value: '21.5bb', note: '12.9 pot plus UTG’s 8.6 barrel' },
              { label: 'Your stack behind the bet', value: '33.8bb', note: 'the whole of the raise available to you' },
              { label: 'A raise to 20bb would leave', value: '13.8bb', note: 'less than a third of your stack' },
              {
                label: 'Equity needed to call the jam that follows',
                value: '~17%',
                pct: 17,
                note: '13.8 to win 66.7 — you cannot fold',
              },
              {
                label: 'Your draw is worth about',
                value: '~33%',
                pct: 33,
                note: 'fifteen cards make a flush or a straight — card counting, not solver output',
              },
            ],
            sources: ['ex3.turn-xr-all-in'],
          },
          bullets: [
            {
              text: 'The source states the mechanism as a property of the hand class, not of one holding: the weaker check-raising hands are semi-bluffs that will have the equity to call an all-in bet and thus be committed.',
              sources: ['ex3.turn-xr-all-in'],
            },
            {
              text: 'And it states the consequence for sizing directly — OOP will be mostly going all-in, because a smaller raise size would commit too many chips.',
              sources: ['ex3.turn-xr-all-in'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book print a raise size to compare against?',
              answer:
                'No. It prints one instruction — mostly all-in — and the reason for it. The 20bb raise in the table above is an illustration chosen by us to show what "commit too many chips" means at this stack depth; the book neither recommends it nor prices it. The direction of the argument is the source’s; the numbers attached to it are ours.',
              nearestSources: ['ex3.turn-xr-all-in'],
            },
          ],
          sources: ['ex3.turn-xr-all-in'],
        },
        {
          id: 'why-forty-percent-folds',
          title: 'Why over 40% of the range folds — and why the calls are still safe',
          body:
            'The fold frequency is not a statement about how scary UTG looks. It is bookkeeping on everything that has already happened. Both ranges have now split several times: UTG c-bet the flop and has barrelled again, so what remains is very polarized, while the medium-strength hands that would have hated a second barrel were checked back on this street rather than bet. On your side the strong hands mostly left earlier — they bet or raised on previous streets — so what arrives at this node is, in the source’s words, weak against UTG’s turn c-betting range. Over 40% of it folds because over 40% of it has nothing to defend with. Note carefully what that number is not: it is a property of the range, not a verdict on your hand, and a flush draw with an open-ender is not in the part that folds.',
          exhibit: {
            caption: 'What OOP’s position at this node is actually worth',
            scope:
              'BB vs UTG on 9♥8♥4♦ at 40bb, facing the turn 2/3-pot c-bet after checking twice (x/b/c/x/b67). Averages across turn cards for the whole range — not equities for any particular hand.',
            rows: [
              { label: 'OOP equity facing the turn c-bet', value: '45%', pct: 45 },
              { label: 'OOP equity realization', value: '77%', pct: 77, note: 'under-realized, and heavily' },
              { label: 'OOP share of the pot', value: '21%', pct: 21 },
              { label: 'IP equity', value: '55%', pct: 55 },
              { label: 'IP equity realization', value: '144%', note: 'over-realized by a large margin' },
              { label: 'IP share of the pot', value: '79%', pct: 79 },
            ],
            sources: ['ex3.turn-facing-cbet-eqr'],
          },
          bullets: [
            {
              text: 'The check-calling range is not left naked. The source is explicit that most strong hands check-raise the turn, but some are still slowplayed — which is what leaves the check-calling range protected, even on brick runouts.',
              sources: ['ex3.turn-second-barrel-oop'],
            },
            {
              text: 'That is the answer to the obvious objection: if every strong hand raised, calling would be a range of pure bluff-catchers and UTG could barrel with impunity. The slowplays are the reason it is not.',
              sources: ['ex3.turn-second-barrel-oop'],
            },
            {
              text: 'The cost of arriving here at all is priced by the source. After OOP has checked twice, IP holds a substantial polarization advantage, c-bets over 65% of the time, and mostly uses the 2/3-pot size you are now facing.',
              sources: ['ex3.ip-punishes-a-check'],
            },
          ],
          sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-facing-cbet-eqr'],
        },
        {
          id: 'the-two-frequencies',
          title: 'The two numbers, and exactly what they are numbers about',
          body:
            'Facing this bet, the range does three things: it folds over 40% of the time, it check-raises 14% of the time — almost always all-in — and it check-calls the remainder. Both printed figures are whole-range averages across turn cards. Neither one tells you how often any single hand takes any single action, and the book prints no per-combo frequency at this node for any holding. What it gives instead is a description of who is in the raising range, which is the actually usable instruction: the weaker part of it is semi-bluffs with enough equity that an all-in cannot fold them.',
          exhibit: {
            caption: 'OOP’s response to a 2/3-pot turn c-bet after checking twice',
            scope:
              'Whole-range averages at the x/b/c/x/b67 node, BB vs UTG on 9♥8♥4♦ at 40bb. The fold and check-raise figures are printed; the check-call share is only what is left over, and the source does not state it.',
            rows: [
              { label: 'Fold', value: 'over 40%', pct: 40, note: 'printed as an average' },
              { label: 'Check-raise, mostly all-in', value: '14%', pct: 14, note: 'printed as an average' },
              {
                label: 'Check-call',
                value: 'under 46%',
                pct: 46,
                note: 'not printed — the residual, and a ceiling rather than a figure',
              },
            ],
            sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
          },
          bullets: [
            {
              text: 'Fold: "resulting in OOP folding, on average, over 40% vs a turn c-bet."',
              sources: ['ex3.turn-second-barrel-oop'],
            },
            {
              text: 'Check-raise: "On average, OOP will x/r the turn 14% of the time and will be mostly going all-in."',
              sources: ['ex3.turn-xr-all-in'],
            },
          ],
          unsourced: [
            {
              question: 'So how much does OOP check-call?',
              answer:
                'The source does not say. Subtracting the two printed figures from 100% leaves 46%, but the fold number is given as "over 40%", so the remainder is a ceiling, not a value — check-calling is under 46%, by an amount the text does not quantify. The bar above is drawn at the ceiling and labelled as such rather than presented as a solved frequency.',
              nearestSources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
            },
          ],
          sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'oop-vs-second-barrel',
      label: 'Big blind’s response to the second barrel',
      kind: 'composition',
      seat: 'hero',
      description:
        'The shape of the whole range at this node, and the reason the puzzle exists. Nearly half of it cannot continue at all — and of the part that raises, almost all of it is raising for its entire stack.',
      bars: [
        { label: 'Fold', pct: 40, note: 'printed as "over 40%" — the range arrives here weak' },
        { label: 'Check-raise, mostly all-in', pct: 14, note: 'a smaller raise would commit too many chips' },
        { label: 'Check-call', pct: 46, note: 'the residual only — under 46%, and not printed in the source' },
      ],
      unsourced: [
        {
          question: 'Can you show which hands make up the 14%?',
          answer:
            'Not as a chart. The source describes the raising range in words — most strong hands check-raise, some are slowplayed instead, and the weaker raises are semi-bluffs with the equity to call an all-in — but prints no per-hand grid and no per-combo frequency at this node. Exact combo frequency is not specified in the source, for this hand or any other.',
          nearestSources: ['ex3.turn-xr-all-in', 'ex3.turn-second-barrel-oop'],
        },
      ],
      sources: ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in'],
    },
    {
      id: 'utg-turn-barrel',
      label: 'UTG’s turn barrelling range',
      kind: 'aggregate',
      seat: 'villain',
      headline: 'over 65%',
      description:
        'What you are actually facing. After you check twice, UTG holds a substantial polarization advantage, c-bets over 65% of the time and mostly uses the 2/3-pot size — and by the time the second barrel lands, the medium-strength hands have been checked back, leaving a very polarized betting range.',
      sources: ['ex3.ip-punishes-a-check', 'ex3.turn-second-barrel-oop'],
    },
  ],

  takeawayHeadline:
    'Out of position on the turn, the check-raise is not a size you choose — it is all-in, and most of your range is not in it.',
  headlineSources: ['ex3.turn-xr-all-in', 'ex3.turn-second-barrel-oop'],
  takeaways: [
    {
      text: 'Facing a turn second barrel after checking twice, the big blind folds over 40% of the time on average — because both ranges have split several times and the strong hands have mostly already bet or raised.',
      sources: ['ex3.turn-second-barrel-oop'],
    },
    {
      text: 'The check-raise happens 14% of the time and is mostly all-in, for one stated reason: a smaller raise size would commit too many chips.',
      sources: ['ex3.turn-xr-all-in'],
    },
    {
      text: 'The weaker hands in that raising range are semi-bluffs with the equity to call an all-in bet, and are therefore committed — which is why raising all of it costs nothing they could have kept.',
      sources: ['ex3.turn-xr-all-in'],
    },
    {
      text: 'The check-calling range still holds up, because some strong hands are slowplayed rather than raised — it stays protected even on brick runouts.',
      sources: ['ex3.turn-second-barrel-oop'],
    },
    {
      text: 'The price of getting to this node is steep: 45% equity, only 77% of it realized, 21% of the pot — while IP over-realizes at 144% and captures 79%.',
      sources: ['ex3.turn-facing-cbet-eqr'],
    },
  ],

  endsEarlyBecause:
    'The hand stops on the turn because the source does. Modern Poker Theory solves this line branch by branch — the flop c-bet and call, the turn check, then OOP’s response to the second barrel (pp.775-778) — and then the book moves to the river chapter, which works in abstract models rather than solutions for this board and never returns to it. There is no printed river strategy for what happens after this check-raise, and building one would mean inventing solver output.',

  xp: 75,
}

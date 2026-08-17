import type { InteractivePuzzle } from '../types'

/**
 * "Four ways to defend the big blind at 25bb"
 * (BB vs a BN min-raise, 25bb, 9-max MTT, preflop only)
 *
 * ONE idea and nothing else: at 25bb the big blind's strategy has FOUR branches,
 * not two or three — fold, call, non-all-in 3-bet, and all-in — and the all-in
 * is an ordinary branch of the equilibrium rather than a panic button. Every
 * claim traces to two facing pages of Modern Poker Theory: the prose on p.386
 * and the aggregates printed with Hand Range 159 on p.387.
 *
 * Four content decisions worth recording, each a place where the obvious version
 * of this puzzle would have claimed more than the book prints:
 *
 * 1. NO PER-COMBO FREQUENCY IS CLAIMED FOR 8♠8♦. Hand Range 159 is a
 *    colour-coded chart IMAGE; the only figures printed in text are the
 *    whole-range aggregates 11.4 / 8.2 / 65.9 / 14.6. What the source states in
 *    words is the CLASS — "Pocket pairs and Axo really like getting all-in" —
 *    so the hero hand is drawn from a class the book names, and the puzzle says
 *    outright that the exact combo frequency is not specified.
 *
 * 2. THE TWO RAISING BRANCHES ARE NEVER ADDED TOGETHER. 8.2% + 11.4% = 19.6% is
 *    a number the book does not print, and printing it would erase the very
 *    distinction these two pages exist to draw. They are kept apart everywhere,
 *    including in the range explorer.
 *
 * 3. NO FIGURE IS IMPORTED FROM ANOTHER STACK DEPTH. Ch.8 solves 15bb, 25bb,
 *    40bb and 60bb separately (p.360), and the 15bb section one page earlier has
 *    a tempting sentence about which pairs rejam — at a depth where the BB has
 *    no non-all-in 3-bet branch at all. Only 25bb figures appear here.
 *
 * 4. THE ANTE IS A GAME ASSUMPTION, AND IT IS DISCLOSED. The 1.125bb of dead
 *    money on the felt comes from the 9-max 12.5% ante the book states for its
 *    MTT solutions at the head of Ch.7 (p.293) — the defence chapter does not
 *    restate it. It is named in the flow rather than left to look like it came
 *    from p.386.
 */
export const BB_FOUR_DEFENCES_25BB: InteractivePuzzle = {
  id: 'bb-four-defences-25bb',
  slug: 'four-ways-to-defend-at-25bb',
  number: 7,
  title: 'Four ways to defend the big blind at 25bb',
  topic: 'BB Defence',
  difficulty: 'intermediate',
  description:
    'One preflop decision with a middle pocket pair. Most players see two answers here and a third they would rather not think about. At 25bb the equilibrium has four — and the one that looks like panic is the one the source names for this hand.',

  setup: {
    format: '25bb effective',
    // Nine-handed, because the book's MTT solutions are 9-max and every seat's
    // ante is in the pot: the dead money is 9 × 0.125, not 6 × 0.125.
    tableSize: 9,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['8s', '8d'],
    effectiveStackBb: 25,
    anteBb: 0.125,
    gameNotes:
      'MTT, 9-max. Blinds 0.5 / 1 with a 12.5% ante from every seat — 1.125bb of dead money before a card is dealt. Stacks are 25bb effective.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'preflop',
      street: 'preflop',
      board: [],
      // 2 (button) + 1 (your posted blind) + 0.5 (folded SB) + 1.125 (nine antes) = 4.625bb.
      potBb: 4.625,
      effectiveStackBb: 25,
      // You are in for 1 and the raise is TO 2, so the call costs 1 — not 2.
      facingBetBb: 2,
      heroInvestedBb: 1,
      toCallBb: 1,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+1', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+2', text: 'Folds' },
        { street: 'preflop', actor: 'LJ', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      situation:
        'It folds to the button, who makes it 2bb — a min-raise. The small blind folds. You are in the big blind with 8♠8♦ — a middle pocket pair — 25bb effective, and 1bb more to call into a 4.6bb pot.',
      actionBeforeHero: [
        'UTG folds',
        'UTG+1 folds',
        'UTG+2 folds',
        'LJ folds',
        'HJ folds',
        'CO folds',
        'BTN raises to 2bb',
        'SB folds',
      ],
      question: 'What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Against a button min-raise at 25bb the big blind folds only 14.6% — the smallest fold branch it has against any opener at this depth. The source puts pocket pairs in the all-in branch, which is the far side of the range from that 14.6%.',
          sources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.fold-range-grows', 'bb25.pairs-and-axo-jam'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1 bb',
          tableAction: { label: 'Calls', betBb: 2 },
          verdict: 'defensible',
          shortWhy:
            'Calling is the biggest branch of the whole strategy — 65.9% — so it is never absurd. But the class the source names for this hand is the all-in branch, and the book prints no per-combo split that would put this pair in the 65.9%.',
          sources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.pairs-and-axo-jam'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: '3-bets',
          // No chip amount: the source gives no non-all-in 3-bet SIZE for this
          // spot, and inventing one to make the felt look tidy is exactly the
          // trade this product does not make. The gap is stated in the flow.
          tableAction: { label: '3-bets' },
          verdict: 'mistake',
          shortWhy:
            'The non-all-in 3-bet is a real branch here — 8.2%, its highest against any opener — but the source enumerates what is in it: JJ+, the strongest suited aces, the best premium suited connectors, and some offsuit blocker hands. A middle pair is in none of those.',
          sources: ['preflop.bb-3bet-composition-25bb', 'bb25.four-branch-strategy', 'bb25.pairs-and-axo-jam'],
        },
        {
          id: 'all-in',
          label: 'All-in',
          historyText: 'All-in 25 bb',
          tableAction: { label: 'All-in', betBb: 25 },
          verdict: 'best',
          shortWhy:
            'The source names this hand’s class for exactly this branch: “Pocket pairs and Axo really like getting all-in.” And the branch is at its widest right here — 11.4% against the button, against 2.1% vs UTG.',
          sources: ['bb25.pairs-and-axo-jam', 'preflop.bb-vs-bn-25bb-chart', 'bb25.four-branch-strategy'],
        },
      ],
      bestOptionId: 'all-in',
      explanation:
        'All-in. **Why:** the book states the composition of the all-in branch in words — “Pocket pairs and Axo really like getting all-in. As the opener’s range widens, the weaker pairs and Ax get to shove” (p.386) — and 8♠8♦ is a pocket pair facing the widest opener at the table, which is the end of that sentence the pairs are pushed towards. **Range theory:** at 25bb the big blind against a button min-raise plays four branches, not two: all-in 11.4%, non-all-in 3-bet 8.2%, call 65.9%, fold 14.6% (Hand Range 159, p.387). Those are four separate numbers for four separate actions, and the two raising branches hold different hands — the non-all-in 3-bet is polarized and made of “JJ+, the strongest Axs, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker” (p.386), which a middle pair does not belong to. **Sizing and frequency:** the all-in is for your 25bb stack, and 11.4% is the frequency of the whole range, not of this hand — the exact combo frequency is not specified in the source. **Supporting passage:** p.386, “Pocket pairs and Axo really like getting all-in”, together with Hand Range 159 on p.387.',
      unsourced: [
        {
          question: 'How often exactly does 8♠8♦ shove here?',
          answer:
            'Exact combo frequency is not specified in the source. Hand Range 159 is printed as a colour-coded chart image, and the only figures printed in text are the four whole-range aggregates — all-in 11.4%, 3-bet 8.2%, call 65.9%, fold 14.6%. What the source does state in words is the class this hand belongs to: pocket pairs are named as hands that really like getting all-in. Unlike the book’s 100bb BB vs BN chart, no reviewed extraction of this 25bb chart exists in this repo either, so there is no per-hand number to quote from any source.',
          nearestSources: ['bb25.pairs-and-axo-jam', 'preflop.bb-vs-bn-25bb-chart'],
        },
        {
          question: 'If you took the 3-bet branch, what would you raise to?',
          answer:
            'The source does not give a non-all-in 3-bet size for the big blind against a button min-raise at 25bb. It names the branch, gives its frequency (8.2%) and lists the hand types in it, but prints no sizing — which is why the 3-bet option puts no chip amount on the felt. The book does state 3-bet sizes for other spots at this depth, so this is a gap on these two pages rather than a habit of the book, and it is left open here instead of being filled with a plausible number.',
          nearestSources: ['preflop.bb-3bet-composition-25bb', 'preflop.bb-vs-bn-25bb-chart'],
        },
        {
          question: 'Where do the antes in the pot come from?',
          answer:
            'From the book’s stated MTT game, not from p.386. Modern Poker Theory says its MTT equilibrium strategies were solved “for 9-max tables with a 12.5% ante” at the opening of Ch.7 (p.293); the defence chapter that contains Hand Range 159 does not restate it. A 12.5% ante from nine seats is 1.125bb, which the book’s own pot arithmetic confirms — it prints the pre-action pot for that game as 2.625bb (p.163). So the 4.6bb here is 2 from the button, your posted 1, the folded small blind’s 0.5, and 1.125 in antes; your call is 1 because you are already in for 1.',
          nearestSources: ['mtt.solver-environment', 'mtt.ante-pot-size'],
        },
      ],
      theory: [
        {
          id: 'four-branches',
          title: 'Four doors, not two',
          body:
            'Most big-blind training collapses this spot into "defend or fold", and a little more into "call or 3-bet". At 25bb the equilibrium does not: the source prints four percentages for four actions, and they sum to the whole range. The all-in is not the 3-bet with the sizing turned up — it is its own branch, with its own frequency and, as the next card shows, its own hands.',
          exhibit: {
            caption: 'BB vs a BN min-raise, 25bb',
            scope:
              'Whole-range percentages printed with Hand Range 159 for BB vs BN, 9-max MTT, 25bb effective. These describe the entire range at once — they are not the frequency of any individual hand, and the two raising branches are separate numbers that the book never adds together.',
            rows: [
              { label: 'Call', value: '65.9%', pct: 65.9, note: 'the biggest branch of the strategy' },
              { label: 'Fold', value: '14.6%', pct: 14.6 },
              { label: 'All-in', value: '11.4%', pct: 11.4, note: 'a branch, not an emergency' },
              { label: 'Non-all-in 3-bet', value: '8.2%', pct: 8.2 },
            ],
            sources: ['preflop.bb-vs-bn-25bb-chart'],
          },
          bullets: [
            {
              text: 'Fold 14.6% is the smallest folding branch the big blind has against any opener at this depth — it defends more than 85% of its hands against a button min-raise.',
              sources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.fold-range-grows'],
            },
            {
              text: 'Both raising branches exist at the same time and are counted separately: 8.2% goes in without being all-in, 11.4% goes all-in. The book never adds them, and neither should you — they are the two ends of a split, not one range with two sizings.',
              sources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.four-branch-strategy'],
            },
            {
              text: 'These four figures are the 25bb solution. The defence chapter solves 15bb, 25bb, 40bb and 60bb separately, so a frequency from another depth is a different answer to a different question.',
              sources: ['defence.chapter-depths'],
            },
          ],
          sources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.four-branch-strategy'],
        },

        {
          id: 'jam-is-biggest-here',
          title: 'The jam is at its biggest against the button',
          body:
            'The four branches are not fixed quantities — they move with who opened, and they move for a reason. As the opener’s range gets stronger, shoving into it gets worse and folding to it gets better; against the widest opener at the table, the shove is at its maximum and the fold at its minimum. The one branch that barely moves is the non-all-in 3-bet, which sits near 5% against everyone — except the button, where it is also at its highest.',
          exhibit: {
            caption: 'How each branch moves with the opener, 25bb',
            scope:
              'BB vs IP at 25bb, from the prose accompanying Table 60. Every figure is a whole-range aggregate for one opener at 25bb; the intermediate positions have their own printed charts that are not quoted here.',
            rows: [
              { label: 'All-in vs BN', value: '11.4%', pct: 11.4, note: 'the widest opener — the shove’s maximum' },
              { label: 'All-in vs UTG', value: '2.1%', pct: 2.1, note: 'the strongest opener — nearly gone' },
              { label: 'Non-all-in 3-bet vs BN', value: '8.20%', pct: 8.2, note: 'the highest of any opener' },
              { label: 'Non-all-in 3-bet vs the rest', value: 'around 5%', pct: 5, note: 'fairly constant' },
              { label: 'Fold vs BN', value: '14.6%', pct: 14.6 },
              {
                label: 'Fold vs UTG',
                value: '27.2%',
                pct: 27.2,
                note: 'the same section writes this as “up to 28% vs EP” a paragraph later — both figures are the book’s own',
              },
              { label: 'Average fold vs a min-raise', value: '22.54%', pct: 22.54 },
            ],
            sources: ['bb25.four-branch-strategy'],
          },
          bullets: [
            {
              text: 'The all-in frequency drops from 11.4% against the button to 2.1% against UTG. Shoving is not a measure of how short you feel — it is a measure of how weak the range you are shoving into is.',
              sources: ['bb25.four-branch-strategy'],
            },
            {
              text: 'The folding branch runs the other way, from 14.6% against the button up to 28% against early position. The source gives the reason: at 25bb stacks are deep enough that weak hands start having difficulty realizing their equity post-flop from out of position.',
              sources: ['bb25.fold-range-grows'],
            },
            {
              text: 'The non-all-in 3-bet is the stable one, around 5% against most openers and 8.20% against the button — its highest. So against a button open, both aggressive branches are at their peak at once.',
              sources: ['bb25.four-branch-strategy'],
            },
          ],
          sources: ['bb25.four-branch-strategy', 'bb25.fold-range-grows'],
        },

        {
          id: 'which-hands-where',
          title: 'Which hands the source sends to which branch',
          body:
            'This is what makes the answer sourceable at all: the book does not leave the two raising branches to inference. It names the hand classes that want to be all-in, and then separately enumerates what the non-all-in 3-bet is made of. The hero hand in this puzzle is a middle pocket pair precisely because those two statements point in opposite directions for it.',
          bullets: [
            {
              text: 'All-in: “Pocket pairs and Axo really like getting all-in. As the opener’s range widens, the weaker pairs and Ax get to shove.” A pocket pair is named, and the widening clause points at the button — the widest opener the big blind faces.',
              sources: ['bb25.pairs-and-axo-jam'],
            },
            {
              text: 'Non-all-in 3-bet: “polarized, made of JJ+, the strongest Axs, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker, including A8o-A2o, K6o-K2o, Qxo and Jxo.” 8♠8♦ is not JJ+, not suited, not a connector and not a blocker hand — it is in none of the four groups.',
              sources: ['preflop.bb-3bet-composition-25bb'],
            },
            {
              text: 'Read together, those two sentences are the whole answer: the branch that wants pocket pairs is the all-in, and the branch that would take a raise without being all-in is made of hands this one is not.',
              sources: ['bb25.pairs-and-axo-jam', 'preflop.bb-3bet-composition-25bb'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book say which pocket pairs shove and which just call?',
              answer:
                'No. It names the class — pocket pairs — and states a direction, that the weaker pairs get to shove as the opener’s range widens. It does not print a cut-off, and it does not say what any individual pair does. The hand-by-hand detail is left in the chart image. So this puzzle asserts membership of the class the book names, and stops there.',
              nearestSources: ['bb25.pairs-and-axo-jam', 'preflop.bb-vs-bn-25bb-chart'],
            },
          ],
          sources: ['bb25.pairs-and-axo-jam', 'preflop.bb-3bet-composition-25bb'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-defence-vs-bn-25bb',
      label: 'Big blind defence vs a button min-raise, 25bb',
      kind: 'composition',
      seat: 'hero',
      description:
        'The whole-range strategy printed with Hand Range 159. Four branches, four separate percentages — the all-in and the non-all-in 3-bet are shown apart because that is how the source prints them, and adding them would produce a figure the book never states.',
      bars: [
        { label: 'Call', pct: 65.9, note: 'the biggest branch' },
        { label: 'Fold', pct: 14.6, note: 'the smallest fold branch vs any opener at 25bb' },
        { label: 'All-in', pct: 11.4, note: 'pocket pairs and offsuit aces are named for this branch' },
        { label: 'Non-all-in 3-bet', pct: 8.2, note: 'polarized — JJ+, the strongest suited aces, and blockers' },
      ],
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from what the book prints in text. Hand Range 159 is a colour-coded chart image, and the only numbers printed with it are these four aggregates. This repo holds a reviewed reconstruction of the book’s 100bb BB vs BN chart, but nothing for this 25bb one — and a 100bb chart is a different solution to a different game, so it cannot stand in. The puzzle therefore teaches from the aggregates and the hand classes the source names in words, and claims no per-combo frequency.',
          nearestSources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.pairs-and-axo-jam'],
        },
      ],
      sources: ['preflop.bb-vs-bn-25bb-chart'],
    },
    {
      id: 'bb-non-allin-3bet-25bb',
      label: 'The non-all-in 3-bet — the branch this hand is not in',
      headline: '8.2%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'The branch that most distinguishes a button open from any other at 25bb: the non-all-in 3-bet sits near 5% against most openers and reaches its highest, 8.20%, against the button. The source describes it as polarized and lists what it is made of — JJ+, the strongest suited aces, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker, including A8o-A2o, K6o-K2o, Qxo and Jxo. A middle pocket pair appears in none of those groups, which is what moves 8♠8♦ into the other raising branch.',
      unsourced: [
        {
          question: 'What does the big blind 3-bet to?',
          answer:
            'Not stated for this spot. The source gives this branch a frequency and a composition but no bet-size for the big blind against a button min-raise at 25bb, so no sizing is shown on the felt or claimed anywhere in this puzzle.',
          nearestSources: ['preflop.bb-3bet-composition-25bb', 'bb25.four-branch-strategy'],
        },
      ],
      sources: ['preflop.bb-3bet-composition-25bb', 'bb25.four-branch-strategy'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'At 25bb the big blind has four answers to a raise, and the jam is one of them.',
  headlineSources: ['preflop.bb-vs-bn-25bb-chart', 'bb25.pairs-and-axo-jam'],
  takeaways: [
    {
      text: 'Against a button min-raise at 25bb the big blind goes all-in 11.4%, 3-bets without being all-in 8.2%, calls 65.9% and folds 14.6% — four branches, four numbers, one range.',
      sources: ['preflop.bb-vs-bn-25bb-chart'],
    },
    {
      text: 'The all-in is an ordinary branch, not a last resort: it is at its largest against the button, the widest opener, and shrinks to 2.1% against UTG as the range it would be shoving into gets stronger.',
      sources: ['bb25.four-branch-strategy'],
    },
    {
      text: 'The two raising branches hold different hands. Pocket pairs and offsuit aces are named as hands that really like getting all-in, while the non-all-in 3-bet is polarized — JJ+, the strongest suited aces, the best premium suited connectors and some offsuit blocker hands.',
      sources: ['bb25.pairs-and-axo-jam', 'preflop.bb-3bet-composition-25bb'],
    },
    {
      text: 'Folding is the branch to be most suspicious of here: 14.6% is the smallest fold frequency the big blind has against any opener at this depth, and it grows to 28% only once an early-position range is doing the raising.',
      sources: ['bb25.fold-range-grows', 'preflop.bb-vs-bn-25bb-chart'],
    },
  ],

  xp: 30,

  endsEarlyBecause:
    'This is a preflop question and the source answers it preflop. Hand Range 159 and the prose on p.386 state what the big blind does against a button min-raise at 25bb; they say nothing about how 8♠8♦ plays a flop from here, and the all-in branch the source names for this hand has no flop to play. The hand stops where the evidence does.',
}

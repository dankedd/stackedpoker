import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 8 — "A range advantage that cannot bet big" (UTG vs BB, Q♥J♥T♥, 40bb)
 *
 * ONE idea, and deliberately nothing else: range advantage decides how OFTEN you
 * bet, not how MUCH. Those are two separate decisions, and this flop is the
 * cleanest place in the book to prove it, because the author himself files his
 * six IP c-bet examples on a frequency × size grid and puts two boards in the
 * same frequency cell with opposite sizes:
 *
 *   A♥Q♦3♠  →  "High c-bet % and big bet-size"    (Example 1, p.682-684)
 *   Q♥J♥T♥  →  "High c-bet % and small bet-size"  (Example 2, p.684-686)
 *
 * And the equity runs the "wrong" way for the intuition being corrected: UTG has
 * 64% equity on Q♥J♥T♥ where it min-bets, against 72% on A♥Q♦3♠ where it bets
 * big. Less range advantage, bigger bet. So the size cannot be a readout of the
 * advantage — it is a readout of the OPPONENT's range shape, which is exactly
 * what p.685-686 says in words.
 *
 * WHY A SINGLE FLOP DECISION. The learning objective is one distinction, and a
 * second street would necessarily introduce a second concept. The source's
 * material on this board is also split across two chapters that do not join up
 * into a line: p.684-686 is UTG's flop strategy, p.739-741 is the BB's response
 * to the min-bet. There is no printed turn strategy for "UTG min-bets, BB
 * calls", so the hand stops where the evidence stops.
 *
 * WHAT IS NOT SOURCED, and is labelled as such in the flow:
 *   - No c-bet FREQUENCY for this flop. Table 114 is a table image and the prose
 *     around it gives no percentage. The book says "high", and says checking back
 *     almost never happens here (p.750) — both qualitative. The two nearby
 *     numbers that look like answers are from a different dataset and contradict
 *     each other (85% for Qxx by rank, p.661; 31% CHECKED for three-straight
 *     boards, p.673). The unsourced note names and rejects both by hand.
 *   - No per-combo frequency, for A♠Q♦ or anything else. The only statement that
 *     covers this hand covers every hand: min-bet 100% loses no EV (p.686).
 *   - No equity BUCKET percentages for this flop. Diagram 60 is an image. The
 *     p.596 bucket definitions are given as vocabulary for the words the book
 *     does use ("polarized", "many strong hands"), never as numbers for QJT.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante, 6-max MTT).
 *   preflop  UTG opens to 2.5, BB calls → pot 5.5 = 2.5 + 2.5 + the dead SB 0.5
 *   flop     pot 5.5, hero has 37.5 behind, faces nothing (BB has checked)
 * The 2.5bb open is an implementation decision — the book prints no open size
 * for this example — and it is what makes the min-bet 18% of the pot rather than
 * some other fraction. Both facts are disclosed in the flow, not smoothed over.
 */
export const RANGE_ADVANTAGE_SMALL_BET: InteractivePuzzle = {
  id: 'range-advantage-small-bet',
  slug: 'a-range-advantage-that-cannot-bet-big',
  number: 8,
  title: 'A range advantage that cannot bet big',
  topic: 'C-bet Sizing',
  difficulty: 'advanced',
  description:
    'You hold the range advantage on this flop and the book wants you betting at a high frequency. It also wants you betting the minimum. Those two sentences are not in tension — they are two different decisions.',

  setup: {
    format: '40bb effective',
    tableSize: 6,
    heroSeat: 'UTG',
    villainSeat: 'BB',
    heroCards: ['As', 'Qd'],
    effectiveStackBb: 40,
    gameNotes: 'MTT, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  decisions: [
    /* ── FLOP ────────────────────────────────────────────────────────────── */
    {
      id: 'flop',
      street: 'flop',
      board: ['Qh', 'Jh', 'Th'],
      potBb: 5.5,
      effectiveStackBb: 37.5,
      toCallBb: 0,
      actionBeforeHero: [
        'Hero raises to 2.5bb',
        'HJ folds',
        'CO folds',
        'BTN folds',
        'SB folds',
        'BB calls',
      ],
      postflopAction: ['BB checks'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: 'Q♥ J♥ T♥ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      situation:
        'You opened to 2.5bb from under the gun and only the big blind called. The flop is Q♥ J♥ T♥ — one suit, and every straight is already out there. You hold A♠Q♦: top pair, top kicker, with a gutshot to the Broadway straight and no heart. The big blind checks. The pot is 5.5bb and you have 37.5bb behind.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'The source has you c-betting this flop at a high frequency, and says that on this board checking back almost never happens at equilibrium. The whole strategy simplifies to betting every time.',
          sources: [
            'ex2.range-advantage-but-small',
            'ex2.ip-almost-never-checks-back',
            'ex2.min-bet-100-no-ev-loss',
          ],
        },
        {
          id: 'min-bet',
          label: 'Min-bet',
          historyText: 'Bets 1 bb (the minimum)',
          tableAction: { label: 'Bets', betBb: 1 },
          verdict: 'best',
          shortWhy:
            'The book files this flop under "high c-bet % and small bet-size", and states that the strategy here simplifies to min-bet 100% with no EV loss. The minimum lures the big blind in with weak hands you dominate instead of folding them out.',
          sources: [
            'ex2.heading-high-freq-small-size',
            'ex2.min-bet-100-no-ev-loss',
            'ex2.big-bet-helps-bb',
          ],
        },
        {
          id: 'bet-67',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb (2/3 pot)',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'mistake',
          shortWhy:
            'The one action the source rules out by name. Betting big makes the big blind’s life easier: it lets them fold their weak hands correctly and continue only with a very strong range, isolating you against the top of it.',
          sources: [
            'ex2.range-advantage-but-small',
            'ex2.big-bet-helps-bb',
            'texture.monotone-betting-big-mistake',
          ],
        },
      ],
      bestOptionId: 'min-bet',
      explanation:
        'Min-bet. The range advantage is real and it is the reason you are betting at all — the book says UTG "would like to c-bet at a high frequency" here, and on this board checking back almost never happens at equilibrium. But the advantage does not set the size; the big blind’s range shape does. Their range is too polarized: many hands that simply could not continue against a big bet, and at the same time many strong hands that would be delighted to. Bet big and you do their work for them — they fold the weak half correctly and you are left playing a 37.5bb stack against the top of their range on a monotone board where every straight is in. Bet the minimum and the weak hands you dominate come along, which keeps their range wide on the turn and river. The author’s verdict on this flop is that the whole strategy can be simplified to min-bet 100% with no EV loss, so this is not a hand-reading exercise — it is the range’s answer, and A♠Q♦ is in the range.',
      unsourced: [
        {
          question: 'How often does UTG actually c-bet this flop?',
          answer:
            'An exact c-bet frequency for this flop is not specified in the source. Table 114 prints UTG’s c-betting breakdown for Q♥J♥T♥ as a table image, and no percentage from it appears in the running text. What the book does state in words is that the frequency is high, that checking back almost never happens here at equilibrium, and that the strategy can be simplified to min-bet 100% with no EV loss. The two nearby figures that look like answers are not: the 85% printed for Qxx flops is a rank-category average across every Qxx board — connected and disconnected, monotone and rainbow — taken from a separate aggregate of 20bb/30bb/40bb MTT-range solutions, and a different cut of that same aggregate puts flops with three possible straights, which this one has, in the group checked 31% of the time. Two averages from the same foreign dataset, pointing opposite ways. Neither is this board’s number, and this puzzle claims neither.',
          nearestSources: [
            'ex2.table-114',
            'ex2.min-bet-100-no-ev-loss',
            'ex2.ip-almost-never-checks-back',
            'texture.qxx-category-average',
            'texture.straights-reduce-cbet',
            'position.ch12-sim-scope',
          ],
        },
        {
          question: 'What frequency does A♠Q♦ specifically min-bet?',
          answer:
            'There is no per-combo frequency for this flop in the text, for this hand or any other — Table 114 is an image, and the prose beside it goes out of its way to say that the level of mixing a solver uses is not something a human can implement anyway. The only statement that covers your hand is the one that covers every hand: the strategy simplifies to min-bet 100% with no EV loss. That is why this puzzle grades a range decision rather than a hand decision, and why the finding it teaches is stated about UTG’s whole range.',
          nearestSources: ['ex2.table-114', 'ex2.min-bet-100-no-ev-loss'],
        },
        {
          question: 'Is the min-bet really 1bb, and is "18% of the pot" the book’s figure?',
          answer:
            'The minimum is 1bb because the big blind is 1bb — that is the rules of poker, not solver output. The book names this sizing "min-bet" and analyses the big blind’s response to it under exactly that name. The 18% is our arithmetic: 1bb into 5.5bb. And the 5.5bb pot depends on a 2.5bb open, which the book does not print for this example — the open size is an implementation decision, as in the other puzzles in this set. Change the open and the pot fraction changes; the minimum does not.',
          nearestSources: ['ex2.min-bet-100-no-ev-loss', 'ex2.bb-36-equity'],
        },
      ],
      theory: [
        {
          id: 'range-theory',
          title: 'What the range advantage does, and what it does not do',
          body:
            'A range advantage is a statement about equity: your range beats theirs more often than not. Here it is substantial — the book prints the big blind at 36% equity on this flop, so yours is 64%, and you capture 72% of the pot against their 28%. That is what buys you a high betting frequency. It buys you nothing at all about size, because size is decided by the SHAPE of the range you are betting into, not by how far ahead you are. And the big blind’s shape on Q♥J♥T♥ is the awkward one: polarized. Many hands too weak to continue against a big bet, and at the same time many hands strong enough to welcome one. A big bet sorts that range for them, cleanly, in their favour. The minimum refuses to sort it.',
          exhibit: {
            caption: 'Range vs range on Q♥J♥T♥',
            scope:
              'BB vs UTG on Q♥J♥T♥ at 40bb. The book prints only the BB’s side (36% equity, 79% equity realization, 28% of the pot captured, against UTG’s flop min-bet); UTG’s figures are those subtracted from 100%.',
            rows: [
              { label: 'UTG equity', value: '64%', pct: 64, note: 'derived: 100% − the printed 36%' },
              { label: 'BB equity', value: '36%', pct: 36, note: 'printed — "a substantial equity disadvantage"' },
              { label: 'UTG share of the pot', value: '72%', pct: 72, note: 'derived: 100% − the printed 28%' },
              { label: 'BB share of the pot', value: '28%', pct: 28, note: 'printed; the BB realizes only 79% of its equity' },
            ],
            sources: ['ex2.bb-36-equity', 'ex2.utg-equity-derived'],
          },
          bullets: [
            {
              text: 'The book’s own words for the mechanism: UTG has a substantial range advantage and would like to c-bet at a high frequency, "but the BB’s range is too polarized, with many hands that would not be able to continue on the flop if UTG used a big bet-size. At the same time, BB has many strong hands that will be happy to continue vs a big bet-size."',
              sources: ['ex2.range-advantage-but-small'],
            },
            {
              text: 'Two of those phrases are equity buckets, and the book defines them precisely: strong hands have 75% equity or more against the opposing range, good hands 50-75%, weak hands 33-50%, and trash under 33%. "Polarized with many strong hands" means both ends of that scale are stocked at once — which is what makes one size unable to serve both purposes.',
              sources: ['eqb.definitions'],
            },
            {
              text: 'Why monotone texture produces that shape: across the aggregate, a single suit inflates the big blind’s strong hands (trash turns into flushes) and their weak hands (trash turns into flush draws) while deflating yours, leaving them polarized and you depolarized.',
              sources: ['texture.monotone-most-cbet-smallest-size'],
            },
            {
              text: 'The same range shape is why the big blind checks here rather than leading: the book notes that monotone flops get donked a lot less frequently than rainbow or two-tone ones.',
              sources: ['family.high-donk-flops'],
            },
          ],
          unsourced: [
            {
              question: 'What is the actual bucket breakdown of each range on this flop?',
              answer:
                'Not available in the text. Diagram 60 carries the equity buckets for this example as an image, and no bucket percentage for Q♥J♥T♥ appears in the prose. So "polarized", "many strong hands" and "many hands that could not continue" are quoted as the book’s words, with the bucket definitions supplied only as the vocabulary those words belong to. No percentage is invented to stand behind them.',
              nearestSources: ['ex2.range-advantage-but-small', 'eqb.definitions'],
            },
          ],
          sources: ['ex2.range-advantage-but-small', 'ex2.bb-36-equity'],
        },
        {
          id: 'frequency-and-size',
          title: 'Frequency and size are two dials, and this flop turns them opposite ways',
          body:
            'The book does not treat "how often" and "how much" as one decision — it names its six IP c-bet examples on a grid of the two, and Q♥J♥T♥ and A♥Q♦3♠ sit in the same frequency cell with opposite size cells. Read the equities across those two boards and the intuition being corrected falls apart: you have MORE range advantage on A♥Q♦3♠, where you bet big, than on Q♥J♥T♥, where you bet the minimum. If size tracked advantage, that ordering would be impossible. What actually changes between them is the defender: on A♥Q♦3♠ the big blind has no nutted hands, because they would have 3-bet aces and queens preflop, so a big bet is unanswerable. On Q♥J♥T♥ the board has handed them flushes, straights and sets. Same seat, same stack, same high frequency, opposite size — because the question a bet-size answers is "what does their range look like", not "how far ahead am I".',
          exhibit: {
            caption: 'Two flops, the same frequency cell, opposite size cells',
            scope:
              'The book’s Flop Strategy Examples 1 and 2 — BB vs UTG at 40bb on each board. Two specific 40bb solves, not category averages. The Q♥J♥T♥ equity and pot share are the complements of the printed BB figures.',
            rows: [
              {
                label: 'A♥Q♦3♠ — UTG equity',
                value: '72%',
                pct: 72,
                note: 'captures 85% of the pot, and bets BIG across multiple streets',
              },
              {
                label: 'Q♥J♥T♥ — UTG equity',
                value: '64%',
                pct: 64,
                note: 'captures 72% of the pot, and bets the MINIMUM',
              },
            ],
            sources: [
              'ex1.aq3-high-freq-big-size',
              'ex2.heading-high-freq-small-size',
              'ex2.utg-equity-derived',
              'ex2.min-bet-100-no-ev-loss',
            ],
          },
          bullets: [
            {
              text: 'The minimum is not a compromise between checking and betting — it is the whole strategy. The author states that this flop can be simplified to min-bet 100% with no EV loss, and adds that the fine mixing a solver shows here is not implementable by a human anyway.',
              sources: ['ex2.min-bet-100-no-ev-loss'],
            },
            {
              text: 'And it works. Against the min-bet the big blind folds only 38.26% of the time, check-calling 43% and check-raising 18% — six hands in ten come along, which is precisely the "lure the BB in with many weak hands that UTG dominates" the passage promises.',
              sources: ['ex2.bb-36-equity', 'ex2.big-bet-helps-bb'],
            },
            {
              text: 'The general rule behind the specific solve: on monotone flops the book says the strategy can be simplified to 1/3-pot or min-bets without a significant EV loss, and that smaller sizes are preferred because they fold out the terrible-equity hands without overcommitting your good-but-not-great ones.',
              sources: ['texture.monotone-simplify-min-bet', 'texture.monotone-most-cbet-smallest-size'],
            },
            {
              text: 'The author names the error directly: betting large on monotone flops to "protect" good hands forces out the weak hands that would have called a smaller bet, and isolates you against a range that either beats you or has a ton of equity.',
              sources: ['texture.monotone-betting-big-mistake'],
            },
          ],
          sources: ['ex2.heading-high-freq-small-size', 'ex1.aq3-high-freq-big-size'],
        },
        {
          id: 'the-passage',
          title: 'The passage this puzzle is built on',
          body:
            '“On Q♥J♥T♥, UTG has a substantial range advantage, so they would like to c-bet at a high frequency, but the BB’s range is too polarized, with many hands that would not be able to continue on the flop if UTG used a big bet-size. At the same time, BB has many strong hands that will be happy to continue vs a big bet-size. So, by betting big UTG would be making the BB’s life easier, allowing them to correctly fold weak hands and continue with a very strong range. If instead, UTG bets the minimum, this will lure the BB in with many weak hands that UTG dominates, keeping their range wider on future streets.” — Modern Poker Theory, pp.685-686. The sentence beginning "So, by betting big" starts at the foot of p.685 and completes on p.686.',
          bullets: [
            {
              text: 'The example’s own heading, on p.684: "Flop Strategy Example 2 — High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb)". Both halves of that title are load-bearing, and they are independent claims.',
              sources: ['ex2.heading-high-freq-small-size'],
            },
            {
              text: 'The verdict, on p.686: "The strategy on this flop can be simplified to min-bet 100% with no EV loss."',
              sources: ['ex2.min-bet-100-no-ev-loss'],
            },
            {
              text: 'And the corroboration from the turn chapter, p.750: "Checking back almost never happens at equilibrium on A♠Q♦3♠ and Q♥J♥T♥." That is the closest the book comes to a frequency for this flop, and it is a sentence rather than a number.',
              sources: ['ex2.ip-almost-never-checks-back'],
            },
          ],
          sources: ['ex2.range-advantage-but-small', 'ex2.big-bet-helps-bb'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-defend-vs-utg',
      label: 'Big blind’s calling range',
      kind: 'aggregate',
      seat: 'villain',
      headline: '49.1%',
      description:
        'The range that arrives on this flop opposite you. Against an UTG open at 40bb the book prints call 49.1%, 3-bet 5.8% and fold 45% — and the 3-bet number is why the calling range is capped in a way that matters here: some of the hands that would most enjoy a big bet have already been raised preflop.',
      unsourced: [
        {
          question: 'Which hands make up the 49.1%?',
          answer:
            'The per-hand chart is printed as an image and the book states only the aggregates, so no per-combo composition can be given for it. This puzzle does not need one: the flop argument is made entirely from the shape of the range the book describes on the flop itself, not from a list of the hands that got there.',
          nearestSources: ['ex3.preflop-bb-vs-utg-40bb'],
        },
      ],
      sources: ['ex3.preflop-bb-vs-utg-40bb'],
    },
    {
      id: 'flop-equity-split',
      label: 'Equity on Q♥J♥T♥',
      kind: 'composition',
      seat: 'both',
      description:
        'Not a hand-strength composition — a range-versus-range equity split, which is the only quantified thing the book prints about this flop. It is the size of the range advantage this puzzle is about, and the whole lesson is that this number does not choose your bet-size. Only the big blind’s 36% is printed; 64% is its complement.',
      bars: [
        { label: 'UTG equity', pct: 64, note: 'derived from the printed 36%' },
        { label: 'BB equity', pct: 36, note: 'printed — a substantial equity disadvantage' },
      ],
      unsourced: [
        {
          question: 'Where is the equity-bucket breakdown for each range?',
          answer:
            'Printed as an image only. Diagram 60 carries the buckets for this example and Table 114 carries UTG’s strategy breakdown; neither is reproduced in the text, so no strong/good/weak/trash percentage exists to show for this flop. The bar above is the equity split, which is a different and much coarser thing — it is shown because it is what the source actually states.',
          nearestSources: ['ex2.bb-36-equity', 'ex2.table-114', 'eqb.definitions'],
        },
      ],
      sources: ['ex2.bb-36-equity', 'ex2.utg-equity-derived'],
    },
  ],

  takeawayHeadline: 'A range advantage tells you how often to bet. It does not tell you how much.',
  headlineSources: ['ex2.range-advantage-but-small', 'ex2.heading-high-freq-small-size'],
  takeaways: [
    {
      text: 'On Q♥J♥T♥ UTG has a substantial range advantage and wants to c-bet at a high frequency — and still cannot bet big, because a big bet lets the big blind fold their weak hands correctly and continue only with a very strong range.',
      sources: ['ex2.range-advantage-but-small', 'ex2.big-bet-helps-bb'],
    },
    {
      text: 'Frequency and size are separate decisions. The book files this flop as "high c-bet % and small bet-size" and A♥Q♦3♠ as "high c-bet % and big bet-size" — and UTG has MORE equity on the big-bet board, 72% against 64%.',
      sources: ['ex2.heading-high-freq-small-size', 'ex1.aq3-high-freq-big-size', 'ex2.utg-equity-derived'],
    },
    {
      text: 'The minimum is the whole strategy here, not a compromise: the flop simplifies to min-bet 100% with no EV loss, and against that sizing the big blind folds only 38.26% — the weak hands you dominate come along, exactly as intended.',
      sources: ['ex2.min-bet-100-no-ev-loss', 'ex2.bb-36-equity'],
    },
    {
      text: 'Texture is the reason. A single suit stocks the defender’s range at both ends at once, which is why monotone flops are the most c-bet of any texture and also the ones where smaller sizes are preferred — and why the big blind rarely leads them.',
      sources: ['texture.monotone-most-cbet-smallest-size', 'family.high-donk-flops'],
    },
  ],

  endsEarlyBecause:
    'This puzzle isolates one distinction — range advantage sets frequency, the opponent’s range shape sets size — and a second street would necessarily add a second idea. The source is also split here rather than continuous: p.684-686 gives UTG’s flop strategy on Q♥J♥T♥ and p.739-741 gives the big blind’s response to the min-bet, but no turn or river strategy is printed for the line where UTG min-bets and the big blind calls. The hand stops where the evidence stops.',

  xp: 75,
}

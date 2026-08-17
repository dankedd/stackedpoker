import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 16 — "The price a min-bet lays"
 * (BB vs UTG's flop min-bet on Q♥J♥T♥, 40bb, flop only)
 *
 * ONE idea: a tiny bet demands a very wide continue, and the source names which
 * hand classes make it. Nothing else is taught here.
 *
 * The evidence is Flop Strategy Example 2 of the C-bet Defense section,
 * pp.739-741 — "BB vs Min-bet: BB vs UTG on Q♥J♥T♥ (40bb)" — plus p.108 for the
 * Alpha/MDF arithmetic, p.726 for what that arithmetic is not, and p.596 for the
 * equity-bucket vocabulary. No other page contributes a poker claim.
 *
 * Four content decisions worth recording, each a place where the obvious version
 * of this puzzle would have overstated or mis-sourced the evidence:
 *
 * 1. THE HERO HAND IS A CLASS THE SOURCE NAMES FOR THIS BOARD. A♠T♦ is bottom
 *    pair with a higher kicker, and p.741 prints the rule in five words:
 *    "Bottom pair with a higher kicker is always called." The suits matter and
 *    are chosen deliberately — neither card is a heart, because the same page
 *    treats "AT … with a heart" as a COMBO DRAW with a different rule. Same two
 *    ranks, different class, because the board is monotone.
 *
 * 2. NOTHING IS BORROWED FROM ANOTHER BOARD'S BREAKDOWN. The book prints a
 *    separate hand-class table per flop AND per bet-size (Table 122: AQ3r vs
 *    2/3-pot; Table 123: Q♥J♥T♥ vs a min-bet; Table 124: 9♥8♥4♦ vs 2/3-pot;
 *    Table 125: J♠6♥6♦ vs a min-bet), and they genuinely disagree: OESD on
 *    Q♥J♥T♥ "will only continue if they are drawing to the nut straight", while
 *    on 9♥8♥4♦ OESD "are x/c every time" (p.744). Every rule cited here comes
 *    from Table 123's own bullets and travels nowhere else.
 *
 * 3. MDF IS THE FRAME, NOT THE ANSWER. 1 − Alpha for this bet-size is about
 *    85%, and the puzzle shows that number — then immediately shows p.726
 *    refusing it ("does not take equities and range distribution into account")
 *    and the solved node landing at fold 38.26%, x/c 43%, x/r 18%. Presenting
 *    the 85% as the strategy would contradict the source in the same chapter it
 *    comes from.
 *
 * 4. THE POT IS A TABLE ASSUMPTION, THE FREQUENCIES ARE THE BOOK'S. pp.739-741
 *    give the seats, the depth and the bet-size by name ("min-bet") and print no
 *    pot. The 2.5bb open and 5.5bb flop pot are this repo's convention, carried
 *    over from the other 40bb puzzles; 1bb is simply the smallest legal bet when
 *    the big blind is 1. So every pot-relative figure on the page — 13% pot
 *    odds, ~15% Alpha, ~85% MDF — is arithmetic on an assumed pot, and the flow
 *    says so where a reader would otherwise take it for solver output. No
 *    check-raise size is shown at all, because the source prints none for this
 *    node.
 */
export const MIN_BET_DEFENCE_QJT: InteractivePuzzle = {
  id: 'min-bet-defence-qjt',
  slug: 'the-price-a-min-bet-lays',
  number: 16,
  title: 'The price a min-bet lays',
  topic: 'C-bet Defence',
  difficulty: 'intermediate',
  description:
    'One flop decision in the big blind, on a monotone board where every straight is already out. The bet is the smallest one legal — and that single fact changes which hands you are allowed to fold.',

  setup: {
    format: '40bb effective',
    // Six-handed MTT. The folded small blind is where the extra half-blind in
    // the flop pot comes from; a heads-up table would lose it and make the
    // 5.5bb on screen wrong.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    heroCards: ['As', 'Td'],
    effectiveStackBb: 40,
    gameNotes: 'MTT, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['Qh', 'Jh', 'Th'],
      // 5.5bb before the bet (2.5 open + 2.5 call + the folded SB's 0.5),
      // plus the 1bb min-bet Hero is facing.
      potBb: 6.5,
      // 40 minus the 2.5 you called preflop.
      effectiveStackBb: 37.5,
      facingBetBb: 1,
      heroInvestedBb: 0,
      toCallBb: 1,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 1 bb' },
      ],
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: ['BB checks', 'UTG bets 1bb'],
      situation:
        'UTG opens to 2.5bb, it folds round, and you call from the big blind with A♠T♦. The flop is Q♥ J♥ T♥ — monotone, and every straight is already possible. You check and UTG bets the minimum: 1bb into 5.5bb. You hold bottom pair with the best kicker there is, plus a gutshot to the nut straight, and neither of your cards is a heart. It costs 1bb to see the turn.',
      question: 'What do you do facing the min-bet?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Folding is 38.26% of the big blind’s range here, but not with this hand. The source’s breakdown for this board names your class in five words — “Bottom pair with a higher kicker is always called” — and names the folds separately: weak bottom pairs T8-T2, underpairs without a flush draw, gutshots without a pair, air.',
          sources: ['qjtdef.bottom-pair', 'qjtdef.folds', 'ex2.bb-36-equity'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1 bb',
          tableAction: { label: 'Calls', betBb: 1 },
          verdict: 'best',
          shortWhy:
            'A♠T♦ is bottom pair with a higher kicker, and the rule the source prints for that class on this board against this bet-size is that it is always called. The bet-size is what makes a hand this weak mandatory: at 1bb into 5.5bb you are risking 1 to win 6.5, and the big blind’s continuing range widens to roughly 61% — x/c 43% plus x/r 18%.',
          sources: ['qjtdef.bottom-pair', 'ex2.bb-36-equity', 'qjtdef.alpha-mdf'],
        },
        {
          id: 'check-raise',
          label: 'Check-raise',
          historyText: 'Check-raises',
          tableAction: { label: 'Raises' },
          verdict: 'mistake',
          shortWhy:
            'The x/r branch is 18% of the range and the source says who fills it: flushes most of the time, sets ~22%, two pair ~17%, straights ~20%, combo draws and weak flush draws ~1/3. Bottom pair with a higher kicker is not on that list — it is the class the same page says is always called.',
          sources: ['ex2.bb-36-equity', 'qjtdef.flushes-xr', 'qjtdef.made-hands-xr', 'qjtdef.draws-xr-third', 'qjtdef.bottom-pair'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. A♠T♦ is bottom pair with a higher kicker, and Modern Poker Theory’s breakdown for this board against this bet-size states the rule outright: “Bottom pair with a higher kicker is always called” (p.741). It is the kicker doing the work, not the pair — the same bullet has weak bottom pairs T8-T2 “almost always folded”. What licenses a call this thin is the price. A min-bet of 1bb into 5.5bb means risking 1 to win 6.5, about 13% pot odds, and Alpha — b ÷ (b + pot), how often a bluff has to work to break even — is only about 15%, so 1 − Alpha is about 85% (p.108). That 85% is the frame, not the answer: the same chapter says MDF “does not take equities and range distribution into account” and that “basing your entire strategy on MDF will be highly detrimental” (p.726). The solved node lands lower and still very wide — the big blind folds 38.26%, x/c 43% and x/r 18% — and it does that while holding only 36% equity and realizing 79% of it (p.739). Raising is not this hand’s job: the 18% raising branch is filled by flushes, sets, two pair, some straights, combo draws and weak flush draws. Folding gives up a hand the source says is never folded here.',
      unsourced: [
        {
          question: 'How often exactly does A♠T♦ call here?',
          answer:
            'Exact combo frequency is not specified in the source. Table 123 is printed as a table image, and nothing in the running text gives a per-combo figure, an EV, or any distinction between A♠T♦ and A♣T♦. What is printed in words is the class rule — “Bottom pair with a higher kicker is always called” — and that rule is the entire basis for the answer here. One suit detail does matter and is stated by the source rather than inferred: the same page treats “AT … with a heart” as a combo draw with a different rule, so a hand like A♥T♦ would be answering a different question.',
          nearestSources: ['qjtdef.bottom-pair', 'qjtdef.table-123', 'qjtdef.draws-xr-third'],
        },
        {
          question: 'Where do the 2.5bb open, the 5.5bb pot and the 1bb bet come from?',
          answer:
            'From this puzzle’s table assumptions, not from pp.739-741. The source gives the seats, the 40bb depth and the bet-size by NAME — “min-bet” — and prints no pot for this node. The 2.5bb open and the 5.5bb flop pot are this repo’s convention, carried over from the other 40bb puzzles so the felt adds up; 1bb is simply the smallest legal bet when the big blind is 1. So read the three pot-relative numbers on this page — 13% pot odds, ~15% Alpha, ~85% MDF — as arithmetic on an assumed pot, and the 36%, 38.26%, 43% and 18% as the book’s own figures for this exact node. For the same reason no check-raise size appears on the felt: the source prints none here.',
          nearestSources: ['ex2.bb-36-equity', 'qjtdef.alpha-mdf'],
        },
      ],
      theory: [
        {
          id: 'what-a-min-bet-asks',
          title: 'What a min-bet actually asks of you',
          body:
            'Before any card is considered, a bet has a price, and the price is fixed by size alone. Alpha is how often a bluff of that size has to work to break even — the bet divided by the bet plus the pot. Its complement, 1 − Alpha, is the minimum defence frequency. Shrink the bet and Alpha collapses towards zero, which drags the defence requirement towards 100%. A min-bet is the smallest size on the menu, so it produces the most extreme version of that arithmetic anyone will ever face.',
          exhibit: {
            caption: 'The price of 1bb into 5.5bb',
            scope:
              'Arithmetic only, applied to this puzzle’s assumed 5.5bb pot and 1bb min-bet. The formula is the book’s (p.108); the pot is this puzzle’s table convention, because pp.739-741 print no pot for this node. None of these are solved frequencies.',
            rows: [
              { label: 'You risk', value: '1bb to win 6.5bb', note: 'the 5.5bb pot plus the bet' },
              { label: 'Pot odds', value: '13%', pct: 13, note: 'equity needed to break even on the call' },
              { label: 'Alpha — b ÷ (b + pot)', value: '15%', pct: 15 },
              { label: 'MDF — 1 − Alpha', value: '85%', pct: 85, note: 'a frame, not the strategy' },
            ],
            sources: ['qjtdef.alpha-mdf'],
          },
          bullets: [
            {
              text: 'Alpha is b ÷ (b + p): “how often a bluff has to work for it to break even”. MDF is its complement. No board, no range and no equity appears anywhere in either — they are properties of the bet-size and nothing else.',
              sources: ['qjtdef.alpha-mdf'],
            },
            {
              text: 'That is precisely why the size does all the work here. A pot-sized bet needs to work 50% of the time; a bet of one blind into five and a half needs about 15%. The defender’s side of the same equation goes from 50% to about 85%.',
              sources: ['qjtdef.alpha-mdf'],
            },
            {
              text: 'The book refuses that number as a strategy in the same chapter this spot comes from: MDF “does not take equities and range distribution into account”, and “basing your entire strategy on MDF will be highly detrimental”.',
              sources: ['qjtdef.mdf-ignores-equities'],
            },
            {
              text: 'It also names this exact trap: “when facing a min-bet, your pot odds will be amazing, but the Villain will use a different range composition compared to when they bet the size of the pot.” Amazing odds and a stronger betting range arrive together.',
              sources: ['qjtdef.min-bet-pot-odds'],
            },
          ],
          unsourced: [
            {
              question: 'So should you defend 85%?',
              answer:
                'No, and the book gives the real number for this node rather than leaving it open: the big blind folds 38.26% against the flop min-bet, x/c 43% and x/r 18%. That is far wider than most players defend and still nowhere near 85%. Treat MDF as the thing that tells you the answer must be large — the solve is what tells you how large, and the gap between the two is exactly what p.726 is warning about.',
              nearestSources: ['ex2.bb-36-equity', 'qjtdef.mdf-ignores-equities'],
            },
          ],
          sources: ['qjtdef.alpha-mdf', 'qjtdef.mdf-ignores-equities'],
        },

        {
          id: 'how-wide-the-bb-actually-goes',
          title: 'How wide the big blind actually goes',
          body:
            'This is one of the few nodes where the book prints the defender’s whole-range answer directly, and it is worth reading against the intuition it contradicts. Q♥J♥T♥ is about as frightening a flop as the big blind can face out of position: monotone, every straight already made, and a substantial equity disadvantage. The defence is still wide, because a min-bet is what is being defended against.',
          exhibit: {
            caption: 'BB strategy vs UTG’s min-bet on Q♥J♥T♥',
            scope:
              'BB vs UTG on Q♥J♥T♥, 40bb, facing a flop MIN-BET specifically. Whole-range frequencies for this one node — not per-hand figures, and not the big blind’s response to any other size or any other board.',
            rows: [
              { label: 'Check-call', value: '43%', pct: 43 },
              { label: 'Fold', value: '38.26%', pct: 38.26 },
              { label: 'Check-raise', value: '18%', pct: 18 },
            ],
            sources: ['ex2.bb-36-equity'],
          },
          bullets: [
            {
              text: 'Roughly 61% of the big blind’s range continues — and it does so while holding “only 36% equity”, realizing 79% of that equity and capturing 28% of the pot. A wide continue and an equity disadvantage are not in conflict; the price is what reconciles them.',
              sources: ['ex2.bb-36-equity'],
            },
            {
              text: 'The 18% and 43% are the book’s own rounding of the 61.74% that a 38.26% fold leaves behind. Read the three figures as the shape of the strategy rather than to two decimal places.',
              sources: ['ex2.bb-36-equity'],
            },
            {
              text: 'Note which number the source chooses to state precisely. 38.26% is the folding frequency — the thing MDF claims to predict, and the thing it gets wrong by more than twenty points here.',
              sources: ['ex2.bb-36-equity', 'qjtdef.mdf-ignores-equities'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book give a fold/call/raise number for every hand class?',
              answer:
                'No — only for some, and only in words. Table 123 itself is a table image. The running text beneath it prints check-raise frequencies for a few classes (flushes about 1/3 or about 88%, straights about 20%, sets about 22%, two pair about 17%, combo draws about 1/3), pure rules for others (“always called”, “always folded”, “100% call strategy”), and for top pair it prints no strategy figure at all — just an equity number and a judgement.',
              nearestSources: ['qjtdef.table-123', 'qjtdef.made-hands-xr', 'qjtdef.top-pair-44'],
            },
          ],
          sources: ['ex2.bb-36-equity'],
        },

        {
          id: 'which-classes-continue',
          title: 'Which hand classes make the continue',
          body:
            'Wide is a roster, not a licence. The source walks the whole range class by class for this board and this bet-size, and the list has a clear edge to it — which is the part worth carrying away, because the edge is where the money is. A♠T♦ sits one line above it.',
          exhibit: {
            caption: 'Where the source puts each class on Q♥J♥T♥ vs a min-bet',
            scope:
              'The hand-class bullets printed beneath Table 123 — BB vs UTG on Q♥J♥T♥ at 40bb, facing a MIN-BET. Board-specific and size-specific: the book prints a separate breakdown for every flop and every size it studies, and they disagree with each other.',
            rows: [
              { label: 'Straight flush', value: 'Mostly slowplayed' },
              { label: 'Flushes', value: 'x/r most of the time' },
              { label: 'Straights', value: 'x/r ~20% — rarely raised', pct: 20 },
              { label: 'Middle / bottom set', value: 'x/r ~22%', pct: 22 },
              { label: 'Two pair', value: 'x/r ~17%', pct: 17 },
              { label: 'Top pair', value: '44% equity — “not a strong hand on this texture”' },
              { label: 'Middle pair, higher kicker', value: '100% call strategy' },
              { label: 'Bottom pair, higher kicker', value: 'Always called', note: 'A♠T♦ is here' },
              { label: 'Weak bottom pair (T8-T2)', value: 'Almost always folded' },
              { label: 'Combo draws / weak flush draws', value: 'x/r ~1/3, x/c ~2/3', pct: 33 },
              { label: 'OESD', value: 'Continue only if drawing to the nut straight' },
              { label: 'Underpairs', value: 'Always folded unless they have a flush draw' },
              { label: 'Gutshots', value: 'Always folded unless they have a pair' },
              { label: 'Air (7-high, no draw)', value: 'Always folded' },
            ],
            sources: [
              'qjtdef.table-123',
              'qjtdef.straight-flush-slowplay',
              'qjtdef.flushes-xr',
              'qjtdef.made-hands-xr',
              'qjtdef.top-pair-44',
              'qjtdef.middle-pair',
              'qjtdef.bottom-pair',
              'qjtdef.draws-xr-third',
              'qjtdef.oesd',
              'qjtdef.folds',
            ],
          },
          bullets: [
            {
              text: 'Your hand is in this bullet, and the kicker is the whole difference: “Weak bottom pairs (T8-T2) are almost always folded. T8 can get x/r a small frequency, and T9 can be x/r half the time. Bottom pair with a higher kicker is always called.”',
              sources: ['qjtdef.bottom-pair'],
            },
            {
              text: 'The source draws the same kicker line one rank higher too — “any Jx with a higher kicker plays a 100% call strategy”, while weaker middle-pair combos are x/f most of the time. Two classes, one principle: on this board the kicker decides whether a small pair continues.',
              sources: ['qjtdef.middle-pair'],
            },
            {
              text: 'And it draws the far edge sharply: underpairs are always folded unless they have a flush draw, all gutshots are folded unless they have a pair, and air is always folded. Your gutshot to the nut straight is not what saves this hand — the pair is.',
              sources: ['qjtdef.folds'],
            },
            {
              text: 'A texture note that explains why so many of the big blind’s ace-high hands are still live: “A-high and K-high hands always have at least a gutshot.” On QJT a king completes A-K-Q-J-T, so every ace has an out; the gutshot rule above is what stops that from being enough on its own.',
              sources: ['qjtdef.a-high-gutshot', 'qjtdef.folds'],
            },
            {
              text: 'Watch what the hearts do to classification. A♠T♦ is bottom pair with a higher kicker; A♥T♦ would hold one heart on a three-heart board, which makes it a flush draw plus a gutshot — and the source treats “AT … with a heart” as a combo draw, mostly called, with a raising branch this hand does not have. Same ranks, different class, different rule.',
              sources: ['qjtdef.draws-xr-third', 'qjtdef.bottom-pair'],
            },
          ],
          unsourced: [
            {
              question: 'Do these rules hold on other boards, or against bigger bets?',
              answer:
                'No, and the book is unusually direct about it — it prints a separate breakdown for each flop AND each bet-size, and they contradict one another. The open-enders here “will only continue if they are drawing to the nut straight”; in the very next example, on 9♥8♥4♦ against a 2/3-pot c-bet, “OESD are x/c every time” (p.744). Nothing on this page is a general rule about bottom pair, gutshots or open-enders. It is a rule about Q♥J♥T♥ against a min-bet.',
              nearestSources: ['qjtdef.oesd', 'qjtdef.table-123', 'qjtdef.min-bet-pot-odds'],
            },
          ],
          sources: ['qjtdef.bottom-pair', 'qjtdef.middle-pair', 'qjtdef.folds', 'qjtdef.table-123'],
        },

        {
          id: 'even-top-pair-is-weak',
          title: 'Even top pair is only a “weak hand” here',
          body:
            'The book has a fixed vocabulary for how good a hand is, and it is not about the hand: equity buckets are hand-versus-RANGE equity, so the same two cards move between buckets as the board and the ranges change. Applying that vocabulary to Q♥J♥T♥ does something startling to a holding most players would call strong — and it is the cleanest way to see why the price, not the hand, is what decides this spot.',
          exhibit: {
            caption: 'The equity buckets, and where top pair lands on this board',
            scope:
              'The four bucket definitions are general (p.596). The 44% is the book’s figure for top pair on Q♥J♥T♥ specifically (p.741). Placing the second inside the first is arithmetic on two printed numbers, not a solved output — and 44% is an equity, never a strategy frequency.',
            rows: [
              { label: 'Strong hands', value: '≥ 75% equity' },
              { label: 'Good hands', value: '50% – 75%' },
              { label: 'Weak hands', value: '33% – 50%' },
              { label: 'Trash hands', value: '< 33%' },
              { label: 'Top pair on Q♥J♥T♥', value: '44% — a weak hand', pct: 44 },
            ],
            sources: ['eqb.definitions', 'qjtdef.top-pair-44'],
          },
          bullets: [
            {
              text: '“Top pair averages 44% equity on a board as connected as this one with so many flush, straight, set and two pair combinations. Top pair is simply not a strong hand on this texture.”',
              sources: ['qjtdef.top-pair-44'],
            },
            {
              text: '44% falls inside the weak bucket by the book’s own definition — at least 33%, below 50%. The buckets are explicitly relative: a hand’s value “is not static but instead dynamic, relative to the ranges in play and the board type”.',
              sources: ['eqb.definitions', 'qjtdef.top-pair-44'],
            },
            {
              text: 'You are holding the bottom pair on that board — a rank below the class the source has just declined to call strong — and it is still always called. That is the lesson in one line: the bet-size set the bar, not the hand.',
              sources: ['qjtdef.bottom-pair', 'qjtdef.top-pair-44'],
            },
          ],
          unsourced: [
            {
              question: 'What equity does bottom pair with an ace kicker have here?',
              answer:
                'The source does not say. The only per-class equity figure printed for this board is top pair’s 44%; no equity is given for bottom pair, for any kicker, or for the hand plus its gutshot. The argument for calling rests on the printed class RULE and on the price, not on an equity comparison that would have to be invented to make it.',
              nearestSources: ['qjtdef.top-pair-44', 'qjtdef.bottom-pair', 'eqb.definitions'],
            },
          ],
          sources: ['eqb.definitions', 'qjtdef.top-pair-44'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-vs-min-bet-qjt',
      label: 'BB strategy vs a min-bet on Q♥J♥T♥',
      kind: 'composition',
      seat: 'hero',
      description:
        'The whole-range answer the book prints for this exact node: 40bb, BB vs UTG, monotone Q♥J♥T♥, facing a flop min-bet. Roughly 61% of the range continues. This is the strategy against the min-bet only — the book solves and prints each bet-size separately.',
      bars: [
        { label: 'Check-call', pct: 43, note: 'the largest branch' },
        { label: 'Fold', pct: 38.26 },
        { label: 'Check-raise', pct: 18, note: 'flushes, sets, two pair, some straights and draws' },
      ],
      unsourced: [
        {
          question: 'Can you show the per-hand chart behind these three numbers?',
          answer:
            'Not from what the book prints in text. Table 123 is a table image, and the running text beneath it describes the strategy by hand CLASS — some with a frequency, some as a flat rule, and top pair with no strategy figure at all. This puzzle teaches from those class statements and claims no per-combo number for any holding.',
          nearestSources: ['qjtdef.table-123', 'ex2.bb-36-equity'],
        },
      ],
      sources: ['ex2.bb-36-equity', 'qjtdef.table-123'],
    },
    {
      id: 'bb-equity-qjt',
      label: 'BB equity on Q♥J♥T♥',
      headline: '36%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'What the big blind is defending with. The source calls this “a substantial equity disadvantage”: 36% equity, only 79% of it realized, capturing 28% of the pot. The wide continue is not a claim to be ahead — it is what a 1bb bet makes correct even from behind.',
      unsourced: [
        {
          question: 'Does the book give the big blind’s equity-bucket split on this flop?',
          answer:
            'Not for Q♥J♥T♥. The 36% figure is a range-versus-range equity, not a bucket breakdown, and the only per-class equity printed for this board is top pair’s 44%. The bucket definitions used elsewhere in this puzzle are the general ones from p.596, applied to that single printed figure and to nothing else.',
          nearestSources: ['ex2.bb-36-equity', 'qjtdef.top-pair-44', 'eqb.definitions'],
        },
      ],
      sources: ['ex2.bb-36-equity'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'A min-bet is cheap enough to turn hands you would fold to a real bet into mandatory calls — but only the classes the source names.',
  headlineSources: ['qjtdef.bottom-pair', 'qjtdef.alpha-mdf', 'ex2.bb-36-equity'],
  takeaways: [
    {
      text: 'Alpha is b ÷ (b + pot), and MDF is 1 − Alpha. Shrink the bet and Alpha collapses: 1bb into 5.5bb is about 15% Alpha and about 85% MDF. Your cards appear nowhere in that calculation.',
      sources: ['qjtdef.alpha-mdf'],
    },
    {
      text: 'Do not stop at MDF. The book says it “does not take equities and range distribution into account” and that basing a strategy on it “will be highly detrimental”. On this node the big blind actually folds 38.26%, check-calls 43% and check-raises 18% — very wide, and not 85% wide.',
      sources: ['qjtdef.mdf-ignores-equities', 'ex2.bb-36-equity'],
    },
    {
      text: 'Wide is a roster, not a licence. Here the source continues bottom pair with a higher kicker (always called), middle pair with a higher kicker (100% call), made hands and draws — and folds weak bottom pairs T8-T2, underpairs without a flush draw, gutshots without a pair, and air.',
      sources: ['qjtdef.bottom-pair', 'qjtdef.middle-pair', 'qjtdef.folds'],
    },
    {
      text: 'The roster is board-specific and size-specific. Open-enders here continue only when drawing to the nut straight; on the very next flop the book studies, open-enders check-call every time. Carry the method across boards, never the list.',
      sources: ['qjtdef.oesd', 'qjtdef.min-bet-pot-odds'],
    },
  ],

  xp: 35,

  endsEarlyBecause:
    'This puzzle teaches one idea — what a min-bet’s price does to the flop continuing range — and pp.739-741 is where the source answers it, as a flop node. The book does carry Q♥J♥T♥ into its turn chapter (pp.750-751), but nothing there is a rule for bottom pair with a higher kicker after it calls, so playing the hand on would mean teaching a second idea from evidence this puzzle has not laid out. It stops where the breakdown does.',
}

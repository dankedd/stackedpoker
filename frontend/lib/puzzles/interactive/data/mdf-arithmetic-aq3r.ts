import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 15 — "The 75% your range does not contain"
 * (BB vs UTG, A♥Q♦3♠, 40bb MTT, flop only)
 *
 * ONE idea: minimum defence frequency is arithmetic about a bet-size. It is not
 * advice about a range. The learner is handed a correctly computed 75%, and the
 * correct play is to fold — because the 75% was never a claim about the cards
 * they hold or the range they hold them in.
 *
 * The whole puzzle is the book's own worked counter-example on p.726, read from
 * three directions:
 *
 *   WHERE 75% COMES FROM   Ch.2, pp.108-110. Alpha is b/(b + p); MDF is its
 *      complement. For a 1/3-pot bet that is 25% and 75%. Two inputs — a bet
 *      and a pot. No board, no hand, no range appears in the expression, which
 *      is why the number travels everywhere and answers nothing about a range.
 *   WHAT IT ASSUMES        pp.602-603, "Alpha and MDF Revisited". The author's
 *      own account: the numbers assume checking back is worth 0 and that a
 *      called bluff loses the whole bet, neither of which holds on a flop.
 *      This is what makes "right arithmetic, wrong question" the book's
 *      position rather than a gloss on it.
 *   WHAT IT MISSES HERE    p.726. On AQ3r the BB's range is 70% trash and 10%
 *      weak, its trash averages 16% equity against UTG, and the price is 20%.
 *      A 75% defence is not a plan the range can execute.
 *
 * WHY THE HERO HAND IS 9♥6♥, and not a hand chosen for effect: p.726 names the
 * holdings it wants folded — "a 96s with a BDFD, a weak king-high or a small
 * pocket pair". This board is rainbow, so a backdoor flush draw means holding
 * two of a suit that appears once on the flop; 9♥6♥ with the A♥ out is exactly
 * "96s with a BDFD" on A♥Q♦3♠. The hand is the book's, not the author's of this
 * file.
 *
 * ══ THE ONE PLACE THIS PUZZLE DEPARTS FROM ITS BRIEF ══════════════════════
 *
 * The build brief for this puzzle instructed that the source states only the
 * CRITIQUE of MDF here, not a replacement number, and to write that the source
 * does not print the BB's actual defence frequency on this flop.
 *
 * The source does print it. p.726, two sentences after the 75%: "the BB's GTO
 * defense strategy vs the 1/3-pot bet-size has them folding 58% and defending
 * only 42% of the time, which is nowhere near the 75% MDF." It is already in
 * this repo's citation registry as `aq3.bb-defends-42`, entered by the puzzle
 * that works the same board from UTG's seat.
 *
 * Writing "the source does not print it" would therefore have been a false
 * statement about a cited page in a product whose entire premise is that claims
 * and evidence are inseparable — and a reader with the book open would catch it
 * on the first look. So the figure is shown, with the constraint the brief was
 * protecting handled a different way: it is scoped to one flop, one match-up,
 * one depth and one bet-size, it is never phrased as a rule, and the note that
 * would have carried the disclaimer instead carries what pp.602-603 actually
 * say — that no frequency of this kind is a strategy. MDF is not replaced here
 * by a better number. It is replaced by a question.
 *
 * MONEY (blinds 0.5/1, six-handed MTT, 40bb effective, no ante). The 2.5bb open
 * is an implementation decision carried over from the other puzzles on this
 * board — p.726 prints no sizes — and is disclosed in the flow.
 *
 * NO `anteBb` HERE, deliberately, and the reason is the dataset rather than an
 * oversight: the puzzles that do set `anteBb: 0.125` are pre-flop ones built on
 * Ch.7/Ch.8 ranges, where the book states its solver environment outright — 9-max
 * tables with a 12.5% ante (p.293). This puzzle draws on the Ch.12 flop dataset,
 * whose stated scope is "thousands of GTO solutions with stack depths 20bb, 30bb
 * and 40bb with standard GTO MTT starting ranges" (p.655) and which restates
 * neither table size nor ante. Adding dead money the source never specified would
 * change the pot odds — the exact quantity the whole lesson turns on — so the felt
 * matches the other flop puzzles on this board instead.
 *   preflop  UTG opens 2.5, BB calls, the folded SB's 0.5 is dead
 *   flop     pot 5.5 → UTG bets 1.8 (1/3-pot, exactly 1.83) → 7.3 faced
 *            hero owes 1.8 with 37.5 behind
 */
export const MDF_ARITHMETIC_AQ3R: InteractivePuzzle = {
  id: 'mdf-arithmetic-aq3r',
  slug: 'the-75-percent-your-range-does-not-contain',
  number: 15,
  title: 'The 75% your range does not contain',
  topic: 'MDF',
  difficulty: 'advanced',
  description:
    'One flop decision in the big blind against a small c-bet. MDF says defend 75%, the arithmetic behind that 75% is correct, and you should still fold — because the calculation was never about your cards.',

  setup: {
    format: 'MTT, 40bb effective',
    // Six-handed, so the folded small blind's dead 0.5bb is accounted for.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    // "96s with a BDFD" is the book's own example holding for this flop. The
    // board is rainbow, so the backdoor draw has to come from the A♥.
    heroCards: ['9h', '6h'],
    effectiveStackBb: 40,
    gameNotes: 'MTT, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['Ah', 'Qd', '3s'],
      // 5.5 (2.5 open + 2.5 call + the folded SB's 0.5) + UTG's 1.8 = 7.3bb.
      potBb: 7.3,
      effectiveStackBb: 37.5,
      facingBetBb: 1.8,
      heroInvestedBb: 0,
      toCallBb: 1.8,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: ['BB checks', 'UTG bets 1.8bb'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: 'A♥ Q♦ 3♠ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 1.8 bb (1/3 pot)' },
      ],
      situation:
        'You defended your big blind against an UTG open and the flop is A♥ Q♦ 3♠ — ace-high and rainbow. You check, and UTG bets 1.8bb: one third of the pot, the smallest real bet in the game. You hold 9♥ 6♥ — no pair, no straight draw, and three hearts to a backdoor flush. There is 7.3bb in the middle and 1.8bb to call, with 37.5bb behind. Against this size, minimum defence frequency says the big blind defends 75% of the time.',
      question: 'MDF says defend 75%. What do you actually do with this hand?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'best',
          shortWhy:
            'The book’s instruction for this exact spot names your hand type: with 96s and a backdoor flush draw, a weak king-high or a small pocket pair — about 10-20% equity — “you should simply fold even if the Villain is betting ATC.”',
          sources: ['mdf.aq3r-fold-these-hands', 'mdf.aq3r-fold-is-zero-ev'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.8 bb',
          tableAction: { label: 'Calls', betBb: 1.8 },
          verdict: 'mistake',
          shortWhy:
            'This is the answer MDF points at, and the price is exactly why it fails: the bet lays you 20% odds while the big blind’s trash hands average 16% equity against UTG. Even against this small a size, calling those hands is -EV.',
          sources: ['aq3.bb-trash-16-equity', 'mdf.one-third-pot-is-75'],
        },
        {
          id: 'check-raise',
          label: 'Check-raise',
          historyText: 'Raises to 7 bb',
          tableAction: { label: 'Raises to', betBb: 7 },
          verdict: 'mistake',
          shortWhy:
            'The one action the source rates below calling. “Raising would be even worse, as that puts even more money into the pot vs a strong range that will not fold enough to make the bluff profitable.”',
          sources: ['mdf.aq3r-raising-worse'],
        },
      ],
      bestOptionId: 'fold',
      explanation:
        'Fold. The 75% is not wrong — it is not an answer. Alpha for a 1/3-pot bet is 0.33/(0.33 + 1) = 25%, so MDF is 75%, and the book prints that same 75% for this bet. Look at what went into it: a bet and a pot. Your two cards are not in that calculation, your range is not in it, and the board is not in it — the identical 75% comes out on every flop in the deck. What decides the hand is the material MDF never consults. On A♥Q♦3♠ the big blind’s range is 70% trash and 10% weak; its trash hands average 16% equity against UTG while the bet lays 20% odds, so “even against the 1/3-pot bet-size, calling many of those hands will be -EV.” Raising is worse still, against a range that will not fold enough. And the book names your holding among the ones to let go: 96s with a backdoor flush draw, about 10-20% equity, “you should simply fold even if the Villain is betting ATC.” When calling and raising are both -EV, folding at 0 EV is the highest-EV play available.',
      unsourced: [
        {
          question: 'So what frequency SHOULD the big blind defend here?',
          answer:
            'For this one node the book does print a figure, and it is shown in this puzzle rather than withheld: folding 58%, defending 42% against the 1/3-pot bet on AQ3r, BB vs UTG at 40bb (p.726). What does not exist is a number you can carry anywhere else. That 42% belongs to one flop, one match-up, one stack depth and one bet-size; change any of the four and it stops being the answer. The book’s general position is stated a hundred pages earlier: “Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO” (p.603). So MDF is not being swapped here for a better constant. It is being swapped for two questions — what is my equity, and what does my range look like on this board.',
          nearestSources: ['aq3.bb-defends-42', 'mdf.limits-rough-guide', 'mdf.limits-ev-assumptions'],
        },
        {
          question: 'Where do the 2.5bb open and the 1.8bb bet come from?',
          answer:
            'The open is an implementation decision. p.726 gives no sizes for its AQ3r example, and the book’s own sizing guidance is general — it reports that for similar bet-sizes the EV differences are small and often indifferent (p.175). 2.5bb is used for consistency with the other puzzles on this board. That makes the flop pot 5.5bb — 2.5 opened, 2.5 called, plus the folded small blind’s 0.5 — so a 1/3-pot bet is 1.83bb, shown as 1.8 on the felt. The 20% pot odds the book quotes are for an exact third: risking 0.33 to win a final pot of 1.66. The rounded 1.8 works out at 19.8%, which is the same decision.',
          nearestSources: ['preflop.sizing-guidelines', 'sizing.pot-fraction-convention'],
        },
        {
          question: 'Why does the check-raise button show a raise size the book never prints?',
          answer:
            'Because a button has to show something. p.726 says only that raising “would be even worse” here; it prints no raise size for this node, and no part of the reasoning in this puzzle depends on the number. Read the 7bb as an illustration of a large raise against a small bet, not as a recommended size.',
          nearestSources: ['mdf.aq3r-raising-worse'],
        },
        {
          question: 'Is 9♥6♥ specifically confirmed to be in the big blind’s range here?',
          answer:
            'By class, yes; by combo, no chart is printed. The book raises this exact holding itself — “if you are holding something like a 96s with a BDFD” — while discussing this flop in this match-up at this depth, so a hand of this shape is demonstrably in the range it is describing. What is not printed is a per-combo frequency for 9♥6♥, and none is claimed. The equity figures work the same way: 10-20% is the band the book gives for the hand types it names, and 16% is the average of the whole trash bucket. Neither is a measurement of this one combo.',
          nearestSources: ['mdf.aq3r-fold-these-hands', 'aq3.bb-trash-16-equity', 'eqb.definitions'],
        },
      ],
      theory: [
        {
          id: 'where-75-comes-from',
          title: 'Where the 75% comes from',
          body:
            'MDF is one subtraction away from Alpha, and Alpha is one division. Alpha is b/(b + p) — how often a bluff has to work to break even — and since folding and defending are complementary, MDF is whatever is left. For a bet of a third into a pot of one: 0.33/(0.33 + 1) = 25% Alpha, so 75% MDF. That matches the figure the book prints for a 1/3-pot bet. Now read the inputs again. There are two of them, and they are both amounts of money. Nothing in the expression asks what board you are on, what you hold, or what your range is made of. That is why the number is available instantly in every spot — and it is the same reason it cannot be a strategy for any of them.',
          exhibit: {
            caption: 'Alpha and MDF at two bet-sizes',
            scope:
              'Both rows are pure bet-size arithmetic from b/(b + p), not solver output for any board. The half-pot row is the book’s own worked river example (p.136); the 1/3-pot row is that formula applied to a third, and the source prints the resulting 75% itself on p.726. The same two rows hold on every flop in the deck.',
            rows: [
              {
                label: '1/3-pot — Alpha',
                value: '25%',
                pct: 25,
                note: '0.33 / (0.33 + 1) — how often the bet must work to break even',
              },
              {
                label: '1/3-pot — MDF',
                value: '75%',
                pct: 75,
                note: 'the complement, and the figure the book states for this bet',
              },
              { label: '1/2-pot — Alpha', value: '33%', pct: 33, note: 'the book’s worked example, p.136' },
              { label: '1/2-pot — MDF', value: '67%', pct: 67, note: '“must defend 67% (1-Alpha) of his range”' },
            ],
            sources: [
              'mdf.alpha-definition',
              'mdf.complement-of-alpha',
              'mdf.alpha-one-third-derived',
              'mdf.one-third-pot-is-75',
              'sizing.alpha-worked-example',
            ],
          },
          bullets: [
            {
              text: 'Alpha is defined as b/(b + p) and described as “how often a bluff has to work for it to break even”. Two inputs, both of them money.',
              sources: ['mdf.alpha-definition'],
            },
            {
              text: 'MDF is simply the other side of it: “folding frequency and calling frequency are complementary numbers, they should add up to 1. So, if you know one, you can always easily calculate the other.”',
              sources: ['mdf.complement-of-alpha'],
            },
            {
              text: 'Where the definition was derived matters. It comes from a two-player toy game on a static board with one clairvoyant player and no cards left to come — a setting built so that nothing about ranges or future equity could interfere.',
              sources: ['mdf.definition-toy-game'],
            },
            {
              text: 'The book applies it to this very bet and gets the number on your screen: “if UTG bets 1/3-pot then, according to MDF, the BB is supposed to defend 75% of the time.” The arithmetic is not in dispute anywhere in this puzzle.',
              sources: ['mdf.one-third-pot-is-75', 'sizing.pot-fraction-convention'],
            },
          ],
          sources: ['mdf.alpha-definition', 'mdf.complement-of-alpha', 'mdf.definition-toy-game'],
        },

        {
          id: 'right-answer-wrong-question',
          title: 'Correct arithmetic, wrong question',
          body:
            'It is tempting to conclude that MDF is simply miscalculated for flop play. It is not. Every step of it is right, and the book is precise about what the calculation is a statement of: it is the frequency that makes a bluff with ZERO equity indifferent. To get there it has to assume two things — that checking back the hand instead of bluffing is worth 0, and that a called bluff always loses the pot and the bet. On a river those assumptions can be true. On a flop neither is, because even the worst hands still have equity and can improve. So the 75% answers a question about an imaginary hand that can never win: how often must it be folded to before it profits. Your question is a different one. Not what would make his bluffs indifferent, but what happens to your money if you put more of it in with this hand.',
          bullets: [
            {
              text: 'The book states the assumptions itself: Alpha and MDF “are derived from the EV equation. They assume that the EV of checking back your hand is 0 and that every time you are called and hold a bluff that you lose the pot and your bet.”',
              sources: ['mdf.limits-ev-assumptions'],
            },
            {
              text: 'And why they break on a flop: “on the flop most poker hands will almost always have some equity as even the worst hands can improve on future streets. For this reason, the Alpha and MDF numbers are misleading. In reality, the BB does not have to defend nearly as many hands as MDF suggests…”',
              sources: ['mdf.limits-ev-assumptions'],
            },
            {
              text: 'The purpose clause is in the definition itself — the defender’s frequency is there “to make your zero equity bluffs indifferent”. Nothing in that sentence promises the defender a profit, or even that the hands to do it with exist.',
              sources: ['sizing.alpha-worked-example'],
            },
            {
              text: 'Which is why the verdict is about standing, not accuracy: “Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO.”',
              sources: ['mdf.limits-rough-guide'],
            },
          ],
          sources: ['mdf.limits-ev-assumptions', 'mdf.limits-rough-guide'],
        },

        {
          id: 'the-range-cannot-supply-it',
          title: 'The hands to defend with are not there',
          body:
            'The decisive objection to defending 75% on this board is not that it is theoretically unsound. It is that the big blind does not own 75% of hands that can profitably continue. Sort the range into the book’s equity buckets and 70% of it is trash — under 33% equity against UTG — with another 10% weak. That is 80% of the range at or below half-equity, on a flop where UTG holds every ace and every queen it opened with. Those trash hands average 16% equity, and the bet asks for 20%. A 75% defence would mean reaching well down into that 80% and calling with hands priced above what they are worth. There is no way to make the arithmetic and the range agree, because they were never talking about the same thing.',
          exhibit: {
            caption: 'The big blind’s range on A♥Q♦3♠',
            scope:
              'BB vs UTG at 40bb, on AQ3r specifically. A property of this board against this opening range — not a general flop distribution, and not a measurement of any individual hand. Buckets are hand-vs-range equity per the book’s definitions (p.596).',
            rows: [
              { label: 'Trash — under 33% equity', value: '70%', pct: 70, note: 'the book’s figure for this flop' },
              { label: 'Weak — 33% to 50% equity', value: '10%', pct: 10, note: 'the book’s figure for this flop' },
              {
                label: 'Everything at 50% or better',
                value: '20%',
                pct: 20,
                note: 'the remainder — the source prints the two figures above, not this one',
              },
              {
                label: 'Average equity of the trash',
                value: '16%',
                pct: 16,
                note: 'a bucket average vs UTG, against pot odds of 20%',
              },
            ],
            sources: ['aq3.bb-trash-16-equity', 'eqb.definitions'],
          },
          bullets: [
            {
              text: 'The composition is the book’s: “on a flop such as AQ3r, the BB’s range has 70% trash hands and 10% weak hands.” Trash is defined as under 33% hand-vs-range equity, weak as 33% to 50%.',
              sources: ['aq3.bb-trash-16-equity', 'eqb.definitions'],
            },
            {
              text: 'The price beats the equity: “On average, the BB’s trash hands have 16% equity against UTG, but the pot odds laid by UTG’s bet-size are 20%. So even against the 1/3-pot bet-size, calling many of those hands will be -EV.”',
              sources: ['aq3.bb-trash-16-equity'],
            },
            {
              text: 'This is what the opening critique meant in concrete terms. MDF “does not take equities and range distribution into account” — the two things that just decided the hand.',
              sources: ['mdf.aq3r-critique'],
            },
            {
              text: 'The book generalizes it into a rule that overrides MDF by name: “If your range has a lot of trash hands, you should fold a lot of it vs a c-bet, regardless of your opponent’s bet-size and the MDF.”',
              sources: ['guideline.trash-heavy-range-folds'],
            },
            {
              text: 'And it accepts the consequence rather than looking for a way out: on this flop UTG “can get away with c-betting their entire range and there is nothing the BB can do to stop them from having a profitable bet with any two cards.”',
              sources: ['aq3.bb-defends-42'],
            },
          ],
          unsourced: [
            {
              question: 'Does 70% trash mean the big blind folds 70%?',
              answer:
                'No, and the two numbers should not be read off each other. Composition is what the range is made of; defence frequency is what gets done with it. For this one node the book gives both — 70% trash and 10% weak, and a strategy folding 58% while defending 42% — so some trash does continue and some weak hands do not. What the composition establishes is narrower and enough for this decision: a range that is 80% weak-or-worse cannot supply 75% profitable continues.',
              nearestSources: ['aq3.bb-trash-16-equity', 'aq3.bb-defends-42', 'eqb.definitions'],
            },
          ],
          sources: ['aq3.bb-trash-16-equity', 'eqb.definitions', 'mdf.aq3r-critique'],
        },

        {
          id: 'the-passage',
          title: 'The passage, and the page',
          body:
            'Everything above is one paragraph of Modern Poker Theory, in the “C-bet Defense” section of the flop chapter, p.726. It opens with the general claim: “Some players like using MDF as pseudo-GTO strategy, but as we have already pointed out, while this number could in some instances serve as a rough guideline, it does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.” Then it works the example you have just played — the 1/3-pot bet, the 75%, the 70% trash, the 16% against a 20% price — and lands on the instruction: “if you are holding something like a 96s with a BDFD, a weak king-high or a small pocket pair and have about 10-20% equity, you should simply fold even if the Villain is betting ATC.” The hand you were dealt is the first item on that list.',
          bullets: [
            {
              text: 'p.726 — the general claim: MDF “does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.”',
              sources: ['mdf.aq3r-critique'],
            },
            {
              text: 'p.726 — the instruction, naming your holding by class: 96s with a BDFD, a weak king-high or a small pocket pair, about 10-20% equity — “you should simply fold even if the Villain is betting ATC.”',
              sources: ['mdf.aq3r-fold-these-hands'],
            },
            {
              text: 'p.726 — the comparison that makes folding correct rather than merely safe: “If calling and raising are -EV plays, then folding, which is always 0 EV, will be the highest EV play.” Folding wins here by being worth nothing.',
              sources: ['mdf.aq3r-fold-is-zero-ev'],
            },
            {
              text: 'p.726 — and what the fold does not cost you: “Your pre-flop call was profitable and there will be other flops where your range will be much stronger…” One bad board is not a reason to have declined a good price.',
              sources: ['mdf.aq3r-other-flops-exist'],
            },
            {
              text: 'pp.602-603 — the same argument stated in general, two hundred pages earlier, in a section called “Alpha and MDF Revisited”. This is a position the book holds, not a remark it makes once.',
              sources: ['mdf.limits-ev-assumptions', 'mdf.limits-rough-guide'],
            },
          ],
          sources: ['mdf.aq3r-critique', 'mdf.aq3r-fold-these-hands', 'mdf.aq3r-fold-is-zero-ev'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-range-aq3r',
      label: 'Big blind’s range on A♥Q♦3♠',
      kind: 'composition',
      seat: 'hero',
      description:
        'Why 75% is unreachable on this board. Sorted into the book’s equity buckets, 70% of the big blind’s range is trash — under 33% equity against UTG — and another 10% is weak. The trash averages 16% equity while the 1/3-pot bet asks for 20%. Scoped to BB vs UTG at 40bb on this flop; it is not a general flop distribution.',
      bars: [
        { label: 'Trash (under 33% eq)', pct: 70, note: 'averaging 16% equity vs UTG' },
        { label: 'Weak (33-50% eq)', pct: 10 },
        { label: 'At 50% eq or better', pct: 20, note: 'the remainder; the source prints the other two' },
      ],
      unsourced: [
        {
          question: 'Can you show which specific hands sit in each bucket?',
          answer:
            'Not from this passage. p.726 states the two percentages in prose and names three hand types it wants folded — 96s with a backdoor flush draw, weak king-high, small pocket pairs at about 10-20% equity. It prints no per-hand chart for the big blind on this flop, so no combo-level assignment is offered here.',
          nearestSources: ['aq3.bb-trash-16-equity', 'mdf.aq3r-fold-these-hands', 'eqb.definitions'],
        },
      ],
      sources: ['aq3.bb-trash-16-equity', 'eqb.definitions'],
    },
    {
      id: 'mdf-vs-actual',
      label: 'What MDF asks for, and what happens',
      headline: '75% vs 42%',
      kind: 'aggregate',
      seat: 'both',
      description:
        'MDF for a 1/3-pot bet is 75%, computed from the bet and the pot alone — the same 75% on any board. For this node the book also prints the strategy that actually gets played: folding 58%, defending 42%, “nowhere near the 75% MDF”. Read the gap as a measurement of how far the arithmetic is from the range, not as a defence frequency to reuse — it holds for one flop, one match-up, one depth and one bet-size.',
      unsourced: [
        {
          question: 'Can I use 42% as my defence frequency against small c-bets?',
          answer:
            'No. It is the solution to one node — AQ3r, BB vs UTG, 40bb, facing exactly a 1/3-pot bet — and the book’s general statement about numbers of this kind covers it: “Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO” (p.603). Swapping a portable 75% for a portable 42% would repeat the mistake this puzzle is about. What travels is the method: check your equity against the price, and look at what your range is actually made of on the board in front of you.',
          nearestSources: ['aq3.bb-defends-42', 'mdf.limits-rough-guide', 'mdf.limits-ev-assumptions'],
        },
      ],
      sources: ['mdf.one-third-pot-is-75', 'aq3.bb-defends-42', 'mdf.alpha-one-third-derived'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'MDF is a fact about the bet in front of you. Whether you can defend that often is a fact about your range.',
  headlineSources: ['mdf.alpha-definition', 'mdf.aq3r-critique'],
  takeaways: [
    {
      text: 'MDF has two inputs and both are money: Alpha is b/(b + p), MDF is the complement. A 1/3-pot bet gives 25% and 75% — and would give the same 75% on every flop in the deck, against every range.',
      sources: ['mdf.alpha-definition', 'mdf.complement-of-alpha', 'mdf.alpha-one-third-derived', 'mdf.one-third-pot-is-75'],
    },
    {
      text: 'The arithmetic is right; the question is the wrong one. MDF is the frequency that makes a ZERO-equity bluff indifferent, assuming checking back is worth 0 and a called bluff loses the whole bet — assumptions the book calls misleading on a flop, where even the worst hands can improve.',
      sources: ['sizing.alpha-worked-example', 'mdf.limits-ev-assumptions', 'mdf.limits-rough-guide'],
    },
    {
      text: 'Nothing in the formula asks what you hold. On A♥Q♦3♠ the big blind’s range is 70% trash and 10% weak, its trash averages 16% equity against UTG, and the bet asks for 20% — so a 75% defence is not something the range can execute, however sound the number is.',
      sources: ['mdf.aq3r-critique', 'aq3.bb-trash-16-equity', 'eqb.definitions', 'guideline.trash-heavy-range-folds'],
    },
    {
      text: 'With a hand like 96s and a backdoor flush draw the instruction is one word — fold, “even if the Villain is betting ATC”. When calling and raising are both -EV, folding at 0 EV is the highest-EV play on the table.',
      sources: ['mdf.aq3r-fold-these-hands', 'mdf.aq3r-fold-is-zero-ev', 'mdf.aq3r-other-flops-exist'],
    },
  ],

  xp: 40,

  endsEarlyBecause:
    'There is no turn because there is no hand left to play. The decision the source answers is this flop one, and its answer is to fold, so the hand ends where the book ends it. p.726 also says what the fold buys: the pre-flop call was already profitable, and there will be other flops where the big blind’s range is much stronger — one board that misses your range is not a reason to have declined a good price on it.',
}

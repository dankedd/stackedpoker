import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 11 — "A big bet you rarely make" (BN vs BB, 8♥6♦2♠, 40bb)
 *
 * ONE idea: c-bet FREQUENCY and c-bet SIZE are independent axes. A board can
 * want a big bet that is made rarely. Nothing else is taught here.
 *
 * The source makes this argument for us in the cleanest way available — by
 * organising its six worked IP c-bet examples as a grid over the two axes
 * (pp.682-696): high/big, high/small, mid/big, mid/small, low/big, low/small.
 * This puzzle is Example 5, the low/big cell, and the whole point is that the
 * learner has to set two dials rather than one.
 *
 * Content decisions worth recording, because each is a place the obvious
 * version of this puzzle would have been wrong:
 *
 * 1. THE 62% IS THE 6xx CATEGORY, AND 8♥6♦2♠ IS AN 8xx FLOP. p.661 lists c-bet
 *    frequency by the flop's top card — 2xx 100%, Axx 96%, 3xx 93%, Kxx 88%,
 *    Qxx/Txx 85%, "middle and low flops... with 6xx being the lowest at only
 *    62%". No 8xx figure appears in the text, and Diagram 44 is an image. So
 *    62% is cited here as the floor of a neighbouring category that establishes
 *    the DIRECTION low flops move in, and the puzzle says in the flow that it
 *    is not this flop's number. Presenting it as "the c-bet frequency on 862r"
 *    would be the single easiest fabrication in this chapter.
 *
 * 2. THE EXACT CHECK/BET SPLIT ON THIS FLOP IS NOT SPECIFIED IN THE SOURCE.
 *    Diagram 65 is a picture. The book says "low c-bet %" in the heading and
 *    prints no number. The puzzle says exactly that rather than manufacturing a
 *    plausible-looking percentage.
 *
 * 3. A♠6♣ IS PLACED IN THE GOOD BUCKET BY THE BOOK, NOT BY US. Table 117's
 *    breakdown files "The strongest middle pairs such as A6 and K6" under its
 *    Good hands heading (pp.694-695) and says they are mostly c-bet. The p.596
 *    bucket definition (50-74% hand vs range equity) is quoted for what "good"
 *    means; no equity number is claimed for this specific combo, because none
 *    is printed.
 *
 * 4. THE BOOK'S OWN 862r TEXT REFERS TO BDFDs ON A FLOP IT PRINTS AS RAINBOW
 *    (8♥6♦2♠ has three suits, so no backdoor flush draw exists for anyone).
 *    That is an inconsistency in the source, not something to reproduce, so no
 *    claim in this puzzle depends on a BDFD and the quotes carrying that
 *    wording are trimmed to the parts that do not.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante, six-handed). The 2.5bb open is
 * an implementation decision, as in puzzles 1-3 — the book gives no open size
 * for its 40bb MTT sims. 2.5 (BN) + 2.5 (BB) + 0.5 (folded SB) = 5.5bb, with
 * 37.5bb behind. Bet sizes are one-third (1.8bb) and two-thirds (3.7bb) of the
 * displayed pot, which are the two c-bet sizes this chapter's own examples talk
 * in ("c-bet 100% for 1/3-pot" vs "the 2/3-pot bet-size", p.683).
 */
export const BIG_BET_LOW_FREQUENCY_862: InteractivePuzzle = {
  id: 'big-bet-low-frequency-862',
  slug: 'a-big-bet-you-rarely-make',
  number: 11,
  title: 'A big bet you rarely make',
  topic: 'Flop C-betting',
  difficulty: 'advanced',
  description:
    'How often you bet and how much you bet are two separate decisions. This is the board where the book sets one of them high and the other one low — and getting it right means resisting the instinct to move both dials together.',

  setup: {
    format: '40bb effective',
    // Six-handed. The folded small blind's half-blind is where the 0.5 in the
    // flop pot comes from; a heads-up table would lose it and make the chips on
    // screen contradict the printed pot.
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['As', '6c'],
    effectiveStackBb: 40,
    gameNotes: 'MTT, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['8h', '6d', '2s'],
      potBb: 5.5,
      effectiveStackBb: 37.5,
      // Checked to. Nothing to call — this is a bet-or-check decision.
      toCallBb: 0,
      actionBeforeHero: [
        'UTG folds',
        'HJ folds',
        'CO folds',
        'Hero raises to 2.5bb',
        'SB folds',
        'BB calls',
      ],
      postflopAction: ['BB checks'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: '8♥ 6♦ 2♠ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      situation:
        'You opened the button to 2.5bb, the small blind folded and the big blind called. The flop is 8♥ 6♦ 2♠ — rainbow, disconnected, no flush possible. You hold A♠6♣: middle pair with the best possible kicker. The big blind checks to you with 37.5bb behind.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'defensible',
          shortWhy:
            'Right about the frequency, wrong about this hand. The source does say the BN’s good hands "really want to check back a lot" here — but it names A6 specifically as one of the strongest middle pairs, and says those are mostly c-bet. The weaker middle pairs are the ones that check.',
          sources: ['ex5.good-hands-check-back', 'ex5.middle-pair-a6'],
        },
        {
          id: 'bet-one-third',
          label: 'Bet 1/3 pot',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'mistake',
          shortWhy:
            'This is the dial you moved by mistake. The source ties small sizes to a depolarized IP range with the bulk of hands good-but-not-great; on 8♥6♦2♠ it says the opposite — few strong hands for the BB is what "incentivizes the BN to use a big bet-size".',
          sources: ['cbet.polarity-drives-size', 'ex5.range-distribution', 'ex5.low-freq-big-size'],
        },
        {
          id: 'bet-two-thirds',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'best',
          shortWhy:
            'Both dials set correctly. This board is the book’s worked example of a LOW c-bet frequency with a BIG bet-size, and A6 is one of the hands it names as mostly c-bet — so when you do bet, you bet big, and most of the rest of your range still checks.',
          sources: ['ex5.low-freq-big-size', 'ex5.range-distribution', 'ex5.middle-pair-a6'],
        },
      ],
      bestOptionId: 'bet-two-thirds',
      explanation:
        'Bet 2/3 pot — and notice that this is two answers, not one. SIZE: the big blind has few strong hands on 862r compared to you, and the source says that is exactly what incentivizes the button to use a big bet-size; small bets belong to depolarized ranges, which this is not. FREQUENCY: the same paragraph says the button also holds many good and weak hands that would rather play a small pot and take a free turn, which is what drags the overall c-bet frequency down — the book’s own heading for this spot is "Low c-bet % and big bet-size". A♠6♣ is one of the hands that does bet: the source files "the strongest middle pairs such as A6 and K6" under good hands and says they are mostly c-bet, while the weaker middle pairs check back. You are the exception inside a checking-heavy strategy, and the exception bets big.',
      unsourced: [
        {
          question: 'How often exactly does the button c-bet this flop?',
          answer:
            'Not specified in the source. The heading calls it a "low c-bet %" and Diagram 65 shows it as a picture; no percentage for 8♥6♦2♠ appears anywhere in the text. Two numeric frequencies ARE printed for this board — the big blind check-raises about 8%, and the button answers a check-raise by folding 43% / calling 34% / jamming 23% — but the c-bet split itself is not one of them, and interpolating it from the top-card averages would be inventing solver output.',
          nearestSources: ['ex5.low-freq-big-size', 'ex5.xr-frequency', 'ex5.bn-vs-xr-response'],
        },
        {
          question: 'Does the source give an exact frequency for A6 specifically?',
          answer:
            'No. It says the strongest middle pairs "are mostly c-bet" — a direction, not a number. What can be stated is the placement: the book puts A6 by name in the good-hands bucket for this exact board and matchup, and within that bucket on the c-betting side rather than the checking side.',
          nearestSources: ['ex5.middle-pair-a6', 'eqb.definitions'],
        },
        {
          question: 'Where do the 2.5bb open and the two bet sizes come from?',
          answer:
            'From this implementation. The book’s 40bb MTT simulations never print an open size, so 2.5bb is used here for consistency with the other puzzles — 2.5 from you, 2.5 called, plus the folded small blind’s 0.5 makes the 5.5bb pot on the felt. The 1/3-pot and 2/3-pot options are the two c-bet sizes this chapter’s own examples are discussed in (p.683 compares "c-bet 100% for 1/3-pot bet-size" against "the 2/3-pot bet-size"); the book does not print a bet-size in bb for this node.',
          nearestSources: ['cbet.example-matrix'],
        },
      ],
      theory: [
        {
          id: 'two-dials',
          title: 'Two dials, not one',
          body:
            'The instinct almost everyone brings to a c-bet decision is that frequency and size move together: strong range, so bet often and bet big; weak range, so bet rarely and bet small. The book takes that instinct apart deliberately. Its six worked IP c-bet examples are laid out as a grid over the two axes, and every combination gets its own board. Your flop is the low-frequency, big-size cell — the one the single-dial instinct cannot produce.',
          exhibit: {
            caption: 'The book’s six IP c-bet examples, by frequency and by size',
            scope:
              'All six examples are 40bb single-raised pots, IP c-betting the flop after the BB checks. Cited for the SECTION’S OWN ORGANISATION — the headings vary the two axes independently. No frequency or size percentage is printed in these headings.',
            rows: [
              { label: 'A♥Q♦3♠ (Ex 1, vs UTG)', value: 'High frequency · big size' },
              { label: 'Q♥J♥T♥ (Ex 2, vs UTG)', value: 'High frequency · small size' },
              { label: '9♥8♥4♦ (Ex 3, vs UTG)', value: 'Mid frequency · big size' },
              { label: 'J♠6♥6♦ (Ex 4, vs BN)', value: 'Mid frequency · small size' },
              { label: '8♥6♦2♠ (Ex 5, vs BN)', value: 'Low frequency · big size — this hand' },
              { label: '5♥5♦4♥ (Ex 6, vs BN)', value: 'Low frequency · small size' },
            ],
            sources: ['cbet.example-matrix', 'ex5.low-freq-big-size'],
          },
          bullets: [
            {
              text: 'What drives FREQUENCY: how many strong hands your range holds relative to your opponent’s. "In general, the more strong hands your range has compared to your opponent’s, the more frequently you can bet."',
              sources: ['cbet.range-strength-drives-frequency'],
            },
            {
              text: 'What drives SIZE: the SHAPE of your range. Small bets go with a depolarized distribution — the bulk of hands good but not great. Bigger sizes go with a polarized one, with a bigger proportion of strong, weak and trash hands.',
              sources: ['cbet.polarity-drives-size'],
            },
            {
              text: 'Those are different questions about the same range, so they can and do point in different directions. Depth pulls on size independently again: bigger sizes are used less when stacks are shallow and become more relevant as they get deeper.',
              sources: ['cbet.sizes-by-stack-depth'],
            },
          ],
          sources: ['cbet.example-matrix', 'cbet.range-strength-drives-frequency', 'cbet.polarity-drives-size'],
        },

        {
          id: 'why-big',
          title: 'Why the size is big',
          body:
            'The source gives one sentence of cause for the size, and it is about the big blind, not about you: on 862r the big blind has few strong hands compared to the button. A range that cannot hold many hands strong enough to continue against pressure is a range you can charge. That is what turns a big bet from reckless into correct here — and it is a claim about range composition, so it applies to your whole betting range at once, not to A♠6♣ in particular.',
          bullets: [
            {
              text: '"On 862r, the BB has few strong hands compared to the BN. This incentivizes the BN to use a big bet-size."',
              sources: ['ex5.range-distribution'],
            },
            {
              text: 'The general rule the board is an instance of: a more polarized IP distribution — a bigger proportion of strong, weak and trash hands — is what bigger bet-sizes are for. The source’s summary of this flop uses that exact word: "a more polarized big bet-size".',
              sources: ['cbet.polarity-drives-size', 'ex5.range-distribution'],
            },
            {
              text: 'The check-raise data agrees. Because the big blind lacks strong hands, its equilibrium check-raise frequency here is only about 8% — a big bet is not walking into a raising range that can punish it often.',
              sources: ['ex5.xr-frequency'],
            },
          ],
          unsourced: [
            {
              question: 'What are the actual equity buckets for the two ranges on this flop?',
              answer:
                'Not printed. Diagrams 65 and 66 are images, and the text describes the distribution only in words — "few strong hands", "many good and weak hands". Other boards in this chapter do get numeric bucket splits; this one does not, so no percentages are shown here.',
              nearestSources: ['ex5.range-distribution', 'eqb.definitions'],
            },
          ],
          sources: ['ex5.range-distribution', 'cbet.polarity-drives-size'],
        },

        {
          id: 'why-rare',
          title: 'Why the frequency is low anyway',
          body:
            'The same sentence that argues for the big size argues against betting often, and it is worth reading it as two clauses rather than one: the big blind has few strong hands (so bet big), HOWEVER the button also has many good and weak hands that benefit from playing a small pot and taking a free turn card (so bet rarely). Both halves come from the same range comparison. Nothing about the board is contradictory — the two questions simply have different answers.',
          bullets: [
            {
              text: 'The book’s own summary: "the BN also has many good and weak hands that benefit from playing a small pot and taking a free turn card. These range distributions results in a more polarized big bet-size with a low c-bet frequency."',
              sources: ['ex5.range-distribution'],
            },
            {
              text: 'It applies the rule right through the range. Top set "wants to check back or bet small", and the author’s recommendation for a one-size strategy is to always check it back here. Middle and low pocket pairs mostly check. Open-enders mostly check. Even some trash has to check, "because c-betting all your trash would make your c-betting range too weak".',
              sources: ['ex5.strong-hands-check-back', 'ex5.good-hands-check-back', 'ex5.weak-hands', 'ex5.trash-hands'],
            },
            {
              text: 'And it names the leak that a big size invites: "A trend that typically loses a lot of EV to IP that I see all the time is to c-bet all strong and good hands on the flop and checking back an unbalanced and capped range that can be attacked by the BB on future streets." Betting big is precisely what makes betting often expensive.',
              sources: ['ex5.dont-cbet-all-value'],
            },
          ],
          sources: ['ex5.range-distribution', 'ex5.good-hands-check-back'],
        },

        {
          id: 'low-flops',
          title: 'Where low flops sit — and what the 62% actually is',
          body:
            'The chapter also cuts the whole flop universe by the board’s top card and prints an average c-bet frequency for each category. Read it for direction only: these are averages over every flop in a category, drawn from the aggregated 20bb/30bb/40bb MTT-range dataset, and the list below is the complete set of figures the text prints.',
          exhibit: {
            caption: 'Average c-bet frequency by the flop’s top card',
            scope:
              'Ch.12 aggregate over thousands of GTO solutions at 20bb, 30bb and 40bb with MTT starting ranges. Each row is the AVERAGE over every flop in that top-card category — not a figure for any one board, and not a figure for 8♥6♦2♠, which is an 8xx flop and has no printed number of its own.',
            rows: [
              { label: '2xx (only 222)', value: '100%', pct: 100 },
              { label: 'Axx', value: '96%', pct: 96 },
              { label: '3xx (333, 322, 332)', value: '93%', pct: 93 },
              { label: 'Kxx', value: '88%', pct: 88 },
              { label: 'Qxx and Txx', value: '85%', pct: 85 },
              { label: '6xx', value: '62%', pct: 62, note: 'the lowest category the text names' },
            ],
            sources: ['cbet.by-top-card'],
          },
          bullets: [
            {
              text: 'The text’s wording for the bottom of that list is "middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62%". 8♥6♦2♠ is a middle-and-low flop, but it is an 8xx flop and NOT a 6xx flop — its top card is an eight. So 62% establishes which end of the scale low boards live at; it is not this board’s number.',
              sources: ['cbet.by-top-card', 'ex5.low-freq-big-size'],
            },
            {
              text: 'Top card is also only one of several cuts the same diagrams make. A separate one runs by how many straights and open-enders the flop allows, and it moves the two axes together in the other direction: more possible OESDs means lower c-bet frequency AND larger bet-sizes.',
              sources: ['cbet.three-oesd-lowest'],
            },
            {
              text: 'Which is the honest reason to distrust category averages as answers: a specific flop’s strategy comes from the two ranges that actually reach it, and here the source solved that directly instead.',
              sources: ['ex5.range-distribution'],
            },
          ],
          unsourced: [
            {
              question: 'What is the 8xx average, then?',
              answer:
                'Not specified in the source. The prose on p.661 names 2xx, Axx, 3xx, Kxx, Qxx, Txx and 6xx and stops there; the full picture is Diagram 44, which is an image with no transcribable values. Reading an 8xx number off "somewhere between 85% and 62%" would be a guess with a citation stapled to it.',
              nearestSources: ['cbet.by-top-card'],
            },
          ],
          sources: ['cbet.by-top-card'],
        },

        {
          id: 'your-hand',
          title: 'Where A♠6♣ sits in all of this',
          body:
            'A low frequency is a statement about a range, and you are not holding a range — you are holding one hand, and the question is which side of the split it falls on. The source answers that by name. It lists the button’s holdings on this flop bucket by bucket, and "the strongest middle pairs such as A6 and K6" appear under Good hands, on the c-betting side.',
          bullets: [
            {
              text: 'The bucket definitions, so "good" means something precise: strong is 75%+ hand-vs-range equity, good is 50-74%, weak is 33-49%, trash is under 33%. They are relative to the ranges in play, not fixed properties of two cards.',
              sources: ['eqb.definitions'],
            },
            {
              text: 'The placement: "The strongest middle pairs such as A6 and K6 are mostly c-bet and the weaker ones are typically checked back." A♠6♣ is a pair of sixes with the best kicker available — the strong end of that description, not the weak end.',
              sources: ['ex5.middle-pair-a6'],
            },
            {
              text: 'The criterion the source uses when it picks which hands bet is whether a hand can call a check-raise. That is the test A6 passes and a weaker middle pair does not — and it is why the big size and this hand fit together rather than pulling against each other.',
              sources: ['ex5.weak-hands', 'ex5.bn-vs-xr-response'],
            },
          ],
          sources: ['ex5.middle-pair-a6', 'eqb.definitions'],
        },

        {
          id: 'if-raised',
          title: 'If the big blind check-raises',
          body:
            'Worth knowing before you bet, because a big size is what makes a raise expensive. This is the one node past your decision that the source does solve, and it is the reason the low frequency is not timidity: the button’s c-betting range here is built so that it can answer a raise with a real range instead of folding out of the pot.',
          exhibit: {
            caption: 'BN’s equilibrium response to a 50%-pot check-raise on 8♥6♦2♠',
            scope:
              'BN vs BB, 8♥6♦2♠, 40bb, after the BN c-bets and the BB check-raises to 50% pot. This is a split of the BN’s C-BETTING range only — not of the range it started the flop with.',
            rows: [
              { label: 'Fold', value: '43%', pct: 43 },
              { label: 'Call', value: '34%', pct: 34 },
              { label: '3-bet all-in', value: '23%', pct: 23 },
            ],
            sources: ['ex5.bn-vs-xr-response'],
          },
          bullets: [
            {
              text: 'The big blind check-raises only about 8% of the time here, because its range does not hold many strong hands — the same fact that argued for the big size in the first place.',
              sources: ['ex5.xr-frequency'],
            },
            {
              text: 'The source’s calling range against the raise is "pretty much any pair, any gutshot or better draw", and its jamming range is QQ-99 and top pair good kicker or better. A6 is a pair, which places it in the continuing half rather than the folding half.',
              sources: ['ex5.bn-vs-xr-response'],
            },
            {
              text: 'This is what the "can it call a x/r" test is protecting. Hands that cannot are the ones the source c-bets reverse-linearly as bet/folds; hands that can are the ones that make a big size safe to use.',
              sources: ['ex5.weak-hands'],
            },
          ],
          sources: ['ex5.bn-vs-xr-response', 'ex5.xr-frequency'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-call-vs-bn-40bb',
      label: 'Big blind calling range vs a button open (40bb)',
      headline: '58.6%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'The printed BB vs BN chart at 40bb — the depth this puzzle plays. It is what builds the range that then checks to you on the flop. A whole-range percentage; the chart itself is a colour-coded image.',
      unsourced: [
        {
          question: 'Is this the exact preflop range behind Flop Strategy Example 5?',
          answer:
            'The book does not say. Hand Range 167 is a 40bb BB vs BN chart, and Example 5 is a 40bb BB vs BN simulation, so it is the closest printed range to this spot — but the flop example never states which preflop ranges produced it. Shown for the shape of the matchup, not as the solver input.',
          nearestSources: ['preflop.bb-vs-bn-40bb-chart', 'ex5.low-freq-big-size'],
        },
      ],
      sources: ['preflop.bb-vs-bn-40bb-chart'],
    },
    {
      id: 'bb-xr-862',
      label: 'Big blind check-raise range on 8♥6♦2♠',
      headline: '~8%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'How often the big blind check-raises this flop at equilibrium, and why: its range does not hold many strong hands. The source names what is in it — top pair good kicker, some open-enders, some overcards — without giving a per-hand breakdown.',
      sources: ['ex5.xr-frequency'],
    },
    {
      id: 'bn-vs-xr-862',
      label: 'Button response to a 50%-pot check-raise',
      kind: 'composition',
      seat: 'hero',
      description:
        'What happens to your c-betting range if the big blind raises. A genuine three-way partition of that range, printed in full — which is what makes the big size usable rather than a one-way commitment.',
      bars: [
        { label: 'Fold', pct: 43 },
        { label: 'Call', pct: 34, note: 'pretty much any pair, any gutshot or better draw — A6 is here' },
        { label: '3-bet all-in', pct: 23, note: 'QQ-99, top pair good kicker+' },
      ],
      sources: ['ex5.bn-vs-xr-response'],
    },
    {
      id: 'bn-flop-862',
      label: 'Button range on 8♥6♦2♠',
      headline: 'Not specified in the source',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'The source describes this range only in words — few strong hands for the big blind, many good and weak hands for the button that would rather take a free turn. Diagrams 65 and 66 carry the numbers and are images, so no equity-bucket percentages exist to show for this board.',
      unsourced: [
        {
          question: 'Could the buckets be estimated from a similar flop?',
          answer:
            'Not without inventing them. The chapter prints bucket splits for other boards, but a range’s bucket distribution is specific to the flop it lands on — that is the whole premise of the equity-bucket concept. Borrowing another board’s split would be the fabrication this puzzle exists to avoid.',
          nearestSources: ['ex5.range-distribution', 'eqb.definitions'],
        },
      ],
      sources: ['ex5.range-distribution', 'eqb.definitions'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'How often you bet and how big you bet are set by different facts about the same range.',
  headlineSources: ['cbet.example-matrix', 'ex5.range-distribution'],
  takeaways: [
    {
      text: 'Frequency follows how many strong hands you hold relative to your opponent. Size follows the shape of your range — small when it is depolarized, big when it is polarized.',
      sources: ['cbet.range-strength-drives-frequency', 'cbet.polarity-drives-size'],
    },
    {
      text: 'On 8♥6♦2♠ those two point opposite ways: the big blind’s lack of strong hands buys you a big size, while your own surplus of good and weak hands that want a free turn keeps the frequency low.',
      sources: ['ex5.range-distribution', 'ex5.low-freq-big-size'],
    },
    {
      text: 'So a low frequency is not an instruction to check this hand. A6 is named as one of the strongest middle pairs and is mostly c-bet — the hands doing the checking are the weaker ones, top set, and part of the trash.',
      sources: ['ex5.middle-pair-a6', 'ex5.strong-hands-check-back', 'ex5.trash-hands'],
    },
  ],

  xp: 60,

  endsEarlyBecause:
    'Flop Strategy Example 5 is a flop analysis and the book does not carry it further — when the turn chapter picks the examples back up it states that it continues with Examples 1, 2, 3 and 4 only (p.748). The one node past this decision that the source does solve, the response to a check-raise, is shown in the theory rather than played out, because reaching it would mean choosing the big blind’s action for them.',
}

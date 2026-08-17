import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 12 — "Why you don't lead the ace-high flop" (BB vs BN, A76r, 30bb)
 *
 * The exact mirror of puzzle 1. Same chapter, same matchup, same stack depth,
 * same preflop setup — Modern Poker Theory pp.631-652 uses 654r and A76r as its
 * two worked poles, so this puzzle is the other end of the pair rather than a
 * new idea. ONE decision, on the flop, and nothing else: the source gives no
 * turn strategy for this line, and inventing one is the failure this product
 * exists to avoid.
 *
 * Four content decisions worth recording, because each is a place where the
 * obvious version of this puzzle would have overstated its evidence:
 *
 * 1. THE 0.3% AND THE 0.4% ARE DIFFERENT NUMBERS. p.632's "A76r (0.3%)" is an
 *    AVERAGE across the BB vs BN and BB vs UTG simulations at 20bb, 30bb and
 *    40bb — the same aggregate that produces the famous "654r (67%)". p.650's
 *    0.4% is A76r's own donk frequency, printed in the section that measures
 *    what removing the option costs. Both appear here, each labelled with the
 *    sim it came from; neither is presented as a frequency for a hand.
 *
 * 2. NO PER-COMBO FREQUENCY EXISTS FOR A♥5♥. The chapter gives frequencies by
 *    equity bucket and by strategy — never per combo for this spot. The puzzle
 *    says so in the flow rather than manufacturing a decimal.
 *
 * 3. TABLE 101's "25 → 13" IS PRINTED WITHOUT A UNIT. The prose on p.635 says
 *    total EV "reduces from 25 to 13" and gives no unit; the table's own column
 *    headers are an image this repo has not extracted. The unit is established
 *    by cross-check instead: p.652 prints the BB's A76r EV out of position as
 *    25% of the pot, in the same matchup at the same depth, which is where the
 *    GTO figure of 25 comes from. That inference is disclosed where it is used
 *    rather than quietly assumed.
 *
 * 4. THE 85% IS ABOUT IP's ACES AGAINST THE BB's RANGE, NOT ABOUT HERO's HAND.
 *    p.634 prints 85% for IP's top pairs against the BB's whole range, and 65%
 *    for a top pair on 654 — it prints no equity figure for the BB's own top
 *    pair on A76r. So the 85% is cited as a range-level fact that explains IP's
 *    31% strong hands, and the missing figure is named as missing.
 *
 * HERO'S HAND: A♥5♥ makes top pair on A♦7♣6♠ — "top pair or better" is the
 * precise category the source locks in Table 101 to measure what leading costs,
 * so the temptation the puzzle asks about is the one the book quantifies. The
 * hearts are the fourth suit: with a rainbow board there is no flush draw and no
 * backdoor to reason about, which keeps the decision about range structure.
 *
 * MONEY: as in puzzles 1-2, the 2.5bb open is an implementation decision — the
 * book never prints an open size. It prints 5.6bb as the flop pot for this same
 * BB vs BN 30bb configuration when discussing 654r (p.650) and prints no pot for
 * A76r. The felt therefore reads 5.5bb (2.5 + 2.5 + the folded SB's 0.5), and
 * the 0.1bb gap is disclosed rather than closed by inventing a 2.55bb open.
 */
export const NO_DONK_A76R: InteractivePuzzle = {
  id: 'no-donk-a76r',
  slug: 'why-not-lead-an-ace-high-flop',
  number: 12,
  title: 'Why you don’t lead the ace-high flop',
  topic: 'Donk Bet',
  difficulty: 'intermediate',
  description:
    'The same seat, the same stack, the same chapter as the board where leading was right — and an ace on the flop instead of a six. You flop top pair and the correct play is to do nothing, for reasons the source measures.',

  setup: {
    format: '30bb effective',
    // Six-handed, as in puzzle 1. The folded small blind is where the dead 0.5bb
    // in the flop pot comes from; heads-up would lose it and make the felt wrong.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['Ah', '5h'],
    effectiveStackBb: 30,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['Ad', '7c', '6s'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      // First to act on a fresh street: nothing to call.
      toCallBb: 0,
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds', 'Hero calls'],
      postflopAction: [],
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: 'A♦ 7♣ 6♠ — pot 5.5 bb' },
      ],
      situation:
        'The button opened to 2.5bb, the small blind folded and you called from the big blind with A♥5♥. The flop is A♦ 7♣ 6♠ — rainbow. You have top pair: aces, with a five kicker. You act first into a 5.5bb pot with 27.5bb behind.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'best',
          shortWhy:
            'The source’s own recommendation for this flop: “it works better for OOP to not split their range and simply check 100% on A76r.” You give up nothing by doing it — the button c-bets 100% of its range when checked to, so your good hands still get paid.',
          sources: ['a76r.check-100', 'a76r.ip-cbets-100'],
        },
        {
          id: 'donk-25',
          label: 'Bet 25% pot',
          historyText: 'Bets 1.4 bb',
          tableAction: { label: 'Bets', betBb: 1.4 },
          verdict: 'mistake',
          shortWhy:
            'This is the size the book measures, and it measures it going badly: the button raises a 1/4-pot lead 53% of the time on A76r, against 20% on 654r. Locking the big blind into leading top pair or better here drops its total EV from 25 to 13.',
          sources: ['donk.654r-ip-raise-frequency', 'a76r.top-pair-lock-ev', 'a76r.donk-reverses-eqr'],
        },
        {
          id: 'donk-67',
          label: 'Bet 67% pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'mistake',
          shortWhy:
            'Worse in the same direction, and with less evidence behind it: the source’s A76r response frequencies are all measured against a 1/4-pot lead, and its recommendation for this flop is a 100% check. Betting bigger commits more chips to a board where the button holds 31% strong hands to your 8%.',
          sources: ['a76r.check-100', 'a76r.buckets', 'contrast.no-donk-flops'],
        },
      ],
      bestOptionId: 'check',
      explanation:
        'Check. This is the flop the chapter uses as its counter-example, and the recommendation is unusually blunt: “it works better for OOP to not split their range and simply check 100% on A76r” (p.635). The reason is not that your hand is weak — it is that the ace belongs to the button. On A76r the button holds 31% strong hands to your 8%, because its top pairs (any Ax) average 85% equity against your range (p.634). Leading into that reverses the whole point of leading: “a donk bet can get raised with such a high frequency that the effect would be reversed. It would be the BB who is forced to continue putting more money into the pot with hands that would rather see a cheap turn card or fold” (p.634). And checking costs you nothing, because “A76r is so good for IP that they get to c-bet 100% of their range… the BB doesn’t need to lead out with their strongest hands to get value as IP will keep putting money into the pot with their entire range when checked to” (p.635).',
      unsourced: [
        {
          question: 'How often exactly does A♥5♥ check here?',
          answer:
            'Exact combo frequency is not specified in the source. The chapter gives frequencies by equity bucket and by whole strategy, never per combo for this spot. What it does state at the level above your hand is unambiguous and points one way: a 100% checking frequency is the recommendation for A76r, the flop’s own donk frequency is about 0.4%, and forcing the big blind to lead top pair or better — the category this hand is in — cuts its total EV from 25 to 13.',
          nearestSources: ['a76r.check-100', 'a76r.donk-option-worthless', 'a76r.top-pair-lock-ev'],
        },
        {
          question: 'Does the book show A♥5♥ specifically calling preflop at 30bb?',
          answer:
            'Not hand by hand. For this exact configuration it prints the aggregates only — a 49% button open met by a 64% big blind call at 30bb — and its per-hand BB vs BN charts are at 25bb and 40bb, with nothing at 30bb. This puzzle claims class membership and stops there: the composition of a big blind calling range against a button is described as most suited hands, offsuit aces, connectors and broadways, and a suited ace is one of those. Interpolating a 30bb chart between the printed 25bb and 40bb ones would be invented solver output.',
          nearestSources: [
            'preflop.bn-open-bb-call-30bb',
            'preflop.bb-call-composition-100bb',
            'preflop.bb-vs-bn-25bb-chart',
            'preflop.bb-vs-bn-40bb-chart',
          ],
        },
        {
          question: 'Where does the 2.5bb open come from, and why does the pot read 5.5bb?',
          answer:
            'From this implementation, not the book. The source never prints an open size for these simulations. It does print 5.6bb as the flop pot for this same BB vs BN 30bb configuration when it measures 654r, and prints no pot at all for A76r. A 2.5bb open is the standard size closest to reproducing that pot: 2.5 from the button, 2.5 from you, plus the folded small blind’s 0.5 makes 5.5bb. The felt shows 5.5 because that is what the visible action adds up to — the 0.1bb gap is disclosed rather than closed by inventing a 2.55bb open. Both bet sizes offered are quarter- and two-thirds-pot of the displayed number, and 1/4-pot is the size the source’s A76r raise frequency is measured against.',
          nearestSources: ['value.table-104', 'donk.654r-ip-raise-frequency'],
        },
      ],
      theory: [
        {
          id: 'whose-board-is-this',
          title: 'Whose board is this?',
          body:
            'This is the heart of it, and it is a fact about range shape rather than about your two cards. Raw equity already runs the wrong way — 38% to 62% — but the chapter is explicit that composition matters more than raw equity, and the composition here is lopsided in a way 654r never is. The top card of the board is the card the preflop raiser has most of. Every ace the button holds is a top pair on this flop, and those top pairs are worth 85% against your range, which is why nearly a third of its range qualifies as strong while less than a tenth of yours does.',
          exhibit: {
            caption: 'Range shape on A76r',
            scope:
              'Equity is range-vs-range on this flop (p.633). The bucket percentages are the BB vs IP distribution on A76r averaged over 20bb/30bb/40bb stacks (Diagram 25). The 85% is IP’s top pairs against the BB’s RANGE — not the equity of any single holding.',
            rows: [
              { label: 'BB equity vs BN equity', value: '38% vs 62%' },
              { label: 'BN strong hands', value: '31%', pct: 31, note: 'a “staggering” 31%, in the book’s own word' },
              { label: 'BB strong hands', value: '8%', pct: 8, note: 'on 654r the same figure is 7% against IP’s 4%' },
              { label: 'BB good hands', value: '17%', pct: 17, note: 'rises to 40% on 654r' },
              { label: 'BB trash hands', value: '49%', pct: 49, note: 'falls to 18% on 654r' },
              { label: 'IP top-pair equity vs BB range', value: '85%', pct: 85, note: 'a top pair on 654 averages about 65%' },
            ],
            sources: ['contrast.a76r', 'a76r.buckets', 'a76r.bb-good-and-trash', 'buckets.654r'],
          },
          bullets: [
            {
              text: 'Read the gap the right way round. 8% against 31% is not “your hand is bad” — it is “the hands worth betting are mostly on the other side of the table”, and a betting range needs strong hands at the top of it to be credible.',
              sources: ['a76r.buckets'],
            },
            {
              text: 'The mirror makes the mechanism visible: on 654r the big blind has 7% strong to the button’s 4%, and every ace the button holds averages 49% equity — effectively a weak hand. Move the ace from your opponent’s hand to the board and that reverses.',
              sources: ['buckets.654r', 'buckets.654r-ax-devalued'],
            },
            {
              text: 'Half your range is unusable: 49% of it is trash on this flop, against 18% on 654r. There is not enough good material to split off a leading range from.',
              sources: ['a76r.bb-good-and-trash', 'a76r.check-100'],
            },
            {
              text: 'The book says which factor dominates: range composition is even more important than raw equity, which is why the 38%-vs-62% split is the smaller half of this answer.',
              sources: ['contrast.a76r', 'a76r.buckets'],
            },
          ],
          unsourced: [
            {
              question: 'What is A♥5♥ itself worth on this flop?',
              answer:
                'The source does not print it. It prints 85% for IP’s top pairs against the BB’s range and “about 65%” for a top pair on 654 — no equity figure for the BB’s own top pair on A76r, and no figure for any specific combo. So this puzzle argues from the range structure the book does print, and makes no claim about how your two cards fare in isolation.',
              nearestSources: ['a76r.buckets'],
            },
          ],
          sources: ['a76r.buckets', 'contrast.a76r'],
        },

        {
          id: 'what-leading-does',
          title: 'What leading actually does here',
          body:
            'Leading on 654r works because it denies the button a free turn it badly wants. Run the same reasoning on A76r and every step of it inverts. The button does not want a free card — its range is strong enough to bet 100% of the time when you check — so your bet does not take anything away from it. What your bet does instead is hand it a raise, and once it raises, the player putting extra money in with hands that wanted a cheap turn is you.',
          exhibit: {
            caption: 'The response to a 1/4-pot lead',
            scope:
              'IP’s raising frequency against a donk bet of 1/4-pot, printed for both flops in the same sentence (p.634). The c-bet figure is BB vs BN on A76r at 30bb (Table 101) — this puzzle’s exact spot. The 84% is the average IP c-bet frequency across ALL flops.',
            rows: [
              { label: 'IP raises your 1/4-pot lead, A76r', value: '53%', pct: 53 },
              { label: 'IP raises your 1/4-pot lead, 654r', value: '20%', pct: 20 },
              { label: 'IP c-bets when you check, A76r', value: '100%', pct: 100, note: 'and does not worry about being check-raised' },
              { label: 'IP c-bets when you check, all flops', value: '84%', pct: 84 },
            ],
            sources: ['donk.654r-ip-raise-frequency', 'a76r.ip-cbets-100', 'donk.baseline-frequencies'],
          },
          bullets: [
            {
              text: 'The source states the reversal directly: donk betting on A76r “does not help the BB deny IP EQR. In this case, the opposite actually occurs” — the bet gets raised so often that it is the big blind who ends up putting more money in with hands that would rather see a cheap turn card or fold.',
              sources: ['a76r.donk-reverses-eqr'],
            },
            {
              text: 'And you are not giving up value by checking. Because the button c-bets its entire range on this board, your strong hands do not need to lead to get paid — checking keeps the money coming.',
              sources: ['a76r.ip-cbets-100'],
            },
            {
              text: 'Leading your best hands actively helps the button: it can then fold the weak hands that would otherwise have kept putting money in as a c-bet, and continue only when continuing is profitable.',
              sources: ['a76r.ip-cbets-100'],
            },
            {
              text: 'Leading your worst hands is worse still. If the big blind leads only weak hands, the button gets to raise 100% of the time — costing the big blind the pot and the bet.',
              sources: ['a76r.check-100'],
            },
            {
              text: 'There is also a cost to the range you leave behind. In the GTO solution the checking range is well protected precisely because the big blind never leads; strip the strong hands out of it and the checking range is vulnerable — in the locked simulation its EV after checking falls to 5.6.',
              sources: ['a76r.top-pair-lock-ev'],
            },
          ],
          sources: ['a76r.donk-reverses-eqr', 'a76r.ip-cbets-100'],
        },

        {
          id: 'the-numbers-that-say-check',
          title: 'The frequencies, and what the lead costs',
          body:
            'The chapter measures this instead of asserting it, twice: once by locking the big blind into the exact strategy this puzzle tempts you with, and once by deleting the leading option altogether. The first is expensive. The second changes nothing — which is the strongest possible statement that there was no leading strategy worth having on this flop.',
          exhibit: {
            caption: 'Locking in the lead, and removing it',
            scope:
              'Both rows are BB vs BN on A76r at 30bb — this puzzle’s exact spot. The first compares the GTO solution with a forced strategy that donks every top pair or better (Table 101, p.635); the second removes the donk option entirely (p.650).',
            rows: [
              {
                label: 'Total EV: GTO → forced to donk top pair or better',
                value: '25 → 13',
                note: 'share of the pot — the source prints the BB’s A76r EV out of position as 25% on p.652, which is where the GTO figure of 25 comes from',
              },
              { label: 'How much of your range that forced lead is', value: '10%', pct: 10 },
              { label: 'EV after checking, in that forced strategy', value: '5.6' },
              { label: 'Cost of removing the donk option entirely', value: 'nothing — overall EV unchanged' },
            ],
            sources: ['a76r.top-pair-lock-ev', 'a76r.bb-ev-share-of-pot', 'a76r.donk-option-worthless'],
          },
          bullets: [
            {
              text: 'The forced strategy is “highly exploitable” in the book’s words, and it is the natural human one: donk every time you have top pair or better, which is 10% of your range on this flop.',
              sources: ['a76r.top-pair-lock-ev'],
            },
            {
              text: 'A76r’s own donk frequency is about 0.4%, and removing the option leaves overall EV the same. Compare 654r at the same depth, where removing it costs 1.1% of the pot, or 6.5bb/100.',
              sources: ['a76r.donk-option-worthless', 'value.table-104'],
            },
            {
              text: 'The headline 0.3% for A76r is a different measurement again — an average across the BB vs BN and BB vs UTG simulations at 20bb, 30bb and 40bb, the same aggregate that puts 654r at 67%. It is a whole-flop figure, not a frequency for any hand.',
              sources: ['donk.654r-is-highest'],
            },
            {
              text: 'A76r is not a special case, it is a member of the largest group of flops there is. The source puts trips, monotone, high-card paired, disconnected two-tone, HXX and AXX flops in the no-donk group, where the whole group averages 39% equity, a 76% equity realization and a donk frequency of about 1% — and where a 100% checking frequency is recommended.',
              sources: ['contrast.no-donk-flops', 'no-donk.family-metrics'],
            },
          ],
          unsourced: [
            {
              question: 'What unit are 25 and 13 in?',
              answer:
                'The prose does not say, and Table 101’s own column headers are printed as an image this repo has not extracted. The unit is established by cross-check rather than assumed: p.652 gives the big blind’s A76r EV out of position as 25% of the pot in the same matchup at the same stack depth, which matches Table 101’s GTO figure exactly. Read as shares of the pot, the forced lead costs roughly half of what the big blind was capturing. No other quantity in this puzzle depends on that reading.',
              nearestSources: ['a76r.top-pair-lock-ev', 'a76r.bb-ev-share-of-pot'],
            },
            {
              question: 'Does the book give a 2/3-pot raise frequency for A76r?',
              answer:
                'No. Every response frequency it prints for this flop is measured against a 1/4-pot donk bet — 53% raises — so the puzzle grades the larger lead on the recommendation the source does make (check 100%) and on the range structure behind it, without inventing a raise frequency for a size the book did not test here.',
              nearestSources: ['donk.654r-ip-raise-frequency', 'a76r.check-100'],
            },
          ],
          sources: ['a76r.top-pair-lock-ev', 'a76r.donk-option-worthless'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-call-30bb',
      label: 'Big blind calling range',
      headline: '64%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'How you got here. The chapter fixes one preflop configuration for both of its worked flops — a standard 49% button open at 30bb met by a standard 64% big blind call — and then solves 654r and A76r from it. The composition of a big blind defence against a button is described as most suited hands, offsuit aces, connectors and broadways, which is where a suited ace enters the hand.',
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from this source at this depth. It prints the 49% and 64% aggregates for the 30bb BB vs BN configuration in prose, and per-hand charts at 25bb (call 65.9%) and 40bb (call 58.6%) — nothing at 30bb. Drawing a grid between the two printed ones would mean choosing which specific hands are in it, and that choice would be ours, not the book’s. The “suited hands, offsuit Ax, connectors and broadways” description is written about the 100bb chart and is cited for shape only, never for a frequency at 30bb.',
          nearestSources: ['preflop.bb-vs-bn-25bb-chart', 'preflop.bb-vs-bn-40bb-chart', 'preflop.bb-call-composition-100bb'],
        },
      ],
      sources: ['preflop.bn-open-bb-call-30bb', 'preflop.bb-call-composition-100bb'],
    },
    {
      id: 'bb-range-a76r',
      label: 'Big blind range on A♦7♣6♠',
      kind: 'composition',
      seat: 'hero',
      description:
        'How that calling range breaks down once this flop lands. Half of it is trash and only 8% is strong — which is the arithmetic reason there is no leading range to build. On 654r the same range has 7% strong, 40% good and 18% trash.',
      bars: [
        { label: 'Strong', pct: 8, note: 'against the button’s 31%' },
        { label: 'Good', pct: 17, note: 'A♥5♥ is top pair; the source does not print which bucket that lands in on this flop' },
        { label: 'Weak', pct: 26, note: 'derived: the four buckets partition the range, so 100 − 8 − 17 − 49' },
        { label: 'Trash', pct: 49, note: 'the single largest part of your range on this board' },
      ],
      unsourced: [
        {
          question: 'Which bucket is top pair with a five kicker in?',
          answer:
            'The source does not say for A76r. It defines the four buckets by equity in Chapter 10 and prints the resulting distribution, but it does not assign this holding to one, and it prints no equity figure for the big blind’s top pair on this flop. The argument here does not need it: the recommendation is a 100% check, and the strategy that leads top pair or better is measured losing EV as a strategy.',
          nearestSources: ['a76r.buckets', 'a76r.top-pair-lock-ev', 'a76r.check-100'],
        },
      ],
      sources: ['a76r.buckets', 'a76r.bb-good-and-trash'],
    },
    {
      id: 'bn-range-a76r',
      label: 'Button range on A♦7♣6♠',
      kind: 'composition',
      seat: 'villain',
      description:
        'The one bucket figure the source prints for the button on this flop, and it is the one that decides the hand: 31% of its range is strong, because every ace it holds is a top pair worth 85% against your range. On this board it c-bets 100% of that range when you check.',
      bars: [
        { label: 'Strong', pct: 31, note: 'BB vs IP buckets on A76r, averaged over 20/30/40bb' },
      ],
      unsourced: [
        {
          question: 'What about the button’s good, weak and trash hands?',
          answer:
            'The source does not print a complete four-bucket breakdown for the button on A76r. The remaining 69% is left unsplit here, because splitting a number the book never split is exactly the kind of plausible invention this puzzle exists to avoid. What it does print about the rest of that range is a strategy rather than a composition: on this flop the button c-bets 100% of the time and does not worry about being check-raised.',
          nearestSources: ['a76r.buckets', 'a76r.ip-cbets-100'],
        },
      ],
      sources: ['a76r.buckets', 'a76r.ip-cbets-100'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'On A76r the big blind should not split its range at all — check 100%.',
  headlineSources: ['a76r.check-100', 'a76r.donk-option-worthless'],
  takeaways: [
    {
      text: 'The ace belongs to the raiser. On A76r the button has 31% strong hands to your 8%, because its top pairs average 85% equity against your range — the exact reverse of 654r, where you hold 7% strong to its 4%.',
      sources: ['a76r.buckets', 'buckets.654r'],
    },
    {
      text: 'Leading reverses the point of leading: the bet gets raised so often that it becomes you putting more money in with hands that wanted a cheap turn. The button raises a 1/4-pot lead 53% of the time here, against 20% on 654r.',
      sources: ['a76r.donk-reverses-eqr', 'donk.654r-ip-raise-frequency'],
    },
    {
      text: 'Checking costs you nothing. The button c-bets 100% of its range on this board, so your best hands get paid without leading — and leading them would only let it fold the weak hands that were going to bet for you.',
      sources: ['a76r.ip-cbets-100'],
    },
    {
      text: 'The book measures the temptation: forcing the big blind to donk every top pair or better — 10% of the range — cuts total EV from 25 to 13 and leaves the checking range unprotected. Remove the leading option from this flop entirely and overall EV is unchanged.',
      sources: ['a76r.top-pair-lock-ev', 'a76r.donk-option-worthless'],
    },
  ],

  xp: 40,

  endsEarlyBecause:
    'The answer on this flop is to check, and the source stops there. Its A76r material is flop material — the equity buckets, the raise frequency against a 1/4-pot lead, Table 101’s locked strategies and the value of the donk option — and it prints no turn or river strategy for this BB vs BN line; the chapter closes by recommending the reader run their own simulations to learn how to follow through on later streets. Adding a turn here would mean inventing the one thing this puzzle is about not inventing.',
}

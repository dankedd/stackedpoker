import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 10 — "The range made of good hands" (BN vs BB, 5♥5♦4♥, 40bb, flop only)
 *
 * ONE idea: how to recognise a DEPOLARIZED range — one whose bulk sits in the
 * merely-good bucket — and why a range shaped that way bets rarely and small.
 * Everything traces to Modern Poker Theory's Flop Strategy Example 6
 * (pp.695-698), the equity-bucket definitions (p.596), the texture rule on
 * p.663, and the book's own definition of the word (p.78).
 *
 * Five content decisions worth recording, because each is a place the obvious
 * version of this puzzle would have been wrong:
 *
 * 1. THE SOURCE DOES PRINT FREQUENCIES FOR THIS FLOP — a lot of them. The brief
 *    for this puzzle stated that no numeric c-bet frequency exists for 5♥5♦4♥
 *    and that no per-hand-class breakdown should be given. That is not what the
 *    book contains: p.696 prints Diagram 67 (both players' equity buckets) and
 *    Diagram 68 (IP's c-bet frequency and size split by bucket), and p.697
 *    prints Table 118, a full per-hand-class table for this exact flop with a
 *    Full Range row. Writing "an exact c-bet frequency for this flop is not
 *    specified in the source" would have been a false statement about the
 *    source, which is the one thing this module exists to prevent — so the
 *    printed figures are used and the genuinely missing ones are named instead:
 *    no frequency for 8♠7♠ as a combo, and no preflop open size.
 *
 * 2. THE HAND IS A GUTSHOT, NOT A MID PAIR. Both are Good-bucket hands here,
 *    and they play in opposite directions: p.697 says "Mid pairs 66-99 are c-bet
 *    almost 100%" in the same sentence as "gutshots mostly like to check back".
 *    Dealing 88 and answering "check" would have contradicted the source. The
 *    gutshot is also the cleaner bucket claim — Table 118 prints 58% equity for
 *    the Gutshot row, which lands it in Good (≥50%, <75%) by the p.596
 *    definition without any inference, whereas the table files 66-99 under
 *    "Over Pair" at 77% equity, i.e. Strong, disagreeing with its own prose.
 *
 * 3. 8♠7♠ HAS NO FLUSH EQUITY. The board is 5♥5♦4♥ and holds no spade, so the
 *    hand is a naked gutshot — one card (a 6) makes the straight, and there is
 *    no backdoor. Suited was chosen only to keep the holding comfortably inside
 *    a button opening range; the suit does nothing, and the puzzle says so.
 *    Table 118 scores flush draws and combo draws on separate rows, so a hand
 *    with a heart would not belong in the Gutshot row at all.
 *
 * 4. TABLE 118 IS CAPTIONED "UTG" AND BELONGS TO A BB-vs-BN EXAMPLE. The
 *    section header (p.695), Diagram 67's caption (p.696) and the prose on
 *    pp.696 and 698 all say BB vs BN, and p.698 reads "the BN's GTO strategy vs
 *    a flop x/r" off this very table. The preceding table, Table 117, is the
 *    BN's breakdown on 8♥6♦2♠ — so "UTG" reads as a carried-over misprint. This
 *    puzzle uses it as the BN table and discloses the discrepancy rather than
 *    silently picking a reading.
 *
 * 5. IT DOES NOT REPEAT THE J66 PUZZLE. min-bet-paired-j66 teaches SIZING on a
 *    paired board from p.690 and p.663. This one teaches how to READ a range's
 *    shape, from a different example with its own printed data — and p.698
 *    happens to contrast the two flops directly, which is cited as the link
 *    rather than as a second lesson.
 *
 * POT CONSTRUCTION: the book prints no preflop open size for its 40bb MTT
 * simulations (see `preflop.sizing-guidelines`). The 2.5bb open here is this
 * repo's standing assumption, matching every other puzzle in the set, so the
 * flop pot reads 5.5bb — 2.5 opened, 2.5 called, plus the folded small blind's
 * 0.5. Six-handed for that reason: heads-up would drop the dead half-blind and
 * make the chips on the felt wrong. The min-bet is 1bb, and the two-thirds bet
 * 3.7bb, of that displayed pot.
 */
export const DEPOLARIZED_RANGE_554: InteractivePuzzle = {
  id: 'depolarized-range-554',
  slug: 'the-range-made-of-good-hands',
  number: 10,
  title: 'The range made of good hands',
  topic: 'Range Structure',
  difficulty: 'advanced',
  description:
    'You open the button, the big blind calls, and the flop is a low paired board. Your hand is fine. So is almost everything else you hold — and that fact, not your two cards, decides what you do.',

  setup: {
    format: '40bb effective',
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['8s', '7s'],
    effectiveStackBb: 40,
    gameNotes:
      'MTT, single raised pot, no ante. Blinds 0.5 / 1. You opened the button to 2.5bb and the big blind called.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['5h', '5d', '4h'],
      // 2.5 opened + 2.5 called + the folded SB's 0.5 = 5.5bb.
      potBb: 5.5,
      // 40bb less the 2.5 you opened for.
      effectiveStackBb: 37.5,
      // Checked to, in position: nothing to call.
      toCallBb: 0,
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: '5♥ 5♦ 4♥ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      situation:
        'The flop is 5♥ 5♦ 4♥ and the big blind checks to you. You hold 8♠7♠: no pair, and no flush equity at all — the board has no spade, so the suit does nothing. What you have is a gutshot. Only a 6 makes your straight. The book puts a hand like this in its GOOD equity bucket on this board: Table 118 prints 58% hand-vs-range equity for gutshots here, which is at or above the 50% floor for Good and below the 75% floor for Strong (p.596). You are last to act with 37.5bb behind and 5.5bb in the middle.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'best',
          shortWhy:
            'Right, and the source says it in words as well as numbers: “gutshots mostly like to check back”. Table 118 has 52.7% of the gutshots in your range checking here — more than any single bet-size — and the same row prints 98% equity realization, so taking the free card costs you almost nothing.',
          sources: ['ex6.good-hands-gutshots-check', 'ex6.table118-gutshot', 'ex6.depolarized-distribution'],
        },
        {
          id: 'min-bet',
          label: 'Min-bet',
          historyText: 'Bets 1 bb (min)',
          tableAction: { label: 'Bets', betBb: 1 },
          verdict: 'defensible',
          shortWhy:
            'A real branch, and the right kind of bet: 21.3% of gutshots min-bet on this flop, and the book says paired boards should frequently be min-bet. It is simply the minority line — checking is used two and a half times more often with this hand class.',
          sources: ['ex6.table118-gutshot', 'ex4.paired-boards-min-bet', 'ex6.small-bets-when-depolarized'],
        },
        {
          id: 'bet-two-thirds',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb (2/3 pot)',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'mistake',
          shortWhy:
            'The one size the source rules out. Gutshots take 2/3-pot 0.4% of the time here and the button’s whole range only 0.5%, because “the BN doesn’t have a significant range advantage, hence the preference for the smaller bet-sizes” — and bigger sizes belong to polarized distributions, which this range is the opposite of.',
          sources: [
            'ex6.table118-gutshot',
            'ex6.table118-full-range',
            'ex6.depolarized-distribution',
            'ex6.small-bets-when-depolarized',
          ],
        },
      ],
      bestOptionId: 'check',
      explanation:
        'Check. (1) The action: checking back is the majority line for this hand — 52.7% of the gutshots in the button’s range check on this flop, against 25.2% at 1/3-pot, 21.3% min-bet and 0.4% at 2/3 (Table 118, p.697) — and the prose states it directly: “gutshots mostly like to check back” (p.697). (2) Why: not because 8♠7♠ is weak. It is a Good hand by the book’s own measure, 58% hand-vs-range equity, which is ≥50% and <75% (p.596) — and that is precisely the kind of hand p.696 says “will benefit from checking back the flop”. Its EQR of 98% says the same thing from the other side: in position, a free card lets this hand realize essentially all of its equity. (3) The range theory: 57% of the button’s range on this flop sits in that same Good bucket, with only 10% Strong and 9% Trash (Diagram 67, p.696). A range with its top and bottom thin and its middle heavy is what the book calls depolarized (p.78) — and “most of the BN range is made of good hands, giving a depolarized distribution that will result in a low c-bet frequency” (p.696). Your hand is not an exception to that range; it is a typical member of it. (4) Sizing and frequency: the book prints both. Across the whole range the button checks 40.6% of the flop, min-bets 22.8%, bets 1/3-pot 35.3%, and uses 2/3-pot 0.5% of the time (Table 118 Full Range row, p.697); by bucket, the Good hands check 45% (Diagram 68, p.696). The reason the big size is missing is stated as a rule on p.663: “small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands.” (5) The passage this all rests on, p.696: “On this flop, the BN doesn’t have a significant range advantage, hence the preference for the smaller bet-sizes. In fact, most of the BN range is made of good hands, giving a depolarized distribution that will result in a low c-bet frequency, as many good and weak hands in the BN’s range will benefit from checking back the flop.”',
      unsourced: [
        {
          question: 'How often exactly does 8♠7♠ check here?',
          answer:
            'The source does not say, and this is the one figure on the page that is genuinely missing. What Table 118 prints is the GUTSHOT CLASS — every gutshot combo in the button’s range averaged together, 5.7% of that range — so 52.7% is the class’s checking frequency, not this combo’s. The 58% equity is a class average too. The book prints no combo-by-combo chart for this flop, and interpolating one from the class row would be invented solver output.',
          nearestSources: ['ex6.table118-gutshot', 'ex6.good-hands-gutshots-check'],
        },
        {
          question: 'Why is 1/3-pot not one of the buttons, if the source uses it most?',
          answer:
            'Because this puzzle asks one question — check, small, or big — and three options are enough to ask it. But the omission should not mislead you: 1/3-pot is the most-used BETTING size both for this hand class (25.2% of gutshots) and for the button’s whole range (35.3%), a little ahead of the min-bet. The two small sizes together come to 46.5% for gutshots against 52.7% checking, so the honest summary is that betting small and checking are close, and betting big is not in the strategy at all. Choosing “Min-bet” here is choosing a small size, which is the distinction the spot turns on.',
          nearestSources: ['ex6.table118-gutshot', 'ex6.table118-full-range', 'ex6.cbet-by-eqb-554'],
        },
        {
          question: 'Where do the 2.5bb open and the 5.5bb pot come from?',
          answer:
            'From this implementation, not from these pages. Modern Poker Theory prints no preflop open size for the 40bb MTT simulations behind this chapter — its general pre-flop sizing guidance (p.175) is explicitly not the size those solutions were run at. A 2.5bb open is the standing assumption across this puzzle set, so the flop pot on screen is 2.5 opened plus 2.5 called plus the folded small blind’s 0.5 = 5.5bb, the min-bet is 1bb and the 2/3 bet is 3.7bb. Nothing in the answer depends on those numbers; the bucket data and the frequencies are the book’s.',
          nearestSources: ['preflop.sizing-guidelines', 'ex6.example-header'],
        },
      ],
      theory: [
        {
          id: 'what-depolarized-means',
          title: 'What “depolarized” actually means, in buckets',
          body:
            'A polarized range is nuts and air — strong hands and bluffs with little in between. Depolarized is its mirror image: “It has the top and bottom hands removed and is comprised of middle equity hands.” That is a shape, and equity buckets are how you measure it. Sort every hand in your range by its equity against the opponent’s range, drop it into one of four bins, and read the profile. On this flop the button’s profile is almost all one bin.',
          exhibit: {
            caption: 'Both ranges on 5♥5♦4♥, by equity bucket',
            scope:
              'Diagram 67 (p.696), BB vs BN at 40bb — the printed data labels on the two pies. Whole-range percentages: 57% is the share of the button’s range sitting in the Good bucket, not how often any hand does anything.',
            rows: [
              { label: 'BN — Strong (75%+)', value: '10%', pct: 10 },
              { label: 'BN — Good (50-75%)', value: '57%', pct: 57, note: 'the bulk of the range' },
              { label: 'BN — Weak (33-50%)', value: '24%', pct: 24 },
              { label: 'BN — Trash (<33%)', value: '9%', pct: 9 },
              { label: 'BB — Strong', value: '8%', pct: 8 },
              { label: 'BB — Good', value: '24%', pct: 24 },
              { label: 'BB — Weak', value: '33%', pct: 33 },
              { label: 'BB — Trash', value: '35%', pct: 35, note: 'the big blind’s bulk is at the bottom' },
            ],
            sources: ['ex6.bn-eqb-554', 'ex6.bb-eqb-554', 'eqb.definitions'],
          },
          bullets: [
            {
              text: 'The bucket boundaries are the book’s, and they are about hand-vs-RANGE equity: Strong is 75%+, Good is 50% to 75%, Weak is 33% to 50%, Trash is under 33%. A hand’s bucket therefore moves with the board and with the ranges in play — it is not a property of the two cards.',
              sources: ['eqb.definitions'],
            },
            {
              text: 'Read the button’s profile as a shape: 57% in one middle bin, and the two extremes thin at 10% and 9%. Top and bottom removed, middle heavy — the definition of depolarized, arrived at by counting rather than by feel.',
              sources: ['ex6.bn-eqb-554', 'ex6.depolarized-definition'],
            },
            {
              text: 'And read the big blind’s as the contrast: 8% strong, 35% trash. Its weight is at the ends. That is what “the BN doesn’t have a significant range advantage” looks like in numbers — the button has 55% equity to the big blind’s 45%, an edge, but not the kind that funds a big bet.',
              sources: ['ex6.bb-eqb-554', 'ex6.depolarized-distribution', 'ex6.table118-full-range'],
            },
          ],
          sources: ['ex6.depolarized-definition', 'eqb.definitions', 'ex6.bn-eqb-554'],
        },

        {
          id: 'rarely-and-small',
          title: 'Why that shape bets rarely, and bets small',
          body:
            'Two consequences follow from the profile, and the book states both. Rarely: a hand that is merely good has more to gain from seeing a free card in position than from charging a range that folds its trash anyway — “many good and weak hands in the BN’s range will benefit from checking back the flop.” Small: a big bet needs a polarized range behind it, with enough strong hands to make the size credible and enough trash to want the folds. This range has 10% and 9% of those. So the sizes that survive are the small ones.',
          exhibit: {
            caption: 'How often each equity bucket checks back on this flop',
            scope:
              'Diagram 68, "IP Cbet Frequency by EQB" (p.696) — the button’s strategy on 5♥5♦4♥ at 40bb, averaged within each bucket. Bucket averages, never a single hand. Only the Bet 1/3, Bet MIN and Check segments carry printed labels in this diagram; the two big sizes are read from Table 118 instead.',
            rows: [
              { label: 'Strong', value: '28%', pct: 28, note: 'trapping — 41% bet 1/3, 29% min' },
              { label: 'Good', value: '45%', pct: 45, note: 'the largest single branch — 31% bet 1/3, 23% min' },
              { label: 'Weak', value: '40%', pct: 40, note: '39% bet 1/3, 20% min' },
              { label: 'Trash', value: '28%', pct: 28, note: 'bluffs — 49% bet 1/3, 20% min' },
            ],
            sources: ['ex6.cbet-by-eqb-554'],
          },
          bullets: [
            {
              text: 'The whole-range figures, from Table 118’s Full Range row: check 40.6%, bet 1/3-pot 35.3%, min-bet 22.8%, bet 1/2-pot 0.8%, bet 2/3-pot 0.5%. Nearly six c-bets in ten, but essentially none of them big — the strategy is a low frequency spread across two small sizes.',
              sources: ['ex6.table118-full-range'],
            },
            {
              text: 'The rule behind it is general, not special to this flop: “small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands. In situations where IP’s range distribution is more polarized with a bigger proportion of strong, weak and trash hands, bigger bet-sizes are used more often.”',
              sources: ['ex6.small-bets-when-depolarized'],
            },
            {
              text: 'Notice which buckets check most: the two middle ones, at 45% and 40%. The extremes check least — strong hands trap and trash hands bluff, both of which want money in the pot. A range whose bulk is middling is therefore a range whose bulk wants to check.',
              sources: ['ex6.cbet-by-eqb-554', 'ex6.depolarized-distribution'],
            },
            {
              text: 'The paired board is doing part of the work: “paired boards should be frequently min-bet.” The book also gives the big blind’s side of it on this particular flop — unlike on J66, most of what would be its trash now holds a flush draw, an open-ender or a gutshot, and “this makes the BN c-bet the flop less frequently on 5♥5♦4♥”.',
              sources: ['ex4.paired-boards-min-bet', 'ex6.bb-less-polarized-lowers-cbet'],
            },
          ],
          unsourced: [
            {
              question: 'Is 59.4% really a “low” c-bet frequency?',
              answer:
                'That is the book’s own label, not this puzzle’s: the example is titled “Low c-bet % and small bet-size” (p.695). No baseline for comparison is printed alongside it. Chapter 12 does print a c-bet split for 5XX flops as a class (Diagram 44, p.661), but that is an average over every flop whose highest card is a five, blended across button and UTG openers — a different measurement from this flop’s own Table 118, and the subject of a different puzzle. No comparison is made here; the figures quoted are the ones printed for 5♥5♦4♥.',
              nearestSources: ['ex6.example-header', 'cbet.by-top-card', 'position.ch12-sim-scope'],
            },
            {
              question: 'The prose says good hands are c-bet ~59%, but the chart adds up to ~55%. Which is it?',
              answer:
                'Both are printed and neither is adjusted here. p.697 states “Good hands are c-bet ~59% of the time”; Diagram 68’s labelled Good-bucket segments are 31% at 1/3-pot, 23% min-bet and 45% checking, which leaves ~55% betting. The gap is about four points and the source does not reconcile it. It changes nothing about the answer — under either reading, checking is the largest single branch for the bucket, and for gutshots specifically Table 118 puts it at 52.7%.',
              nearestSources: ['ex6.good-hands-gutshots-check', 'ex6.cbet-by-eqb-554', 'ex6.table118-gutshot'],
            },
          ],
          sources: ['ex6.depolarized-distribution', 'ex6.small-bets-when-depolarized', 'ex6.table118-full-range'],
        },

        {
          id: 'this-hand-inside-the-bucket',
          title: 'Your hand, inside that bucket',
          body:
            'A range-level fact only helps if you can place your own hand in it. 8♠7♠ on 5♥5♦4♥ has no pair and no flush equity — the board has no spade — so what it holds is a gutshot to a 6, and the book scores that class at 58% equity against the big blind’s range. Above 50%, below 75%: Good. Not a hand looking for folds, not a hand needing protection, and not a hand that minds a free card. It is a typical member of the 57%, and it plays like one.',
          exhibit: {
            caption: 'What the button does with a gutshot on 5♥5♦4♥',
            scope:
              'Table 118 (p.697), the Gutshot row — every gutshot combo in the button’s range averaged together, 5.7% of that range. A class frequency, not a frequency for 8♠7♠. The table is captioned “UTG C-betting Range Breakdown” but belongs to a BB vs BN example; see the note below.',
            rows: [
              { label: 'Check', value: '52.7%', pct: 52.7, note: 'the majority line' },
              { label: 'Bet 1/3 pot', value: '25.2%', pct: 25.2, note: 'the most-used bet-size' },
              { label: 'Min-bet', value: '21.3%', pct: 21.3 },
              { label: 'Bet 1/2 pot', value: '0.5%', pct: 0.5 },
              { label: 'Bet 2/3 pot', value: '0.4%', pct: 0.4, note: 'effectively absent' },
            ],
            sources: ['ex6.table118-gutshot'],
          },
          bullets: [
            {
              text: 'The same table prints 98% EQR for this class — it realizes essentially all of its equity. That is the arithmetic behind “benefit from checking back”: in position, a check buys the turn cheaply, and this hand needs the turn.',
              sources: ['ex6.table118-gutshot', 'ex6.depolarized-distribution'],
            },
            {
              text: 'Good does not mean “play it one way”. The sentence that sends gutshots to a check sends mid pairs the other way in the same breath: “Mid pairs 66-99 are c-bet almost 100%, OESD gets mostly c-bet, gutshots mostly like to check back.” Same bucket, opposite actions — the bucket predicts the RANGE’s behaviour, and the hand-type note tells you where inside it you are.',
              sources: ['ex6.good-hands-gutshots-check'],
            },
            {
              text: 'Which is why this hand is a gutshot and not a pocket pair. The bucket claim for a gutshot needs no inference — 58% equity is printed, and 50-75% is Good. Table 118 files 66-99 under “Over Pair” at 77% equity, i.e. Strong, disagreeing with its own prose; there was no need to build a lesson on top of that.',
              sources: ['ex6.table118-gutshot', 'eqb.definitions', 'ex6.good-hands-gutshots-check'],
            },
          ],
          unsourced: [
            {
              question: 'Table 118 is captioned “UTG”. Is this really the button’s table?',
              answer:
                'It is, and the caption is the odd one out. The example this table belongs to is headed “BB vs BN on 5♥5♦4♥ (40bbs)” (p.695), Diagram 67’s caption on the facing page says BB vs BN, and p.698 reads “the BN’s GTO strategy vs a flop x/r” directly off this table. The table immediately before it, Table 117, is the BN’s breakdown on 8♥6♦2♠ — so “UTG” in 118’s caption reads as a carried-over misprint rather than a different simulation. This puzzle uses it as the BN table on the strength of the example it sits inside, and states the discrepancy rather than hiding it. If you prefer to distrust the table entirely, the answer does not change: the p.697 prose gives gutshots a check-back without any table at all.',
              nearestSources: ['ex6.example-header', 'ex6.table118-gutshot', 'ex6.good-hands-gutshots-check'],
            },
          ],
          sources: ['ex6.table118-gutshot', 'ex6.good-hands-gutshots-check', 'eqb.definitions'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bn-buckets-554',
      label: 'Button’s range on 5♥5♦4♥',
      headline: '57% good',
      kind: 'composition',
      seat: 'hero',
      description:
        'The shape the whole answer rests on. Over half the button’s range falls in the Good bucket — 50% to 75% hand-vs-range equity — with the extremes thin at 10% strong and 9% trash. Top and bottom removed, middle heavy: depolarized.',
      bars: [
        { label: 'Strong (75%+)', pct: 10 },
        { label: 'Good (50-75%)', pct: 57, note: 'the bulk of the range' },
        { label: 'Weak (33-50%)', pct: 24 },
        { label: 'Trash (<33%)', pct: 9 },
      ],
      unsourced: [
        {
          question: 'Can you show the 13×13 grid behind these buckets?',
          answer:
            'No — the book prints no per-hand chart for this flop. What it prints is this bucket split (Diagram 67), the strategy split by bucket (Diagram 68) and a per-hand-CLASS table with thirteen rows (Table 118). That is unusually rich for a single flop, and it still stops short of a combo-by-combo grid; drawing one would mean inventing solver output.',
          nearestSources: ['ex6.bn-eqb-554', 'ex6.cbet-by-eqb-554', 'ex6.table118-gutshot'],
        },
      ],
      sources: ['ex6.bn-eqb-554', 'eqb.definitions'],
    },
    {
      id: 'bb-buckets-554',
      label: 'Big blind’s range on 5♥5♦4♥',
      headline: '35% trash',
      kind: 'composition',
      seat: 'villain',
      description:
        'The other pie in Diagram 67, and the reason the button’s edge is slim. The big blind’s weight sits at the ends — 8% strong, 35% trash — so the button holds 55% equity to its 45%: an advantage, but not the significant one that would justify a large bet.',
      bars: [
        { label: 'Strong (75%+)', pct: 8 },
        { label: 'Good (50-75%)', pct: 24 },
        { label: 'Weak (33-50%)', pct: 33 },
        { label: 'Trash (<33%)', pct: 35, note: 'folds to any size' },
      ],
      sources: ['ex6.bb-eqb-554', 'ex6.table118-full-range', 'ex6.depolarized-distribution'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'A range made mostly of merely-good hands bets rarely, and bets small.',
  headlineSources: ['ex6.depolarized-distribution', 'ex6.small-bets-when-depolarized'],
  takeaways: [
    {
      text: 'Depolarized means the middle is heavy and the ends are thin. On 5♥5♦4♥ the button has 57% of its range in the Good bucket — 50% to 75% hand-vs-range equity — against 10% strong and 9% trash.',
      sources: ['ex6.bn-eqb-554', 'eqb.definitions', 'ex6.depolarized-definition'],
    },
    {
      text: 'That shape bets rarely: “most of the BN range is made of good hands, giving a depolarized distribution that will result in a low c-bet frequency, as many good and weak hands in the BN’s range will benefit from checking back the flop.” Across the whole range the button checks 40.6% of this flop.',
      sources: ['ex6.depolarized-distribution', 'ex6.table118-full-range'],
    },
    {
      text: 'And when it bets, it bets small: 35.3% of the range at 1/3-pot, 22.8% min-bet, and 0.5% at 2/3. Big sizes need a polarized range behind them — “small bets are preferred when IP’s range has this type of depolarized distribution”, and a paired board should frequently be min-bet.',
      sources: ['ex6.table118-full-range', 'ex6.small-bets-when-depolarized', 'ex4.paired-boards-min-bet'],
    },
    {
      text: 'Place your own hand in the shape rather than judging it alone. 8♠7♠ is a Good hand here at 58% equity, and Good hands of this type are exactly the ones that check: gutshots check 52.7% of the time on this flop and realize 98% of their equity doing it.',
      sources: ['ex6.table118-gutshot', 'ex6.good-hands-gutshots-check', 'eqb.definitions'],
    },
  ],

  xp: 55,

  endsEarlyBecause:
    'Flop only, because that is the decision the source solves. Flop Strategy Example 6 (pp.695-698) prints the button’s flop equity buckets, its c-bet split by bucket, a per-class table for this flop and its response to a 25%-pot check-raise. It prints nothing about how 8♠7♠ plays on a turn, so the hand stops where the evidence does rather than continuing into a street the book has not solved for it.',
}

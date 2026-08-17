import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 4 — "Why a paired board wants a tiny bet"
 * (BN c-bets J♠6♥6♦ after the BB checks, 40bb, flop only)
 *
 * ONE idea: a pair on the board caps how MUCH you can bet and simultaneously
 * raises how OFTEN you should bet. Size and frequency move in opposite
 * directions, and the pair is what moves them. Nothing else is taught here.
 *
 * The evidence is two pages of Modern Poker Theory and no more. p.690 is the
 * node — Flop Strategy Example 4, "Mid c-bet % and small bet-size: BB vs BN on
 * J♠6♥6♦ (40bbs)". p.663 is the texture rule the node instantiates: "Clearly,
 * paired boards should be frequently min-bet", plus the paragraph that says why.
 *
 * Four content decisions worth recording, each a place where the obvious version
 * of this puzzle would overstate what p.690 actually prints:
 *
 * 1. 72% IS AN OVERALL RANGE FREQUENCY, NOT THIS HAND'S. The sentence reads
 *    "a high overall c-bet frequency of 72%", and it describes the BN's entire
 *    range at once. Rendering it as "bet A♥Q♣ 72% of the time" would convert a
 *    range statistic into a per-hand instruction the book never gives. Every
 *    place the number appears — option, exhibit, takeaway, source scope — says
 *    which it is.
 *
 * 2. THE COMPOSITION FIGURES ARE NOT STRATEGY FIGURES. 14%, 23%, 8.9%, 5% and
 *    52% sit in the same short paragraph as the 72%, and every one of them is a
 *    share of a range rather than a frequency of an action. They are what makes
 *    the sizing argument work; they say nothing about how often anyone bets.
 *
 * 3. NO PER-HAND-CLASS BREAKDOWN IS GIVEN FOR THE BN ON THIS BOARD. Not from
 *    the pages this puzzle teaches from. The book does print one immediately
 *    afterwards (Table 116, pp.691-692), and the `UnsourcedNote` says so rather
 *    than implying no such data exists — but nothing from it is quoted,
 *    approximated or hinted at here, because this puzzle teaches one idea and
 *    that table is a different one.
 *
 * 4. THE PREFLOP SIZE IS A GAME ASSUMPTION. p.690 gives the stack depth and the
 *    seats and no bet-sizes, so the 2.5bb open and the 5.5bb flop pot are this
 *    repo's own convention, carried over from the 654r puzzle for consistency.
 *    Disclosed in the flow, because they come from outside the cited passages.
 *
 * The hero hand is A♥Q♣: two overcards on J♠6♥6♦ with no pair, no straight draw
 * and no backdoor flush draw. It was chosen precisely because it is unremarkable
 * — there is no per-hand claim to be tempted into, and the whole lesson can stay
 * where the source puts it, at the level of the range.
 */
export const MIN_BET_PAIRED_J66: InteractivePuzzle = {
  id: 'min-bet-paired-j66',
  slug: 'why-a-paired-board-wants-a-tiny-bet',
  number: 4,
  title: 'Why a paired board wants a tiny bet',
  topic: 'C-bet Sizing',
  difficulty: 'intermediate',
  description:
    'One flop decision on the button. The pair on the board is doing two things at once — it takes your big bet away, and it hands you a bet you can make almost every time.',

  setup: {
    format: '40bb effective',
    // Six-handed MTT. The folded small blind is where the extra half-blind in
    // the flop pot comes from; a heads-up table would lose it and make the 5.5bb
    // on screen wrong.
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['Ah', 'Qc'],
    effectiveStackBb: 40,
    gameNotes: 'MTT, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['Js', '6h', '6d'],
      // 2.5 (your open) + 2.5 (the BB's call) + 0.5 (the folded SB) = 5.5bb.
      potBb: 5.5,
      // 40 minus the 2.5 you opened for.
      effectiveStackBb: 37.5,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      situation:
        'You open the button to 2.5bb, the small blind folds and the big blind calls. The flop is J♠ 6♥ 6♦ — a paired board — and the big blind checks. You hold A♥Q♣: two overcards, no pair, no draw. There is 5.5bb in the middle and 37.5bb behind. Everything the source says about this flop describes the two RANGES, not this hand — it prints no frequency for any individual holding here.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'defensible',
          shortWhy:
            'Checking is a real branch — the button bets 72% of its range on this flop, so 28% of it goes back. But the source calls 72% a high overall c-bet frequency, and it is high precisely because a bet this small is available. Checking is the minority answer to a board built for the majority one.',
          sources: ['ex4.j66-cbet-72', 'ex4.j66-check-28'],
        },
        {
          id: 'min-bet',
          label: 'Min-bet',
          historyText: 'Bets 1 bb',
          tableAction: { label: 'Bets', betBb: 1 },
          verdict: 'best',
          shortWhy:
            'The book’s own heading for this node is “small bet-size”, and its rule for the texture is that paired boards should be frequently min-bet. The big blind holds more trip sixes than you do — 8.9% against 5% — so a large bet is not available. But 52% of the big blind’s range is trash that struggles against even a min-bet, so the smallest bet on the menu still does the whole job.',
          sources: ['ex4.j66-headline', 'ex4.j66-range-comparison', 'ex4.j66-cbet-72', 'ex4.paired-boards-min-bet'],
        },
        {
          id: 'bet-two-thirds',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'mistake',
          shortWhy:
            'The source rules this out in so many words: the button “cannot use a large sizing”. The pair is why — the big blind’s range holds 8.9% trip sixes to your 5%, so the player you would be building a pot against is the one better equipped to raise it. And the extra chips buy nothing, because the hands you fold out fold to a min-bet anyway.',
          sources: ['ex4.j66-cbet-72', 'ex4.j66-range-comparison', 'ex4.why-paired-boards-small'],
        },
      ],
      bestOptionId: 'min-bet',
      explanation:
        'Min-bet. The book titles this exact node “Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs)” (p.690), and states the texture rule behind it plainly: “Clearly, paired boards should be frequently min-bet” (p.663). The reason is a two-sided range fact the source gives in full here — the big blind’s range is very polar, with 14% strong hands against the button’s 23%, “not too far away”, and more importantly 8.9% trip sixes against the button’s 5%. The out-of-position player holds more of the board’s best hand than you do, so the big bet is off the table. What is still on the table is a tiny one: 52% of the big blind’s range is trash that “will struggle to continue against even a min-bet”. Those two facts together are what let the button run a 72% overall c-bet frequency on this flop — the frequency of the whole range, not of A♥Q♣. Checking is the other 28% and is not a blunder; betting 2/3 pot is, because the source says the button cannot size up here.',
      unsourced: [
        {
          question: 'How often should A♥Q♣ specifically bet on this flop?',
          answer:
            'The pages this puzzle teaches from do not say. 72% is stated as the button’s overall c-bet frequency — one number for the entire range — and the other percentages on p.690 (14, 23, 8.9, 5, 52) are range compositions, not frequencies of any action. No per-hand figure appears on that page for either player. The book does print a hand-class breakdown for the button on this board a page later (Table 116, pp.691-692); it is deliberately out of scope for this puzzle, which teaches the sizing idea only, and nothing from it is quoted or approximated anywhere here.',
          nearestSources: ['ex4.j66-cbet-72', 'ex4.j66-range-comparison'],
        },
        {
          question: 'Where do the 2.5bb open and the 5.5bb pot come from?',
          answer:
            'From this repo’s game assumptions, not from the cited passages. p.690 gives the seats, the flop and the 40bb stack depth and no bet-sizes at all, so the 2.5bb button open is carried over from the convention the other puzzles in this set use. The pot follows from it: 2.5 opened, 2.5 called, plus the folded small blind’s 0.5 makes 5.5bb, which puts a min-bet of 1bb at about 18% of the pot and a 2/3-pot bet at 3.7bb. The argument on this page does not depend on those numbers — it depends on which sizing is large and which is small.',
          nearestSources: ['ex4.j66-headline'],
        },
      ],
      theory: [
        {
          id: 'what-the-pair-does',
          title: 'What the pair on the board actually does',
          body:
            'A paired flop is not just a dry board. Pairing the six hands the big blind a specific kind of hand it would not otherwise have — every six in a wide calling range becomes trips — and the source treats that as the defining fact of the texture. The consequence runs in two directions at once, which is the whole point of this puzzle: the strong hands the pair creates sit on the out-of-position player’s side, so the in-position player loses access to big bets, while the same board leaves the out-of-position range full of hands that cannot call anything at all.',
          bullets: [
            {
              text: 'The rule, stated as a rule: “Clearly, paired boards should be frequently min-bet.” It is a claim about the texture as a class, which is what makes it transferable to paired boards you have never seen before.',
              sources: ['ex4.paired-boards-min-bet'],
            },
            {
              text: 'And the mechanism behind it: paired boards “give the BB a lot of strong hands, polarizing their range and allowing them some counterplay. This range polarization is one of the main reasons why betting very small is optimal on paired boards.”',
              sources: ['ex4.why-paired-boards-small'],
            },
            {
              text: 'Small bets are not a compromise here — they are the efficient tool. “Small bets force the BB to reveal a lot of information about their holding, as there are a lot of trash and weak hands the BB has to fold, regardless of IP’s bet-size, and IP loses the minimum when having to bet/fold the flop with the bottom of their range.” Regardless of bet-size is the operative phrase: paying more per bet buys you no extra folds.',
              sources: ['ex4.why-paired-boards-small'],
            },
            {
              text: 'The book’s own one-line label for this node says both halves out loud before any analysis begins: “Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs)”.',
              sources: ['ex4.j66-headline'],
            },
          ],
          sources: ['ex4.paired-boards-min-bet', 'ex4.why-paired-boards-small', 'ex4.j66-headline'],
        },

        {
          id: 'both-sides-of-the-same-flop',
          title: 'Both sides of the same flop — the rare case where the book prints them',
          body:
            'Most worked examples in this chapter describe one player’s range. This one describes both, and the comparison is what the sizing decision actually rests on. Read the strong-hand line first: 14% for the big blind against 23% for the button. The button is ahead — but only by nine points, and the source’s own word for the gap is that the two are “not too far away”. Then read the trips line, which reverses it: 8.9% for the big blind against 5% for the button. On the one hand class this board is built around, the player who has to act first has nearly twice as much of it as the player with position. That single reversal is what removes the large bet-size from the menu, and it is why a range advantage in aggregate does not automatically license a big bet.',
          exhibit: {
            caption: 'Range composition on J♠6♥6♦ — the two players side by side',
            scope:
              'BB vs BN on J♠6♥6♦ at 40bb effective. Every row is a share of a whole range, not the frequency of an action and not the frequency of any individual hand. These are the figures the sizing argument is built from; the strategy figure is in the next card.',
            rows: [
              {
                label: 'BB strong hands',
                value: '14%',
                pct: 14,
                note: 'the BB’s range on this flop is described as very polar',
              },
              { label: 'BN strong hands', value: '23%', pct: 23, note: '“not too far away” from the BB’s 14%' },
              { label: 'BB trip sixes', value: '8.9%', pct: 8.9, note: 'the reversal — nearly twice the button’s share' },
              { label: 'BN trip sixes', value: '5%', pct: 5 },
              {
                label: 'BB trash hands',
                value: '52%',
                pct: 52,
                note: 'will “struggle to continue against even a min-bet”',
              },
            ],
            sources: ['ex4.j66-range-comparison', 'ex4.j66-cbet-72'],
          },
          bullets: [
            {
              text: 'The source states the comparison directly: the BB has 14% strong hands to the BN’s 23%, and 8.9% trip sixes to the BN’s 5%. Both halves come from the same two sentences, which is why they can be set against each other honestly.',
              sources: ['ex4.j66-range-comparison'],
            },
            {
              text: 'The conclusion the book draws from it is the ceiling on your bet: “For this reason, the BN cannot use a large sizing.” The reason named is the trips, not the equity.',
              sources: ['ex4.j66-cbet-72'],
            },
            {
              text: 'And the floor under your bet is the other half of the same sentence: “the BB still has 52% trash hands that will struggle to continue against even a min-bet.” Half the range you are betting into cannot call the smallest bet in the game.',
              sources: ['ex4.j66-cbet-72'],
            },
          ],
          sources: ['ex4.j66-range-comparison', 'ex4.j66-cbet-72'],
        },

        {
          id: 'size-down-bet-more-often',
          title: 'Sizing and frequency are two dials, and the pair turns them opposite ways',
          body:
            'The intuitive link between the two dials is the wrong one. It is tempting to think a capped bet-size means a cautious strategy, and here it means the reverse: because the bet is cheap, it can be made with almost anything, so it gets made almost always. The source spells out the causal order — the trips force the size down, the 52% trash makes the small size effective, and the result is a high overall c-bet frequency of 72%. Note what that number is attached to. It is the button’s whole range on this flop, not a hand, not a hand class and not a sizing. It is the answer to “how much of my range bets here”, and the answer to “how often does this particular hand bet” is not printed on this page for anyone.',
          exhibit: {
            caption: 'The button’s flop strategy on J♠6♥6♦, whole range',
            scope:
              'BN vs BB on J♠6♥6♦ at 40bb effective, after the BB checks. Both figures describe the BN’s ENTIRE range at once. Neither is the frequency of A♥Q♣ or of any other single hand, and the page prints no split of the 72% across bet-sizes. The 72% is printed in the source; the 28% is its complement.',
            rows: [
              { label: 'C-bets (overall, whole range)', value: '72%', pct: 72, note: 'the source calls this a high overall c-bet frequency' },
              { label: 'Does not bet', value: '28%', pct: 28, note: '100 − 72; the book prints the 72%' },
            ],
            sources: ['ex4.j66-cbet-72', 'ex4.j66-check-28'],
          },
          bullets: [
            {
              text: 'The causal chain in the source’s own order: more trips for the BB → the BN cannot use a large sizing → but 52% of the BB’s range folds to even a min-bet → “This allows the BN to have a high overall c-bet frequency of 72%.” The word allows is the link between the two dials.',
              sources: ['ex4.j66-cbet-72'],
            },
            {
              text: '72% is an overall, whole-range figure. It does not say that A♥Q♣ bets 72% of the time, and it does not say that any hand class does — treating it as a per-hand instruction would turn a range statistic into advice the book never gives.',
              sources: ['ex4.j66-cbet-72'],
            },
            {
              text: 'The complement is the check: 28% of the button’s range takes the free card. That is arithmetic on the printed number, not a second figure from the source.',
              sources: ['ex4.j66-check-28'],
            },
            {
              text: 'This is why the general rule reads the way it does. “Frequently min-bet” is one instruction with two parts, and on a paired board the parts reinforce each other rather than trading off.',
              sources: ['ex4.paired-boards-min-bet'],
            },
          ],
          unsourced: [
            {
              question: 'How does the 72% break down by hand class for the button here?',
              answer:
                'Not on the pages this puzzle uses. p.690 prints the 72% as a single whole-range number and stops. The book does give a breakdown for this board on the pages immediately following (Table 116, pp.691-692), which this puzzle leaves out of scope so it teaches exactly one idea — no figure from it is quoted, rounded or gestured at anywhere in this puzzle. If you want the per-class picture, read it there rather than inferring it from the 72%: an overall frequency cannot be redistributed across hand classes by guessing.',
              nearestSources: ['ex4.j66-cbet-72'],
            },
          ],
          sources: ['ex4.j66-cbet-72', 'ex4.j66-check-28', 'ex4.paired-boards-min-bet'],
        },

        {
          id: 'the-passage',
          title: 'The passage this puzzle is built on',
          body:
            'Modern Poker Theory (Acevedo, 2019), p.690 — Flop Strategy Example 4, “Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs)”: “On this flop, the BB’s range is very polar and has a healthy number of strong hands at 14%, not too far away from the BN’s 23%. More specifically, the BB’s range has 8.9% trip sixes, while the BN only has 5%. For this reason, the BN cannot use a large sizing, but the BB still has 52% trash hands that will struggle to continue against even a min-bet. This allows the BN to have a high overall c-bet frequency of 72%.” And the texture rule it instantiates, p.663: “Clearly, paired boards should be frequently min-bet.” Those two passages are the entire evidence base for this puzzle. Every claim above traces to one of them, and where they run out, the amber panels say so.',
          bullets: [
            {
              text: 'p.690 — the node: range composition for both players, the ceiling on the bet-size, and the 72% overall c-bet frequency.',
              sources: ['ex4.j66-headline', 'ex4.j66-range-comparison', 'ex4.j66-cbet-72'],
            },
            {
              text: 'p.663 — the rule and its mechanism: paired boards should be frequently min-bet, because pairing gives the big blind strong hands, polarizes their range, and leaves trash that folds regardless of your bet-size.',
              sources: ['ex4.paired-boards-min-bet', 'ex4.why-paired-boards-small'],
            },
          ],
          sources: ['ex4.j66-headline', 'ex4.j66-range-comparison', 'ex4.j66-cbet-72', 'ex4.paired-boards-min-bet'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'j66-strong-hands-both',
      label: 'Strong hands on J♠6♥6♦ — both ranges',
      kind: 'composition',
      seat: 'both',
      description:
        'The comparison the sizing decision rests on. In aggregate strong hands the button is ahead, 23% to 14%, and the source’s own reading of that gap is “not too far away”. On trip sixes specifically the order reverses: the big blind has 8.9% and the button only 5%. These are shares of each whole range, not frequencies of any action.',
      bars: [
        { label: 'BN strong hands', pct: 23, note: 'the in-position range' },
        { label: 'BB strong hands', pct: 14, note: '“not too far away” from the button’s 23%' },
        { label: 'BB trip sixes', pct: 8.9, note: 'the reversal that caps the bet-size' },
        { label: 'BN trip sixes', pct: 5 },
      ],
      sources: ['ex4.j66-range-comparison'],
    },
    {
      id: 'j66-bb-trash',
      label: 'Big blind trash on J♠6♥6♦',
      headline: '52%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'The other half of the sentence that caps your bet-size, and the half that pays for the strategy. Over half the big blind’s range on this flop is trash that “will struggle to continue against even a min-bet” — so the smallest bet available already collects the folds a big one would, which is exactly why the big one is not needed.',
      sources: ['ex4.j66-cbet-72'],
    },
    {
      id: 'j66-bn-cbet',
      label: 'Button c-bet frequency on J♠6♥6♦',
      headline: '72%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'What the small size buys: the button can bet 72% of its entire range on this flop. Read it as a property of the range, not an instruction for a hand — it is the answer to “how much of my range bets here”, and the remaining 28% checks.',
      unsourced: [
        {
          question: 'Can you show which hands make up the 72%?',
          answer:
            'Not from the pages this puzzle teaches from. p.690 gives 72% as a single whole-range figure with no per-hand or per-class split, and no per-sizing split either. A breakdown for this exact board is printed a page later (Table 116, pp.691-692) and is out of scope here by design, so this puzzle claims the aggregate the source states and stops there rather than distributing 72% across hand classes by inference.',
          nearestSources: ['ex4.j66-cbet-72', 'ex4.j66-check-28'],
        },
      ],
      sources: ['ex4.j66-cbet-72', 'ex4.j66-check-28'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'A pair on the board takes your big bet away and gives you a tiny one you can make almost every time.',
  headlineSources: ['ex4.paired-boards-min-bet', 'ex4.j66-cbet-72'],
  takeaways: [
    {
      text: 'On a paired flop, min-bet. The book states it as a rule for the texture as a whole — “Clearly, paired boards should be frequently min-bet” — and labels this exact spot “Mid c-bet % and small bet-size”.',
      sources: ['ex4.paired-boards-min-bet', 'ex4.j66-headline'],
    },
    {
      text: 'The ceiling on your bet comes from trips, not equity. The big blind has 8.9% trip sixes to the button’s 5% — so even though the button leads in aggregate strong hands, 23% to 14%, “the BN cannot use a large sizing”.',
      sources: ['ex4.j66-range-comparison', 'ex4.j66-cbet-72'],
    },
    {
      text: 'The floor under your bet comes from the other side of the range: 52% of the big blind’s hands are trash that “will struggle to continue against even a min-bet”. You are not sizing down to save money — the small bet already collects everything the big one would.',
      sources: ['ex4.j66-cbet-72', 'ex4.why-paired-boards-small'],
    },
    {
      text: 'Cheap bets get made often: those two facts together let the button c-bet 72% of the time on this flop, with 28% checking. That 72% is the frequency of the whole range — not of A♥Q♣, and not of any hand class, neither of which this page gives a figure for.',
      sources: ['ex4.j66-cbet-72', 'ex4.j66-check-28'],
    },
    {
      text: 'The transferable version: a pair on the board hands strong hands to the out-of-position player, polarizes their range, and leaves trash that folds “regardless of IP’s bet-size”. Whenever that shape appears, size down and bet more often.',
      sources: ['ex4.why-paired-boards-small', 'ex4.paired-boards-min-bet'],
    },
  ],

  xp: 50,

  endsEarlyBecause:
    'This is a flop sizing question and the source answers it on the flop. p.690 describes the button’s c-betting decision on J♠6♥6♦ and stops; it gives no turn or river strategy for this hand, and this puzzle teaches one idea rather than following the hand into streets the cited passages do not cover.',
}

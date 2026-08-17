import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 5 — "The flop where simplifying is free" (UTG vs BB, A♥Q♦3♠, 40bb)
 *
 * ONE idea: on this board you can throw away the mixed strategy, bet 100% of
 * your range for 2/3-pot, and give up nothing at all — while the SAME 100%
 * simplification at 1/3-pot costs real money. That asymmetry is the lesson.
 * The puzzle is the book's own Flop Strategy Example 1 (p.682), played from
 * IP's seat, and it stops on the flop because that is where the example does.
 *
 * THE TRAP THIS PUZZLE IS BUILT AROUND, stated plainly because it is the one
 * error that would look authoritative:
 *
 *   "Simplifying the strategy to c-bet 100% for 1/3-pot bet-size loses 1.07%
 *   of the pot, or 6.6bb/100" (p.683) is a measurement of a SIMPLIFICATION
 *   APPLIED TO A WHOLE RANGE. It is not the EV loss of betting 1/3-pot with
 *   K♠J♠, or with any other hand. Attaching it to the two cards on screen
 *   would be a fabrication with a correct page number under it — the most
 *   convincing kind. Every place the figure appears here is scoped, the
 *   decision carries an UnsourcedNote saying so, and a test asserts it.
 *
 * WHY THE HERO HAND IS INCIDENTAL. Diagram 58 is a chart image; the book
 * prints no per-combo frequency for this flop, and this puzzle claims none.
 * K♠J♠ is a routine early-position open that flops nothing — a gutshot to
 * Broadway and a backdoor spade draw — precisely so the answer cannot be read
 * off the hand's strength. The learner is meant to arrive at "bet big" from
 * the range facts, which is how the source arrives at it too.
 *
 * FOUR SOURCE PASSAGES BEYOND THE HEADLINE RESULT, all verified verbatim
 * against docs/mpt_fulltext.txt, all serving the one objective:
 *   p.684  why the big size is the free one — the BB 3-bets AA/QQ/AK preflop,
 *          so its flop range has no nutted hands and UTG captures 85% of the
 *          pot. This is the mechanism; without it the EV numbers are a
 *          conclusion with no argument.
 *   p.726  the defender's side of the identical match-up: 70% trash, 10% weak,
 *          trash averaging 16% equity against pot odds of 20%. The book's own
 *          words for what that permits — UTG "can get away with c-betting
 *          their entire range".
 *   p.656  never c-betting costs IP 26bb/100 across the chapter's dataset,
 *          which is why Check is graded a mistake rather than a small leak.
 *   p.680  the general rule linking the two: lots of trash in their range →
 *          high frequency, few strong hands → size up.
 *
 * MONEY (blinds 0.5/1, 40bb effective, six-handed, no ante). The 2.5bb open is
 * an implementation decision carried over from puzzles 1 and 2 — the book gives
 * no open size for this example — and is disclosed in the flow.
 *   preflop  UTG opens 2.5, BB calls, SB's 0.5 is dead
 *   flop     pot 5.5, hero has 37.5 behind
 *            1/3-pot = 1.8bb   2/3-pot = 3.7bb
 */
export const CBET_SIMPLIFY_AQ3: InteractivePuzzle = {
  id: 'cbet-simplify-aq3',
  slug: 'the-flop-where-simplifying-is-free',
  number: 5,
  title: 'The flop where simplifying is free',
  topic: 'Flop C-bet',
  difficulty: 'intermediate',
  description:
    'One flop decision from UTG on A♥Q♦3♠. Playing a perfect mixed strategy here is optional — but only if you pick the right size to simplify to. One of the two costs nothing at all; the other costs 6.6bb/100.',

  setup: {
    format: 'MTT, 40bb effective',
    // Six-handed, so the folded small blind's dead 0.5bb is accounted for.
    tableSize: 6,
    heroSeat: 'UTG',
    villainSeat: 'BB',
    heroCards: ['Ks', 'Js'],
    effectiveStackBb: 40,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop',
      street: 'flop',
      board: ['Ah', 'Qd', '3s'],
      // 2.5 (UTG open) + 2.5 (BB call) + 0.5 (folded SB) = 5.5bb.
      potBb: 5.5,
      effectiveStackBb: 37.5,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      situation:
        'You opened UTG and only the big blind called. The flop is A♥Q♦3♠ — ace-high and rainbow — and the big blind checks to you. You hold K♠J♠: no pair, a gutshot to Broadway and a backdoor spade draw, with 5.5bb in the middle and 37.5bb behind.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'This is the one flop where a checking range buys you nothing. The source states that c-betting 100% for 2/3-pot retains ALL of IP’s EV here — so whatever the check is protecting, it is not protecting any money.',
          sources: ['aq3.simplification-ev', 'cbet.check-back-costs', 'cbet.axx-96'],
        },
        {
          id: 'bet-third',
          label: 'Bet 1/3 pot',
          historyText: 'Bets 1.8 bb (1/3 pot)',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'defensible',
          shortWhy:
            'Betting is right and this is a size the solver genuinely uses — the book even offers 1/3-pot as the default when you are unsure of your range’s strategy. But as the size you standardise on, this is the expensive one: 1.07% of the pot, or 6.6bb/100.',
          sources: ['aq3.simplification-ev', 'cbet.default-third-pot'],
        },
        {
          id: 'bet-two-thirds',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb (2/3 pot)',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'best',
          shortWhy:
            'The source’s own result: c-betting 100% of the range for 2/3-pot retains all of IP’s EV on this flop. You get the simple strategy for free — and the big size is what the big blind’s range, 70% trash with no nutted hands, actually deserves.',
          sources: ['aq3.simplification-ev', 'aq3.no-nutted-hands', 'aq3.bb-trash-16-equity'],
        },
      ],
      bestOptionId: 'bet-two-thirds',
      explanation:
        'Bet 2/3 pot. The book solves this exact spot — “High c-bet % and big bet-size: BB vs UTG on A♥Q♦3♠ (40bb)”, Flop Strategy Example 1 (p.682) — and reports that “simplifying the strategy to c-bet 100% using the 2/3-pot bet-size retains all of IP’s EV”, while “simplifying the strategy to c-bet 100% for 1/3-pot bet-size loses 1.07% of the pot, or 6.6bb/100” (p.683). Both figures describe a simplification applied to your WHOLE RANGE, not to K♠J♠; the book prints no frequency for any individual hand here. The reason the range can bet everything is the big blind’s range, not yours: on AQ3r it is “70% trash hands and 10% weak hands”, and those trash hands average 16% equity against pot odds of 20% (p.726). The reason it can bet BIG is that the big blind 3-bets AA, QQ and AK preflop, so “this lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot” (p.684). Checking is the real error: it declines a bet the source says costs nothing to make.',
      unsourced: [
        {
          question: 'How often should you bet K♠J♠ specifically, and how much does checking IT cost?',
          answer:
            'Neither is stated in the source, and this puzzle claims neither. The 1.07% of the pot and 6.6bb/100 figures measure a simplification applied to IP’s ENTIRE RANGE — they are the price of standardising every hand on the 1/3-pot size, not the EV loss of one hand making one bet. The per-hand strategy lives in Diagram 58, which is a chart image; the book prints no combo-by-combo frequency for this flop. What can honestly be said is what the passage says: across the range, betting 100% for 2/3-pot gives up nothing at all.',
          nearestSources: ['aq3.simplification-ev', 'aq3.example-header'],
        },
        {
          question: 'Does the book say UTG opens K♠J♠ at 40bb in an MTT?',
          answer:
            'Not in these pages. Chapter 12’s flop work is built on “standard GTO MTT starting ranges” (p.655) without printing them, and the preflop charts the book does print are the 6-max cash and BB-defence ranges elsewhere. K♠J♠ is chosen as an ordinary early-position open that flops nothing, precisely so the answer does not rest on it — the finding here is about the whole range, and the hand is along for the ride.',
          nearestSources: ['position.ch12-sim-scope', 'aq3.example-header'],
        },
        {
          question: 'Where do the 2.5bb open and the 5.5bb pot come from?',
          answer:
            'From this project, not from the source. The book names the spot as “BB vs UTG on A♥Q♦3♠ (40bb)” and gives no preflop open size for it, so the 2.5bb open, the 0.5 dead small blind and therefore the 5.5bb flop pot are an implementation decision, carried over from the other 40bb puzzles here so the money is consistent across the set. Nothing in the answer depends on it: 1/3-pot and 2/3-pot are ratios, and the book’s EV figures are quoted as a percentage of the pot and in bb/100.',
          nearestSources: ['aq3.example-header'],
        },
      ],
      theory: [
        {
          id: 'simplifying-is-free',
          title: 'The result: one size is free, the other is not',
          body:
            'Solver output on a flop like this looks intimidating — several sizes, each used some fraction of the time. The useful question is not “can I reproduce that?” but “what does it cost me if I don’t?”. The book answers it directly for this board, and the answer is that the cost depends entirely on which size you collapse onto. Standardise your whole range on 2/3-pot and you lose nothing measurable. Standardise that same range on 1/3-pot and you have chosen to pay 6.6bb/100 for the convenience.',
          exhibit: {
            caption: 'What each simplification costs IP on A♥Q♦3♠',
            scope:
              'Flop Strategy Example 1, p.683 — BB vs UTG, 40bb. Every row is a strategy applied across IP’s ENTIRE RANGE. None of these numbers is the EV of an individual hand, and the book prints no per-combo frequency for this flop.',
            rows: [
              {
                label: 'C-bet 100%, 2/3-pot',
                value: 'no EV lost',
                note: 'the source’s words: “retains all of IP’s EV”',
              },
              {
                label: 'C-bet 100%, 1/3-pot',
                value: '−1.07% of pot',
                note: 'the same figure expressed as a rate: 6.6bb/100',
              },
              {
                label: 'Adding a 120% overbet',
                value: 'used 14.45%, no extra EV',
                pct: 14.45,
                note: 'the solver takes the option and gains nothing by it',
              },
            ],
            sources: ['aq3.simplification-ev'],
          },
          bullets: [
            {
              text: 'The spot is the book’s own worked example, named in its heading as a high c-bet % AND big bet-size flop — the two properties this puzzle is about, printed together in the title.',
              sources: ['aq3.example-header'],
            },
            {
              text: 'Read the two costs as one sentence about simplification, not two facts about sizes. Betting 1/3-pot is not a 1.07% mistake; standardising your whole range on 1/3-pot is.',
              sources: ['aq3.simplification-ev'],
            },
            {
              text: 'Checking is the branch with no case for it here. Across the chapter’s dataset, an IP player who always checks back the flop loses 26bb/100 — and on this specific board the source has already said a 100% c-bet gives up nothing, so there is no EV for a checking range to recover.',
              sources: ['cbet.check-back-costs', 'aq3.simplification-ev'],
            },
            {
              text: 'The board family agrees: Axx flops are the second most c-bet flops in the book’s data, at a 96% c-bet frequency. That is an average over every Axx flop at 20-40bb, not a measurement of A♥Q♦3♠ — cited for the direction, not as this flop’s number.',
              sources: ['cbet.axx-96', 'position.ch12-sim-scope'],
            },
          ],
          sources: ['aq3.simplification-ev', 'aq3.example-header'],
        },

        {
          id: 'why-the-big-size',
          title: 'Why it is the BIG size that comes for free',
          body:
            'Nothing about K♠J♠ explains this. The whole argument is about the two ranges, and it has two halves. First, the big blind has almost nothing: on AQ3r its range is 70% trash and 10% weak, and those trash hands hold 16% equity against a bet laying them 20% — so calling is losing money for most of the range, whatever size you pick. Second, and this is the half that chooses the size: the big blind cannot have the nuts. It 3-bet AA and QQ preflop every time and AK most of the time, so the hands that would punish a big bet are simply not in the range that reached this flop. Betting small against a range that cannot raise you and cannot call you is leaving the pot on the table.',
          exhibit: {
            caption: 'The big blind’s side of A♥Q♦3♠',
            scope:
              'BB vs UTG at 40bb on AQ3r, from the C-bet Defense chapter (p.726) — the same match-up and stack depth as Flop Strategy Example 1, seen from the defender’s seat. The 58/42 split is the BB’s response to the 1/3-pot size specifically.',
            rows: [
              { label: 'Trash hands in the BB’s range', value: '70%', pct: 70 },
              { label: 'Weak hands', value: '10%', pct: 10 },
              {
                label: 'Average equity of those trash hands',
                value: '16%',
                pct: 16,
                note: 'against pot odds of 20% laid by a 1/3-pot bet',
              },
              {
                label: 'BB defends vs 1/3-pot',
                value: '42%',
                pct: 42,
                note: 'folding 58% — nowhere near the 75% MDF suggests',
              },
            ],
            sources: ['aq3.bb-trash-16-equity', 'aq3.bb-defends-42'],
          },
          bullets: [
            {
              text: 'The source states the mechanism for the size outright: the big blind 3-bets AA and QQ always and AK most of the time preflop, and “this lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot”.',
              sources: ['aq3.no-nutted-hands'],
            },
            {
              text: 'It is also the book’s general rule, stated for all flops: if your opponent has a lot of trash you should c-bet at a high frequency and expect many folds, and if they have very few strong hands compared to you, you should size up. This board is that rule with the numbers filled in.',
              sources: ['cbet.size-up-vs-trash', 'aq3.bb-trash-16-equity'],
            },
            {
              text: 'How far it goes: on this flop the big blind folds 58% against even the SMALL bet, and the author writes that UTG “can get away with c-betting their entire range and there is nothing the BB can do to stop them from having a profitable bet with any two cards”.',
              sources: ['aq3.bb-defends-42'],
            },
            {
              text: 'And the obvious worry about betting every hand does not materialise: at equilibrium IP should face a flop check-raise only about 5% of the time here.',
              sources: ['aq3.xr-frequency'],
            },
          ],
          unsourced: [
            {
              question: 'What is the other 20% of the big blind’s range?',
              answer:
                'Not broken out on p.726. The passage names two buckets — 70% trash and 10% weak — and leaves the remaining fifth unlabelled in that sentence. It is not filled in here by inference. The argument only needs what is printed: most of the range is trash, and the strong hands that would punish a big bet were 3-bet preflop.',
              nearestSources: ['aq3.bb-trash-16-equity', 'aq3.no-nutted-hands'],
            },
          ],
          sources: ['aq3.no-nutted-hands', 'aq3.bb-trash-16-equity'],
        },

        {
          id: 'used-is-not-profitable',
          title: 'A size the solver uses can still be worth nothing',
          body:
            'The most useful sentence on p.683 is the one that is easiest to skim past. Given a 120% overbet as an option, the solver picks it up and uses it 14.45% of the time — a substantial slice of a strategy, the kind of number that gets quoted as proof that you must overbet on ace-high boards. The book then says it plainly: this does not generate any extra EV to IP. The solver is indifferent, and an indifferent option used at a real frequency looks identical, in a chart, to an option that is making you money. Frequency is not evidence of value. That is why the answer to this puzzle is a simplification you can defend on EV grounds, and not the fanciest line available.',
          bullets: [
            {
              text: 'Verbatim: “If we give IP the option to use a 120% overbet, the solver will use it 14.45% of the time, although this does not generate any extra EV to IP.”',
              sources: ['aq3.simplification-ev'],
            },
            {
              text: 'The practical reading: when a strategy chart shows an exotic size at a visible frequency, the question to ask is what removing it would cost — not how often it appears. On this flop, removing it costs nothing, and removing the 1/3-pot size costs nothing either, so long as what remains is the 2/3-pot bet.',
              sources: ['aq3.simplification-ev'],
            },
            {
              text: 'It also explains why 1/3-pot is graded here as defensible rather than wrong. It is a real size in the solver’s strategy, and the book’s own fallback advice is to default to 1/3-pot when you are unsure of your range’s strategy — it is only when you make it your whole strategy on THIS board that the 6.6bb/100 shows up.',
              sources: ['cbet.default-third-pot', 'aq3.simplification-ev'],
            },
          ],
          sources: ['aq3.simplification-ev'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-range-aq3',
      label: 'Big blind’s range on A♥Q♦3♠',
      kind: 'composition',
      seat: 'villain',
      description:
        'The reason a 100% c-bet works. Seven hands in ten are trash, and those trash hands hold 16% equity against pot odds of 20% — so most of this range is losing money by continuing, even against the small bet.',
      bars: [
        { label: 'Trash', pct: 70, note: 'averaging 16% equity vs UTG' },
        { label: 'Weak', pct: 10 },
      ],
      unsourced: [
        {
          question: 'Why do the bars only add up to 80%?',
          answer:
            'Because that is all the source labels. p.726 names 70% trash and 10% weak on AQ3r and does not break out the remaining 20% in that passage. The gap is left visible rather than filled with a plausible-looking number.',
          nearestSources: ['aq3.bb-trash-16-equity'],
        },
      ],
      sources: ['aq3.bb-trash-16-equity', 'aq3.bb-defends-42'],
    },
    {
      id: 'utg-range-aq3',
      label: 'What UTG captures on A♥Q♦3♠',
      headline: '85%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'UTG’s range has 72% equity on this flop and captures 85% of the pot — it over-realizes, which is the definition of a board you are allowed to play aggressively. The book attributes it to one thing: the big blind 3-bet AA, QQ and AK preflop, so it arrives on this flop without nutted hands and cannot make a big bet expensive.',
      unsourced: [
        {
          question: 'Can you show UTG’s c-betting range hand by hand?',
          answer:
            'Not from what the book prints in text. The per-hand strategy for this flop is Diagram 58 and Table 113 — a chart and a table of images — and the figures printed in words are whole-range: 72% equity, 85% of the pot, and the EV cost of each simplification. No combo-by-combo frequency is claimed anywhere in this puzzle.',
          nearestSources: ['aq3.no-nutted-hands', 'aq3.simplification-ev'],
        },
      ],
      sources: ['aq3.no-nutted-hands'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'On A♥Q♦3♠ you can c-bet 100% of your range for 2/3-pot and lose nothing — the same simplification at 1/3-pot costs 6.6bb/100.',
  headlineSources: ['aq3.simplification-ev', 'aq3.example-header'],
  takeaways: [
    {
      text: 'The source’s result, in its own words: simplifying your whole range to c-bet 100% for the 2/3-pot size “retains all of IP’s EV”, while the same simplification at 1/3-pot “loses 1.07% of the pot, or 6.6bb/100”.',
      sources: ['aq3.simplification-ev'],
    },
    {
      text: 'Both figures describe a simplification applied to the WHOLE range. Neither is the EV of one hand making one bet, and the book prints no per-combo frequency for this flop — so the lesson is about which size you standardise on, never about K♠J♠.',
      sources: ['aq3.simplification-ev'],
    },
    {
      text: 'Why the range can bet everything: on AQ3r the big blind’s range is 70% trash and 10% weak, and its trash hands average 16% equity against pot odds of 20% — it folds 58% even against the small bet.',
      sources: ['aq3.bb-trash-16-equity', 'aq3.bb-defends-42'],
    },
    {
      text: 'Why the big size is the free one: the big blind 3-bets AA, QQ and AK preflop, so its flop range has no nutted hands — which lets IP bet big across multiple streets, over-realize 72% equity and capture 85% of the pot.',
      sources: ['aq3.no-nutted-hands', 'cbet.size-up-vs-trash'],
    },
    {
      text: 'And the habit worth keeping: a size the solver uses is not automatically a size that pays. Given a 120% overbet here the solver takes it 14.45% of the time and gains no extra EV — so judge an option by what removing it costs, not by how often it appears.',
      sources: ['aq3.simplification-ev'],
    },
  ],

  xp: 35,

  endsEarlyBecause:
    'The source stops here, so the puzzle does. Flop Strategy Example 1 is a flop analysis: it prints the EV of each flop simplification, the range comparison behind it and the response to a flop check-raise, and then moves on to the next example without solving a turn. Continuing this hand past the flop would mean inventing the very thing the whole puzzle is about not inventing.',
}

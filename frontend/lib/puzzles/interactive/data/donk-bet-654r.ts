import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 1 — "When should the BB lead?" (BB vs BN, 654r, 30bb)
 *
 * Every frequency, percentage, sizing and strategic claim below traces to
 * Modern Poker Theory's donk-bet chapter (pp. 631-652) via an id in
 * ../sources.ts. Three content decisions are worth recording here, because each
 * one is a place where the obvious version of this puzzle would have been wrong:
 *
 * 1. 7♠6♠ ON 6♣5♦4♠ IS NOT A STRAIGHT. It is top pair (sixes) with the best
 *    available kicker plus an open-ended straight draw — 3 or 8 completes it.
 *    The source settles this itself: p.641 enumerates the straights on this
 *    flop as 32, 87 and 73, and 76 is not among them. This matters beyond
 *    pedantry, because "straight" would put the hand in the STRONG bucket
 *    (bet 73%) when it actually sits in GOOD (bet 64%), and the source's
 *    per-category note for this exact flop — top pairs with an OESD bet at the
 *    highest frequency inside their group — is the sharper, more specific
 *    justification anyway.
 *
 * 2. THE FAMOUS 654r WALKTHROUGH IS BB vs UTG, NOT BB vs BN. The book's
 *    per-category numbers for this flop (strong 77% / good 70% / weak 61%) come
 *    from a BB vs UTG sim at 30bb (p.641). This puzzle is BB vs BN, where the
 *    same chapter gives a materially different aggregate donk frequency — 53%
 *    vs the BN against 67% vs UTG (p.640). Presenting the UTG numbers as the
 *    answer here would be a fabrication of exactly the kind that is hardest to
 *    catch, so the UTG figures appear only where they are labelled as UTG, and
 *    the primary frequencies come from the 30-40bb high-donk-board aggregate
 *    (p.639) which does cover BB vs BN.
 *
 * 3. NO EXACT COMBO FREQUENCY EXISTS FOR THIS HAND. The source gives bucket-
 *    level frequencies, not per-combo frequencies for BB vs BN on 654r. The
 *    puzzle says so, in the flow, rather than manufacturing a decimal.
 *
 * POT CONSTRUCTION: the book prints the flop pot for this exact spot as 5.6bb
 * (p.650) but never prints the preflop open size that produced it. The 2.5bb
 * open here is an implementation decision — the standard open closest to
 * reproducing that pot — and the table therefore reads 5.5bb (2.5 + 2.5 + the
 * folded SB's 0.5). The 0.1bb gap is stated in the preflop step rather than
 * papered over: the alternative is either inventing a 2.55bb open to hit 5.6
 * exactly, or printing a pot the chips on the felt visibly contradict. Sizings
 * are quarter- and two-thirds-pot of the displayed number.
 *
 * TABLE SIZE: six-handed, not heads-up. The source's setup is a single raised
 * pot that folds around to the button, and that folded small blind is exactly
 * where the extra half-blind in the pot comes from. Rendering it heads-up would
 * drop the dead 0.5 and make the arithmetic on screen wrong.
 */
export const DONK_BET_654R: InteractivePuzzle = {
  id: 'donk-bet-654r',
  slug: 'when-should-the-bb-lead',
  number: 1,
  title: 'When should the BB lead?',
  topic: 'Donk Bet',
  difficulty: 'intermediate',
  description:
    'You defend the big blind, flop top pair with a straight draw, and land on the single flop the solver leads more often than any other. Knowing why is what makes the bet repeatable.',

  setup: {
    format: '30bb effective',
    // Six-handed, not heads-up. The book's sim is a single raised pot that folds
    // around to the button — which is where the dead small blind in the flop pot
    // comes from. A heads-up table would quietly lose that half-blind and make
    // the pot arithmetic on screen wrong.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['7s', '6s'],
    effectiveStackBb: 30,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'preflop',
      street: 'preflop',
      board: [],
      potBb: 4,
      effectiveStackBb: 30,
      // 2.5 (button) + 1 (your posted blind) + 0.5 (folded SB) = 4bb in the middle.
      // You are in for 1 and the bet is TO 2.5, so the call costs 1.5 — not 2.5.
      facingBetBb: 2.5,
      heroInvestedBb: 1,
      toCallBb: 1.5,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      situation:
        'It folds to the button, who opens to 2.5bb. The small blind folds. You are in the big blind with 30bb behind and 1.5bb more to call.',
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds'],
      question: 'What do you do with 7♠6♠?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Far too tight. At this exact depth the book has the big blind continuing with a 64% range against the button — a suited connector sits comfortably inside a range that wide.',
          sources: ['preflop.bn-open-bb-call-30bb', 'preflop.bb-call-composition-100bb'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.5 bb',
          tableAction: { label: 'Calls', betBb: 2.5 },
          verdict: 'best',
          shortWhy:
            'This is the book’s own reference spot: a 49% button open met by a 64% big blind calling range at 30bb, and suited connectors are named as part of what the big blind calls against a button.',
          sources: ['preflop.bn-open-bb-call-30bb', 'preflop.bb-call-composition-100bb'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: 'Raises to 7.5 bb',
          tableAction: { label: 'Raises to', betBb: 7.5 },
          verdict: 'mistake',
          shortWhy:
            'The source gives this no support. Where it describes the big blind’s non-all-in 3-betting range it is polarized around JJ+, the strongest suited aces and the best premium suited connectors — 7♠6♠ is none of those, and it names connectors as calls instead.',
          sources: ['preflop.bb-3bet-composition-25bb', 'preflop.bb-3bet-value-40bb', 'preflop.bb-call-composition-100bb'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. The book builds its whole 654r analysis on this precise preflop setup — the button opening a standard GTO 49% range at 30bb, the big blind defending with a standard 64% calling range. A 64% range is most suited hands, offsuit aces, connectors and broadways; 7♠6♠ is squarely inside it. The 3-betting range at these depths is polarized around hands 7♠6♠ is not among, and folding a suited connector to a button open at 30bb throws away a defend the solver takes.',
      unsourced: [
        {
          question: 'Does the book print a per-hand chart for BB vs BN at 30bb?',
          answer:
            'No. It prints the 64% aggregate for this spot in prose, and full per-hand charts at 25bb (call 65.9%) and 40bb (call 58.6%) — but nothing at 30bb. This puzzle does not interpolate between those two charts, because a hand-by-hand range invented between two printed ones is invented solver output.',
          nearestSources: ['preflop.bb-vs-bn-25bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
        },
        {
          question: 'Where does the 2.5bb open size come from, and why does the pot read 5.5bb?',
          answer:
            'From this implementation, not the book. The source states the flop pot for this spot is 5.6bb but never states the preflop open size behind it. A 2.5bb open is the standard size closest to reproducing that pot: 2.5 from the button, 2.5 from you, plus the folded small blind’s 0.5 makes 5.5bb. The table shows 5.5 because that is what the action on screen actually adds up to — inventing an open size that hit 5.6 exactly, or printing a pot the visible chips contradict, would both be worse than a transparent 0.1bb gap. Bet sizings are quarter and two-thirds of the displayed pot.',
          nearestSources: ['value.table-104'],
        },
      ],
      theory: [
        {
          id: 'preflop-reference-spot',
          title: 'The reference spot the whole analysis is built on',
          body:
            'The donk-bet chapter does not treat 654r as an isolated puzzle — it fixes one preflop configuration and then solves every flop from it. That configuration is this one, which is why the flop material that follows applies directly to the hand you are holding rather than approximately.',
          exhibit: {
            caption: 'BB vs BN preflop, 30bb effective',
            scope:
              'Stated directly for this matchup and stack depth. These are whole-range frequencies, not the frequency of any individual hand.',
            rows: [
              { label: 'Button opening range', value: '49%', pct: 49 },
              { label: 'Big blind calling range', value: '64%', pct: 64 },
            ],
            sources: ['preflop.bn-open-bb-call-30bb'],
          },
          bullets: [
            {
              text: 'A 64% defending range is described as most suited hands, offsuit aces, connectors and broadways — the button’s range is wide enough that the big blind can call far more than against any other position.',
              sources: ['preflop.bb-call-composition-100bb'],
            },
            {
              text: 'The printed charts either side of 30bb agree with a defence this wide: the big blind calls 65.9% at 25bb and 58.6% at 40bb against a button open.',
              sources: ['preflop.bb-vs-bn-25bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
            },
            {
              text: 'The 3-betting range at these depths is polarized — JJ+, the strongest suited aces, the best premium suited connectors, and some offsuit blocker hands — and at 40bb the value half is 99+, ATs+ and AJ+.',
              sources: ['preflop.bb-3bet-composition-25bb', 'preflop.bb-3bet-value-40bb'],
            },
          ],
          sources: ['preflop.bn-open-bb-call-30bb'],
        },
      ],
    },

    /* ────────────────────────────────────────────────────────────────── */

    {
      id: 'flop',
      street: 'flop',
      board: ['6c', '5d', '4s'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      // First to act on a checked-to street: nothing to call.
      toCallBb: 0,
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '6♣ 5♦ 4♠ — pot 5.5 bb' },
      ],
      situation:
        'The flop comes 6♣ 5♦ 4♠ — rainbow. You have top pair with the best kicker and an open-ended straight draw: any 3 or 8 makes your straight. You act first.',
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds', 'Hero calls'],
      postflopAction: [],
      question: 'What is your preferred action?',
      options: [
        {
          id: 'donk-25',
          label: 'Bet 25% pot',
          historyText: 'Bets 1.4 bb',
          tableAction: { label: 'Bets', betBb: 1.4 },
          verdict: 'best',
          shortWhy:
            'On high-donk boards at 30-40bb the book has the big blind betting good hands 64% of the time, and 1/4-pot is the most used size. Top pair with an open-ender is the part of that bucket that bets most often.',
          sources: ['family.high-donk-bucket-frequencies', 'example.654r-utg-top-pair', 'sizing.stack-depth'],
        },
        {
          id: 'donk-67',
          label: 'Bet 67% pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'defensible',
          shortWhy:
            'A real part of the strategy, but the minority one: at 30-40bb the 2/3-pot lead is used about 5% of the time. It is the preferred size at 20bb, where the shorter stack wants folds and flop all-ins — not at 30bb.',
          sources: ['family.high-donk-bucket-frequencies', 'sizing.stack-depth'],
        },
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'defensible',
          shortWhy:
            'Not a blunder — good hands still check 36% of the time here, and the checking range needs strong and good hands to stay protected. But it is the minority branch, and it hands the button a free turn it is happy to take.',
          sources: ['family.high-donk-bucket-frequencies', 'checking.range-protection', 'donk.654r-denies-eqr'],
        },
      ],
      bestOptionId: 'donk-25',
      explanation:
        'Lead small. 7♠6♠ is top pair with an open-ended straight draw — a good hand, not a strong one, since the straights on this flop are 32, 87 and 73. At 30-40bb on high-donk-frequency boards the book bets good hands 64% of the time, and the most used size by a distance is 1/4-pot. On 654r specifically it adds that among top pairs, the ones with the highest kickers and the ones with an open-ender bet at the highest frequency — which is exactly this hand. The small size is also what lets you call a raise and see a turn instead of committing the stack on the flop.',
      unsourced: [
        {
          question: 'How often exactly does 7♠6♠ lead here?',
          answer:
            'The book does not provide an exact frequency for this specific combo. It gives frequencies by equity bucket, not by hand, and its only per-category walkthrough of 654r is a BB vs UTG simulation rather than the BB vs BN spot you are in. What can be said from the source is the direction: this hand sits in the bucket that bets 64%, in the sub-group the source singles out as betting most often within it.',
          nearestSources: ['family.high-donk-bucket-frequencies', 'example.654r-utg-top-pair'],
        },
      ],
      theory: [
        {
          id: 'why-654r-favours-bb',
          title: 'Why does 654r favour the BB?',
          body:
            'Raw equity is the smaller half of the answer — the big blind’s edge on this flop is 51% to 49%, which on its own would not justify leading into the preflop aggressor. What justifies it is how the two ranges are shaped. The button’s range is wide and, on a board of small connected cards, most of it has turned into hands that flopped nothing much and would like to see a turn for free. Two overcards that dominate preflop are close to worthless here.',
          exhibit: {
            caption: 'Range shape on 654r',
            scope:
              'Equity is range-vs-range on this flop. The bucket percentages are the BB vs IP distribution on 654r averaged over 20bb/30bb/40bb; the button’s 51% weak figure is from the BB vs BN 30bb simulation.',
            rows: [
              { label: 'BB equity vs BN equity', value: '51% vs 49%' },
              { label: 'BB strong hands', value: '7%', pct: 7 },
              { label: 'BN strong hands', value: '4%', pct: 4 },
              { label: 'BB good hands', value: '40%', pct: 40, note: 'up from 17% on A76r' },
              { label: 'BB trash hands', value: '18%', pct: 18, note: 'down from 49% on A76r' },
              { label: 'BN weak hands', value: '51%', pct: 51, note: 'BB vs BN 30bb sim' },
            ],
            sources: ['eq.654r-vs-a76r', 'buckets.654r', 'position.654r-bn-weak-hands'],
          },
          bullets: [
            {
              text: 'Every ace the button holds averages 49% equity on this board — its overcards are effectively weak hands, not the range-topping holdings they are on an ace-high flop.',
              sources: ['buckets.654r-ax-devalued'],
            },
            {
              text: 'Because the bulk of the button’s range is weak and plays badly against a check-raise, the button lowers its c-betting frequency and checks back to take a free turn — it can only bet about 48% of the time after you check.',
              sources: ['donk.654r-denies-eqr', 'position.654r-ip-cbet'],
            },
            {
              text: 'Leading takes that free card away: the button must fold or put money in with hands that wanted to check behind. That is what "denying equity realization" means in practice.',
              sources: ['donk.654r-denies-eqr'],
            },
            {
              text: 'And the lead is hard to punish. The button raises a 1/4-pot lead only 20% of the time on 654r, against 53% on A76r — it lacks the strong hands to raise for value and the material to bluff-raise with.',
              sources: ['donk.654r-ip-raise-frequency'],
            },
            {
              text: 'The overall shape is the big blind polarized against a depolarized button, with half the button’s range weak — the book compares it to the Clairvoyance Toy game, where the polarized player is the one who wants to bet.',
              sources: ['family.high-donk-polarity'],
            },
          ],
          sources: ['eq.654r-vs-a76r', 'buckets.654r', 'donk.654r-denies-eqr'],
        },

        {
          id: 'donk-frequencies',
          title: 'Donk betting on high-frequency boards',
          body:
            'These are the frequencies that drive the answer. Read the scope line carefully: they describe the strategy across the whole family of boards the solver leads most, at 30-40bb — not one hand, and not 654r on its own.',
          exhibit: {
            caption: 'Donk bet frequency by equity bucket',
            scope:
              'GENERAL strategy across all high-donk-frequency boards at 30-40bb, aggregated over BB vs BN and BB vs UTG. This is not the frequency of any individual hand, and not a 654r-specific number.',
            rows: [
              { label: 'Strong hands', value: '73%', pct: 73 },
              { label: 'Good hands', value: '64%', pct: 64, note: '7♠6♠ is here — top pair, not a straight' },
              { label: 'Weak hands', value: '59%', pct: 59 },
              { label: 'Trash hands', value: '49%', pct: 49 },
            ],
            sources: ['family.high-donk-bucket-frequencies'],
          },
          bullets: [
            {
              text: '1/4-pot is the most used donk size at 30-40bb; the 2/3-pot lead is used about 5% of the time.',
              sources: ['family.high-donk-bucket-frequencies'],
            },
            {
              text: 'Size tracks stack depth. At 20bb the 2/3-pot lead is preferred, because the big blind is happy to stack off on the flop and the bigger bet both wins folds and gets the money in while its equity is high. Deeper, few hands want a flop all-in, so the small lead is better — it lets the big blind call a raise and see the turn without committing.',
              sources: ['sizing.stack-depth'],
            },
            {
              text: 'On 654r itself the source adds that among top pairs, the highest kickers and the ones holding an open-ender bet at the highest frequency — though note that walkthrough is the BB vs UTG simulation, not BB vs BN.',
              sources: ['example.654r-utg-top-pair', 'example.654r-utg-buckets'],
            },
            {
              text: 'Board family matters too: the high-donk group is 7-x-x and 6-x-x flops with one to three possible flopped straights, and rainbow boards like this one are led more often than two-tone, with monotone led far less.',
              sources: ['family.high-donk-flops'],
            },
          ],
          unsourced: [
            {
              question: 'Why not just use the 654r numbers — strong 77%, good 70%, weak 61%?',
              answer:
                'Because those are the BB vs UTG simulation at 30bb, and you are facing a button. The same chapter puts the average donk frequency on these boards at 67% against UTG but 53% against the button, precisely because a button’s wider range misses this texture less often. Borrowing the UTG frequencies for a button spot would overstate how often you should be leading.',
              nearestSources: ['example.654r-utg-buckets', 'donk.frequency-by-opener'],
            },
          ],
          sources: ['family.high-donk-bucket-frequencies', 'sizing.stack-depth'],
        },

        {
          id: 'what-leading-is-worth',
          title: 'What the lead is actually worth',
          body:
            'The chapter measures this directly, on exactly this flop and matchup, by re-solving with the big blind’s leading option removed. It is worth seeing the size of the number, in both directions: leading is genuinely better here, and it is also not the difference between winning and losing at poker.',
          exhibit: {
            caption: 'Cost of removing the BB’s lead on 654r',
            scope: 'BB vs BN, 654r, 30bb effective — the GTO solution against a forced 100%-check simulation. Flop pot 5.6bb.',
            rows: [
              { label: 'Share of pot lost', value: '1.1%' },
              { label: 'In bb/100', value: '6.5bb/100' },
              { label: 'Equity realization lost', value: '2.25%' },
            ],
            sources: ['value.table-104'],
          },
          bullets: [
            {
              text: 'For contrast, on A76r the big blind should lead about 0.4% of the time, and removing the option entirely costs nothing — the whole gain here comes from the board, not from leading being clever.',
              sources: ['value.difficulty-caveat', 'contrast.a76r'],
            },
            {
              text: 'The author’s own caveat: high-frequency donk boards are a small number of rarely-occurring flops, so a simplified always-check strategy is not a disaster, and donk betting is hard to implement correctly in game.',
              sources: ['value.difficulty-caveat'],
            },
            {
              text: 'Across all flops the big blind leads only about 2% of the time while the button c-bets 84% — this board is the exception, and treating it as the rule is the more expensive mistake.',
              sources: ['donk.baseline-frequencies'],
            },
          ],
          sources: ['value.table-104'],
        },

        {
          id: 'why-not-axx',
          title: 'Why this board and not an ace-high one',
          body:
            'The clearest way to hold on to this is the contrast the chapter itself draws. 654r is the flop the solver leads most; A76r is one of the flops it leads least. The two boards share small cards and connectivity — what separates them is who the top of the board belongs to.',
          exhibit: {
            caption: '654r against A76r',
            scope: 'Both figures are BB vs IP on the named flop. Raise frequencies are against a 1/4-pot lead.',
            rows: [
              { label: 'Donk frequency, 654r', value: '67%', pct: 67 },
              { label: 'Donk frequency, A76r', value: '0.3%', pct: 0.3 },
              { label: 'BB equity, 654r', value: '51%', pct: 51 },
              { label: 'BB equity, A76r', value: '38%', pct: 38 },
              { label: 'IP raise vs lead, 654r', value: '20%', pct: 20 },
              { label: 'IP raise vs lead, A76r', value: '53%', pct: 53 },
            ],
            sources: ['donk.654r-is-highest', 'eq.654r-vs-a76r', 'contrast.a76r', 'donk.654r-ip-raise-frequency'],
          },
          bullets: [
            {
              text: 'On A76r the button holds 31% strong hands to the big blind’s 8%. Leading there does not deny equity realization — it gets raised, and the big blind ends up putting money in with the hands that wanted a cheap turn.',
              sources: ['buckets.654r', 'contrast.a76r'],
            },
            {
              text: 'As a general rule the source puts trips, monotone, high-card paired, disconnected two-tone, HXX and AXX flops in the no-lead group, where a 100% checking frequency is recommended.',
              sources: ['contrast.no-donk-flops'],
            },
          ],
          sources: ['donk.654r-is-highest', 'contrast.a76r'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bn-open',
      label: 'Button opening range',
      headline: '49%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'The standard GTO button opening range the book uses for this 30bb spot. It is a whole-range percentage, stated in prose — the source does not print a hand-by-hand chart of it at this depth.',
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from this source. Modern Poker Theory prints per-hand button and big blind charts at other stack depths, but for the 30bb BB vs BN configuration it gives the 49% and 64% aggregates only. Drawing a grid would mean choosing which specific hands are in it, and that choice would be ours, not the book’s.',
          nearestSources: ['preflop.bb-vs-bn-25bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
        },
      ],
      sources: ['preflop.bn-open-bb-call-30bb'],
    },
    {
      id: 'bb-call',
      label: 'Big blind calling range',
      headline: '64%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'What the big blind continues with against that 49% open at 30bb. The book describes a defence this wide against a button as most suited hands, offsuit aces, connectors and broadways — which is where 7♠6♠ enters the hand.',
      unsourced: [
        {
          question: 'Is that composition specific to 30bb?',
          answer:
            'No — the "suited hands, offsuit aces, connectors and broadways" description is written about the 100bb button chart. It is cited here for the shape of the range, never for a frequency at 30bb. The 64% figure itself is stated for 30bb directly.',
          nearestSources: ['preflop.bb-call-composition-100bb', 'preflop.bn-open-bb-call-30bb'],
        },
      ],
      sources: ['preflop.bn-open-bb-call-30bb', 'preflop.bb-call-composition-100bb'],
    },
    {
      id: 'bb-postflop',
      label: 'Big blind range on 6♣5♦4♠',
      kind: 'composition',
      seat: 'hero',
      description:
        'How the big blind’s calling range breaks down by equity bucket once this flop lands. This is the postflop range data the book does print for 654r, and it is what actually drives the decision — more than raw equity does.',
      bars: [
        { label: 'Strong', pct: 7 },
        { label: 'Good', pct: 40, note: 'top pair and better-but-not-nutted; 7♠6♠ is here' },
        { label: 'Weak', pct: 35, note: 'derived: the four buckets partition the range, so 100 − 7 − 40 − 18' },
        { label: 'Trash', pct: 18 },
      ],
      sources: ['buckets.654r'],
    },
    {
      id: 'bn-postflop',
      label: 'Button range on 6♣5♦4♠',
      kind: 'composition',
      seat: 'villain',
      description:
        'The two figures the source prints for the button’s range on this flop. They come from two different tables and do not form a complete four-bucket partition — shown side by side rather than as one distribution, because that is how the book gives them.',
      bars: [
        { label: 'Strong', pct: 4, note: 'BB vs IP buckets on 654r, averaged over 20/30/40bb' },
        { label: 'Weak', pct: 51, note: 'BB vs BN 30bb simulation, from the button’s perspective' },
      ],
      unsourced: [
        {
          question: 'What about the button’s good and trash hands?',
          answer:
            'The source does not print a complete four-bucket breakdown for the button on this flop. Filling in the remaining 45% would mean splitting a number the book never split.',
          nearestSources: ['buckets.654r', 'position.654r-bn-weak-hands'],
        },
      ],
      sources: ['buckets.654r', 'position.654r-bn-weak-hands'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: '654r is one of the boards where the big blind can lead aggressively.',
  headlineSources: ['donk.654r-is-highest', 'value.table-104'],
  takeaways: [
    {
      text: 'The big blind has relatively more of the hands worth betting: 7% strong against the button’s 4%, with good hands rising to 40% on this texture.',
      sources: ['buckets.654r'],
    },
    {
      text: 'Half the button’s range is weak — hands that would rather check behind and see a free turn, including every ace it holds.',
      sources: ['position.654r-bn-weak-hands', 'buckets.654r-ax-devalued'],
    },
    {
      text: 'Leading denies that cheap equity realization, and it is hard to punish: the button raises a 1/4-pot lead only 20% of the time here.',
      sources: ['donk.654r-denies-eqr', 'donk.654r-ip-raise-frequency'],
    },
  ],

  xp: 50,

  endsEarlyBecause:
    'The book’s 654r analysis is a flop analysis. It gives no turn or river strategy for this BB vs BN spot, so the hand stops at the decision the source can actually answer rather than inventing one.',
}

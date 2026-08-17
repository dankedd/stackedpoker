import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 14 — "The same range, the other seat" (654r, 30bb)
 *
 * ONE idea: what position alone is worth, measured by holding the range fixed
 * and moving the seat. Modern Poker Theory runs that experiment itself in "The
 * Power of Position" (pp.651-653), and this puzzle is that experiment and
 * nothing else.
 *
 * Four content decisions worth recording, because each is a place the obvious
 * version of this puzzle would have been wrong:
 *
 * 1. THIS IS NOT A REAL SPOT, AND THE PUZZLE MUST NOT LET IT LOOK LIKE ONE.
 *    p.651 defines the setup as a "Modified solution where the players' ranges
 *    are flipped, so now OOP has the BN range and the IP Player has the BB
 *    range." A button that acts first on the flop heads-up in a single raised
 *    pot cannot happen. That is the whole point — it is the only way to isolate
 *    position from range — but a learner who takes 9.23% away as "how often the
 *    button leads 654r" has learned something false. So the hypothetical is
 *    named in the description, the setup notes, the situation line, the action
 *    strip, the explanation, every option's feedback and the scope of every
 *    citation in the `flip.*` group.
 *
 * 2. 48% AND 9.23% ARE THE SAME RANGE ON THE SAME BOARD. They sit in adjacent
 *    sentences on p.652 and describe the identical 49% BN range on the identical
 *    flop against the identical 64% BB range. Only the seat differs. Presenting
 *    them as two different strategies rather than one strategy priced twice
 *    would destroy the only thing this puzzle teaches.
 *
 * 3. THE ANSWER IS A FREQUENCY, NOT A HAND READ. The source gives a whole-range
 *    betting frequency of 9.23%. It does not give per-combo frequencies for this
 *    node, and the puzzle says so rather than manufacturing one. A♣Q♦ is
 *    illustrative — a concrete member of the 51% of Hero's range the book calls
 *    weak on this flop (p.652), with p.634's note that every ace in the BN's
 *    range averages 49% equity here. Nothing in the answer depends on it.
 *
 * 4. THE OPTIONS ARE THE SOURCE'S OWN BET-SIZE MENU. p.651 states the modified
 *    solve runs with "new flop bet-sizings for both players: 1.25-pot, 2/3-pot,
 *    1/4-pot". The three answers are check, the size the book names as most used
 *    when Hero does bet (125%), and the size it explicitly demotes once position
 *    is gone (2/3). The 1/4-pot size is left out because the source says nothing
 *    about it on 654r in the flipped solve, and an option the book cannot grade
 *    is not an option worth offering.
 *
 * POT CONSTRUCTION: identical to DONK_BET_654R and disclosed the same way. The
 * book prints 5.6bb for this flop (p.650) without printing the open size behind
 * it; 2.5 + 2.5 + the folded SB's 0.5 = 5.5bb is the standard open closest to
 * reproducing it, and the 0.1bb gap is stated rather than closed by inventing a
 * 2.55bb raise. Bet sizings are two-thirds and 125% of the displayed pot.
 *
 * SEAT RENDERING: heroSeat is BTN, which is accurate for the hand as dealt —
 * preflop really did happen with Hero on the button. The book's flip applies to
 * the flop only ("Now imagine the positions are flipped on the flop"), so the
 * dealer button in front of Hero and Hero acting first on the flop are both
 * correct, and the contradiction between them IS the experiment.
 */
export const POSITION_FLIP_654R: InteractivePuzzle = {
  id: 'position-flip-654r',
  slug: 'the-price-of-position',
  number: 14,
  title: 'The same range, the other seat',
  topic: 'Position',
  difficulty: 'advanced',
  description:
    'The book takes the button’s range, leaves it completely unchanged, and makes it act first on the flop. Nothing about the cards moves. Everything about the strategy does — and the gap between the two is what position is worth.',

  setup: {
    format: '30bb effective',
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['Ac', 'Qd'],
    effectiveStackBb: 30,
    gameNotes:
      'MODIFIED SIMULATION. Preflop is real: you opened the button, the big blind called. On the flop the book flips who acts first while both players keep their original ranges — so you hold the button’s 49% range with no position. This cannot happen at a table; it is the book’s own thought experiment, built to price position with range held constant. A♣Q♦ is illustrative only — the question is about the range.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'flop-oop-with-btn-range',
      street: 'flop',
      board: ['6c', '5d', '4s'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      // Nothing in front of you: in the flipped solve you are the first player
      // to act on this street.
      toCallBb: 0,
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: '6♣ 5♦ 4♠ — pot 5.5 bb' },
        { street: 'flop', actor: '', text: 'Positions flipped — you are first to act' },
      ],
      situation:
        'You opened the button with a standard 49% range and the big blind called with a standard 64% range. The flop is 6♣ 5♦ 4♠ — rainbow. Now the book flips the experiment: both players keep the exact ranges they just built, but you are the one who has to act first. This is a modified simulation, not a seat you can be dealt — it exists so the effect of position can be measured with the ranges held still.',
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: [],
      question: 'You hold the button’s range, but you are out of position. What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'best',
          shortWhy:
            'In the flipped solve the button’s range bets only 9.23% of the time on this flop — so it checks the overwhelming majority. In position, the same range on the same board bets about 48% after the big blind checks. Nothing changed but the seat.',
          sources: ['flip.654r-oop-frequency', 'position.654r-ip-cbet', 'flip.654r-checking-range-protection'],
        },
        {
          id: 'overbet-125',
          label: 'Overbet 125% pot',
          historyText: 'Bets 6.9 bb',
          tableAction: { label: 'Bets', betBb: 6.9 },
          verdict: 'defensible',
          shortWhy:
            'The right size, at the wrong frequency. When this range does bet out of position, 125% is the size the book names as most used — but the total betting frequency is 9.23%, so this is the minority branch by a wide margin.',
          sources: ['flip.654r-oop-frequency', 'flip.two-street-game'],
        },
        {
          id: 'bet-67',
          label: 'Bet 2/3 pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'mistake',
          shortWhy:
            'The size that loses its job when position goes. The book says the 67% size is used more often in position because it sets up an effective triple barrel — and that out of position parts of this range only want a two-street game, going all-in on the turn instead. It names the 125% overbet as the most used size here, not this one.',
          sources: ['flip.two-street-game', 'flip.654r-oop-frequency', 'flip.experiment-definition'],
        },
      ],
      bestOptionId: 'check',
      explanation:
        'Check. On p.652 the book prints both halves of this comparison one sentence apart, for the same range on the same flop: “with position, Hero can only bet about 48% of the time after the BB checks. When Hero is OOP with the BN’s range on this flop, the total betting frequency drops down to 9.23% and the most used bet-size is the 125% overbet.” Betting is not deleted — it is compressed into roughly a tenth of the range, and when it does happen it comes as an overbet rather than the two-thirds size that works in position. So checking is the answer at frequency, and the 125% overbet is the size to reach for on the rare occasions you are not checking.',
      unsourced: [
        {
          question: 'How often exactly does A♣Q♦ check here?',
          answer:
            'The book does not say. 9.23% is a whole-range betting frequency for the flipped solve; the source prints no per-combo frequencies for this node, and no strong/good/weak/trash split of it either. A♣Q♦ is shown only as a concrete member of the 51% of this range the book calls weak on this flop — every ace in the button’s range averages 49% equity on 654r. The answer would be the same with any two cards, because the question is about the range.',
          nearestSources: ['flip.654r-oop-frequency', 'position.654r-bn-weak-hands', 'buckets.654r-ax-devalued'],
        },
        {
          question: 'Why does the pot read 5.5bb when the book prints 5.6bb?',
          answer:
            'Because the book states the flop pot for this spot without ever stating the preflop open size behind it. A 2.5bb open is the standard size closest to reproducing it: 2.5 from you, 2.5 called, plus the folded small blind’s 0.5 makes 5.5bb, which is what the chips on the felt actually add up to. Inventing a 2.55bb open to hit 5.6 exactly would be worse than a disclosed 0.1bb gap. The two bet-sizes offered are two-thirds and 125% of the displayed pot.',
          nearestSources: ['value.table-104', 'flip.experiment-definition'],
        },
      ],
      theory: [
        {
          id: 'the-experiment',
          title: 'What this experiment is — and what it is not',
          body:
            'Two things normally change at once when you compare a button to a blind: the seat and the range. That makes the effect of position impossible to read off a normal solve. So the book removes one of the two variables. It runs the real preflop — button opens 49%, big blind calls 64% — and then re-solves the flop with the players’ positions swapped and their ranges untouched. Hero ends up out of position holding the button’s range. No table can deal that. It is a measuring instrument, and the number it produces is the price of the seat.',
          exhibit: {
            caption: 'The button’s 49% range on 654r — the same range, priced twice',
            scope:
              'BB vs BN, 654r, 30bb effective. The 48% figure is the real GTO solve, after the big blind checks to the button. The 9.23% figure is the MODIFIED "positions flipped" solve, with the identical range acting first. Both are whole-range frequencies, not per-hand frequencies.',
            rows: [
              { label: 'Bets, in position (real solve)', value: '48%', pct: 48, note: 'after the BB checks' },
              { label: 'Bets, out of position (flipped solve)', value: '9.23%', pct: 9.23 },
              { label: 'Checks, out of position', value: '90.77%', pct: 90.77, note: 'derived: 100 − 9.23' },
              { label: 'Most used size when betting OOP', value: '125% overbet' },
            ],
            sources: ['position.654r-ip-cbet', 'flip.654r-oop-frequency', 'flip.hero-oop-with-bn-range'],
          },
          bullets: [
            {
              text: 'The book’s own definition: “Modified solution where the players’ ranges are flipped, so now OOP has the BN range and the IP Player has the BB range.” The same paragraph fixes the three flop bet-sizes available to both players at 1.25-pot, 2/3-pot and 1/4-pot — which is where the answer choices above come from.',
              sources: ['flip.experiment-definition'],
            },
            {
              text: '“Now imagine the positions are flipped on the flop, but both players keep their original ranges.” The ranges are the ones the real preflop built — a 49% button open, a 64% big blind call at 30bb.',
              sources: ['flip.hero-oop-with-bn-range', 'preflop.bn-open-bb-call-30bb'],
            },
            {
              text: 'Even in position, this is not a board the button gets to bet freely: it has a range disadvantage on 654r, so betting the whole range risks a check-raise that would destroy its equity, and the frequency is already held down to about 48%.',
              sources: ['position.654r-ip-cbet'],
            },
            {
              text: 'When the flipped range does bet, it is aiming at a two-street game — overbet the flop, then mostly all-in or check the turn — rather than the three-street plan the in-position version can run.',
              sources: ['flip.two-street-game', 'flip.654r-oop-frequency'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book give the flipped strategy broken down by hand strength?',
              answer:
                'No. For this node it prints the total betting frequency, the most used size, and the fact that weak hands make up 51% of the range. There is no strong/good/weak/trash betting split for the flipped solve, and no per-combo figures — so this puzzle states the aggregate and stops there.',
              nearestSources: ['flip.654r-oop-frequency', 'position.654r-bn-weak-hands'],
            },
          ],
          sources: ['flip.experiment-definition', 'flip.hero-oop-with-bn-range'],
        },

        {
          id: 'why-the-frequency-collapses',
          title: 'Why the betting frequency collapses',
          body:
            'The mechanism the book gives is not "out of position is bad" — it is specific, and it runs through the checking range. In position, a weak hand can check behind and be guaranteed a turn card. Out of position, checking guarantees nothing: the player behind gets to bet, and hands that badly wanted a free card are forced to give up their equity. The only defence is to keep enough strong hands in the checking range to check-raise with, which is what makes the opponent bet less often. Those strong hands are exactly the ones that would otherwise have been betting — so protecting the check is paid for out of the betting frequency.',
          exhibit: {
            caption: 'What the button’s range looks like on 6♣5♦4♠',
            scope:
              'BB vs BN on 654r at 30bb. The 51% weak figure is stated for Hero’s range in this very section; the 4% strong figure is the BB vs IP bucket data for this flop, averaged over 20/30/40bb stacks. Two different tables — shown side by side, not as one distribution.',
            rows: [
              { label: 'Weak hands in the button’s range', value: '51%', pct: 51 },
              { label: 'Strong hands in the button’s range', value: '4%', pct: 4, note: 'against the BB’s 7%' },
              { label: 'Average equity of every ace it holds', value: '49%', pct: 49, note: 'effectively a weak hand' },
            ],
            sources: ['position.654r-bn-weak-hands', 'buckets.654r', 'buckets.654r-ax-devalued'],
          },
          bullets: [
            {
              text: 'The source states the trade outright: “when OOP, Hero has to check many strong hands that can x/r the flop, forcing the Villain to bet less often, and thus allowing Hero’s weak hands to realize equity.”',
              sources: ['flip.654r-checking-range-protection'],
            },
            {
              text: 'And the penalty for skipping it: “If Hero does not protect the checking range, Villain will bet at a higher frequency, costing Hero a lot of EV. For this reason, Hero’s checking frequency is even higher when OOP with a range disadvantage.”',
              sources: ['flip.654r-checking-range-protection'],
            },
            {
              text: 'The 51% of the range that is weak is where the difference bites hardest. In position those hands check back to realize equity in a small pot without risking a check-raise; out of position the same hands check and are not guaranteed to see a turn at all.',
              sources: ['position.654r-bn-weak-hands'],
            },
            {
              text: 'This is a board where the button starts behind: the big blind has the equity edge at 51% to 49%, and 7% strong hands to the button’s 4%. That range disadvantage is why the check-raise threat is severe enough to reshape the strategy.',
              sources: ['eq.654r-vs-a76r', 'buckets.654r'],
            },
          ],
          sources: ['flip.654r-checking-range-protection', 'position.654r-bn-weak-hands'],
        },

        {
          id: 'what-position-costs',
          title: 'What the seat costs, in pot share',
          body:
            'The frequency shift is the strategy changing. This is the bill. Equity realization is what fraction of your raw equity you actually convert into pot, and in position on this flop the button’s range converts all of it. Move the same range to the other seat and it converts 79% — and because the ranges never moved, every point of that is position.',
          exhibit: {
            caption: 'Cost of moving the same range out of position',
            scope:
              'The MODIFIED "positions flipped" solve at 30bb, measured against the real solve where the same range plays in position. Both rows are the book’s figures for Hero, whose range is the 49% BN opening range in every case.',
            rows: [
              { label: 'EQR on 654r, in position', value: '100%', pct: 100 },
              { label: 'EQR on 654r, out of position', value: '79%', pct: 79 },
              { label: 'Cost on 654r', value: '9.7% of the pot' },
              { label: 'Pot captured on A76r, in position', value: '75%', pct: 75 },
              { label: 'Pot captured on A76r, out of position', value: '68.3%', pct: 68.3 },
              { label: 'Cost on A76r', value: '6.7% of the pot' },
            ],
            sources: ['flip.654r-oop-eqr', 'flip.a76r-oop-cost'],
          },
          bullets: [
            {
              text: 'On 654r: “When OOP on 654r, Hero’s EQR decreases from 100% to 79%, costing 9.7% of the pot!”',
              sources: ['flip.654r-oop-eqr'],
            },
            {
              text: 'On A76r the same range still over-realizes when moved out of position — it is simply too strong for that board to punish — but the seat still costs 6.7% of the pot, with EV falling from capturing 75% to 68.3%.',
              sources: ['flip.a76r-oop-cost'],
            },
            {
              text: 'So the price of position is not a constant. It is larger on 654r, where the button’s range is behind and cannot bet its way out, than on A76r, where the range is strong enough to keep betting 100% of the time from either seat.',
              sources: ['flip.654r-oop-eqr', 'flip.a76r-oop-cost', 'position.654r-ip-cbet'],
            },
            {
              text: 'A third experiment brackets the number: deal both players the identical range, and the in-position player still captures 5% more of the pot than their equity (110% EQR) while the out-of-position player realizes 90%. Across sample flops the book puts the value of position at 5-10% of the pot.',
              sources: ['flip.value-of-position-general'],
            },
          ],
          sources: ['flip.654r-oop-eqr', 'flip.a76r-oop-cost'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'hero-btn-range',
      label: 'Your range — the button’s opening range',
      headline: '49%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'The standard GTO button opening range the book uses for this 30bb spot. In the flipped simulation this is still your range — completely unchanged from the real preflop — you are simply playing it from the wrong side of the table.',
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from this source. Modern Poker Theory gives the 49% and 64% aggregates in prose for the 30bb BB vs BN configuration and prints no hand-by-hand chart of it at that depth. Drawing a grid would mean choosing which specific hands are in it, and that choice would be ours, not the book’s.',
          nearestSources: ['preflop.bb-vs-bn-25bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
        },
      ],
      sources: ['preflop.bn-open-bb-call-30bb', 'flip.hero-oop-with-bn-range'],
    },
    {
      id: 'villain-bb-range',
      label: 'Villain’s range — the big blind’s calling range',
      headline: '64%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'What the big blind called your open with. It does not change either — in the flipped solve the big blind simply gets to act last with it, which is the only difference between the two simulations being compared.',
      sources: ['preflop.bn-open-bb-call-30bb', 'flip.hero-oop-with-bn-range'],
    },
    {
      id: 'hero-range-on-654r',
      label: 'Your range on 6♣5♦4♠',
      kind: 'composition',
      seat: 'hero',
      description:
        'The two figures the book prints for the button’s range on this flop. They come from different tables and do not form a complete four-bucket partition, so they are shown side by side rather than as one distribution — which is exactly how the source gives them.',
      bars: [
        { label: 'Weak', pct: 51, note: 'stated for Hero’s range in this section — the hands that most want position' },
        { label: 'Strong', pct: 4, note: 'BB vs IP buckets on 654r, averaged over 20/30/40bb' },
      ],
      unsourced: [
        {
          question: 'What about the button’s good and trash hands?',
          answer:
            'The source does not print a complete four-bucket breakdown for the button on this flop, and prints none at all for the flipped solve. Filling in the remaining 45% would mean splitting a number the book never split.',
          nearestSources: ['position.654r-bn-weak-hands', 'buckets.654r'],
        },
      ],
      sources: ['position.654r-bn-weak-hands', 'buckets.654r'],
    },
    {
      id: 'villain-range-on-654r',
      label: 'Villain’s range on 6♣5♦4♠',
      kind: 'composition',
      seat: 'villain',
      description:
        'Why the check-raise threat is real. The big blind’s calling range connects with a board of small connected cards far better than the button’s does — it holds more of the hands worth raising with, and it is the reason the button cannot simply bet its way out of the seat.',
      bars: [
        { label: 'Strong', pct: 7, note: 'against the button’s 4%' },
        { label: 'Good', pct: 40, note: 'up from 17% on A76r' },
        { label: 'Weak', pct: 35, note: 'derived: the four buckets partition the range, so 100 − 7 − 40 − 18' },
        { label: 'Trash', pct: 18, note: 'down from 49% on A76r' },
      ],
      sources: ['buckets.654r', 'eq.654r-vs-a76r'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'Same range, same board, other seat: betting 48% of the time becomes betting 9.23%.',
  headlineSources: ['position.654r-ip-cbet', 'flip.654r-oop-frequency'],
  takeaways: [
    {
      text: 'The book measures position by holding the range still. It flips who acts first on the flop, changes nothing else, and reads off the difference — a modified simulation, not a spot you can be dealt.',
      sources: ['flip.experiment-definition', 'flip.hero-oop-with-bn-range'],
    },
    {
      text: 'On 654r the button’s range bets about 48% of the time in position and 9.23% out of it, and the size shifts from the two-thirds bet that sets up a triple barrel to a 125% overbet aimed at a two-street game.',
      sources: ['position.654r-ip-cbet', 'flip.654r-oop-frequency', 'flip.two-street-game'],
    },
    {
      text: 'The mechanism is the checking range: out of position a check no longer buys a turn card, so strong hands have to stay back to check-raise with — and they are paid for out of the betting frequency.',
      sources: ['flip.654r-checking-range-protection', 'position.654r-bn-weak-hands'],
    },
    {
      text: 'The bill is 9.7% of the pot on 654r, where equity realization falls from 100% to 79%. On A76r, where the same range is far stronger than its opponent’s, the same flip costs 6.7% — position is worth more the weaker your range is.',
      sources: ['flip.654r-oop-eqr', 'flip.a76r-oop-cost'],
    },
  ],

  xp: 45,

  endsEarlyBecause:
    'The flipped simulation is a flop experiment. The book reports the flop betting frequency, the sizing and the equity-realization cost, and says only that Hero aims to play a two-street game and go all-in on the turn at a reasonably high frequency — that is not a turn strategy, so the hand stops where the measurement stops.',
}

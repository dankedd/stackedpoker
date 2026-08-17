import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 6 — "Read the highest card first" (BN vs BB, flop only, 30bb)
 *
 * ONE idea: sort flops by their highest card and the preflop raiser's c-bet
 * frequency sorts with them. The book prints that ranking in a single sentence
 * on p.661 — 222 100%, Axx 96%, 3xx 93%, Kxx 88%, Qxx and Txx 85%, 6xx lowest
 * at 62% — and this puzzle is that sentence, made playable at its two extremes.
 *
 * THE HAND IS THE CONTROL VARIABLE. K♣J♦ is dealt on both boards and flops
 * nothing on either, deliberately: if the hero hand improved on one flop and not
 * the other, the learner could not tell whether the board or the holding moved
 * the answer. Everything about the spot is held fixed — same seats, same stack,
 * same 2.5bb open, same BB check — and only the three cards change.
 *
 * FOUR THINGS THIS PUZZLE REFUSES TO OVERSTATE, each surfaced in the flow rather
 * than buried here:
 *
 * 1. 96% AND 62% ARE CATEGORY AVERAGES. They average every flop sharing that
 *    highest card, so neither is the frequency for A♠8♦3♣ or 6♠4♦2♣, and neither
 *    is the frequency for K♣J♦ on them. The book prints no per-flop and no
 *    per-hand figure for these categories.
 *
 * 2. THEY ARE ALSO AVERAGES OVER TWO OPENERS. p.655 states the whole section is
 *    aggregated from 20bb/30bb/40bb solutions with MTT starting ranges, blended
 *    over the BN and UTG — and p.659 says UTG c-bets more often than the BN. So
 *    the button's own Axx figure is somewhere below 96%, and the book never
 *    splits the top-card table by opener. Hero is the BN, so this matters.
 *
 * 3. THERE IS NO SIZING SPLIT. p.661 ranks c-bet FREQUENCY by top card and says
 *    nothing about size for these categories. The two bet buttons therefore
 *    carry no theory claim between them: "Bet small" is the key only because the
 *    format needs exactly one, and "Bet big" is graded defensible for that
 *    reason alone. Said outright at both decisions.
 *
 * 4. THE TOP CARD IS NOT CLAIMED TO BE THE BEST PREDICTOR. The book measures
 *    several flop features — straights possible (p.661), OESD count (p.661),
 *    structure (p.663) — and never ranks the features against each other. What
 *    it prints is this one ordering, from 100% down to 62%. The 6xx flop chosen
 *    here allows exactly one flopped straight (5-3), the fewest available to any
 *    unpaired 6xx board, which is disclosed rather than hidden: every unpaired
 *    6xx flop allows at least one, and the straights feature is part of why the
 *    category sits where it does.
 *
 * MONEY (blinds 0.5/1, 30bb effective, no ante, six-handed):
 *   preflop  BN opens to 2.5, SB folds, BB calls → pot 5.5, hero 27.5 behind
 *   flop     BB checks, hero acts. Small = 1/3 pot (1.8bb), big = 2/3 pot (3.7bb).
 * The 2.5bb open and both bet-sizes are implementation decisions — the source
 * gives no open size here and no size split for these flop categories.
 */
export const CBET_BY_TOP_CARD: InteractivePuzzle = {
  id: 'cbet-by-top-card',
  slug: 'read-the-highest-card-first',
  number: 6,
  title: 'Read the highest card first',
  topic: 'Flop C-betting',
  difficulty: 'beginner',
  description:
    'Two flops, one hand, one seat. Nothing changes between the decisions except the three cards on the felt — and that is enough to move the preflop raiser’s betting frequency from 96% to 62%.',

  setup: {
    format: '30bb effective',
    // Six-handed: the folded small blind's 0.5bb is part of the 5.5bb flop pot.
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['Kc', 'Jd'],
    effectiveStackBb: 30,
    gameNotes:
      'Single raised pot, no ante. Blinds 0.5 / 1. You opened the button, the big blind called, and you act after they check.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    /* ── BOARD 1: A♠8♦3♣ ─────────────────────────────────────────────── */
    {
      id: 'flop-axx',
      street: 'flop',
      board: ['As', '8d', '3c'],
      // 2.5 (you) + 2.5 (BB) + 0.5 (folded SB).
      potBb: 5.5,
      effectiveStackBb: 27.5,
      // The big blind checked. Nothing to call.
      toCallBb: 0,
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: 'A♠ 8♦ 3♣ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      situation:
        'You opened the button to 2.5bb with K♣J♦, the big blind called, and the flop comes A♠ 8♦ 3♣ — rainbow. The big blind checks to you. Your hand is nothing: king-high, no pair, no draw. Hold that thought — the same two cards are dealt again on the next board, so the only thing that will change between these two decisions is the flop itself. Small is about a third of the pot, big about two-thirds.',
      question: 'What do you do?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'This is the group the book has the preflop raiser betting most often outside of 222: Axx flops are c-bet 96% of the time, which leaves checking about 4%. Giving up the betting lead here is close to abandoning the strategy, not choosing a smaller branch of it.',
          sources: ['cbet.by-top-card', 'cbet.check-share-derived', 'cbet.checking-back-costs-ip'],
        },
        {
          id: 'bet-small',
          label: 'Bet small',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'best',
          shortWhy:
            'Bet. Sorted by highest card, Axx flops are c-bet 96% of the time — second only to 222. Which size is not what this page ranks, so the small bet is the key here only because the format needs one; betting at all is the answer.',
          sources: ['cbet.by-top-card', 'cbet.analysis-after-bb-checks', 'cbet.sizes-by-stack-depth'],
        },
        {
          id: 'bet-big',
          label: 'Bet big',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'defensible',
          shortWhy:
            'Also a bet, and the source does not rank it against the small one: p.661 sorts c-bet FREQUENCY by the flop’s highest card and prints no size split for these categories. Graded below the small bet by the format, not by the book.',
          sources: ['cbet.by-top-card', 'cbet.sizes-by-stack-depth'],
        },
      ],
      bestOptionId: 'bet-small',
      explanation:
        'Bet. Sort every flop by its highest card and the book prints an ordering: 222 is c-bet 100% of the time, Axx flops 96%, 3xx 93%, Kxx 88%, Qxx and Txx 85%, and middle and low flops lowest of all (p.661). An ace-high flop is at the top of that list, so betting is what the strategy does here almost without exception — the 4% that is left over is what checking gets. Note what that figure is and is not: it is the average across every flop with an ace as its highest card, describing the preflop raiser’s whole range at that node. It is not a number for A♠8♦3♣ specifically, and it is not a number for K♣J♦. Your hand missing is not the question this page answers.',
      unsourced: [
        {
          question: 'Does the book say whether to bet small or big on an Axx flop?',
          answer:
            'No. p.661 ranks c-bet FREQUENCY by the flop’s highest card and prints no sizing split for those categories, so this puzzle does not invent one. The two bet buttons are graded apart only because the format requires a single key — treat them as one answer. The nearest thing the book says about size is a different variable entirely: bigger sizes are used less often when stacks are shallower and become more relevant when stacks are deeper (p.660). That is about stack depth, not about the top card, and it is not the basis for the key here.',
          nearestSources: ['cbet.by-top-card', 'cbet.sizes-by-stack-depth'],
        },
        {
          question: 'Is 96% the button’s number, or an average of two different openers?',
          answer:
            'An average. The whole section is aggregated from thousands of solutions at 20bb/30bb/40bb with MTT starting ranges, blended across the BN and UTG openers (p.655) — and the book states that UTG c-bets more often than the BN, because UTG’s range is stronger (p.659). So the button’s own frequency on ace-high flops sits somewhere below the blended 96%, and the book never splits the top-card table by opener. What survives that caveat is the ordering, which is what this puzzle teaches.',
          nearestSources: ['position.ch12-sim-scope', 'cbet.range-strength-drives-frequency', 'cbet.by-top-card'],
        },
      ],
      theory: [
        {
          id: 'the-ranking',
          title: 'Every flop, sorted by its highest card',
          body:
            'This is the whole lesson in one exhibit. The book takes every flop, groups them by the biggest card on the board, and prints how often the preflop raiser c-bets each group after the big blind checks. The spread runs from 100% down to 62% — a huge range for a single feature you can read off the felt in a fraction of a second, before you have thought about your own two cards at all.',
          exhibit: {
            caption: 'IP c-bet frequency by the flop’s highest card',
            scope:
              'Category AVERAGES over every flop sharing that highest card. Aggregated from thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges, blended over the BN and UTG openers, measured at IP’s decision after the BB checks (pp.655-656). Not the frequency for one flop, and not the frequency for one hand.',
            rows: [
              { label: '2xx (222 only)', value: '100%', pct: 100 },
              { label: 'Axx', value: '96%', pct: 96, note: 'this board' },
              { label: '3xx (333, 322, 332)', value: '93%', pct: 93 },
              { label: 'Kxx', value: '88%', pct: 88 },
              { label: 'Qxx and Txx', value: '85%', pct: 85 },
              { label: '6xx', value: '62%', pct: 62, note: 'the lowest group — the next board' },
            ],
            sources: ['cbet.by-top-card'],
          },
          bullets: [
            {
              text: 'The source states it as one list: 222 is c-bet 100%, Axx 96%, 3xx 93%, Kxx 88%, Qxx and Txx 85%, and middle and low flops lowest, with 6xx the lowest at 62%.',
              sources: ['cbet.by-top-card'],
            },
            {
              text: 'Every figure in that list is a category average across all flops with that top card. Read it as an ordering you can apply instantly, not as a number to attach to the specific board in front of you.',
              sources: ['cbet.by-top-card'],
            },
            {
              text: 'All of it describes one node: the preflop raiser in position, acting after the big blind has checked the flop in a single raised pot. That is exactly where you are sitting.',
              sources: ['cbet.analysis-after-bb-checks'],
            },
          ],
          unsourced: [
            {
              question: 'Is the top card the best single predictor of c-bet frequency?',
              answer:
                'The book never says so, and this puzzle does not claim it. Modern Poker Theory sorts the same flops several ways in the same few pages — by how many straights are possible, by how many open-ended draws they allow, by structure such as trips and paired boards — and it never ranks those features against one another. What it does print is this one ordering by highest card, and the spread it produces is wide: 100% down to 62%. That is the claim being taught here, and no more than it.',
              nearestSources: ['cbet.by-top-card', 'cbet.straights-favor-bb'],
            },
          ],
          sources: ['cbet.by-top-card', 'cbet.analysis-after-bb-checks'],
        },

        {
          id: 'why-betting-is-the-default',
          title: 'Why the preflop raiser is betting in the first place',
          body:
            'Before the board even matters, the default in this seat is aggression, and the book puts a price on abandoning it: an in-position player who simply checks back every flop loses 26bb/100. That is the baseline the top-card ranking modulates. The question a flop answers is not whether to c-bet as a policy — it is how much of your range keeps doing it here.',
          exhibit: {
            caption: 'What position is worth after the big blind checks',
            scope:
              'Ch.12, pp.655-657 — the same 20bb/30bb/40bb aggregate with MTT starting ranges. Whole-strategy figures for the in-position player, not figures for one board or one hand.',
            rows: [
              { label: 'EV lost by always checking back', value: '26bb/100' },
              { label: 'IP equity over-realization', value: '15%', pct: 15, note: 'both the BN and UTG' },
              { label: 'Overall range advantage', value: 'In position' },
            ],
            sources: ['cbet.checking-back-costs-ip', 'position.ip-over-realizes', 'position.ip-range-advantage'],
          },
          bullets: [
            {
              text: '“If IP plays a strategy that always checks back the flop, they will have an EV loss of 26bb/100, so c-betting the flop is of massive importance to IP.”',
              sources: ['cbet.checking-back-costs-ip'],
            },
            {
              text: 'Position is doing part of the work: IP has the overall range advantage, and both the button and UTG over-realize their equity by 15%.',
              sources: ['position.ip-range-advantage', 'position.ip-over-realizes'],
            },
            {
              text: 'And range strength is doing the rest. The book states the mechanism plainly — UTG c-bets more often than the button because UTG’s range is stronger, and in general the more strong hands your range has compared to your opponent’s, the more frequently you can bet.',
              sources: ['cbet.range-strength-drives-frequency'],
            },
            {
              text: 'Mind the scope on the 15%: it comes from the book’s 20bb/30bb/40bb aggregate with MTT starting ranges, so read it for the direction position pushes things rather than as a measurement of this exact spot.',
              sources: ['position.ch12-sim-scope'],
            },
          ],
          sources: ['cbet.checking-back-costs-ip', 'position.ip-range-advantage'],
        },
      ],
    },

    /* ── BOARD 2: 6♠4♦2♣ ─────────────────────────────────────────────── */
    {
      id: 'flop-6xx',
      street: 'flop',
      board: ['6s', '4d', '2c'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      toCallBb: 0,
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: '6♠ 4♦ 2♣ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      situation:
        'Rewind. Identical hand: you open the button to 2.5bb with the same K♣J♦, the same big blind calls, the same 5.5bb pot — and this time the flop is 6♠ 4♦ 2♣, rainbow. The big blind checks again. Your hand is once again nothing, exactly as before. The board is the only thing that moved.',
      question: 'What do you do now?',
      options: [
        {
          id: 'bet-small',
          label: 'Bet small',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'best',
          shortWhy:
            'Still a bet, but by a much smaller margin: 6xx is the lowest-betting group in the book’s list at 62%. Betting remains the majority strategy — it is checking that has gone from a rounding error to more than a third of it. As on the previous board, the source ranks frequency here, not size.',
          sources: ['cbet.by-top-card', 'cbet.check-share-derived', 'cbet.sizes-by-stack-depth'],
        },
        {
          id: 'bet-big',
          label: 'Bet big',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'defensible',
          shortWhy:
            'Betting is right; the size is not what p.661 ranks. The top-card table sorts c-bet frequency and prints no sizing split for these categories, so this is scored below the small bet by the format rather than by the book.',
          sources: ['cbet.by-top-card', 'cbet.sizes-by-stack-depth'],
        },
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'defensible',
          shortWhy:
            'A real and large part of the strategy here — the largest of any top-card group. At 62% c-bet, checking is the other 38%: on the ace flop it was 4%. That jump is the lesson, even though betting is still the majority action.',
          sources: ['cbet.by-top-card', 'cbet.check-share-derived'],
        },
      ],
      bestOptionId: 'bet-small',
      explanation:
        'Bet — but only just, and that is the point. 6xx is the lowest-betting group the book lists, at 62%, against 96% for the ace-high flop you just played. Nothing about your holding changed: K♣J♦ missed both boards identically. What changed is the top card, and with it the checking share of the strategy — from 4% to 38%, close to ten times more. So checking is graded here as a real branch rather than a mistake, because on this board it is one. If you want the mechanism the book gives for the low end of the table, it is the big blind’s connectors: the big blind holds more offsuit connectors than the preflop raiser, so flops that allow more straights favour them, and c-bet frequency falls as more straights become possible.',
      unsourced: [
        {
          question: 'Is 62% the frequency for 6♠4♦2♣ specifically?',
          answer:
            'No. It is the average across every flop whose highest card is a six, and the book prints no figure for an individual flop in this table — nor for an individual hand on one. Two things are worth knowing about this particular board. Every unpaired 6xx flop allows at least one straight, and 6-4-2 allows exactly one (5-3), which is the fewest available; and the book states separately that c-bet frequency falls as more straights are possible. So a straight-heavy 6xx flop would sit below the 62% average and this one plausibly above it — but the book gives no number for either, so none is claimed.',
          nearestSources: ['cbet.by-top-card', 'cbet.straights-favor-bb'],
        },
        {
          question: 'Does 62% mean you should check this flop?',
          answer:
            'It means checking is 38% of the strategy — the largest checking share of any group in the table, and nearly ten times what it is on an ace-high flop. It does not mean checking is the primary action: 62% is still a majority, so betting remains what the strategy does most of the time. Both bet buttons and the check are therefore graded as real strategy on this board; only on the ace-high flop, where checking is about 4%, is giving up the lead marked as an error.',
          nearestSources: ['cbet.by-top-card', 'cbet.check-share-derived'],
        },
      ],
      theory: [
        {
          id: 'what-actually-moved',
          title: 'Same hand, same seat, same pot — 34 points of frequency',
          body:
            'Put the two decisions side by side. Your cards were identical and equally useless on both flops; the seats, the stacks, the preflop action and the pot were identical too. The only variable was the highest card on the board, and it moved the betting frequency by 34 percentage points. Looked at from the other side, the checking share went from something close to a rounding error to more than a third of the strategy.',
          exhibit: {
            caption: 'The two boards you just played',
            scope:
              'Category averages for the Axx and 6xx groups (p.661) with their arithmetic complements. Same 20bb/30bb/40bb MTT-range aggregate, blended over BN and UTG openers, measured after the BB checks. Neither row is a figure for A♠8♦3♣, for 6♠4♦2♣, or for K♣J♦ on either.',
            rows: [
              { label: 'Axx — c-bet', value: '96%', pct: 96 },
              { label: 'Axx — check', value: '4%', pct: 4, note: '100% − 96%' },
              { label: '6xx — c-bet', value: '62%', pct: 62, note: 'the lowest group in the table' },
              { label: '6xx — check', value: '38%', pct: 38, note: '100% − 62%' },
            ],
            sources: ['cbet.by-top-card', 'cbet.check-share-derived'],
          },
          bullets: [
            {
              text: 'The book’s own words for the bottom of the list: “middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62%.”',
              sources: ['cbet.by-top-card'],
            },
            {
              text: 'The mechanism it gives for that end of the table is the big blind’s range shape: the big blind has more offsuit connectors than the in-position player, so flops allowing more straights favour the big blind, and c-bet frequency decreases as more straights become possible.',
              sources: ['cbet.straights-favor-bb'],
            },
            {
              text: 'Which is the same principle stated the other way around: the more strong hands your range has compared to your opponent’s, the more frequently you can bet.',
              sources: ['cbet.range-strength-drives-frequency'],
            },
          ],
          unsourced: [
            {
              question: 'So is the top card just standing in for how many straights are possible?',
              answer:
                'Partly, and the book does not resolve how much. It sorts the same flops by both features in the same few pages — by highest card and by number of possible straights — without ranking one against the other or separating their effects. The two overlap here by construction: every unpaired 6xx flop allows at least one straight, while the ace-high board you just played allows none. This puzzle teaches the ordering the source prints and names the overlap rather than resolving it.',
              nearestSources: ['cbet.by-top-card', 'cbet.straights-favor-bb'],
            },
          ],
          sources: ['cbet.by-top-card', 'cbet.check-share-derived'],
        },

        {
          id: 'how-to-use-a-category-average',
          title: 'What a 62% actually licenses you to do',
          body:
            'A category average is a strong, cheap prior and nothing more. It tells you what the strategy does across a whole group of boards before any other information arrives, which is exactly what makes it useful at the moment the flop lands: you can read the top card faster than you can read anything else. What it cannot do is tell you what to do with one hand on one board — for that, the source would need to print a per-flop or per-hand figure, and for these categories it does not.',
          bullets: [
            {
              text: 'Every number in the ranking averages all flops sharing that highest card, so it describes a group of boards, not the one in front of you.',
              sources: ['cbet.by-top-card'],
            },
            {
              text: 'It also averages the whole range at that node — the preflop raiser’s entire set of holdings after the big blind checks — so it is not a frequency for K♣J♦ or for any other specific hand.',
              sources: ['cbet.by-top-card', 'cbet.analysis-after-bb-checks'],
            },
            {
              text: 'And it blends two openers with different frequencies: UTG c-bets more often than the button because its range is stronger, and the top-card table is never split by seat.',
              sources: ['cbet.range-strength-drives-frequency', 'position.ch12-sim-scope'],
            },
          ],
          unsourced: [
            {
              question: 'How often should K♣J♦ specifically bet on either of these flops?',
              answer:
                'The source does not provide an exact frequency for this hand on either board. The top-card table is a range-wide figure by construction, and the book prints no per-hand breakdown attached to it. What can honestly be carried away is the ordering and its size: ace-high flops sit near the top of the list at 96%, six-high flops at the bottom at 62%, and that gap is a property of the board rather than of your holding.',
              nearestSources: ['cbet.by-top-card', 'cbet.check-share-derived'],
            },
          ],
          sources: ['cbet.by-top-card'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'ip-after-bb-checks',
      label: 'The in-position range after the big blind checks',
      headline: '15%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'The node every figure in this puzzle describes. The book measures the preflop raiser’s flop strategy from exactly this point — in position, after the big blind has checked — and reports that IP holds the overall range advantage and over-realizes its equity by 15%. That is the standing edge the top-card ranking then modulates board by board.',
      unsourced: [
        {
          question: 'What percentage of hands is the button actually opening here?',
          answer:
            'Not stated for this spot. There is a tempting number in the same pages — p.657 contrasts UTG’s “~15% range” with the BN’s “~44% range” — but p.655 states the whole section is aggregated from 20bb/30bb/40bb solutions using MTT starting ranges, so those are the opening ranges of that dataset rather than a cash configuration. No per-hand chart is claimed here either: the top-card figures are range-wide frequencies, and the book prints no grid alongside them.',
          nearestSources: ['position.ip-range-advantage', 'position.ch12-sim-scope', 'cbet.by-top-card'],
        },
      ],
      sources: ['cbet.analysis-after-bb-checks', 'position.ip-range-advantage', 'position.ip-over-realizes'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'Sort flops by their highest card and the c-bet frequency sorts with them — from 96% on ace-high down to 62% on six-high.',
  headlineSources: ['cbet.by-top-card'],
  takeaways: [
    {
      text: 'The book prints one ordering by top card: 222 is c-bet 100% of the time, Axx 96%, 3xx 93%, Kxx 88%, Qxx and Txx 85%, and 6xx lowest of all at 62%.',
      sources: ['cbet.by-top-card'],
    },
    {
      text: 'Flip those around and you get the checking share: about 4% on an ace-high flop, 38% on a six-high one. Checking barely exists on the first board and is a large branch on the second — though at 62% betting is still the majority action there.',
      sources: ['cbet.check-share-derived', 'cbet.by-top-card'],
    },
    {
      text: 'Your hand did not move between the two decisions — K♣J♦ missed both flops identically. The board moved, which is what makes the top card worth reading before anything else.',
      sources: ['cbet.by-top-card'],
    },
    {
      text: 'Every one of those percentages is a category average over all flops with that top card, describing the whole in-position range after the big blind checks. It is not a figure for one flop, not a figure for one hand, and the book prints no sizing split for these categories.',
      sources: ['cbet.by-top-card', 'cbet.analysis-after-bb-checks', 'cbet.sizes-by-stack-depth'],
    },
    {
      text: 'The reason the low end sits low is the big blind’s connectors: they hold more of them than you do, so flops that allow more straights favour them, and c-bet frequency falls as more straights become possible.',
      sources: ['cbet.straights-favor-bb'],
    },
  ],

  xp: 30,

  comparesAlternativeBoards:
    'The two decisions are the same hand dealt two different flops, not one hand advancing. That is the whole design: the source ranks c-bet frequency by the flop’s highest card, so the only way to show the effect honestly is to hold the seats, the stack, the pot, the preflop action and Hero’s two cards fixed and change nothing but the three cards on the felt. The second board replaces the first rather than extending it, and the decision says so in its own opening line.',

  endsEarlyBecause:
    'The ranking this puzzle teaches is a flop statistic and nothing else. p.661 sorts flops by their highest card and reports how often the preflop raiser c-bets each group after the big blind checks; it prints no turn or river continuation for those categories, so the hand stops where the evidence does rather than playing on into streets the source has not solved. The second decision is not a later street either — it is the same hand dealt a different flop, so that the board is the only variable that moves.',
}

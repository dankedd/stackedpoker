import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 2 — "The turn card you were waiting for" (BB vs UTG, 9♥8♥4♦, 40bb)
 *
 * A complete four-street hand. It exists because puzzle 1 cannot be one: the
 * donk-bet chapter is a FLOP chapter and closes by telling the reader to run
 * their own sims to learn "how to follow through on future streets" (p.648), so
 * extending that hand to a turn would mean inventing the very thing this product
 * refuses to invent. This spot is different — it is the book's own Flop Strategy
 * Example 3, and the author carries it through the flop chapter (p.741-743), the
 * turn chapter (p.766-771) and into the river principles (p.782, p.808-809).
 *
 * The line is chosen so every decision lands on something the source states:
 *
 *   PREFLOP  BB defends vs an UTG open at 40bb. Printed: call 49.1% (p.402).
 *   FLOP     9♥8♥4♦, UTG c-bets 2/3-pot. The book gives the BB's whole hand-class
 *            breakdown for this exact bet on this exact board, including the one
 *            rule that decides this hand: "OESD will only continue if they are
 *            drawing to the nut straight" (p.741).
 *   TURN     5♣. Not chosen for drama — the book names offsuit 5s as literally
 *            the best turn card in the deck for the BB here (p.769), and lists
 *            "7, 6, 5 that complete straights" among the best cards to lead
 *            (p.768). It also completes 7♠6♠ into the nuts.
 *   RIVER    2♣, a brick. Hero holds the nuts, which is the one river situation
 *            the book's abstract model answers directly (p.782).
 *
 * WHAT IS *NOT* SOURCED, and is labelled as such in the flow:
 *   - No per-hand preflop chart. 49.1% is an aggregate. The argument that 7♠6♠
 *     is inside it is indirect but real: the book's own flop breakdown for this
 *     spot discusses what the BB does holding an OESD, so the BB's range here
 *     demonstrably contains hands of exactly this shape.
 *   - No turn BET-SIZE for this node. The book says which cards to lead and that
 *     the BB plays "an aggressive turn donking strategy on favorable runouts"
 *     (p.743); it prints no sizing. So both bet sizes are graded as correct in
 *     substance and the split between them is flagged as our reading.
 *   - No solved river node. The river reasoning is the book's polar-vs-bluff-
 *     catcher model applied to a matching structure, not a printed frequency.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante). The 2.5bb open is an
 * implementation decision, as in puzzle 1 — the book gives no open size.
 *   preflop  pot 4.0   = 2.5 + 1 + 0.5   hero in for 1, owes 1.5
 *   flop     pot 5.5 → UTG bets 3.7 (2/3) → 9.2 faced, hero owes 3.7
 *   turn     pot 12.9  (5.5 + 3.7 + 3.7), hero first to act
 *   river    pot 30.1  (12.9 + 8.6 + 8.6), hero first to act, 25.2 behind
 */
export const TURN_DONK_984: InteractivePuzzle = {
  id: 'turn-donk-984',
  slug: 'the-turn-you-were-waiting-for',
  number: 2,
  title: 'The turn card you were waiting for',
  topic: 'Turn Play',
  difficulty: 'advanced',
  description:
    'A full hand on the board the book works through in most depth. You play a passive flop on purpose, then the single best card in the deck arrives — and the plan you deferred becomes the plan you execute.',

  setup: {
    format: '40bb effective',
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    heroCards: ['7s', '6s'],
    effectiveStackBb: 40,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  decisions: [
    /* ── PREFLOP ─────────────────────────────────────────────────────── */
    {
      id: 'preflop',
      street: 'preflop',
      board: [],
      potBb: 4,
      effectiveStackBb: 40,
      facingBetBb: 2.5,
      heroInvestedBb: 1,
      toCallBb: 1.5,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      situation:
        'UTG opens to 2.5bb and everyone folds to you. You are in the big blind with 40bb, already in for your 1bb blind, so 1.5bb more to call.',
      question: 'What do you do with 7♠6♠?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Tighter than the source. The printed chart for this exact seat and depth has the big blind calling 49.1% and folding 45% — and a suited connector getting 3.5-to-1 is not in the bottom half of that range.',
          sources: ['ex3.preflop-bb-vs-utg-40bb'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.5 bb',
          tableAction: { label: 'Calls', betBb: 2.5 },
          verdict: 'best',
          shortWhy:
            'The book calls 49.1% of hands here, and its own flop analysis of this spot goes on to discuss what the big blind does holding an open-ender — so hands of exactly this shape are in the calling range by the source’s own account.',
          sources: ['ex3.preflop-bb-vs-utg-40bb', 'ex3.oesd-nut-straight-only'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: 'Raises to 8 bb',
          tableAction: { label: 'Raises to', betBb: 8 },
          verdict: 'mistake',
          shortWhy:
            'The 3-betting frequency against UTG at this depth is only 5.8%, and the source is explicit that against an early-position range you keep 3-betting low and use better hands as bluffs.',
          sources: ['ex3.preflop-bb-vs-utg-40bb', 'preflop.bb-3bet-value-40bb'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. Against an UTG open at 40bb the book has the big blind calling 49.1%, 3-betting only 5.8% and folding 45%. 7♠6♠ is a suited connector getting a good price closing the action — and the strongest evidence it belongs here is that the book’s own flop walkthrough of this very spot spends time on what the big blind does with an open-ended straight draw. Those hands have to come from somewhere, and this is where.',
      unsourced: [
        {
          question: 'Is 7♠6♠ specifically in the 49.1%?',
          answer:
            'The chart is printed as a per-hand image the book states only in aggregate, so no per-combo confirmation exists in the text. What can be said is indirect but concrete: the flop breakdown for this exact matchup and board discusses the big blind’s open-enders as a live category, which requires hands like this to be in the preflop calling range.',
          nearestSources: ['ex3.preflop-bb-vs-utg-40bb', 'ex3.oesd-nut-straight-only'],
        },
      ],
      theory: [
        {
          id: 'pf-utg',
          title: 'Defending against the tightest range at the table',
          body:
            'UTG opens the narrowest range of any seat, and that shapes everything downstream: fewer trash hands to attack, more strong hands to run into. The book’s response is not to fold more preflop — the price closing the action is still good — but to keep the 3-betting frequency low and plan to play a careful postflop hand.',
          exhibit: {
            caption: 'BB vs UTG, 40bb effective',
            scope: 'The printed action frequencies for this seat and stack depth. Whole-range figures, not per-hand.',
            rows: [
              { label: 'Call', value: '49.1%', pct: 49.1 },
              { label: '3-bet', value: '5.8%', pct: 5.8 },
              { label: 'Fold', value: '45%', pct: 45 },
            ],
            sources: ['ex3.preflop-bb-vs-utg-40bb'],
          },
          bullets: [
            {
              text: 'Against an early-position opener the book’s instruction is to defend tighter, use better hands as bluffs, and keep the 3-betting frequency low — the value range shrinks to TT+ and AK against UTG.',
              sources: ['preflop.bb-3bet-value-40bb'],
            },
          ],
          sources: ['ex3.preflop-bb-vs-utg-40bb'],
        },
      ],
    },

    /* ── FLOP ────────────────────────────────────────────────────────── */
    {
      id: 'flop',
      street: 'flop',
      board: ['9h', '8h', '4d'],
      potBb: 9.2,
      effectiveStackBb: 37.5,
      facingBetBb: 3.7,
      heroInvestedBb: 0,
      toCallBb: 3.7,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: ['BB checks', 'UTG bets 3.7bb'],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♥ 8♥ 4♦ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 3.7 bb (2/3 pot)' },
      ],
      situation:
        'The flop is 9♥ 8♥ 4♦. You check, and UTG bets 3.7bb — two-thirds of the pot. You hold an open-ended straight draw: a 5 or a T makes your straight, and the 5 makes the best hand possible.',
      question: 'What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'The source’s rule for this exact bet on this exact board is that open-enders continue when they draw to the nut straight. Yours does — a 5 gives you 9-8-7-6-5, the best hand available.',
          sources: ['ex3.oesd-nut-straight-only'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 3.7 bb',
          tableAction: { label: 'Calls', betBb: 3.7 },
          verdict: 'best',
          shortWhy:
            'Exactly the plan the book describes: the big blind has almost no strong hands here, raises only about 4%, and deliberately waits until the turn to split its range rather than give away information now.',
          sources: ['ex3.oesd-nut-straight-only', 'ex3.bb-few-strong-hands', 'ex3.bb-compensates-on-turn'],
        },
        {
          id: 'raise',
          label: 'Check-raise',
          historyText: 'Raises to 12 bb',
          tableAction: { label: 'Raises to', betBb: 12 },
          verdict: 'mistake',
          shortWhy:
            'Against this bet-size the big blind’s check-raise frequency is only about 4%, precisely because the range holds so few strong hands. Raising a draw here spends the information advantage the book says to keep.',
          sources: ['ex3.bb-few-strong-hands'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. Two source rules meet on this hand. The first decides whether you continue at all: on this board, facing this bet, open-enders continue only when they draw to the nut straight — and a 5 gives you 9-8-7-6-5, which nothing beats. The second decides how: the big blind’s range holds only about 4% strong hands here, so it raises only about 4% and instead waits for the turn to split its range, keeping its information advantage intact. You are not calling and hoping. You are calling with a specific card in mind.',
      theory: [
        {
          id: 'flop-passive-on-purpose',
          title: 'Why the passive line is the plan, not the surrender',
          body:
            'It feels weak to call a big bet with no pair. It is not — it is the book’s stated strategy for this board, and the reason is structural rather than about your hand. The big blind arrives on 9♥8♥4♦ with almost nothing genuinely strong, which is exactly why UTG is allowed to use a large size. Splitting into a raising range now would announce the few good hands you do have.',
          exhibit: {
            caption: 'BB’s position on 9♥8♥4♦ facing a 2/3-pot c-bet',
            scope: 'BB vs UTG on 9♥8♥4♦ at 40bb, facing a 2/3-pot c-bet. Printed for this exact node.',
            rows: [
              { label: 'BB strong hands', value: '~4%', pct: 4 },
              { label: 'BB check-raise frequency', value: '~4%', pct: 4 },
              { label: 'BB x/r vs a 1/3-pot bet instead', value: '~15%', pct: 15, note: 'a smaller bet earns more raising' },
            ],
            sources: ['ex3.bb-few-strong-hands'],
          },
          bullets: [
            {
              text: 'The source states the plan outright: the big blind waits until the turn to start splitting its range, depending on the runout, which avoids revealing information on the flop.',
              sources: ['ex3.bb-few-strong-hands'],
            },
            {
              text: 'And it names the compensation explicitly — the big blind makes up for the lack of flop aggression with an aggressive turn donking strategy on favourable runouts. Your next decision is that sentence.',
              sources: ['ex3.bb-compensates-on-turn'],
            },
            {
              text: 'Top pair averages only 44% equity on a board this connected, so even hands that look strong here are not — which is why so little of the range wants to raise.',
              sources: ['ex3.bb-few-strong-hands'],
            },
          ],
          sources: ['ex3.bb-few-strong-hands', 'ex3.oesd-nut-straight-only'],
        },
      ],
    },

    /* ── TURN ────────────────────────────────────────────────────────── */
    {
      id: 'turn',
      street: 'turn',
      board: ['9h', '8h', '4d', '5c'],
      potBb: 12.9,
      effectiveStackBb: 33.8,
      toCallBb: 0,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: [],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♥ 8♥ 4♦' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 3.7 bb' },
        { street: 'flop', actor: 'BB', text: 'Calls 3.7 bb', isHero: true },
        { street: 'turn', actor: '', text: '5♣ — pot 12.9 bb' },
      ],
      situation:
        'The turn is the 5♣. Your straight is there: 9-8-7-6-5, and nothing beats it right now. You are first to act into a 12.9bb pot with 33.8bb behind.',
      question: 'What is your action?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'This is the card the source singles out as the best in the deck for you, and the runout its "aggressive turn donking strategy" was describing. Check twice and UTG c-bets over 65% with a polarization advantage — you hand the initiative back on the one card you wanted.',
          sources: ['ex3.turn-best-card-is-five', 'ex3.bb-compensates-on-turn', 'ex3.ip-punishes-a-check'],
        },
        {
          id: 'bet-33',
          label: 'Bet 33% pot',
          historyText: 'Bets 4.3 bb',
          tableAction: { label: 'Bets', betBb: 4.3 },
          verdict: 'defensible',
          shortWhy:
            'Leading is right, and the source does not print a bet-size for this node — so this is not a wrong answer in substance. It sits below the "aggressive" the book uses to describe the strategy on these runouts.',
          sources: ['ex3.turn-donk-best-cards', 'ex3.bb-compensates-on-turn'],
        },
        {
          id: 'bet-67',
          label: 'Bet 67% pot',
          historyText: 'Bets 8.6 bb',
          tableAction: { label: 'Bets', betBb: 8.6 },
          verdict: 'best',
          shortWhy:
            'Lead, and lead big. The book names cards that complete straights among the best to donk, calls offsuit 5s the single best turn card for you here, and describes the strategy on these runouts as aggressive.',
          sources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five', 'ex3.bb-compensates-on-turn'],
        },
      ],
      bestOptionId: 'bet-67',
      explanation:
        'Bet. This is the deferred plan arriving on schedule. The book lists the cards the big blind most wants to lead on this board — the 9, 8 and 4 that pair it, and the 7, 6 and 5 that complete straights — and then names offsuit 5s as literally the best turn card in the deck for you, by EV. It is also the card that turns your draw into the nuts. Checking here is the one clearly wrong answer, because after two checks UTG c-bets over 65% of the time with a polarization advantage and you have given away the street you were waiting for.',
      unsourced: [
        {
          question: 'Does the book give a bet-size for this exact turn lead?',
          answer:
            'No. It names which turn cards the big blind should lead and describes the strategy as aggressive, but prints no sizing for this node. Both bet options here are therefore correct in substance — the choice between them is graded on the book’s word "aggressive", which is our reading of a qualitative term, not a printed frequency.',
          nearestSources: ['ex3.turn-donk-best-cards', 'ex3.bb-compensates-on-turn'],
        },
      ],
      theory: [
        {
          id: 'turn-why-five',
          title: 'Why the 5 and not just any card',
          body:
            'Turn cards are not interchangeable, and the book classifies them: cards that pair the board, complete a flush, complete an open-ender, bring an ace, bring an overcard, or brick. On this board the cards that complete straights are among the best for you and the ace and high cards are among the worst — because those are the cards that connect with UTG’s range rather than yours.',
          exhibit: {
            caption: 'Turn cards on 9♥8♥4♦ after the flop went check / bet / call',
            scope: 'BB vs UTG on 9♥8♥4♦ at 40bb, after x/b/c. Printed as best/worst card families and average equities.',
            rows: [
              { label: 'Best cards to lead', value: '9, 8, 4, 7, 6, 5', note: 'board pairs and straight completers' },
              { label: 'Single best turn card', value: 'offsuit 5', note: '5♣ / 5♠' },
              { label: 'Worst cards to lead', value: 'A, high cards, ♦', note: 'they connect with UTG instead' },
              { label: 'Single worst turn card', value: 'offsuit K', note: 'K♣ / K♠' },
              { label: 'BB equity on the average turn', value: '51.65%', pct: 51.65 },
              { label: 'BB share of pot captured', value: '48.6%', pct: 48.6, note: 'under-realized — hence the need to lead good cards hard' },
            ],
            sources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five', 'ex3.turn-equity-runs-close'],
          },
          bullets: [
            {
              text: 'The mechanism is the same one that drives the flop donk bet: you lead the turn when UTG does not have many dominant strong hands and instead holds weaker ones that would happily check back and see a free river.',
              sources: ['ex3.turn-equity-runs-close'],
            },
            {
              text: 'The cost of checking is concrete. After you check twice, UTG holds a substantial polarization advantage, c-bets over 65% of the time and mostly uses 2/3-pot.',
              sources: ['ex3.ip-punishes-a-check'],
            },
            {
              text: 'The book’s own turn classification puts this card in the "completes an OESD" family — the category built for exactly this moment.',
              sources: ['turn.categories'],
            },
          ],
          sources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five'],
        },
      ],
    },

    /* ── RIVER ───────────────────────────────────────────────────────── */
    {
      id: 'river',
      street: 'river',
      board: ['9h', '8h', '4d', '5c', '2c'],
      potBb: 30.1,
      effectiveStackBb: 25.2,
      toCallBb: 0,
      actionBeforeHero: ['UTG raises to 2.5bb', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds', 'Hero calls'],
      postflopAction: [],
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♥ 8♥ 4♦' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'UTG', text: 'Bets 3.7 bb' },
        { street: 'flop', actor: 'BB', text: 'Calls 3.7 bb', isHero: true },
        { street: 'turn', actor: '', text: '5♣' },
        { street: 'turn', actor: 'BB', text: 'Bets 8.6 bb', isHero: true },
        { street: 'turn', actor: 'UTG', text: 'Calls 8.6 bb' },
        { street: 'river', actor: '', text: '2♣ — pot 30.1 bb' },
      ],
      situation:
        'UTG called your turn lead. The river is the 2♣ — a brick that pairs nothing and completes no flush. You still hold 9-8-7-6-5, still the best hand possible. The pot is 30.1bb and you have 25.2bb left, so a shove is slightly less than the pot.',
      question: 'How do you finish the hand?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'You hold the nuts on a card that changed nothing. In the book’s river model the polarized player always puts the money in with their nut hands — checking here gives up the whole value of the street.',
          sources: ['river.polar-jams-nuts'],
        },
        {
          id: 'bet-50',
          label: 'Bet 50% pot',
          historyText: 'Bets 15 bb',
          tableAction: { label: 'Bets', betBb: 15 },
          verdict: 'defensible',
          shortWhy:
            'Value, but not all of it. A half-pot bet asks UTG to defend far more of their range than a shove does, which is the wrong direction to push when you can never be beaten.',
          sources: ['river.polar-jams-nuts', 'theory.alpha-mdf'],
        },
        {
          id: 'all-in',
          label: 'All-in',
          historyText: 'Bets 25.2 bb (all-in)',
          tableAction: { label: 'All-in', betBb: 25.2 },
          verdict: 'best',
          shortWhy:
            'You arrive with a polarized range against a capped caller and you hold the top of it. The book’s river model is unambiguous about that structure: the polar player goes all-in with their nut hands.',
          sources: ['river.polar-jams-nuts'],
        },
      ],
      bestOptionId: 'all-in',
      explanation:
        'Get it in. The river is the one street where the book gives a clean general answer, because hand values are fixed and the situation reduces to a shape: a polarized bettor against a range of bluff-catchers. You led the turn on a card that gave you value hands and bluffs; UTG called and by doing so capped their range. You now hold the top of your own range on a brick. The model says the polar player goes all-in with their nut hands and with Alpha% of their bluffs — and the larger the bet, the smaller the fraction of their range your opponent is required to defend.',
      unsourced: [
        {
          question: 'Did a solver actually solve this river?',
          answer:
            'Not in this book. The river chapter deliberately works in abstract models rather than board-by-board solutions, because on the river hand values are fixed and situations can be classified by structure instead. So the reasoning here is the book’s polar-versus-bluff-catcher model applied to a spot whose structure matches it — a model, correctly applied, rather than a printed frequency for this node. No percentage is claimed for 7♠6♠ on this runout.',
          nearestSources: ['river.polar-jams-nuts', 'river.defend-1-alpha'],
        },
      ],
      theory: [
        {
          id: 'river-polar',
          title: 'Why the river is the simplest street',
          body:
            'By the river there are no cards to come, so every hand is either ahead or behind — no equity, just a ranking. That is what lets the book stop solving individual boards and start classifying situations. If you can recognise the shape as polarized against bluff-catchers, you already know both strategies without solving anything.',
          exhibit: {
            caption: 'Bet size and the defence it demands',
            scope:
              'Alpha and MDF are arithmetic, not solver output: they follow from bet size and pot alone, and hold in any spot.',
            rows: [
              { label: 'Bet 50% pot', value: 'Alpha 33%', note: 'opponent must defend about 67%' },
              { label: 'All-in, 25.2 into 30.1', value: 'Alpha ~46%', note: 'opponent must defend only about 54%' },
            ],
            sources: ['theory.alpha-mdf', 'river.defend-1-alpha'],
          },
          bullets: [
            {
              text: 'The model’s conclusion is stated plainly: the polar player goes all-in with their nut hands and with Alpha% of their bluffs, and the bluff-catcher calls 1-Alpha of their range.',
              sources: ['river.polar-jams-nuts'],
            },
            {
              text: 'And the general river-calling heuristic on the other side of the table: defending close to 1-Alpha is a good approximation in most river spots.',
              sources: ['river.defend-1-alpha'],
            },
            {
              text: 'Which bluff-catchers UTG keeps is a blocker question — call more when you block their value range, fold more when you block their bluffs. That is their problem here, not yours: you are never bluff-catching with the nuts.',
              sources: ['river.blockers'],
            },
          ],
          sources: ['river.polar-jams-nuts', 'theory.alpha-mdf'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-defend',
      label: 'Big blind defending range',
      kind: 'aggregate',
      seat: 'hero',
      headline: '49.1%',
      description:
        'What the big blind continues with against an UTG open at 40bb. The book prints call 49.1%, 3-bet 5.8% and fold 45% for this exact seat and stack depth.',
      unsourced: [
        {
          question: 'Can you show which hands make up the 49.1%?',
          answer:
            'Not from the text. The per-hand chart is an image; only the aggregate is stated. Your hand is marked on the grid below as a location, not as a claimed frequency — the book supports that 7♠6♠-shaped hands are in this range, because its own flop analysis of this spot discusses the big blind’s open-enders.',
          nearestSources: ['ex3.preflop-bb-vs-utg-40bb', 'ex3.oesd-nut-straight-only'],
        },
      ],
      sources: ['ex3.preflop-bb-vs-utg-40bb'],
    },
    {
      id: 'bb-flop',
      label: 'Big blind range on 9♥8♥4♦',
      kind: 'composition',
      seat: 'hero',
      description:
        'The single number that explains the whole flop. With this little at the top of its range, the big blind cannot build a raising range without giving itself away — so it calls, and waits.',
      bars: [
        { label: 'Strong', pct: 4, note: 'which is why the check-raise frequency is also about 4%' },
        { label: 'Everything else', pct: 96, note: 'the book does not break the remainder into buckets for this node' },
      ],
      sources: ['ex3.bb-few-strong-hands'],
    },
    {
      id: 'turn-cards',
      label: 'Turn cards, best to worst',
      kind: 'composition',
      seat: 'both',
      description:
        'Not a hand range but a card range — the book’s ranking of which turn cards the big blind wants to see on this board. The 5 you were dealt is at the very top of it.',
      bars: [
        { label: 'Board pairs and straight completers', pct: 55, note: '9, 8, 4, 7, 6, 5 — the cards to lead' },
        { label: 'Aces, high cards, diamonds', pct: 45, note: 'the cards that connect with UTG instead' },
      ],
      unsourced: [
        {
          question: 'Are those split percentages from the book?',
          answer:
            'No — the bar widths are only a visual grouping of the two named families. The book lists which cards fall in each group and names the best and worst single cards, but prints no percentage split between the groups. The card lists are exact; the proportions are presentation.',
          nearestSources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five'],
        },
      ],
      sources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five'],
    },
  ],

  takeawayHeadline:
    'A passive flop can be the setup for an aggressive turn — if you know which card you are waiting for.',
  headlineSources: ['ex3.bb-compensates-on-turn', 'ex3.turn-best-card-is-five'],
  takeaways: [
    {
      text: 'On 9♥8♥4♦ the big blind holds only about 4% strong hands, so it raises about 4% and keeps its range hidden instead of splitting it on the flop.',
      sources: ['ex3.bb-few-strong-hands'],
    },
    {
      text: 'The book names the payoff explicitly: the big blind compensates for that flop passivity with an aggressive turn donking strategy on favourable runouts.',
      sources: ['ex3.bb-compensates-on-turn'],
    },
    {
      text: 'Cards that complete straights are among the best to lead, and offsuit 5s are the single best turn card in the deck for you here — while aces and high cards are the worst.',
      sources: ['ex3.turn-donk-best-cards', 'ex3.turn-best-card-is-five'],
    },
    {
      text: 'On the river hand values are fixed, so the spot reduces to a shape: the polarized player gets the money in with their nut hands, and the bluff-catcher defends close to 1-Alpha.',
      sources: ['river.polar-jams-nuts', 'river.defend-1-alpha'],
    },
  ],

  xp: 75,
}

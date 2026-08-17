import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 4 — "The same hand, at two stack depths"
 * (BB vs BN open, 9♠9♦, preflop only, 15bb then 40bb)
 *
 * ONE idea, and deliberately nothing else: stack depth decides whether the big
 * blind jams, 3-bets or calls. The hand is held fixed at 9♠9♦, the opener is
 * held fixed at the button, the price is nearly identical — and the correct
 * action changes anyway, because the only thing that moved is the stack.
 *
 * The whole puzzle rests on one structural fact about the source rather than on
 * any single number: Modern Poker Theory prints THREE branches for BB vs BN at
 * 15bb and FOUR at 40bb. The 3-bet branch does not shrink between those depths —
 * at 15bb it does not exist, and p.381 says why in the author's own words. That
 * absence is the lesson, so the 15bb decision offers "3-bet" as a choice on
 * purpose and answers it with the fact that the source prices no such action.
 *
 * Six content decisions worth recording:
 *
 * 1. THE HERO HAND IS THE ONE THE SOURCE NAMES AT BOTH DEPTHS. 9♠9♦ is not a
 *    convenient pick — it is the single hand that both passages reach. At 15bb
 *    p.381 puts "most pocket pairs" in the rejam range and names its own
 *    exceptions (AA and KK, slowplayed vs LP; small pairs mixed vs EP), none of
 *    which covers 99 against a button. At 40bb p.395 prints the 3-betting VALUE
 *    range against the BN as "99+, ATs+, and AJ+" — 99 is literally its bottom
 *    card. A pocket pair also sits in the class p.386 names outright: "Pocket
 *    pairs and Axo really like getting all-in."
 *
 * 2. THE 15bb "3-BET" BUTTON CARRIES NO SIZE, AND THAT IS DELIBERATE. Every
 *    other action on the felt shows what it costs. This one cannot, because the
 *    source prints no non-all-in raise size for the BB at 15bb — there is no
 *    such branch to size. Inventing "raises to 5bb" here would be the single
 *    easiest fabrication in this puzzle and would quietly destroy its point.
 *
 * 3. NO 30bb FIGURE APPEARS ANYWHERE. p.360 states the four depths the defence
 *    chapter solves: 15, 25, 40 and 60bb. 30bb is not one of them, and the two
 *    charts either side of it are five whole percentage points apart on the
 *    3-bet branch — so a midpoint would be invented solver output, not a
 *    reading. An `UnsourcedNote` says "Not specified in the source" in as many
 *    words.
 *
 * 4. ALL-IN AT 40bb IS GRADED 'defensible', NOT 'mistake'. It is tempting to
 *    stamp it wrong, because "don't jam at 40bb" is the takeaway. But Hand Range
 *    167 prints an all-in branch of 3%: small, and real. Under this schema's own
 *    definition, 'mistake' means the source contradicts the action or gives it
 *    no support, and 3% is support. The lesson survives without the red mark —
 *    18% of the range at 15bb, where it was the only raise available, against 3%
 *    at 40bb, where it is the smallest of four branches, IS the stack-depth
 *    effect quantified.
 *
 * 5. THE BET-SIZES COME FROM THE OPENER'S SIDE OF THE SAME TREE. Ch.8's prose
 *    around Hand Ranges 155 and 167 never restates the open size. It is printed
 *    instead in the nodes where the BN responds: "BN 15bb (2x vs BB All-in)"
 *    (p.516) and "BN 40bb (2.3x vs BB 3.5x 3-bet)" (p.548). Those labels are
 *    where the 2bb open, the 2.3bb open and the 3.5x 3-bet on this felt come
 *    from — the same 9-max/12.5%-ante MTT solution, read from the other player's
 *    branch. Disclosed in the flow rather than presented as Ch.8 material.
 *
 * 6. THE POT IS A TOURNAMENT POT. p.293 states the whole MTT dataset is 9-max
 *    with a 12.5% ante, which is 1.125bb of dead money before anyone acts. A
 *    puzzle about how wide a big blind may defend cannot quietly drop that — the
 *    ante is a large part of what it is defending. Hence `tableSize: 9` and
 *    `anteBb: 0.125`, and pots of 4.625bb and 4.925bb rather than 3.5 and 3.8.
 */
export const JAM_3BET_OR_CALL_BY_DEPTH: InteractivePuzzle = {
  id: 'jam-3bet-or-call-by-depth',
  slug: 'the-same-hand-at-two-stack-depths',
  number: 4,
  title: 'The same hand, at two stack depths',
  topic: 'BB Defence',
  difficulty: 'advanced',
  description:
    'Two preflop decisions with the same pocket pair against the same button open. Nothing changes between them except the size of the stacks — and that alone changes the answer.',

  setup: {
    format: '15bb, then 40bb',
    // Nine-handed, because that is the game the book solved: p.293 states the
    // MTT equilibrium strategies were generated "for 9-max tables with a 12.5%
    // ante". A 6-max felt would show a different pot and a different price.
    tableSize: 9,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['9s', '9d'],
    // The first depth. Each decision carries its own — that is the subject.
    effectiveStackBb: 15,
    anteBb: 0.125,
    gameNotes: 'MTT, 9-max. Blinds 0.5 / 1, 12.5% ante — 1.125bb dead before anyone acts.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    /* ── DECISION 1: 15bb ─────────────────────────────────────────────── */
    {
      id: 'preflop-15bb',
      street: 'preflop',
      board: [],
      // 1.125 (nine 12.5% antes) + 0.5 (folded SB) + 1 (your blind) + 2 (the open).
      potBb: 4.625,
      effectiveStackBb: 15,
      // The button raises TO 2bb; you are already in for 1, so the call is 1.
      facingBetBb: 2,
      heroInvestedBb: 1,
      toCallBb: 1,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+1', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+2', text: 'Folds' },
        { street: 'preflop', actor: 'LJ', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2 bb (min-raise)' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      situation:
        'Mid-tournament, 15bb effective. It folds to the button, who min-raises to 2bb. The small blind folds. You are in the big blind with 9♠9♦ and 1bb more to call into a 4.625bb pot.',
      actionBeforeHero: [
        'UTG folds',
        'UTG+1 folds',
        'UTG+2 folds',
        'LJ folds',
        'HJ folds',
        'CO folds',
        'BTN raises to 2bb',
        'SB folds',
      ],
      question: 'You have 15bb. What do you do?',
      options: [
        {
          id: 'fold-15',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Folding is a real branch at this depth — 23.8% of hands — but not with a pocket pair. The source puts most pocket pairs in the rejamming range against a late-position opener, so this hand is on the other side of that split.',
          sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-who-jams'],
        },
        {
          id: 'call-15',
          label: 'Call',
          historyText: 'Calls 1 bb',
          tableAction: { label: 'Calls', betBb: 2 },
          verdict: 'mistake',
          shortWhy:
            'Calling is the biggest branch overall here — 58.2% — but the source assigns this hand class elsewhere: most pocket pairs make great rejamming hands, and it names its own exceptions (AA and KK, and small pairs against early position). Neither exception is 99 against a button.',
          sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-who-jams'],
        },
        {
          id: 'three-bet-15',
          label: '3-bet',
          historyText: '3-bets — no size exists at this depth',
          tableAction: { label: '3-bets' },
          verdict: 'mistake',
          shortWhy:
            'There is nothing to size. The 15bb chart prints three branches — all-in, call, fold — and no non-all-in 3-bet at all, because “at this stack depth, the BB is too shallow to have a non-all-in 3-betting range”. This option is on the screen so you can see the gap where it would be.',
          sources: ['depth.15bb-no-non-allin-3bet', 'depth.bb-vs-bn-15bb-chart'],
        },
        {
          id: 'all-in-15',
          label: 'All-in',
          historyText: 'Jams 15 bb',
          tableAction: { label: 'All-in', betBb: 15 },
          verdict: 'best',
          shortWhy:
            'The only raise the strategy has at 15bb, used with 18% of hands — and the source puts most pocket pairs in it, because they are ahead of a button’s range but realize equity badly out of position. The button folds 57.4% of the time.',
          sources: [
            'depth.bb-vs-bn-15bb-chart',
            'depth.15bb-who-jams',
            'depth.bn-response-to-15bb-jam',
          ],
        },
      ],
      bestOptionId: 'all-in-15',
      explanation:
        'All-in. Against a button open at 15bb the big blind jams 18%, calls 58.2% and folds 23.8% (Hand Range 155, p.382) — three branches, and a non-all-in 3-bet is not among them: “At this stack depth, the BB is too shallow to have a non-all-in 3-betting range” (p.381). So the real question is not whether 9♠9♦ is strong enough to raise, but which of the two raises exists, and only one does. The same page says who takes it: “The solver likes going all-in pre-flop at this stack depth with hands that are ahead of the opener’s range but have bad post-flop equity realization… Most pocket pairs make great rejamming hands except AA and KK, which get slowplayed vs LP.” 99 is a pocket pair, and it is not one of the named exceptions. The jam also works: after a 2bb open at this depth the button folds to a big-blind rejam 57.4% of the time and calls 42.6% (Hand Range 267, p.516).',
      unsourced: [
        {
          question: 'What size would the 3-bet be, if you took it?',
          answer:
            'The source prints none, because at 15bb there is no such branch to size. That is not a gap in the book — it is the strategy. Hand Range 155 has exactly three actions, and p.381 states the reason: the big blind is too shallow at this depth to have a non-all-in 3-betting range. The button on screen therefore carries no amount, which is the honest rendering of an action the solver does not price.',
          nearestSources: ['depth.15bb-no-non-allin-3bet', 'depth.bb-vs-bn-15bb-chart'],
        },
        {
          question: 'Where do the 2bb open and the 4.625bb pot come from?',
          answer:
            'The 2bb open is printed in the node where the button answers this jam: “BN 15bb (2x vs BB All-in)” (Hand Range 267, p.516) — the opener’s branch of the same 15bb solution. Ch.8’s prose around Hand Range 155 never restates the size, though it does confirm the shape, measuring the big blind’s fold “vs a min-raise” (p.381). The pot is the book’s own tournament arithmetic: p.293 states the MTT strategies were solved “for 9-max tables with a 12.5% ante”, so nine antes put 1.125bb in before any card is played, and 1.125 + 0.5 from the folded small blind + your 1 + the button’s 2 = 4.625bb. Your call is 1bb, not 2, because you are already in for the blind.',
          nearestSources: ['depth.bn-response-to-15bb-jam', 'mtt.solver-environment', 'mtt.ante-pot-size'],
        },
      ],
      theory: [
        {
          id: 'three-branches-not-four',
          title: 'Count the branches before you choose one',
          body:
            'The instinct with a mid pocket pair facing a steal is to ask how strong it is and pick an action to match. At 15bb that question cannot be answered, because one of the four actions you are used to having is not in the strategy. The big blind here has three: jam, call, fold. Not a small 3-betting range — none. The source states the cause directly, and it is a fact about the stack rather than about any hand: at this depth the big blind is too shallow to have a non-all-in 3-betting range. Once you have counted the branches, the decision with a pocket pair is nearly made for you.',
          exhibit: {
            caption: 'BB defence against a button min-raise, 15bb',
            scope:
              'Whole-range percentages printed with Hand Range 155 for BB vs BN at 15bb, 9-max MTT with a 12.5% ante. They describe the entire range at once and are not the frequency of any individual hand.',
            rows: [
              { label: 'Call', value: '58.2%', pct: 58.2, note: 'the biggest branch' },
              { label: 'Fold', value: '23.8%', pct: 23.8 },
              { label: 'All-in', value: '18%', pct: 18, note: 'the only raise available' },
              { label: '3-bet (non-all-in)', value: 'no such branch', note: 'not printed — see p.381' },
            ],
            sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-no-non-allin-3bet'],
          },
          bullets: [
            {
              text: '“With 15bb, the average BB fold vs a min-raise is 22.56%. At this stack depth, the BB is too shallow to have a non-all-in 3-betting range.” The absence is stated, not inferred from a chart that happens to omit it.',
              sources: ['depth.15bb-no-non-allin-3bet'],
            },
            {
              text: 'The same statement covers every in-position opener at 15bb, not just the button. It is the depth doing the work.',
              sources: ['depth.15bb-no-non-allin-3bet'],
            },
            {
              text: 'So a raise at 15bb means one thing only. Deciding to raise and deciding to jam are the same decision at this depth, which is not true at 40bb.',
              sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-no-non-allin-3bet'],
            },
          ],
          sources: ['depth.15bb-no-non-allin-3bet', 'depth.bb-vs-bn-15bb-chart'],
        },

        {
          id: 'why-a-pair-jams',
          title: 'Why a pocket pair is the shape that jams',
          body:
            'The source does not say "jam your strong hands". It says something more specific and more useful: jam the hands that are ahead of the opener’s range but will not get to keep that edge if the hand goes to a flop. A mid pair out of position is exactly that shape — ahead of a button steal right now, and awkward on most boards, where it will face overcards and tough decisions with a hand too good to fold. Getting the money in preflop banks the edge while it exists. Notice the author names the exceptions himself, and they run the other way: AA and KK get slowplayed against late position, because they are strong enough to want the button to keep playing.',
          bullets: [
            {
              text: '“The solver likes going all-in pre-flop at this stack depth with hands that are ahead of the opener’s range but have bad post-flop equity realization and thus perform better by getting the money in pre-flop.”',
              sources: ['depth.15bb-who-jams'],
            },
            {
              text: '“Most pocket pairs make great rejamming hands except AA and KK, which get slowplayed vs LP, and the smaller pairs are played using a mixed strategy vs EP.” 99 against a button is neither exception: not AA or KK, and not a small pair against early position.',
              sources: ['depth.15bb-who-jams'],
            },
            {
              text: 'The book states the class again at the next depth up, plainly: “Pocket pairs and Axo really like getting all-in.” That sentence is from the 25bb section, so read it for the hand class it names, not as a frequency at 15bb.',
              sources: ['bb25.pairs-and-axo-jam'],
            },
            {
              text: 'And the jam has fold equity to work with: after a 2bb open at 15bb, the button folds to a big-blind all-in 57.4% of the time and calls 42.6%.',
              sources: ['depth.bn-response-to-15bb-jam'],
            },
          ],
          unsourced: [
            {
              question: 'How often exactly does 9♠9♦ jam here?',
              answer:
                'Exact combo frequency is not specified in the source. Hand Range 155 is a colour-coded chart image, and the only figures printed in text are the three whole-range aggregates — 18% / 58.2% / 23.8%. What the book states in words is the class: most pocket pairs rejam, with AA and KK named as the exceptions against late position. This puzzle asserts membership of that class and stops there.',
              nearestSources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-who-jams'],
            },
          ],
          sources: ['depth.15bb-who-jams', 'depth.bb-vs-bn-15bb-chart'],
        },
      ],
    },

    /* ── DECISION 2: 40bb ─────────────────────────────────────────────── */
    {
      id: 'preflop-40bb',
      street: 'preflop',
      board: [],
      // 1.125 (antes) + 0.5 (folded SB) + 1 (your blind) + 2.3 (the open).
      potBb: 4.925,
      effectiveStackBb: 40,
      facingBetBb: 2.3,
      heroInvestedBb: 1,
      toCallBb: 1.3,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+1', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+2', text: 'Folds' },
        { street: 'preflop', actor: 'LJ', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.3 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      situation:
        'New hand, deeper: 40bb effective. Same seat, same opponent, same two cards. It folds to the button, who opens to 2.3bb, and the small blind folds. You are in the big blind with 9♠9♦ and 1.3bb more to call into a 4.925bb pot.',
      actionBeforeHero: [
        'UTG folds',
        'UTG+1 folds',
        'UTG+2 folds',
        'LJ folds',
        'HJ folds',
        'CO folds',
        'BTN raises to 2.3bb',
        'SB folds',
      ],
      question: 'Same hand, same opponent, 40bb. What do you do?',
      options: [
        {
          id: 'fold-40',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Folding is 24.2% of the range at this depth — almost unchanged from 15bb — but it is still not where this hand goes. The source prints 99 as the bottom of the 3-betting value range against a button.',
          sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
        },
        {
          id: 'call-40',
          label: 'Call',
          historyText: 'Calls 1.3 bb',
          tableAction: { label: 'Calls', betBb: 2.3 },
          verdict: 'mistake',
          shortWhy:
            'Calling is again the biggest branch — 58.6% — and again this hand is named elsewhere: the value range for the 40bb 3-bet against a button is “99+, ATs+, and AJ+”. With 40bb behind you have the room to raise and still play a hand, which you did not have at 15bb.',
          sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
        },
        {
          id: 'three-bet-40',
          label: '3-bet',
          historyText: '3-bets to 8.05 bb',
          tableAction: { label: 'Raises to', betBb: 8.05 },
          verdict: 'best',
          shortWhy:
            'The branch that did not exist at 15bb is now the biggest raise in the strategy at 14.1%, and the source names 99 as the bottom of its value range against a button. Same hand, same opponent — deeper stack, different action.',
          sources: [
            'preflop.bb-vs-bn-40bb-chart',
            'preflop.bb-3bet-value-40bb',
            'depth.bn-response-to-40bb-3bet',
          ],
        },
        {
          id: 'all-in-40',
          label: 'All-in',
          historyText: 'Jams 40 bb',
          tableAction: { label: 'All-in', betBb: 40 },
          verdict: 'defensible',
          shortWhy:
            'A real branch, and the smallest one: 3%, down from 18% at 15bb. The source says why in one line — “With 40bb, the BB is now too deep to 3-bet all-in against most positions… due to the lack of pre-flop fold equity”. Jamming 40bb to win a 4.925bb pot asks far too much of the fold.',
          sources: ['preflop.bb-vs-bn-40bb-chart', 'bb40.no-rejam-vs-ep'],
        },
      ],
      bestOptionId: 'three-bet-40',
      explanation:
        '3-bet. Nothing about the hand changed and nothing about the opponent changed — the stack did, and the strategy has a fourth branch now. Against a button open at 40bb the big blind 3-bets 14.1%, jams 3%, calls 58.6% and folds 24.2% (Hand Range 167, p.396). Compare the raises: the all-in that was 18% and the only raise available at 15bb is now 3% and the smallest branch of four, while the 3-bet that did not exist at all is the biggest raise in the strategy. The source gives the reason plainly: “With 40bb, the BB is now too deep to 3-bet all-in against most positions. In fact, the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges” (p.395). And it puts this exact hand in the new branch: the 3-betting value range against a button is “99+, ATs+, and AJ+” (p.395), of which 99 is the bottom card. Note what a 3-bet is risking rather than winning outright — the button’s only counter-raise at this depth is all-in (p.545), which it takes 8.8% of the time, calling 45.4% and folding 45.7% (Hand Range 297, p.548).',
      unsourced: [
        {
          question: 'What would the answer be at 30bb, halfway between?',
          answer:
            'Not specified in the source. The defence chapter solves four depths and states them: “the specific strategy recommended by solvers for all positions at stacks depths of 15bb, 25bb, 40bb and 60bb” (p.360). 30bb is not one of them, so there is no chart to read. Nor can one be read off by splitting the difference: on the 3-bet branch alone the printed values go 0% at 15bb, 8.2% at 25bb and 14.1% at 40bb, and a midpoint between the last two would be a number the book never solved for. What the source does support is the direction — as stacks deepen, the all-in branch shrinks and the non-all-in 3-bet grows.',
          nearestSources: [
            'defence.chapter-depths',
            'depth.bb-vs-bn-15bb-chart',
            'preflop.bb-vs-bn-25bb-chart',
            'preflop.bb-vs-bn-40bb-chart',
          ],
        },
        {
          question: 'Where do the 2.3bb open and the 8.05bb 3-bet come from?',
          answer:
            'Both from the label of the node where the button responds to this exact 3-bet: “BN 40bb (2.3x vs BB 3.5x 3-bet)” (Hand Range 297, p.548) — the opener’s branch of the same 40bb solution. Ch.8’s prose around Hand Range 167 restates neither size. In this book’s notation an opening “x” is big blinds while a 3-bet or 4-bet “x” multiplies the bet it faces, so 3.5x over a 2.3bb open is 8.05bb; the felt rounds that to 8.1 for display. The pot is 1.125bb of antes + the folded small blind’s 0.5 + your 1 + the button’s 2.3 = 4.925bb, and your call is 1.3bb because you are already in for the blind.',
          nearestSources: ['depth.bn-response-to-40bb-3bet', 'mtt.solver-environment', 'mtt.ante-pot-size'],
        },
      ],
      theory: [
        {
          id: 'the-branch-that-appeared',
          title: 'What deeper stacks actually changed',
          body:
            'Put the two charts side by side and the shift is not a matter of degree. The all-in did not merely become less popular — it went from being the strategy’s only raise to being its smallest branch, and a raise that did not exist took over. Neither the hand nor the opponent moved. The only variable was the stack, and it reassigned which actions the big blind even has.',
          exhibit: {
            caption: 'BB vs a button open — the two depths compared',
            scope:
              'Whole-range aggregates printed with Hand Range 155 (15bb, p.382) and Hand Range 167 (40bb, p.396), both BB vs BN in a 9-max MTT with a 12.5% ante. Two separate solutions of the same matchup, not one range changing — and neither figure is the frequency of any individual hand.',
            rows: [
              { label: 'All-in — 15bb', value: '18%', pct: 18, note: 'the only raise there is' },
              { label: 'All-in — 40bb', value: '3%', pct: 3, note: 'now the smallest of four branches' },
              { label: '3-bet — 15bb', value: 'no such branch', note: 'not printed at this depth' },
              { label: '3-bet — 40bb', value: '14.1%', pct: 14.1, note: 'the biggest raise in the strategy' },
              { label: 'Call — 15bb / 40bb', value: '58.2% → 58.6%', note: 'essentially unmoved' },
              { label: 'Fold — 15bb / 40bb', value: '23.8% → 24.2%', note: 'essentially unmoved' },
            ],
            sources: ['depth.bb-vs-bn-15bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
          },
          bullets: [
            {
              text: 'The two branches that barely move are calling and folding. Almost all of the change is inside the raise: which raise, not how often to raise.',
              sources: ['depth.bb-vs-bn-15bb-chart', 'preflop.bb-vs-bn-40bb-chart'],
            },
            {
              text: 'The source’s reason is fold equity, not hand strength: “With 40bb, the BB is now too deep to 3-bet all-in against most positions… due to the lack of pre-flop fold equity vs narrow ranges.”',
              sources: ['bb40.no-rejam-vs-ep'],
            },
            {
              text: 'Read the arithmetic behind that sentence. At 15bb the jam risks 15 to win a 4.625bb pot and gets a fold 57.4% of the time; at 40bb the same action risks 40 into 4.925bb. The prize hardly grew and the price nearly tripled.',
              sources: ['depth.bn-response-to-15bb-jam', 'bb40.no-rejam-vs-ep'],
            },
            {
              text: 'A 3-bet at 40bb is not a free upgrade either. The opener’s only counter-raise at 25-40bb is all-in, and after this open and this 3-bet the button takes it 8.8% of the time, calls 45.4% and folds 45.7%.',
              sources: ['depth.only-4bet-is-all-in', 'depth.bn-response-to-40bb-3bet'],
            },
          ],
          sources: ['preflop.bb-vs-bn-40bb-chart', 'bb40.no-rejam-vs-ep', 'depth.bb-vs-bn-15bb-chart'],
        },

        {
          id: 'same-hand-different-slot',
          title: 'The hand never changed slots by getting better',
          body:
            'It is worth being precise about what 9♠9♦ is doing in each answer, because the temptation is to read the deeper spot as "the hand is now good enough to 3-bet". It is not. At 15bb the source puts most pocket pairs in the jam because they are ahead of a button’s range and realize equity poorly out of position; at 40bb it prints 99 as the bottom of the value range for the non-all-in 3-bet against a button. The hand sits at the same place in the range at both depths. What changed is the action that place is assigned to.',
          bullets: [
            {
              text: '“if we compare the BB 3-betting ranges, it is very clear how the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG.” 99 is the bottom card of the value range against a button at this depth.',
              sources: ['preflop.bb-3bet-value-40bb'],
            },
            {
              text: 'Which is also a warning about reading across: that same sentence moves the boundary to TT+ against UTG. The hand you are holding does not decide the action on its own — the depth and the opener both get a say.',
              sources: ['preflop.bb-3bet-value-40bb'],
            },
            {
              text: 'And at 40bb there is a flop worth having: with 40bb behind, a 3-bet leaves room to play, which is exactly what a 15bb jam gives up on purpose.',
              sources: ['bb40.no-rejam-vs-ep', 'depth.15bb-who-jams'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book say 9♠9♦ specifically 3-bets rather than calls here?',
              answer:
                'It names the class boundary, not the combo. p.395 prints the value range as “99+, ATs+, and AJ+” against a button, which places 99 in the 3-betting range at its lower edge; the per-hand colours of Hand Range 167 are a chart image and appear nowhere in text. So exact combo frequency is not specified in the source, and a threshold hand is precisely where a real solver output is most likely to be mixed. This puzzle asserts the boundary the book prints and claims no frequency for the hand.',
              nearestSources: ['preflop.bb-3bet-value-40bb', 'preflop.bb-vs-bn-40bb-chart'],
            },
          ],
          sources: ['preflop.bb-3bet-value-40bb', 'preflop.bb-vs-bn-40bb-chart'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-vs-bn-15bb',
      label: 'BB vs a button open — 15bb',
      kind: 'composition',
      seat: 'hero',
      description:
        'The whole-range strategy printed with Hand Range 155. Three branches, and the missing fourth is the point: the book states that at this depth the big blind is too shallow to have a non-all-in 3-betting range at all.',
      bars: [
        { label: 'Call', pct: 58.2 },
        { label: 'Fold', pct: 23.8 },
        { label: 'All-in', pct: 18, note: 'most pocket pairs; AA and KK slowplayed vs LP' },
        { label: '3-bet (non-all-in)', pct: 0, note: 'no such branch is printed at 15bb' },
      ],
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from what the book prints in text. Hand Range 155 is a colour-coded chart image and the only figures printed with it are these aggregates. The repo’s one extracted per-hand BB-vs-BN chart (lib/learn/bbDefenseComplete.ts) is 100bb and says in its own file comment that it must not be reused at another stack depth — which is exactly the mistake this puzzle is about. So the explorer shows the aggregates and the hand classes the book names in words.',
          nearestSources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-who-jams'],
        },
      ],
      sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-no-non-allin-3bet', 'depth.15bb-who-jams'],
    },
    {
      id: 'bb-vs-bn-40bb',
      label: 'BB vs a button open — 40bb',
      kind: 'composition',
      seat: 'hero',
      description:
        'The same matchup solved 25bb deeper (Hand Range 167). Calling and folding are within half a point of their 15bb values; the entire change is that the all-in has collapsed to 3% and a non-all-in 3-bet worth 14.1% has appeared.',
      bars: [
        { label: 'Call', pct: 58.6, note: '58.2% at 15bb — essentially unmoved' },
        { label: 'Fold', pct: 24.2, note: '23.8% at 15bb — essentially unmoved' },
        { label: '3-bet', pct: 14.1, note: 'value range vs the BN: 99+, ATs+, AJ+' },
        { label: 'All-in', pct: 3, note: '18% at 15bb — now too deep for the fold equity' },
      ],
      unsourced: [
        {
          question: 'What does this matchup look like at 30bb?',
          answer:
            'Not specified in the source. The defence chapter solves 15bb, 25bb, 40bb and 60bb (p.360), and 30bb is not among them. The nearest printed rungs are 25bb — all-in 11.4%, 3-bet 8.2%, call 65.9%, fold 14.6% — and this 40bb chart; interpolating between them would produce solver output the book never generated. The trend across the four depths the book does solve is the safe reading: the all-in branch shrinks and the non-all-in 3-bet grows as stacks deepen.',
          nearestSources: [
            'defence.chapter-depths',
            'preflop.bb-vs-bn-25bb-chart',
            'preflop.bb-vs-bn-40bb-chart',
          ],
        },
      ],
      sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb', 'bb40.no-rejam-vs-ep'],
    },
    /*
     * The two opener nodes are separate exhibits rather than one, because each
     * is its own complete strategy summing to 100%. Stacking them into a single
     * bar would draw a 200% track and imply one partition where there are two.
     */
    {
      id: 'btn-vs-jam-15bb',
      label: 'The button facing the jam — 15bb',
      kind: 'composition',
      seat: 'villain',
      description:
        'Where the fold equity behind the 15bb answer is actually measured. After min-raising to 2bb, a button facing a big-blind all-in folds more often than it calls — which is what makes putting 15bb in with a mid pair work.',
      bars: [
        { label: 'Folds to the all-in', pct: 57.4 },
        { label: 'Calls the all-in', pct: 42.6 },
      ],
      sources: ['depth.bn-response-to-15bb-jam'],
    },
    {
      id: 'btn-vs-3bet-40bb',
      label: 'The button facing the 3-bet — 40bb',
      kind: 'composition',
      seat: 'villain',
      description:
        'The other side of the 40bb answer. A 3-bet is not a free roll: the button folds and calls at almost the same rate, and the one re-raise available to it at this depth is all-in.',
      bars: [
        { label: 'Folds to the 3-bet', pct: 45.7 },
        { label: 'Calls the 3-bet', pct: 45.4 },
        { label: '4-bets all-in', pct: 8.8, note: 'the only 4-bet size at 25-40bb' },
      ],
      sources: ['depth.bn-response-to-40bb-3bet', 'depth.only-4bet-is-all-in'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'Stack depth, not hand strength, decides whether the big blind jams, 3-bets or calls.',
  headlineSources: [
    'depth.bb-vs-bn-15bb-chart',
    'preflop.bb-vs-bn-40bb-chart',
    'bb40.no-rejam-vs-ep',
  ],
  takeaways: [
    {
      text: 'At 15bb the big blind has three actions against a button open — all-in 18%, call 58.2%, fold 23.8% — and a non-all-in 3-bet is not one of them, because “at this stack depth, the BB is too shallow to have a non-all-in 3-betting range”.',
      sources: ['depth.bb-vs-bn-15bb-chart', 'depth.15bb-no-non-allin-3bet'],
    },
    {
      text: 'At 40bb the same matchup has four — 3-bet 14.1%, all-in 3%, call 58.6%, fold 24.2%. Calling and folding barely moved; the raise changed identity.',
      sources: ['preflop.bb-vs-bn-40bb-chart'],
    },
    {
      text: 'The reason is fold equity, not card strength: “With 40bb, the BB is now too deep to 3-bet all-in against most positions… due to the lack of pre-flop fold equity vs narrow ranges.” At 15bb the button folds to the jam 57.4% of the time — a jam of 40bb into a 5bb pot cannot ask that much.',
      sources: ['bb40.no-rejam-vs-ep', 'depth.bn-response-to-15bb-jam'],
    },
    {
      text: 'A pocket pair is the class the source names on both sides of the change: “most pocket pairs make great rejamming hands” at 15bb, and 99 is the bottom card of “99+, ATs+, and AJ+” — the 3-betting value range against a button at 40bb.',
      sources: ['depth.15bb-who-jams', 'preflop.bb-3bet-value-40bb'],
    },
    {
      text: 'So before asking how strong your hand is, count the actions the depth gives you. Ask it at 30bb and there is no answer to read: the chapter solves 15, 25, 40 and 60bb, and interpolating between charts invents solver output.',
      sources: ['defence.chapter-depths'],
    },
  ],

  xp: 45,

  endsEarlyBecause:
    'Both decisions are preflop because the source answers a preflop question here: Hand Ranges 155 and 167 state what the big blind does against a button open at each depth, and the prose on pp.381 and 395 states why the two answers differ. Neither says how 9♠9♦ then plays a flop at either stack size, so the hand stops where the evidence does. The second decision is a fresh hand rather than a continuation of the first — same seat, same cards, same opponent, different stack — which is what makes the comparison a controlled one.',
}

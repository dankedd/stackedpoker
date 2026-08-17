import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 20 — "The river is a structure, not a board"
 * (Heads-up, BB vs BTN, 50bb start, ONE river decision)
 *
 * ONE idea: on the river a hand is either ahead of everything the Villain is
 * bluffing with or behind everything they are betting for value, and once the
 * situation is recognised as polar vs bluff-catcher the answer comes out of the
 * bet-size arithmetic rather than out of the cards on the felt. Nothing else is
 * introduced — no exploitative adjustment, no multi-street plan, no equity
 * realization. The three earlier streets exist only to build the structure and
 * are shown as history, never as decisions.
 *
 * THE ONE THING THIS FILE MUST NOT DO, and the reason the comment is this long:
 * Chapter 14 is abstract BY DESIGN. Its models are computed on the quartz board
 * 2♠2♣2♥2♦3♣ (p.783) and the chapter says in its own words that what it produces
 * is "heuristics on how to approach the most typical river situations" (p.782).
 * It solves no concrete river board anywhere. So there is no solver output for
 * 9♠6♠2♥K♠4♠ to quote, and the puzzle says so in those words rather than
 * dressing the model up as a solution. What licenses applying the model at all
 * is p.781: "It doesn't matter how the players got to the specific river
 * situation. As long as they arrive to the overall same structure, the GTO
 * strategy pair in that situation will be equivalent."
 *
 * Four content decisions worth recording:
 *
 * 1. THE BOARD IS CONSTRUCTED SO THE BLUFF-CATCHER IS UNAMBIGUOUS. On
 *    9♠6♠2♥K♠4♠ there are four spades, no pair and no possible straight. A set
 *    of kings therefore beats EVERY non-flush holding in the deck (no full
 *    house, no straight, no higher set is available — the fourth king is the
 *    board's own K♠), and loses to EVERY flush, which is any single spade. The
 *    split is exactly "does the Villain hold a spade", 100% or 0% equity with
 *    nothing in between and no tie possible. That is the p.779 property made
 *    literal, and it is why "Hero holds a bluff-catcher" needs no hedging here.
 *
 * 2. THE VILLAIN'S BLUFF COUNT IS AN ASSUMPTION, AND IS LABELLED ONE. The book
 *    never says how many bluffs this Villain has. What it does say is what a
 *    half-pot river bet from a polarized range looks like at equilibrium —
 *    75% value / 25% bluffs, 3-to-1 (p.136) — so the puzzle assumes the Villain
 *    is at that equilibrium at this size and says out loud that it is assuming
 *    it. p.809 supplies the condition that would void the whole answer: "Never
 *    call with bluff-catchers if the Villain doesn't have enough bluffs."
 *
 * 3. HALF-POT, NOT POT, IS THE BET-SIZE — and that is a pedagogical choice with
 *    a consequence. The abstract model has the polar player betting as large as
 *    possible; a half-pot bet is smaller than the model's own preferred size.
 *    It is used because p.136 works that exact size out in full, which lets
 *    every number on screen be either quoted or computed: Alpha 33%, 1-Alpha
 *    67%, 3-to-1, a 25% price. The deviation is disclosed in the flow.
 *
 * 4. "THE BEST BLUFF-CATCHER CALLS" IS A DERIVATION, NOT A SENTENCE IN THE BOOK.
 *    p.808 says all bluff-catchers are equal apart from blockers, p.779 gives a
 *    linear ordering of hand strength and p.809 says to defend close to 1-Alpha.
 *    Concluding from those three that a range defending 67% defends with its
 *    best 67% is this puzzle's reasoning. It is flagged as such in an
 *    `UnsourcedNote` rather than smuggled in as quoted theory.
 */
export const RIVER_STRUCTURE_BLUFFCATCHER: InteractivePuzzle = {
  id: 'river-structure-bluffcatcher',
  slug: 'the-river-is-a-structure',
  number: 20,
  title: 'The river is a structure, not a board',
  topic: 'River Defence',
  difficulty: 'intermediate',
  description:
    'One river decision with the best hand you could possibly hold that still loses to everything worth betting. The cards stop mattering the moment you can name the shape of the spot — after that it is arithmetic.',

  setup: {
    format: '50bb effective',
    // Heads-up, so there is no dead small blind and every figure on the felt is
    // a round number. The button posts the small blind and raises from it, which
    // is why the 2.5bb open and the 5bb pot need no third contributor.
    tableSize: 2,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['Kh', 'Kd'],
    effectiveStackBb: 50,
    gameNotes: 'Heads-up, single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'river',
      street: 'river',
      board: ['9s', '6s', '2h', 'Ks', '4s'],
      // 20bb was already in the middle; the button's 10bb river bet makes 30.
      potBb: 30,
      effectiveStackBb: 40,
      facingBetBb: 10,
      heroInvestedBb: 0,
      toCallBb: 10,
      actionBeforeHero: ['BTN raises to 2.5bb', 'Hero calls'],
      postflopAction: ['BB checks', 'BTN bets 10bb'],
      history: [
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.5 bb' },
        { street: 'preflop', actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
        { street: 'flop', actor: '', text: '9♠ 6♠ 2♥' },
        { street: 'flop', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'flop', actor: 'BTN', text: 'Bets 2.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Calls 2.5 bb', isHero: true },
        { street: 'turn', actor: '', text: 'K♠' },
        { street: 'turn', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'turn', actor: 'BTN', text: 'Bets 5 bb' },
        { street: 'turn', actor: 'BB', text: 'Calls 5 bb', isHero: true },
        { street: 'river', actor: '', text: '4♠ — pot 20 bb' },
        { street: 'river', actor: 'BB', text: 'Checks', isHero: true },
        { street: 'river', actor: 'BTN', text: 'Bets 10 bb' },
      ],
      situation:
        'You turned a set of kings and check-called again. The river is the 4♠ — a fourth spade. Your hand did not change; the situation did. On 9♠6♠2♥K♠4♠ there is no pair on the board, no straight available and the last king is the board’s own K♠, so your set beats every hand in the deck that does not contain a spade — and loses to every hand that does. The button bets 10bb into 20bb.',
      question: 'What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'defensible',
          shortWhy:
            'Folding is a real branch — a third of your bluff-catchers have to go — but this is the wrong third. Your hand beats every non-spade holding in the deck, so nothing else you hold defends better, and it blocks none of the Villain’s bluffs to argue you out of the call.',
          sources: ['river.defend-1-alpha', 'ch14.linear-ordering', 'ch14.no-blockers-irrelevant'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 10 bb',
          tableAction: { label: 'Calls', betBb: 10 },
          verdict: 'best',
          shortWhy:
            'The structure is polar versus bluff-catcher, and the bluff-catching player calls 1-Alpha. Against a half-pot bet Alpha is 10/(10+20) = 33%, so the defence is 67% — and this is the strongest bluff-catcher you can hold.',
          sources: ['river.polar-jams-nuts', 'river.defend-1-alpha', 'alpha.half-pot-river-example'],
        },
        {
          id: 'raise',
          label: 'Raise',
          historyText: 'Raises to 30 bb',
          tableAction: { label: 'Raises to', betBb: 30 },
          verdict: 'mistake',
          shortWhy:
            'A bluff-catcher never raises a polarized range. Every hand that calls you has you drawing dead, and every hand that folds was one you already beat — the book’s model has the bluff-catching player never betting at all.',
          sources: ['ch14.bluffcatcher-never-bets', 'ch14.bluffcatcher-calls-1-alpha'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. (1) THE ACTION: call the 10bb. (2) WHY: on the river hand values are fixed — “each hand having either 100% or 0% equity vs another hand” (p.779) — and on this board that binary is literal. Your set of kings beats every holding without a spade and loses to every holding with one, so you are a pure bluff-catcher: ahead of all of the Villain’s bluffs, behind all of their value. (3) THE RANGE THEORY: that is the polar-versus-bluff-catcher structure, and the book’s instruction for it is explicit — the polar player goes all-in with their nut hands and Alpha% of their bluffs, “and the bluff-catching player has to call with 1-Alpha of their range” (p.782). (4) THE ARITHMETIC: Alpha = bet / (bet + pot) = 10 / (10 + 20) = 33%, so 1-Alpha = 67%. A half-pot bet made with a polarized range should be 75% value and 25% bluffs (3-to-1), and it lays you 25% odds — which is exactly the fraction of that betting range you beat, so a generic bluff-catcher is indifferent and the tie is broken by hand quality and blockers. Yours is the best bluff-catcher available and it blocks nothing the Villain is bluffing with, so it belongs in the calling 67% rather than the folding 33%. (5) THE PASSAGE: “if you can recognize the river situation as being polar vs bluff-catcher, you will know that the GTO strategy for the polar player is to always go all-in with their nut hands and the Alpha % of their bluffs. and the bluff-catching player has to call with 1-Alpha of their range.” — Modern Poker Theory, p.782.',
      unsourced: [
        {
          question: 'What does the solver say about 9♠6♠2♥K♠4♠?',
          answer:
            'Nothing. The source gives a river model, not a solved frequency for this board. The reasoning here is that model applied to a matching structure. Chapter 14 computes its river work on the abstract board 2♠2♣2♥2♦3♣ (p.783) and describes its own output as heuristics generated from abstract models (p.782) — it solves no real river board anywhere in the chapter. What makes the transfer legitimate is the chapter’s own equivalence claim on p.781: as long as two situations arrive at the same structure, the GTO strategy pair is equivalent. So the claim being made is “this spot has the model’s structure”, never “the solver output for this board is X”.',
          nearestSources: [
            'ch14.abstract-models-are-heuristics',
            'ch14.structure-not-history',
            'ch14.nuts-identity-irrelevant',
          ],
        },
        {
          question: 'How many bluffs does this button actually have?',
          answer:
            'ASSUMPTION — not from the source. The book never states a bluff count for any real opponent. What it does state is the shape of a half-pot river bet made with a polarized range at equilibrium: 75% value, 25% bluffs, 3-to-1 (p.136). This puzzle assumes the button is at that equilibrium for this size, and every number downstream of it — the 25% hand-vs-range equity, the indifference — inherits that assumption. p.809 gives the condition that voids the answer entirely: “Never call with bluff-catchers if the Villain doesn’t have enough bluffs.” Against an opponent who never bluffs a river, this is a fold regardless of Alpha.',
          nearestSources: ['alpha.half-pot-river-example', 'ch14.value-range-starting-point'],
        },
        {
          question: 'Does the book say the strongest bluff-catcher is the one that calls?',
          answer:
            'Not in one sentence — that step is this puzzle’s reasoning. What the book supplies is three separate pieces: bluff-catchers are all equal except in their blockers (p.808), river hands have a linear ordering of strength (p.779), and you should defend close to 1-Alpha (p.809). Putting them together — a range that must defend 67% defends with its best 67%, and among equals the blockers decide — is a derivation, not a quotation. In the abstract model the question does not even arise, because there the bluff-catching range is a single undifferentiated hand class.',
          nearestSources: ['river.blockers', 'ch14.linear-ordering', 'river.defend-1-alpha'],
        },
      ],
      theory: [
        {
          id: 'the-structure',
          title: 'What you are actually looking at',
          body:
            'Stop reading the board and start reading the shape. Four spades are out, the board is unpaired and no straight is possible, so every hand in the deck sorts into exactly two piles: has a spade, or does not. Your set of kings is the best hand in the second pile — the last king is the board’s own K♠, so nothing without a spade beats you — and it loses to every hand in the first. That is not a description of a board. It is a description of a structure: one player holding nuts-or-air, the other holding a hand that beats the air and loses to the nuts.',
          bullets: [
            {
              text: 'The river is the street where this is even possible to state cleanly: “On the river there are no more cards to come, so the values of the hands are fixed. There are no draws, resulting in each hand having either 100% or 0% equity vs another hand.”',
              sources: ['ch14.hand-values-fixed'],
            },
            {
              text: 'The identity of the nuts is not an input. The book is blunt about it: “It doesn’t really matter if the nuts are a full house, flush, straight or any combination of those hands. The only important thing would be the overall ranges composition.” Here the nuts happen to be a flush. That fact does no work.',
              sources: ['ch14.nuts-identity-irrelevant'],
            },
            {
              text: 'Neither does the way you got here. “It doesn’t matter how the players got to the specific river situation. As long as they arrive to the overall same structure, the GTO strategy pair in that situation will be equivalent.” Three streets of check-calling are how the pot got to 20bb; they are not evidence about what to do now.',
              sources: ['ch14.structure-not-history'],
            },
            {
              text: 'Which is why the answer is quotable at all. The model’s instruction for this structure names both roles at once: the polar player goes all-in with their nut hands and the Alpha% of their bluffs, and the bluff-catching player has to call with 1-Alpha of their range.',
              sources: ['river.polar-jams-nuts'],
            },
          ],
          sources: ['ch14.hand-values-fixed', 'ch14.structure-not-history', 'river.polar-jams-nuts'],
        },

        {
          id: 'the-arithmetic',
          title: 'Alpha, computed from these numbers',
          body:
            'Alpha is the fraction of the time a bluff has to work to break even, and it is the one quantity in a river spot that may be calculated rather than looked up: Alpha = b / (b + p), where b is the bet and p is the pot before it. The button bet 10bb into 20bb, so Alpha = 10 / (10 + 20) = 33%, and the defence the model asks of your whole range is 1-Alpha = 67%. The book works this exact size out in full — a half-pot river bet from a polarized range lays 25% odds, should be built 75% value to 25% bluffs, needs to work 33% of the time, and asks the defender for 67%.',
          exhibit: {
            caption: 'Half-pot on the river: every number in this spot',
            scope:
              'Alpha and 1-Alpha are computed from this puzzle’s own pot and bet by the p.109 formula. The 3-to-1 ratio and the 25% price are the book’s worked half-pot river example (p.136), which describes a bet-size and a polarized range — not a solution for this or any other board. The 25% hand-vs-range equity follows from the p.779 equity definition applied to that ratio, and inherits the assumption that the button is at equilibrium for this size.',
            rows: [
              { label: 'Pot before the bet', value: '20 bb' },
              { label: 'Bet faced', value: '10 bb', note: 'half pot' },
              { label: 'Alpha = 10 / (10 + 20)', value: '33%', pct: 33, note: 'how often the bluff must work' },
              { label: '1-Alpha — the defence asked of your range', value: '67%', pct: 67 },
              { label: 'Value-to-bluff at this size', value: '75% / 25% (3-to-1)', pct: 75 },
              { label: 'Price you are laid', value: '25%', pct: 25, note: '10 to win 40' },
              {
                label: 'Your hand vs that betting range',
                value: '25%',
                pct: 25,
                note: 'you beat the bluffs and nothing else — so, indifferent',
              },
            ],
            sources: ['alpha.formula', 'alpha.half-pot-river-example', 'ch14.hand-vs-range-equity'],
          },
          bullets: [
            {
              text: 'The formula is the book’s: “Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.”',
              sources: ['alpha.formula'],
            },
            {
              text: 'Its mirror image is MDF — the same derivation read from the defender’s side, asking how often you must call to leave a bluff exactly break-even.',
              sources: ['alpha.mdf-definition'],
            },
            {
              text: 'Your equity is a count, not an estimate: “The hand vs range equity is simply the fraction of the opponent’s range the hand beats plus half of the hands it ties with.” You beat the bluffs, you tie with nothing, and at 3-to-1 the bluffs are a quarter of what was bet.',
              sources: ['ch14.hand-vs-range-equity'],
            },
            {
              text: 'And this is the street where the number deserves the weight: “These numbers become more relevant on the river when there are no more cards to come and you know if your hand has some equity in the pot or not.” The same source caps it in the next breath — Alpha and MDF are a rough guide, not a core strategy.',
              sources: ['alpha.river-relevance'],
            },
          ],
          unsourced: [
            {
              question: 'Why is the button betting half-pot rather than shoving?',
              answer:
                'That is a choice this puzzle made, not one the book recommends. In the abstract model the polarized player’s EV increases with bet-size, so the model’s own preference is the largest bet available (p.784). Half-pot is used here because p.136 works that exact size out in full, which lets Alpha, 1-Alpha, the value-to-bluff ratio and the price all be either quoted or computed rather than guessed. The structural answer — bluff-catcher defends 1-Alpha — is the same at any size; only the number changes.',
              nearestSources: ['ch14.bluffcatcher-calls-1-alpha', 'alpha.half-pot-river-example'],
            },
          ],
          sources: ['alpha.formula', 'alpha.half-pot-river-example', 'alpha.river-relevance'],
        },

        {
          id: 'which-bluffcatcher',
          title: 'Why this bluff-catcher and not another',
          body:
            'A 67% defence is a statement about a range, and a range is made of specific hands — so something has to decide which of your bluff-catchers call and which make up the folding third. The book gives one rule, and it is about blockers rather than about hand strength: bluff-catchers are interchangeable except in what they remove from the Villain’s range. Run it on your actual cards. K♥K♦ contains no spade, so it removes not one combination from a value range made entirely of flushes. It does remove two kings — but a button holding the last king without a spade has a pair of kings, a middling hand that a polarized bettor checks rather than jams. So you block no value and, more importantly, no bluffs.',
          bullets: [
            {
              text: 'The rule, in full: “On the river, all bluff-catchers are equal except in how they block value hands and don’t block bluffs. When you block the opponent’s value range, call more often. When you block the opponent’s bluffing range, fold more often.”',
              sources: ['river.blockers'],
            },
            {
              text: 'Your case is the fourth one the book lists — the neutral hand: “When you have no blockers, it is irrelevant, or slightly negative.” Nothing about your specific cards argues you out of the structural answer, which is what leaves the structural answer standing.',
              sources: ['ch14.no-blockers-irrelevant'],
            },
            {
              text: 'This is where the puzzle would flip. Had you arrived holding a busted spade draw’s worth of bluff-blockers — a hand that removes the combinations the button needs in order to be bluffing — the same rule sends you the other way: block their bluffing range, fold more often.',
              sources: ['river.blockers'],
            },
            {
              text: 'And the ordering is what puts your hand in the calling 67% rather than the folding 33%: “There is a linear ordering of hands in terms of strength that is history independent.” Against everything without a spade, no hand you could hold is stronger than this one.',
              sources: ['ch14.linear-ordering'],
            },
          ],
          sources: ['river.blockers', 'ch14.no-blockers-irrelevant', 'ch14.linear-ordering'],
        },

        {
          id: 'why-not-raise',
          title: 'Why raising is not on the menu',
          body:
            'It is tempting, holding a set, to want the last word. But look at what a raise can accomplish against a range that is either flushes or air. Every hand that calls it is a flush and you are drawing dead; every hand that folds to it was a bluff you already had beaten. There is no third group for the raise to work on, and the model says so directly for the bluff-catching player: they never bet.',
          bullets: [
            {
              text: '“P2 has P1 beat 90% of the time, but their equilibrium strategy is still to always check. P2 cannot bet because P1’s range is polarized. P1 knows when they have the best hand and can choose to only call when this is the case.” Being ahead of the range is not a reason to raise it.',
              sources: ['ch14.bluffcatcher-never-bets'],
            },
            {
              text: 'The model states both halves of the strategy pair together: “P2 will never bet, and their strategy when facing a bet is to call 1-Alpha of the time.” Call or fold is the whole action set.',
              sources: ['ch14.bluffcatcher-calls-1-alpha'],
            },
            {
              text: 'The same model also notes that this holds regardless of stack depth and regardless of who has position — which is why nothing about your 40bb behind, or about being out of position, changes the answer.',
              sources: ['ch14.bluffcatcher-calls-1-alpha'],
            },
          ],
          sources: ['ch14.bluffcatcher-never-bets', 'ch14.bluffcatcher-calls-1-alpha'],
        },

        {
          id: 'when-this-breaks',
          title: 'The one thing that would change the answer',
          body:
            'A 1-Alpha defence is a response to a betting range that actually contains bluffs. It is not a duty owed to anyone who bets. Everything above assumes the button is betting the equilibrium shape for this size — three value hands for every bluff — and that assumption is the puzzle’s, not the book’s. Against an opponent whose river bets are value only, the structure is not polar versus bluff-catcher at all, and the arithmetic that follows from it does not apply.',
          bullets: [
            {
              text: 'The book states the condition plainly: “Use their value range as a starting point… Never call with bluff-catchers if the Villain doesn’t have enough bluffs. If there is a lot of air in the Villain’s range, they will be more likely to be bluffing.”',
              sources: ['ch14.value-range-starting-point'],
            },
            {
              text: 'And it prices the approximation honestly rather than as a law: “Defending close to 1-Alpha is a good approximation in most river spots.”',
              sources: ['river.defend-1-alpha'],
            },
            {
              text: 'The author’s own limit on the arithmetic belongs here too: Alpha and MDF “can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO”.',
              sources: ['alpha.river-relevance'],
            },
          ],
          unsourced: [
            {
              question: 'Is this button’s range really polar?',
              answer:
                'The puzzle asserts it as a construction, and it is the assumption the whole answer rests on. What can be said from the source is narrower: the structure being modelled is one where a betting range is nuts-or-air against a range of bluff-catchers (p.782), and where a bettor’s range is polarized the book’s advice from the in-position seat is to bet as big as possible and add enough bluffs to make the defender indifferent (p.808). Whether this particular opponent is doing that is a read, and reads are outside what the book can supply.',
              nearestSources: ['river.polar-jams-nuts', 'river.blockers', 'ch14.value-range-starting-point'],
            },
          ],
          sources: ['ch14.value-range-starting-point', 'river.defend-1-alpha'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'villain-river-betting-range',
      label: 'The button’s river betting range',
      kind: 'composition',
      seat: 'villain',
      description:
        'The shape the model gives a polarized half-pot river bet: three value hands for every bluff. On this board that reads as “holds a spade” against “holds no spade and gave up on a draw”. This is an ASSUMPTION about the opponent, labelled as one — the source states the equilibrium ratio for the bet-size, never the bluff count of a real player.',
      bars: [
        { label: 'Value — any spade, i.e. a flush', pct: 75, note: 'beats your set 100% of the time' },
        { label: 'Bluffs — no spade, no pair', pct: 25, note: 'your set beats all of it' },
      ],
      unsourced: [
        {
          question: 'Where does 75 / 25 come from?',
          answer:
            'From the bet-size, not from the board. The book’s worked example states that a half-pot river bet made with a polarized range “should have 75% value-bets and 25% bluffs (3-to-1)” (p.136). Applying it here assumes this button is betting that equilibrium shape at this size. No solver output exists for 9♠6♠2♥K♠4♠ in the source — Chapter 14 solves abstract models, not boards — so the composition above is the model’s ratio, wearing this board’s clothes.',
          nearestSources: ['alpha.half-pot-river-example', 'ch14.abstract-models-are-heuristics'],
        },
      ],
      sources: ['alpha.half-pot-river-example', 'river.polar-jams-nuts'],
    },
    {
      id: 'hero-defence',
      label: 'What your range owes: 1-Alpha',
      headline: '67%',
      kind: 'aggregate',
      seat: 'hero',
      description:
        'Against a half-pot bet, Alpha is 10 / (10 + 20) = 33%, so the bluff-catching range defends 1-Alpha = 67% and folds the other 33%. That is a figure for the whole range, not for any one hand — which is exactly why the blocker rule exists to decide which hands fill it.',
      unsourced: [
        {
          question: 'Which 67% of your range, hand by hand?',
          answer:
            'Not specified in the source, and not specifiable from it. The abstract model treats the bluff-catching range as one undifferentiated class of hands, all equally indifferent, so it never has to rank them. The only sorting rule the book gives for real hands is the blocker rule (p.808), plus the observation that river hands are linearly ordered by strength (p.779). A set of kings on this board is the top of that ordering among hands without a spade, which is why this puzzle puts it in the calling 67% — a derivation, not a printed frequency.',
          nearestSources: ['ch14.bluffcatcher-calls-1-alpha', 'river.blockers', 'ch14.linear-ordering'],
        },
      ],
      sources: ['river.defend-1-alpha', 'alpha.formula', 'alpha.half-pot-river-example'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'Name the structure first; the board and the three streets that built it stop mattering the moment you can.',
  headlineSources: ['ch14.structure-not-history', 'ch14.nuts-identity-irrelevant'],
  takeaways: [
    {
      text: 'On the river every hand is either 100% or 0% against another — no draws, no maybes — so a bluff-catcher is a precise object: it beats all of their bluffs and loses to all of their value.',
      sources: ['ch14.hand-values-fixed'],
    },
    {
      text: 'Once you recognise polar versus bluff-catcher, the strategy pair is fixed: the polar player jams their nuts plus Alpha% of their bluffs, and the bluff-catching player calls 1-Alpha of their range.',
      sources: ['river.polar-jams-nuts', 'river.defend-1-alpha'],
    },
    {
      text: 'Alpha is arithmetic you can do at the table: bet / (bet + pot). A 10bb bet into 20bb gives 33%, so the defence is 67% — and the book works this exact size through: 3-to-1 value-to-bluff, a 25% price.',
      sources: ['alpha.formula', 'alpha.half-pot-river-example'],
    },
    {
      text: 'Which bluff-catchers fill that 67% is a blocker question, not a strength question: block their value, call more often; block their bluffs, fold more often; block neither, and the structural answer stands.',
      sources: ['river.blockers', 'ch14.no-blockers-irrelevant'],
    },
    {
      text: 'The whole answer is conditional on them having bluffs. Never call with a bluff-catcher against someone who does not bluff enough — and treat 1-Alpha as a good approximation, not a law.',
      sources: ['ch14.value-range-starting-point', 'river.defend-1-alpha'],
    },
  ],

  xp: 35,
}

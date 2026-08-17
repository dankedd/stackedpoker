import type { InteractivePuzzle } from '../types'

/**
 * Puzzle — "One hand, two openers"
 * (BB vs BN and BB vs UTG, 40bb, preflop only, two decisions)
 *
 * ONE idea and nothing else: how far the correct action moves when the ONLY
 * thing that changes is the opener's seat. Same 40bb, same big blind, same two
 * cards, same 2.2bb open — decided twice.
 *
 * The evidence is three places in Modern Poker Theory and no others:
 *   • Hand Range 167, p.396 — BB vs BN (40bb): All-in 3% / 3-bet 14.1% /
 *     Call 58.6% / Fold 24.2%
 *   • Hand Range 173, p.402 — BB vs UTG (40bb): 3-bet 5.8% / Call 49.1% /
 *     Fold 45%
 *   • The prose around Table 61 on p.395, which is the only place the book
 *     explains, in words rather than as a chart image, WHY those two sets of
 *     numbers differ.
 *
 * Four content decisions, each a place where the obvious version of this puzzle
 * would have claimed more than the source supports:
 *
 * 1. THE HERO HAND IS CHOSEN FROM THE BOOK'S OWN THRESHOLD, NOT FROM JUDGEMENT.
 *    p.395 writes the BB's value 3-betting range as "99+, ATs+, and AJ+ vs the
 *    BN" and "TT+ and AK vs UTG". AJ is the lowest offsuit ace named on the
 *    button side, and the class that disappears entirely on the UTG side. That
 *    is what makes A♠J♦ a boundary hand here: it is the hand the source itself
 *    puts on the moving edge. Any other hand would have required us to guess
 *    where the edge was.
 *
 * 2. NO PER-COMBO FREQUENCY IS CLAIMED, IN EITHER SCENARIO. Hand Ranges 167 and
 *    173 are colour-coded chart IMAGES; the only figures printed in text are the
 *    whole-range branches. So every claim here is of the form "the source moves
 *    the boundary this far, and here is where this hand sits relative to the
 *    classes it names" — never "the solver 3-bets this combo X% of the time".
 *    Both decisions carry an UnsourcedNote saying so in those words.
 *
 * 3. THE 2.2bb OPEN AND THE ABSENT 3-BET SIZE ARE THE PUZZLE'S, NOT THE BOOK'S.
 *    Neither Hand Range prints a bet-size. That absence is real rather than an
 *    extraction gap — the book prints sizes when it has them, as with Hand Range
 *    149 ("Raise 3.3x") and Hand Range 154 ("4-bet 2.2x"). So 2.2bb is stated as
 *    this puzzle's own fixed assumption, held IDENTICAL across both scenarios
 *    because that is what isolates the variable under test. It is defensible
 *    rather than arbitrary — p.294 names "somewhere between 2bb and 2.5bb from
 *    BN to UTG" as the RFI sweet spot, one band spanning both openers, and
 *    recommends min-raising only inside the rejam region below 25bb, which 40bb
 *    is not. The 3-bet lands on the felt with no amount attached rather than
 *    with an invented one, because no 3-bet size is printed anywhere here.
 *
 * 5. THE TABLE IS 9-MAX WITH A 12.5% ANTE, WHICH IS THE BOOK'S OWN GAME AND NOT
 *    A GUESS. Ch.8 does not restate its solve environment, and the temptation is
 *    to render a tidy 6-max table with no ante — which would put 3.7bb on the
 *    felt instead of 4.825bb and quietly misprice every decision on screen.
 *    p.293 states the environment for the MTT equilibrium strategies ("9-max
 *    tables with a 12.5% ante") and names 15/25/40/60bb as the depths studied,
 *    which is exactly the set Ch.8 solves. Nine antes of 0.125 are therefore
 *    live money in the pot before a card is dealt.
 *
 * 4. THE PAGE FOR THE VALUE-RANGE SENTENCE IS 395, NOT 396. It sits between the
 *    PAGE_395 and PAGE_396 markers in docs/mpt_fulltext.txt; only its closing
 *    clause runs onto 396. The convention is confirmed three ways on these same
 *    pages — Hand Range 167 under PAGE_396, Hand Range 173 under PAGE_402, both
 *    fold-frequency passages under PAGE_395 — each matching the printed page.
 */
export const BOUNDARY_MOVES_BY_OPENER: InteractivePuzzle = {
  id: 'boundary-moves-by-opener',
  slug: 'one-hand-two-openers-40bb',
  // Display number only. Several puzzles were authored in parallel and 6 was
  // claimed three times over; 9 was free at the time of writing.
  number: 9,
  title: 'One hand, two openers',
  topic: 'BB Defence',
  difficulty: 'intermediate',
  description:
    'The same 40bb, the same big blind, the same two cards, the same 2.2bb open — decided twice. Only the opener’s seat changes, and the correct action changes with it.',

  setup: {
    format: '40bb effective',
    // Nine-handed with every seat's ante live, because that is the game the book
    // solved: p.293 states the MTT equilibrium strategies are "9-max tables with
    // a 12.5% ante" and names 40bb as one of the studied depths. A 6-max no-ante
    // table would show 3.7bb in the middle instead of 4.825bb.
    tableSize: 9,
    heroSeat: 'BB',
    // Decision-level `villainSeat` overrides this; the setup value is the seat
    // the puzzle opens on.
    villainSeat: 'BTN',
    heroCards: ['As', 'Jd'],
    effectiveStackBb: 40,
    anteBb: 0.125,
    gameNotes:
      'MTT, 9-max, single raised pot. Blinds 0.5 / 1 with a 12.5% ante from every seat — 1.125bb of dead money before a card is dealt. The opener’s seat is the only thing that changes between the two decisions.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    /* ── Scenario A: the button opens ─────────────────────────────────── */
    {
      id: 'vs-bn',
      street: 'preflop',
      villainSeat: 'BTN',
      board: [],
      // 2.2 (button) + 1 (your posted blind) + 0.5 (folded SB) + 1.125 (nine
      // antes) = 4.825bb.
      potBb: 4.825,
      effectiveStackBb: 40,
      // You are in for 1 and the raise is TO 2.2, so the call costs 1.2.
      facingBetBb: 2.2,
      heroInvestedBb: 1,
      toCallBb: 1.2,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+1', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+2', text: 'Folds' },
        { street: 'preflop', actor: 'LJ', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Raises to 2.2 bb' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      actionBeforeHero: [
        'UTG folds',
        'UTG+1 folds',
        'UTG+2 folds',
        'LJ folds',
        'HJ folds',
        'CO folds',
        'BTN raises to 2.2bb',
        'SB folds',
      ],
      situation:
        'It folds to the button, who opens to 2.2bb. The small blind folds. You are in the big blind with A♠J♦, 40bb effective, and 1.2bb more to call into a 4.8bb pot. Hold on to this hand — you are about to play it twice.',
      question: 'The button opened. What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Against a button the big blind folds only 24.2% of its hands — the lowest folding frequency in the whole 40bb table. A hand sitting at the edge of the range the source names for VALUE 3-bets is not in that bottom quarter.',
          sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb', 'bb40.fold-jumps-by-seat'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.2 bb',
          tableAction: { label: 'Calls', betBb: 2.2 },
          verdict: 'defensible',
          shortWhy:
            'Calling is the single biggest branch against a button — 58.6% — so it is a real part of the strategy, and this hand sits at the very bottom edge of the value class rather than in the middle of it. But the source names AJ+ on the value 3-betting side here, and 14.1% is the widest non-all-in 3-betting frequency the big blind gets at this depth.',
          sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: 'Re-raises (3-bet)',
          tableAction: { label: 'Re-raises' },
          verdict: 'best',
          shortWhy:
            'The source names the value 3-betting range against a button as “99+, ATs+, and AJ+”, and A♠J♦ sits on the bottom edge of that named class. This is also where the 3-betting branch is at its widest — 14.1% non-all-in, plus a 3% all-in branch.',
          sources: ['preflop.bb-3bet-value-40bb', 'preflop.bb-vs-bn-40bb-chart'],
        },
      ],
      bestOptionId: 'three-bet',
      explanation:
        '3-bet. WHY: the only sentence in the book that names hands for this exact spot puts AJ inside the value 3-betting range — “the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG” (p.395) — and A♠J♦ sits on the bottom edge of the class named on the button side. RANGE THEORY: the button opens the widest range the big blind ever faces, so it is the range with the fewest strong hands per hundred combos; that dilution is what lets the big blind carry both the widest value 3-betting range and bluffs alongside it, and it shows up as the tightest folding frequency in the table. FREQUENCY: against a button the big blind 3-bets 14.1% non-all-in, jams 3%, calls 58.6% and folds only 24.2% (Hand Range 167, p.396) — 17.1% of the range raises, counting both branches. SIZING: none is available. Hand Range 167 prints no bet-size at all, so the 3-bet goes onto the felt without an amount rather than with an invented one. PASSAGES: Hand Range 167, p.396; the value-range sentence and the folding-frequency comparison, both p.395.',
      unsourced: [
        {
          question: 'How often exactly does A♠J♦ 3-bet here?',
          answer:
            'Exact combo frequency is not specified in the source. Hand Range 167 is printed as a colour-coded chart image; the only figures printed in text are the whole-range branches — all-in 3%, 3-bet 14.1%, call 58.6%, fold 24.2%. Those describe the entire range at once and are not the frequency of any individual hand. What the source states in words is the CLASS: the value 3-betting range against the button is “99+, ATs+, and AJ+”. This puzzle asserts that A♠J♦ sits on the bottom edge of a class the book names, and stops there.',
          nearestSources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
        },
        {
          question: 'Where do the 2.2bb open, the missing 3-bet size and the money on the felt come from?',
          answer:
            'The 2.2bb open is this puzzle’s assumption, not a figure lifted from these charts. Hand Ranges 167 and 173 print only their branches — and that silence is the book’s rather than a gap in extraction, because the book prints sizes when it has them (Hand Range 149 is titled “Raise 3.3x”, Hand Range 154 “4-bet 2.2x”). The assumption is a defensible one: p.294 puts the RFI sweet spot at “somewhere between 2bb and 2.5bb from BN to UTG” — one band covering both of this puzzle’s openers — and recommends min-raising only inside the rejam region below 25bb, which 40bb is not. Holding it identical across both scenarios is deliberate: it is what leaves the opener’s seat as the only thing that changes. The countervailing note is that the book also says “The earlier your position, the smaller your bet-sizing should be” (p.175), so a real UTG open might sit at the lower end of that band. No 3-bet size is printed anywhere here, so the re-raise appears on the felt with no amount attached. The 4.825bb pot is 2.2 from the opener, your posted 1, the folded small blind’s 0.5, and 1.125 of antes — nine seats at 12.5% each, because p.293 states these MTT strategies were solved for “9-max tables with a 12.5% ante”. Your call is 1.2 because you are already in for 1.',
          nearestSources: [
            'preflop.rfi-sweet-spot',
            'preflop.sizing-guidelines',
            'mtt.solver-environment',
            'preflop.bb-vs-bn-40bb-chart',
            'ex3.preflop-bb-vs-utg-40bb',
          ],
        },
      ],
      theory: [
        {
          id: 'the-named-class',
          title: 'The class the book names, and where this hand sits in it',
          body:
            'Almost everything printed about these two spots is a whole-range percentage, which can never answer “what do I do with these two cards”. One sentence is different: on p.395 the book names actual hands, and it names them for both openers in the same breath. That sentence is the reason this puzzle can be built at all, and the reason the hero hand is an ace-jack rather than something the source never mentions.',
          bullets: [
            {
              text: 'The sentence in full: “if we compare the BB 3-betting ranges, it is very clear how the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG.” Against the button, AJ is named. Against UTG, it is not.',
              sources: ['preflop.bb-3bet-value-40bb'],
            },
            {
              text: 'That makes A♠J♦ a boundary hand in the strict sense: it is the lowest offsuit ace inside the class the source names on the button side, and it belongs to the class that vanishes on the UTG side. The edge is the book’s, not an estimate.',
              sources: ['preflop.bb-3bet-value-40bb'],
            },
            {
              text: 'Against the button this is also the widest the 3-betting branch ever gets at 40bb — 14.1% non-all-in on top of a 3% all-in branch.',
              sources: ['preflop.bb-vs-bn-40bb-chart'],
            },
          ],
          unsourced: [
            {
              question: 'Does “AJ+” mean AJo, AJs, or both?',
              answer:
                'The book does not spell the notation out. It writes the value range as “99+, ATs+, and AJ+”, and because “ATs+” separately covers the suited aces, “AJ+” reads most naturally as the offsuit branch — AJo, AQo, AKo. Either reading contains AJ, which is why this puzzle can use it without the ambiguity mattering. What no reading gives you is a frequency: exact combo frequency is not specified in the source under either interpretation.',
              nearestSources: ['preflop.bb-3bet-value-40bb', 'preflop.bb-vs-bn-40bb-chart'],
            },
          ],
          sources: ['preflop.bb-3bet-value-40bb'],
        },

        {
          id: 'vs-button-numbers',
          title: 'What the whole range does against a button',
          body:
            'The four branches below are the entire strategy against a button open at 40bb. Read them as the shape of the range, not as anything about your two cards: the folding branch is the smallest the big blind ever has at this depth, and the raising branches are the largest. That is the profile of a range defending against the widest opener it will face.',
          exhibit: {
            caption: 'BB vs BN (40bb)',
            scope:
              'Whole-range percentages printed with Hand Range 167 for the BB defending a button open at 40bb, MTT ranges. They describe the entire range at once — none of them is the frequency of an individual hand.',
            rows: [
              { label: 'Call', value: '58.6%', pct: 58.6, note: 'the biggest single branch' },
              { label: 'Fold', value: '24.2%', pct: 24.2, note: 'the lowest folding frequency in the 40bb table' },
              { label: '3-bet (non-all-in)', value: '14.1%', pct: 14.1 },
              { label: 'All-in', value: '3%', pct: 3 },
            ],
            sources: ['preflop.bb-vs-bn-40bb-chart'],
          },
          bullets: [
            {
              text: 'Folding 24.2% is the number to hold on to — it is the near end of the comparison the book draws two sentences later, and the whole point of the second decision in this puzzle.',
              sources: ['bb40.fold-jumps-by-seat'],
            },
            {
              text: 'The 3% all-in branch is separate from the 14.1% 3-bet branch, which is why the answer button here says “3-bet” rather than folding the two together. At 40bb the big blind is “too deep to 3-bet all-in against most positions”, and the button is the position it can still occasionally jam against.',
              sources: ['preflop.bb-vs-bn-40bb-chart', 'bb40.no-rejam-vs-ep'],
            },
          ],
          sources: ['preflop.bb-vs-bn-40bb-chart'],
        },
      ],
    },

    /* ── Scenario B: rewind, and UTG opens instead ────────────────────── */
    {
      id: 'vs-utg',
      street: 'preflop',
      villainSeat: 'UTG',
      board: [],
      // Identical money: 2.2 (opener) + 1 (your blind) + 0.5 (folded SB)
      // + 1.125 (nine antes) = 4.825bb.
      potBb: 4.825,
      effectiveStackBb: 40,
      facingBetBb: 2.2,
      heroInvestedBb: 1,
      toCallBb: 1.2,
      history: [
        { street: 'preflop', actor: 'UTG', text: 'Raises to 2.2 bb' },
        { street: 'preflop', actor: 'UTG+1', text: 'Folds' },
        { street: 'preflop', actor: 'UTG+2', text: 'Folds' },
        { street: 'preflop', actor: 'LJ', text: 'Folds' },
        { street: 'preflop', actor: 'HJ', text: 'Folds' },
        { street: 'preflop', actor: 'CO', text: 'Folds' },
        { street: 'preflop', actor: 'BTN', text: 'Folds' },
        { street: 'preflop', actor: 'SB', text: 'Folds' },
      ],
      actionBeforeHero: [
        'UTG raises to 2.2bb',
        'UTG+1 folds',
        'UTG+2 folds',
        'LJ folds',
        'HJ folds',
        'CO folds',
        'BTN folds',
        'SB folds',
      ],
      situation:
        'Rewind the hand. Same table, same 40bb, same A♠J♦, same 2.2bb open, same 1.2bb to call into the same 4.8bb pot — but this time it is UTG who opened and everyone folded to you. One variable has changed, and it is not your cards.',
      question: 'Now UTG opened. What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Folding almost doubles against UTG — 24.2% to 45% — but that increase is about weak hands that struggle to realize equity out of position, not about a hand the same page names at the top of the button value range. Calling is still the largest branch at 49.1%.',
          sources: ['bb40.fold-jumps-by-seat', 'ex3.preflop-bb-vs-utg-40bb', 'preflop.bb-3bet-value-40bb'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.2 bb',
          tableAction: { label: 'Calls', betBb: 2.2 },
          verdict: 'best',
          shortWhy:
            'The value 3-betting range against UTG is named as TT+ and AK — AJ has dropped out of it — and the bluffing range shrinks along with the value range, so the hand does not come back as a bluff either. Nothing moves it to the folding side, and calling remains the biggest branch at 49.1%.',
          sources: ['preflop.bb-3bet-value-40bb', 'bb40.bluffs-shrink-with-value', 'ex3.preflop-bb-vs-utg-40bb'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: 'Re-raises (3-bet)',
          tableAction: { label: 'Re-raises' },
          verdict: 'mistake',
          shortWhy:
            'The same sentence that put AJ in the value range against a button takes it out against UTG, where the value range is TT+ and AK. The whole 3-betting branch collapses to 5.8%, and the source’s instruction against early position is to keep the 3-betting frequency low and use better hands as bluffs.',
          sources: ['preflop.bb-3bet-value-40bb', 'ex3.preflop-bb-vs-utg-40bb', 'bb40.defend-tighter-vs-ep'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. WHY: the identical sentence that made this a 3-bet one decision ago now removes it — “the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG” (p.395). AJ is no longer named, and it does not reappear on the bluffing side, because “when the value range shrinks, the bluffing range must also shrink” and the instruction against early position is to “defend tighter and… use better hands as bluffs, while keeping your 3-betting frequency low” (p.395). Nothing, however, pushes the hand into the folding class: that branch grows because weak hands stop being able to realize equity out of position against a strong range, which is not what a hand at the top of the button value range is. RANGE THEORY: UTG’s range is narrow and strong, so the big blind loses on both fronts at once — it has less to 3-bet for value, and less fold equity to bluff with. FREQUENCY: against UTG the big blind 3-bets 5.8%, calls 49.1% and folds 45% (Hand Range 173, p.402); no all-in branch is printed at all, because at 40bb “the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges” (p.395). SIZING: none is available — Hand Range 173 prints no bet-size, exactly as Hand Range 167 does not. PASSAGES: Hand Range 173, p.402; Hand Range 167, p.396; the value-range, bluff-shrink, defend-tighter and rejam sentences, all p.395.',
      unsourced: [
        {
          question: 'Does the book say A♠J♦ calls here rather than folds?',
          answer:
            'Not for the combo. Exact combo frequency is not specified in the source — Hand Range 173 is a chart image, and the figures printed in text are the whole-range branches 3-bet 5.8% / call 49.1% / fold 45%. What the source does state is the direction and the classes: the value 3-betting range against UTG is named as TT+ and AK, so AJ is outside it; the bluffing range shrinks along with the value range; and the folding branch grows because weak hands cannot realize equity out of position against a narrow range. This puzzle reads the answer off those three statements — the hand leaves the class the book names for raising, and nothing the book says moves it into the class it describes as folding — and it does not claim a percentage for A♠J♦ in either scenario.',
          nearestSources: [
            'ex3.preflop-bb-vs-utg-40bb',
            'preflop.bb-3bet-value-40bb',
            'bb40.bluffs-shrink-with-value',
            'bb40.defend-tighter-vs-ep',
          ],
        },
        {
          question: 'What replaces AJ as a bluff against UTG?',
          answer:
            'The book says the bluffs change but does not print the replacements for this depth. Its words are that “bluffs vs BN are made with completely different hands than vs EP”, and that you “should use better hands as bluffs” against an early-position opener — a direction, with the hand-by-hand answer left to the chart images of Hand Ranges 167-174. The nearest thing the book prints in words is the composition of the 25bb non-all-in 3-betting range, which is a different stack depth and is not transplanted here.',
          nearestSources: [
            'bb40.bluffs-shrink-with-value',
            'bb40.defend-tighter-vs-ep',
            'preflop.bb-3bet-composition-25bb',
          ],
        },
      ],
      theory: [
        {
          id: 'boundary-movement',
          title: 'How far the boundary actually moved',
          body:
            'This is the whole puzzle in one table. Nothing about the big blind changed between the two decisions — same seat, same stack, same price, same cards. The opener moved four seats, and every branch of the strategy moved with it.',
          exhibit: {
            caption: 'The same big blind, two different openers, 40bb',
            scope:
              'Whole-range percentages printed with Hand Range 167 (BB vs BN, p.396) and Hand Range 173 (BB vs UTG, p.402), both at 40bb with MTT ranges. The “total defence” row is the printed branches added together — 3 + 14.1 + 58.6 and 5.8 + 49.1 — and no other row involves arithmetic. None of these figures is the frequency of an individual hand.',
            rows: [
              { label: 'Fold', value: '24.2% → 45%', note: 'the book calls this increase drastic' },
              { label: 'Call', value: '58.6% → 49.1%' },
              { label: '3-bet (non-all-in)', value: '14.1% → 5.8%' },
              { label: 'All-in', value: '3% → no branch printed' },
              { label: 'Total defence', value: '75.8% → 55%', note: 'the printed branches added together' },
            ],
            sources: ['preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb', 'bb40.fold-jumps-by-seat'],
          },
          bullets: [
            {
              text: 'The book states the headline movement itself: “The folding frequency also increases drastically as Villain’s range gets stronger, from 24.2% vs the BN to 45% vs UTG.” That is 20.8 points of range that defends against one seat and gives up against another.',
              sources: ['bb40.fold-jumps-by-seat'],
            },
            {
              text: 'The 3-betting branch does not merely shrink — it narrows from both ends at once. The value range goes from 99+, ATs+ and AJ+ down to TT+ and AK, and “when the value range shrinks, the bluffing range must also shrink”.',
              sources: ['preflop.bb-3bet-value-40bb', 'bb40.bluffs-shrink-with-value'],
            },
            {
              text: 'The all-in branch disappears entirely: 3% against the button, none printed against UTG. The stated reason is fold equity — at 40bb the big blind is already too deep to rejam against most positions, and “the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges”.',
              sources: ['bb40.no-rejam-vs-ep', 'preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb'],
            },
          ],
          sources: ['preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb', 'bb40.fold-jumps-by-seat'],
        },

        {
          id: 'why-tighter-vs-ep',
          title: 'Why an early-position opener squeezes both sides',
          body:
            'It would be easy to read the shrinking 3-bet as caution and the growing fold as fear. The source gives a more specific account: against a narrow, strong opening range the big blind loses its two separate reasons to put in more money — it has fewer hands strong enough to raise for value, and less fold equity behind the ones it might raise as bluffs. Those are different losses, and they happen at the same time.',
          bullets: [
            {
              text: 'The instruction is stated plainly: “Against a non-all-in polarized range from an early position player, you should defend tighter and should use better hands as bluffs, while keeping your 3-betting frequency low.”',
              sources: ['bb40.defend-tighter-vs-ep'],
            },
            {
              text: 'And the reason the folding branch grows is about equity realization out of position, not about hand strength alone — which is exactly why it does not swallow a hand the same page names at the top of the button value range.',
              sources: ['bb40.fold-jumps-by-seat', 'bb40.defend-tighter-vs-ep'],
            },
            {
              text: 'The lesson generalizes past this one hand: the correct action is a function of the opener’s seat, and a range chart read without checking which opener it was solved against is a chart read wrong.',
              sources: ['preflop.bb-3bet-value-40bb', 'bb40.fold-jumps-by-seat'],
            },
          ],
          sources: ['bb40.defend-tighter-vs-ep', 'bb40.fold-jumps-by-seat'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-vs-bn-40bb',
      label: 'BB defence vs a button open (40bb)',
      kind: 'composition',
      seat: 'hero',
      description:
        'The whole-range strategy printed with Hand Range 167. Against the widest opener it faces, the big blind folds least and raises most — and this is the side of the comparison where the source names AJ inside the value 3-betting range.',
      bars: [
        { label: 'Call', pct: 58.6 },
        { label: 'Fold', pct: 24.2, note: 'the lowest folding frequency in the 40bb table' },
        { label: '3-bet (non-all-in)', pct: 14.1, note: 'value range named as 99+, ATs+, AJ+' },
        { label: 'All-in', pct: 3 },
      ],
      unsourced: [
        {
          question: 'Can you show the per-hand grid for this chart?',
          answer:
            'Not from what the book prints in text. Hand Range 167 is a colour-coded chart image, and the only figures printed with it are these four aggregates. No reviewed extraction of the 40bb charts exists in this repo either — the chart data it does hold is 100bb and says in its own file comment that it must not be reused at another stack depth. So this puzzle teaches from the aggregates and the hand classes the book names in words, and claims no per-combo frequency.',
          nearestSources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
        },
      ],
      sources: ['preflop.bb-vs-bn-40bb-chart', 'preflop.bb-3bet-value-40bb'],
    },
    {
      id: 'bb-vs-utg-40bb',
      label: 'BB defence vs an UTG open (40bb)',
      kind: 'composition',
      seat: 'hero',
      description:
        'The same strategy against the narrowest opener it faces, printed with Hand Range 173. Every branch has moved: folding nearly doubles, the 3-bet is more than halved, and the all-in branch is gone from the chart entirely.',
      bars: [
        { label: 'Call', pct: 49.1, note: 'still the biggest branch' },
        { label: 'Fold', pct: 45, note: 'up from 24.2% against the button' },
        { label: '3-bet (non-all-in)', pct: 5.8, note: 'value range named as TT+ and AK' },
      ],
      unsourced: [
        {
          question: 'Why is there no all-in row here?',
          answer:
            'Because Hand Range 173 does not print one, and the book explains the absence rather than leaving it to inference: at 40bb the big blind is already too deep to 3-bet all-in against most positions, and “the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges”. The row is left out rather than shown as 0%, because a printed zero would be a figure the source does not state.',
          nearestSources: ['bb40.no-rejam-vs-ep', 'ex3.preflop-bb-vs-utg-40bb'],
        },
      ],
      sources: ['ex3.preflop-bb-vs-utg-40bb', 'preflop.bb-3bet-value-40bb'],
    },
    {
      id: 'boundary-shift',
      label: 'How far the boundary moves',
      headline: '20.8 points',
      kind: 'aggregate',
      seat: 'both',
      description:
        'The size of the effect this puzzle exists to show. The big blind’s folding frequency goes from 24.2% against a button to 45% against UTG — 20.8 points of range that defends against one seat and folds against another, with the price, the stack and the cards all held fixed. The subtraction is the only arithmetic here; both endpoints are printed in the source.',
      unsourced: [
        {
          question: 'Does that mean 20.8% of hands switch from call to fold?',
          answer:
            'Not as stated. What the source prints is two folding frequencies, 24.2% and 45%, and the difference between them; it does not print which hands move, and the other branches move too — calling drops 58.6% to 49.1% and the 3-bet drops 14.1% to 5.8%, so the hands leaving the defending range come out of more than one branch. Exact combo frequency is not specified in the source for any of them.',
          nearestSources: ['bb40.fold-jumps-by-seat', 'preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb'],
        },
      ],
      sources: ['bb40.fold-jumps-by-seat', 'preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'Move the opener from the button to UTG and the same A♠J♦ goes from a value 3-bet to a call — nothing else changed.',
  headlineSources: ['preflop.bb-3bet-value-40bb', 'preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb'],
  takeaways: [
    {
      text: 'The opener’s seat is a bigger input than most players treat it as: at 40bb the big blind folds 24.2% against a button and 45% against UTG — the source calls the increase drastic.',
      sources: ['bb40.fold-jumps-by-seat'],
    },
    {
      text: 'The value 3-betting range shrinks from “99+, ATs+, and AJ+” against a button to “TT+ and AK” against UTG. AJ is precisely the class that drops out, which is why this hand answers differently in the two scenarios.',
      sources: ['preflop.bb-3bet-value-40bb'],
    },
    {
      text: 'The 3-bet narrows from both ends, not one: when the value range shrinks the bluffing range must shrink with it, so the branch falls from 14.1% to 5.8% and the hands used as bluffs change completely.',
      sources: ['bb40.bluffs-shrink-with-value', 'preflop.bb-vs-bn-40bb-chart', 'ex3.preflop-bb-vs-utg-40bb'],
    },
    {
      text: 'Against an early-position opener the instruction is to defend tighter, keep the 3-betting frequency low and use better hands as bluffs — and the all-in branch disappears altogether, because there is no fold equity against a narrow range.',
      sources: ['bb40.defend-tighter-vs-ep', 'bb40.no-rejam-vs-ep'],
    },
  ],

  xp: 40,

  comparesAlternativeOpeners:
    'The two decisions are the same preflop moment played twice, not a hand advancing. Hero’s cards, seat, stack, the open size and the price to call are all held identical on purpose; the only thing that changes is which seat opened — the button in the first, UTG in the second. That is the entire experiment, and it is why the second decision shows the same empty board and the same 4.825bb pot as the first.',

  endsEarlyBecause:
    'This is a preflop question asked twice, and the source answers it preflop both times. Hand Ranges 167 and 173 and the prose around Table 61 state what the big blind does against a button and against UTG at 40bb; they say nothing about how A♠J♦ plays on a flop in either scenario. Continuing past the decision would mean leaving the evidence behind, and the comparison is complete without it.',
}

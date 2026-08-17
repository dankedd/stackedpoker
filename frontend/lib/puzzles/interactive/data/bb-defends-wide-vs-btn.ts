import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 3 — "Why the big blind defends widest against the button"
 * (BB vs BN open, 100bb, preflop only)
 *
 * ONE idea, and deliberately nothing else: the big blind calls far more against
 * a button open than against any other position, and the reason is a fact about
 * the BUTTON's range rather than about the big blind's cards. Everything here
 * traces to two places in Modern Poker Theory — the prose on p.243 and the
 * aggregates printed with Hand Range 82 on p.244 — plus one positional check
 * from Ch.12 (pp.656-657). There is no flop. The source answers a preflop
 * question here, so the puzzle asks a preflop question.
 *
 * Three content decisions worth recording, because each is a place where the
 * obvious version of this puzzle would have overstated the evidence:
 *
 * 1. NO PER-COMBO FREQUENCY IS CLAIMED FOR A♥7♣. Hand Range 82 is a
 *    colour-coded chart IMAGE; the only figures printed in text are the
 *    whole-range aggregates 13.4 / 43.4 / 43.2. What the source states in words
 *    is the CLASS — "offsuit Ax" — which is why the hero hand is chosen from a
 *    class the book names, and why the puzzle says in the flow that the exact
 *    combo frequency is not specified in the source.
 *
 * 2. NO 13×13 GRID, THOUGH ONE COULD BE DRAWN. Unlike the 30bb puzzle, a
 *    reviewed extraction of THIS chart does exist in the repo
 *    (lib/learn/bbDefenseComplete.ts, BB_vs_BTN, 100bb — the same Hand Range
 *    82). It is deliberately not rendered here: it is a documented pixel
 *    reconstruction, `derivation: 'reconstructed'`, and this puzzle teaches
 *    from what the book prints in text. The `UnsourcedNote` says so rather
 *    than implying no such data exists anywhere.
 *
 * 3. THE CH.12 FIGURES ARE A DIFFERENT SIMULATION. p.657 prints "the BN's ~44%
 *    range", which reads exactly like the button open size this puzzle is
 *    missing — and is not. p.655 states that the whole flop c-bet section is
 *    aggregated from 20bb/30bb/40bb solutions using MTT starting ranges, so
 *    neither that 44% nor the 15% equity-realization figure describes a 100bb
 *    cash spot. They are cited here for the DIRECTION position pushes things,
 *    with the sim scope rendered alongside every time.
 *
 * 4. THE BET SIZES ARE GAME ASSUMPTIONS, NOT SOLVER OUTPUT. The 2.5bb button
 *    open and the 10bb out-of-position 3-bet are the sizes the chart was solved
 *    at, recorded from the book's game assumptions (pp.179-180) in the repo's
 *    own chart provenance. They are disclosed in the flow, because they come
 *    from a different part of the book than the passages this puzzle cites.
 */
export const BB_DEFENDS_WIDE_VS_BTN: InteractivePuzzle = {
  id: 'bb-defends-wide-vs-btn',
  slug: 'bb-defence-vs-a-button-open',
  number: 3,
  title: 'Why the big blind defends widest against the button',
  topic: 'BB Defence',
  difficulty: 'beginner',
  description:
    'One preflop decision with an offsuit ace in the big blind. The button opens, and the right answer is easy — what is worth learning is why this seat, and only this seat, lets you defend this wide.',

  setup: {
    format: '100bb effective',
    // Six-handed. The folded small blind is where the dead 0.5bb in the pot
    // comes from; a heads-up table would quietly lose it and make the 4bb pot
    // on screen wrong.
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: ['Ah', '7c'],
    effectiveStackBb: 100,
    gameNotes: 'Single raised pot, no ante. Blinds 0.5 / 1.',
  },

  /* ══════════════════════════════════════════════════════════════════════ */

  decisions: [
    {
      id: 'preflop',
      street: 'preflop',
      board: [],
      // 2.5 (button) + 1 (your posted blind) + 0.5 (folded SB) = 4bb.
      potBb: 4,
      effectiveStackBb: 100,
      // You are in for 1 and the raise is TO 2.5, so the call costs 1.5 — not 2.5.
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
        'It folds to the button, who opens to 2.5bb. The small blind folds. You are in the big blind with A♥7♣ — an offsuit ace — 100bb behind, and 1.5bb more to call into a 4bb pot.',
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds'],
      question: 'What do you do?',
      options: [
        {
          id: 'fold',
          label: 'Fold',
          historyText: 'Folds',
          tableAction: { label: 'Folds' },
          verdict: 'mistake',
          shortWhy:
            'Folding is a real branch here — 43.2% of hands — but not with this one. The source names offsuit Ax as part of what the big blind CALLS against a button, so this hand is on the other side of that split.',
          sources: ['bb100.hr82-aggregates', 'bb100.linear-3bet'],
        },
        {
          id: 'call',
          label: 'Call',
          historyText: 'Calls 1.5 bb',
          tableAction: { label: 'Calls', betBb: 2.5 },
          verdict: 'best',
          shortWhy:
            'Calling is the biggest branch of the strategy against a button open — 43.4% of hands — and the source names offsuit Ax among what the big blind calls with. Against any other position it can call nowhere near this wide.',
          sources: ['bb100.hr82-aggregates', 'bb100.linear-3bet', 'bb100.why-bb-calls-wider'],
        },
        {
          id: 'three-bet',
          label: '3-bet',
          historyText: 'Raises to 10 bb',
          tableAction: { label: 'Raises to', betBb: 10 },
          verdict: 'mistake',
          shortWhy:
            'The 13.4% 3-betting range is described as very linear — strength-ordered from the top down, with no bluff slot at the bottom for a hand like this. The same sentence puts offsuit Ax in the calling range instead.',
          sources: ['bb100.hr82-aggregates', 'bb100.linear-3bet'],
        },
      ],
      bestOptionId: 'call',
      explanation:
        'Call. Against a button open the big blind calls 43.4% of its hands, 3-bets 13.4% and folds 43.2% (Hand Range 82, p.244) — and the source names the calling range as “most suited hands, offsuit Ax, connectors and broadways” (p.243). A♥7♣ is an offsuit ace, so it enters the pot as a member of a class the book names by name. The reason the defence is this wide has nothing to do with your two cards: “The BN range is wide enough that now the BB can call many more hands compared to all the other positions, as the BN’s ability to barrel and overbet very aggressively is downgraded due to the strong hands being diluted” (p.243). 3-betting is unsupported because that 13.4% range is very linear — top-down by strength — and folding gives up a hand the same sentence assigns to the calling range.',
      unsourced: [
        {
          question: 'How often exactly does A♥7♣ call here?',
          answer:
            'Exact combo frequency is not specified in the source. Hand Range 82 is printed as a colour-coded chart image; the only figures printed in text are the whole-range aggregates — 3-bet 13.4%, call 43.4%, fold 43.2%. What the source does state in words is the class this hand belongs to: offsuit Ax is named as part of the calling range. (A reviewed pixel reconstruction of this exact chart does exist in this repo, lib/learn/bbDefenseComplete.ts — but a measurement of an image is not a figure the book prints, so no per-combo number is quoted here.)',
          nearestSources: ['bb100.hr82-aggregates', 'bb100.linear-3bet'],
        },
        {
          question: 'Where do the 2.5bb open and the 10bb 3-bet size come from?',
          answer:
            'From the book’s game assumptions, not from the passages this puzzle cites. Modern Poker Theory states the bet-sizes its 100bb solutions were run at — 2.5bb opens from the button, 10bb for an out-of-position 3-bet — on pp.179-180, recorded in this repo’s chart provenance for Hand Range 82. They are shown so the money on the felt adds up, and named here because they sit outside pp.243-244 and Ch.12. The 4bb pot is 2.5 from the button plus your posted 1 plus the folded small blind’s 0.5, and your call is 1.5 because you are already in for 1.',
          nearestSources: ['bb100.hr82-aggregates'],
        },
      ],
      theory: [
        {
          id: 'why-widest-vs-button',
          title: 'Why the button, and only the button',
          body:
            'The big blind is getting the same price against every open — the seat that changes is the raiser’s. A button opens more hands than any seat before it, and a range that wide is mostly made of hands that are not strong. That dilution is what unlocks a wide defence: the same aggression that punishes a loose caller — barrelling and overbetting — needs strong hands to be credible, and the button has proportionally fewer of them. So the big blind is allowed to bring more marginal hands to the flop and still show up with something.',
          exhibit: {
            caption: 'BB defence against a button open, 100bb',
            scope:
              'Whole-range percentages printed with Hand Range 82 for BB vs BN, 6-max cash, 100bb effective. These describe the entire range at once — they are not the frequency of any individual hand.',
            rows: [
              { label: 'Call', value: '43.4%', pct: 43.4, note: 'the biggest branch of the strategy' },
              { label: 'Fold', value: '43.2%', pct: 43.2 },
              { label: '3-bet', value: '13.4%', pct: 13.4 },
            ],
            sources: ['bb100.hr82-aggregates'],
          },
          bullets: [
            {
              text: 'The source states the mechanism directly: the button’s range is wide enough that the big blind can call many more hands compared to all the other positions, because the button’s ability to barrel and overbet very aggressively is downgraded when its strong hands are diluted.',
              sources: ['bb100.why-bb-calls-wider'],
            },
            {
              text: 'Read that as two linked effects, not one. A wide open means fewer strong hands per hundred combos, and fewer strong hands means less credible aggression on later streets — which is what makes a thin call survivable.',
              sources: ['bb100.why-bb-calls-wider'],
            },
            {
              text: 'Wide is still not “any two cards”: 43.2% of the big blind’s hands are folded even against this, the widest open it faces.',
              sources: ['bb100.hr82-aggregates'],
            },
          ],
          sources: ['bb100.why-bb-calls-wider', 'bb100.hr82-aggregates'],
        },

        {
          id: 'what-goes-where',
          title: 'Which hands the source puts in which range',
          body:
            'The book does not leave the composition of the two continuing ranges to inference. It names the shape of the 3-betting range and then lists the hand types that call — which is exactly why the hero hand in this puzzle is an offsuit ace and not something the source never mentions.',
          bullets: [
            {
              text: '3-bet: “a very linear range” — strength-ordered from the top down. A linear range has no bluff slot at its bottom, which is where a hand like A7 offsuit would have to fit.',
              sources: ['bb100.linear-3bet'],
            },
            {
              text: 'Call: “most suited hands, offsuit Ax, connectors and broadways”. A♥7♣ is an offsuit ace, so it belongs to a class the source names, and it belongs to it on the calling side.',
              sources: ['bb100.linear-3bet'],
            },
            {
              text: 'Those two clauses come from one sentence about one chart. They are what makes the answer here sourceable at all — the chart’s per-hand colours are not printed as text anywhere in the book.',
              sources: ['bb100.linear-3bet', 'bb100.hr82-aggregates'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book say which offsuit aces call and which fold?',
              answer:
                'No. It names the class — offsuit Ax — and leaves the hand-by-hand detail to the chart image. Exact combo frequency is not specified in the source, so this puzzle asserts membership of the class the book names and stops there.',
              nearestSources: ['bb100.linear-3bet', 'bb100.hr82-aggregates'],
            },
          ],
          sources: ['bb100.linear-3bet'],
        },

        {
          id: 'wide-is-not-winning',
          title: 'Defending wide is not the same as being the favourite',
          body:
            'It is easy to read a 43.4% calling range as the big blind taking control of the pot. It is not. The wide defence is a response to the button’s range being diluted; the button still has the position, and Chapter 12 puts numbers on what position is worth across the whole game.',
          exhibit: {
            caption: 'The positional picture',
            scope:
              'Ch.12, pp.656-657 — aggregated from thousands of GTO solutions at 20bb/30bb/40bb using MTT starting ranges (p.655), NOT the 100bb cash configuration of Hand Range 82. Read for the DIRECTION position pushes things, not as a number for this spot.',
            rows: [
              { label: 'Overall range advantage', value: 'In position' },
              { label: 'BN equity over-realization', value: '15%', pct: 15 },
              { label: 'UTG equity over-realization', value: '15%', pct: 15 },
            ],
            sources: ['position.ip-range-advantage', 'position.ip-over-realizes', 'position.ch12-sim-scope'],
          },
          bullets: [
            {
              text: '“Clearly IP has the overall range advantage.” Both the button and UTG over-realize their equity by 15% — position turns the same cards into a bigger share of the pot than being out of position does.',
              sources: ['position.ip-range-advantage', 'position.ip-over-realizes'],
            },
            {
              text: 'So the wide call is not a claim to be ahead. It is what the big blind is permitted to do because the button’s strong hands are diluted, while position keeps running the other way.',
              sources: ['bb100.why-bb-calls-wider', 'position.ip-range-advantage'],
            },
            {
              text: 'Mind the scope on these two figures: the chapter states they come from 20bb/30bb/40bb solutions with MTT starting ranges, so they are the shape of the positional effect, not a measurement of this 100bb cash spot.',
              sources: ['position.ch12-sim-scope'],
            },
          ],
          unsourced: [
            {
              question: 'Does the book itself frame wide defence as damage limitation?',
              answer:
                'Not in the passages used here. What the source states is the two facts, separately: the big blind can call many more hands against a button because the button’s strong hands are diluted (p.243), and in position holds the overall range advantage while both the button and UTG over-realize their equity by 15% (pp.656-657). Reading the first as damage limitation against the second is this puzzle’s framing, not the book’s sentence — and the second comes from a different set of simulations besides.',
              nearestSources: ['bb100.why-bb-calls-wider', 'position.ip-range-advantage', 'position.ch12-sim-scope'],
            },
          ],
          sources: ['position.ip-range-advantage', 'position.ch12-sim-scope'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bb-defence-vs-btn',
      label: 'Big blind defence vs a button open',
      kind: 'composition',
      seat: 'hero',
      description:
        'The whole-range strategy printed with Hand Range 82 at 100bb. Calling is the largest branch, and the source names its contents as most suited hands, offsuit Ax, connectors and broadways — which is where A♥7♣ enters the hand.',
      bars: [
        { label: 'Call', pct: 43.4, note: 'most suited hands, offsuit Ax, connectors, broadways' },
        { label: 'Fold', pct: 43.2 },
        { label: '3-bet', pct: 13.4, note: 'described as a very linear range' },
      ],
      unsourced: [
        {
          question: 'Can you show the 13×13 grid for this range?',
          answer:
            'Not from what the book prints in text. Hand Range 82 is a colour-coded chart image, and the only numbers printed with it are these three aggregates. This repo does hold a reviewed pixel reconstruction of this exact chart (lib/learn/bbDefenseComplete.ts, BB_vs_BTN at 100bb), but that is a documented measurement of an image rather than a figure the source states — so this puzzle teaches from the aggregates and the named hand classes, and claims no per-combo frequency.',
          nearestSources: ['bb100.hr82-aggregates', 'bb100.linear-3bet'],
        },
      ],
      sources: ['bb100.hr82-aggregates', 'bb100.linear-3bet'],
    },
    {
      id: 'btn-position-edge',
      label: 'Button’s edge in position',
      headline: '15%',
      kind: 'aggregate',
      seat: 'villain',
      description:
        'What the button keeps even when the big blind defends this wide. Chapter 12 states that IP has the overall range advantage, and that both the button and UTG over-realize their equity by 15% — though from a different set of simulations than Hand Range 82, so read it for direction rather than as a measurement of this spot.',
      unsourced: [
        {
          question: 'What percentage of hands does the button actually open here?',
          answer:
            'Not stated in the passages this puzzle uses. p.243 says only that the button’s range is “wide enough” that the big blind can call many more hands than against any other position. There IS a tempting number nearby — p.657 calls the button’s range “~44%” against UTG’s “~15%” — but p.655 states that whole section is aggregated from 20bb/30bb/40bb solutions using MTT starting ranges, so it is not the 100bb cash opening range for this hand. The argument here rests on the button’s range being wide, not on how wide exactly.',
          nearestSources: ['bb100.why-bb-calls-wider', 'position.ip-range-advantage', 'position.ch12-sim-scope'],
        },
      ],
      sources: ['position.ip-range-advantage', 'position.ch12-sim-scope'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline: 'The big blind defends widest against the button because the button opens widest.',
  headlineSources: ['bb100.why-bb-calls-wider', 'bb100.hr82-aggregates'],
  takeaways: [
    {
      text: 'Against a button open the big blind calls 43.4%, folds 43.2% and 3-bets 13.4% — calling is the biggest branch of the strategy.',
      sources: ['bb100.hr82-aggregates'],
    },
    {
      text: 'The reason is the button’s range, not your cards: a wide open dilutes the strong hands, which downgrades the button’s ability to barrel and overbet aggressively, so the big blind can call many more hands than against any other position.',
      sources: ['bb100.why-bb-calls-wider'],
    },
    {
      text: 'Wide does not mean shapeless. The 3-bet range is very linear, and the calling range is named as most suited hands, offsuit Ax, connectors and broadways — A♥7♣ calls as an offsuit ace.',
      sources: ['bb100.linear-3bet'],
    },
    {
      text: 'Calling wide is not the big blind taking over: IP still has the overall range advantage, and the button over-realizes its equity by 15% — a figure from the book’s 20-40bb aggregate, cited for its direction rather than as a number for this spot.',
      sources: ['position.ip-range-advantage', 'position.ip-over-realizes', 'position.ch12-sim-scope'],
    },
  ],

  xp: 30,

  endsEarlyBecause:
    'This is a preflop question and the source answers it preflop. Hand Range 82 and the prose on p.243 state what the big blind does against a button open; they say nothing about how A♥7♣ plays on a flop, so the hand stops where the evidence does rather than continuing into a street the source has not solved for it.',
}

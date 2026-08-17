import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 6 — "Who owns the straights" (BTN vs BB, two flops, 30bb)
 *
 * ONE idea, taught by holding everything else still: the big blind is the
 * player who holds the offsuit connectors, so the number of straights and
 * straight draws a flop allows is really a measure of how much of THEIR range
 * it activates. As that number rises, IP's c-bet frequency falls and the sizes
 * grow.
 *
 * THE TWO BOARDS. Both have zero flopped straights, and that is not a slip —
 * p.661 puts the OESD count INSIDE the zero-straight family ("Within the flops
 * with zero possible straights, we can create a subcategory for the number of
 * possible open-ended straight draws"). So the comparison the source actually
 * draws is between the two ends of that subcategory:
 *
 *   K♠8♥3♦  zero flopped straights, zero OESDs. No two board cards sit inside a
 *           four-rank run, so nothing the BB can hold is drawing at eight outs.
 *   9♠8♥3♦  zero flopped straights, three OESDs. The nine and the eight sit in
 *           three different four-card runs — J-T-9-8, T-9-8-7 and 9-8-7-6 — so
 *           J-T, T-7 and 7-6 are all open-enders. One card different; the whole
 *           strategy moves.
 *
 * WHY THE OESD COUNT IS ENUMERATED RATHER THAN ASSERTED. The book defines the
 * straight count with four worked examples (p.627) and then states plainly that
 * it will NOT develop the OESD subcategory: "for the scope of this book we will
 * only focus on the number of straights" (p.628). So there is no printed table
 * that classifies 9♠8♥3♦, and calling it a "three-OESD flop" on the book's
 * authority would be borrowing authority the book declined to lend. The three
 * draws are therefore listed card by card in the puzzle, where the learner can
 * check them.
 *
 * SOURCE STRENGTH: DERIVED, and the puzzle says so where the learner reads it.
 * Both quoted sentences are exact transcription, but they give a DIRECTION and
 * a diagram, not a frequency per bucket. Turning that into a ranking of three
 * buttons is our derivation. No number is claimed, and none is graded.
 *
 * SCOPE. Every figure in this section of Ch.12 comes from one aggregated
 * dataset — thousands of GTO solutions at 20bb/30bb/40bb with standard GTO MTT
 * starting ranges (p.655), measured at IP's decision after the BB checks
 * (p.656). The 30bb table below sits inside that range; the effect is stated
 * across it, not solved for this one depth.
 *
 * MONEY (blinds 0.5/1, 30bb effective, no ante). The 2.5bb open is an
 * implementation decision — the book prints no open size — and is disclosed as
 * one, exactly as in puzzle 1.
 *   preflop  BTN 2.5, SB folds, BB calls → flop pot 5.5, Hero 27.5 behind
 *   33% pot  1.8bb        67% pot  3.7bb
 */
export const CBET_CONNECTED_BOARDS: InteractivePuzzle = {
  id: 'cbet-connected-boards',
  slug: 'who-owns-the-straights',
  number: 6,
  title: 'Who owns the straights',
  topic: 'Flop C-betting',
  difficulty: 'intermediate',
  description:
    'Two flops, one card apart, with your hand and the pot held still. Nothing about A♠8♣ changes between them — only the number of straight draws the big blind can be holding — and that alone moves both how often you bet and how big. Graded DERIVED: the source states the direction of this effect, not a number.',

  setup: {
    format: '30bb effective',
    tableSize: 6,
    heroSeat: 'BTN',
    villainSeat: 'BB',
    heroCards: ['As', '8c'],
    effectiveStackBb: 30,
    gameNotes:
      'Single raised pot, no ante. Blinds 0.5 / 1. You opened the button to 2.5bb, the big blind called, and now checks to you. The source’s figures for this node are aggregated across 20bb / 30bb / 40bb.',
  },

  decisions: [
    /* ── BOARD 1: zero flopped straights, zero open-enders ───────────────── */
    {
      id: 'flop-no-straights',
      street: 'flop',
      board: ['Ks', '8h', '3d'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      toCallBb: 0,
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      history: [
        { street: 'flop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'flop', actor: 'SB', text: 'Folds' },
        { street: 'flop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: 'K♠ 8♥ 3♦ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      situation:
        'The flop is K♠ 8♥ 3♦ and the big blind checks to you. Count what this board can make for them. A flopped straight needs all three board cards inside a five-rank window: the king and the eight are five ranks apart, the eight and the three another five, so no two hole cards complete anything — zero flopped straights. Now count open-enders, which need two board cards inside a four-card run: the closest pair here is still five apart, so there are none of those either. You hold middle pair with an ace kicker, and nothing in the big blind’s range is drawing at eight outs.',
      question: 'The big blind has checked. What do you do with A♠ 8♣?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'mistake',
          shortWhy:
            'This family sits at the top of the source’s c-betting scale — “Flops with zero flopped straights are the highest c-bet ones.” Giving up the lead on the boards that get c-bet most often is the one answer the passage argues against.',
          sources: ['cbet.straights-favor-bb', 'cbet.analysis-after-bb-checks'],
        },
        {
          id: 'bet-33',
          label: 'Bet 33% pot',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'best',
          shortWhy:
            'Bet, and bet small. Betting is what the passage supports on the highest c-bet family of flops, and the only thing it says about size attaches the larger bets to the connected end of the scale. This board is the other end.',
          sources: ['cbet.straights-favor-bb', 'cbet.three-oesd-lowest'],
        },
        {
          id: 'bet-67',
          label: 'Bet 67% pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'defensible',
          shortWhy:
            'Betting is right; the size is the half the source addresses only by comparison. It gives the larger bet-sizes to the flops full of straight draws, and this board has none — but it prints no size for either board, so this is not contradicted outright.',
          sources: ['cbet.straights-favor-bb', 'cbet.three-oesd-lowest'],
        },
      ],
      bestOptionId: 'bet-33',
      explanation:
        'Bet 33% pot. WHY: the big blind’s edge on connected boards comes from holding offsuit connectors, and this board hands those hands nothing — no straight is possible and no open-ender either — so the advantage that would normally slow you down is simply absent. RANGE THEORY: the source is ranking the board by what it does to THEIR range, not yours: “Since the BB has more offsuit connectors than IP, flops with more possible flopped straights will, as expected, favor the BB.” Zero straights means none of that applies, which is why “flops with zero flopped straights are the highest c-bet ones.” SIZING AND FREQUENCY: the frequency is the highest on this scale; on size the book speaks only from the far end, giving the larger bet-sizes to the flops thick with straight draws — so the small size here is read off that comparison, not transcribed from a printed figure. PASSAGE: Modern Poker Theory, p.661, the prose accompanying Diagram 42, with the board classification itself defined on p.627.',
      unsourced: [
        {
          question: 'How much more often, and how much smaller?',
          answer:
            'Unanswerable from this passage, which is why this puzzle is graded DERIVED rather than Direct. The source gives the direction of this effect in a diagram; it does not print a frequency per straight-count bucket. Both quoted sentences are exact transcription, but the ranking of these three buttons is our derivation from a comparison the book states in words. One caveat worth stating rather than hiding: the book does print figures per straight-count bucket in one other place, p.673 — but as how often the flop gets CHECKED, inside the unpaired-flops-by-texture section, not as c-bet frequencies for this comparison. They are not imported here.',
          nearestSources: [
            'cbet.straights-favor-bb',
            'cbet.three-oesd-lowest',
            'cbet.straight-count-figures-elsewhere',
          ],
        },
        {
          question: 'Where does the 5.5bb pot come from?',
          answer:
            'From an implementation decision, not the source. The book prints no open size for this section, so the 2.5bb button raise is ours; the pot, and therefore both bet amounts on the buttons, follow from it. Nothing in the grading depends on those numbers — the answer is a size as a fraction of the pot, which is how the source expresses sizes throughout.',
          nearestSources: ['cbet.analysis-after-bb-checks'],
        },
      ],
      theory: [
        {
          id: 'zero-straights-top-of-scale',
          title: 'The board that gives the big blind nothing to hold',
          body:
            'The scale the source builds on this page measures one thing: how many of the big blind’s hands the flop turns into straights and straight draws. The reason is stated outright — the big blind has more offsuit connectors than you do, because a wide defending range keeps those hands and an opening range leans on high cards and suited hands instead. A board that cannot make a straight is a board where that entire advantage is dead, and it is the top of the c-betting scale for exactly that reason.',
          bullets: [
            {
              text: 'The mechanism, in the source’s own words: “Since the BB has more offsuit connectors than IP, flops with more possible flopped straights will, as expected, favor the BB.” The flop is being judged by what it does to their range, not by whether it hit yours.',
              sources: ['cbet.straights-favor-bb'],
            },
            {
              text: 'Which places this flop at the top of the scale: “the c-bet frequency decreases as there are more straights possible on the flop. Flops with zero flopped straights are the highest c-bet ones.”',
              sources: ['cbet.straights-favor-bb'],
            },
            {
              text: 'The straight count is the book’s own board classification, with its own worked examples — AQ7 has zero flopped straights, KT9 has one, 875 has two, JT9 has three. K-8-3 is an AQ7: no three of its cards fit inside a five-rank window, so no two hole cards can complete a straight.',
              sources: ['flops.straight-count'],
            },
            {
              text: 'On size, the passage speaks only by comparison and only from the far end — the flops thick with straight draws are the ones that take “the larger bet-sizes”. Nothing is printed for a board like this one, so the small size here is derived from that contrast rather than transcribed.',
              sources: ['cbet.three-oesd-lowest'],
            },
          ],
          sources: ['cbet.straights-favor-bb', 'cbet.analysis-after-bb-checks'],
        },
      ],
    },

    /* ── BOARD 2: zero flopped straights, three open-enders ──────────────── */
    {
      id: 'flop-three-oesds',
      street: 'flop',
      board: ['9s', '8h', '3d'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      toCallBb: 0,
      actionBeforeHero: ['UTG folds', 'HJ folds', 'CO folds', 'Hero raises to 2.5bb', 'SB folds', 'BB calls'],
      postflopAction: ['BB checks'],
      history: [
        { street: 'flop', actor: 'BTN', text: 'Raises to 2.5 bb', isHero: true },
        { street: 'flop', actor: 'SB', text: 'Folds' },
        { street: 'flop', actor: 'BB', text: 'Calls 1.5 bb' },
        { street: 'flop', actor: '', text: '9♠ 8♥ 3♦ — pot 5.5 bb' },
        { street: 'flop', actor: 'BB', text: 'Checks' },
      ],
      situation:
        'Rewind and deal it again. Same pot, same A♠ 8♣, same check from the big blind — one card is different. The king is now the 9♠, so the flop is 9♠ 8♥ 3♦. Count again. Still no flopped straight: 9, 8 and 3 do not fit inside a five-rank window, so nobody has a made straight. But now count open-enders, and the nine and the eight sitting next to each other sit inside three different four-card runs: J-T-9-8, T-9-8-7 and 9-8-7-6. So J-T, T-7 and 7-6 are all open-ended draws — three of them, where the last board had none. You still hold middle pair with an ace kicker.',
      question: 'The big blind has checked again. What do you do with A♠ 8♣?',
      options: [
        {
          id: 'check',
          label: 'Check',
          historyText: 'Checks',
          tableAction: { label: 'Checks' },
          verdict: 'defensible',
          shortWhy:
            'Not a mistake here — and that shift is the lesson. The source puts the lowest c-bet frequency of any flop family on exactly this one, so checking is a real part of the strategy on this board in a way it was not on the last. What it does not do is make checking the primary action: it ranks frequencies, it never names a majority.',
          sources: ['cbet.three-oesd-lowest', 'cbet.oesd-subcategory'],
        },
        {
          id: 'bet-33',
          label: 'Bet 33% pot',
          historyText: 'Bets 1.8 bb',
          tableAction: { label: 'Bets', betBb: 1.8 },
          verdict: 'defensible',
          shortWhy:
            'Betting is fine; the size runs against the one thing the source states about size on this family. The same sentence that gives these flops the lowest c-bet frequency gives them the larger bet-sizes — because the big blind holds more draws and your good hands need protection.',
          sources: ['cbet.three-oesd-lowest'],
        },
        {
          id: 'bet-67',
          label: 'Bet 67% pot',
          historyText: 'Bets 3.7 bb',
          tableAction: { label: 'Bets', betBb: 3.7 },
          verdict: 'best',
          shortWhy:
            'Both halves of the source’s sentence at once: you bet this board less often than the last one, and when you do bet, you bet bigger. Three open-enders in the big blind’s range is three reasons your middle pair cannot afford to give a cheap card.',
          sources: ['cbet.three-oesd-lowest', 'cbet.straights-favor-bb'],
        },
      ],
      bestOptionId: 'bet-67',
      explanation:
        'Bet 67% pot. WHY: one card turned three of the big blind’s hand classes into eight-out draws, and the source’s adjustment to that has two halves — bet less often, and bet bigger when you do. RANGE THEORY: the draws that appeared are J-T, T-7 and 7-6, which is precisely the shape the passage names as the big blind’s structural edge — they hold more offsuit connectors than you do, so a board that fits connectors fits their range and not yours. SIZING AND FREQUENCY: “the flops with three OESDs are the ones with the lowest c-bet frequency and with the larger bet-sizes, as the BB will have more possible straight draws and IP’s strong hands need more protection.” Lowest of the scale, not a printed percentage — no figure is attached to the bucket, so none is claimed here. PASSAGE: Modern Poker Theory, p.661, the prose accompanying Diagrams 42 and 43.',
      unsourced: [
        {
          question: 'How much less often, and how much bigger?',
          answer:
            'Unanswerable from this passage, which is why this puzzle is graded DERIVED rather than Direct. The source gives the direction of this effect in a diagram; it does not print a frequency per straight-count bucket. Both quoted sentences are exact transcription, but the ranking of these three buttons is our derivation from a comparison the book states in words. One caveat worth stating rather than hiding: the book does print figures per straight-count bucket in one other place, p.673 — but as how often the flop gets CHECKED, inside the unpaired-flops-by-texture section, not as c-bet frequencies for this comparison. They are not imported here.',
          nearestSources: [
            'cbet.straights-favor-bb',
            'cbet.three-oesd-lowest',
            'cbet.straight-count-figures-elsewhere',
          ],
        },
        {
          question: 'Where does “three OESDs” come from — did the book count this board?',
          answer:
            'No. The book defines the straight count with four worked examples and then says outright that it will not develop the open-ender subcategory: “for the scope of this book we will only focus on the number of straights.” So no printed table classifies 9♠8♥3♦. The three draws are enumerated here card by card — J-T, T-7 and 7-6, the only three four-card runs containing both the nine and the eight — so you can check the count yourself instead of taking a bucket label on trust.',
          nearestSources: ['flops.oesd-subcategory-limits', 'flops.straight-count'],
        },
      ],
      theory: [
        {
          id: 'three-oesds-both-halves',
          title: 'Three open-enders, and both halves of the adjustment',
          body:
            'Notice where this board sits in the book’s scheme: it still has zero flopped straights, exactly like the last one. The open-ender count is a subcategory drawn INSIDE the zero-straight family, not a separate axis — so this is a comparison between two boards that a coarse straight count would call identical, and the finer cut is the one that matters. What changed is not what the big blind can already have made. It is what they can be drawing to.',
          bullets: [
            {
              text: 'The nesting, stated by the source: “Within the flops with zero possible straights, we can create a subcategory for the number of possible open-ended straight draws.” Both of this puzzle’s flops have zero flopped straights; they sit at opposite ends of that subcategory.',
              sources: ['cbet.oesd-subcategory'],
            },
            {
              text: 'And the finding, with both halves in one sentence: “the flops with three OESDs are the ones with the lowest c-bet frequency and with the larger bet-sizes, as the BB will have more possible straight draws and IP’s strong hands need more protection.”',
              sources: ['cbet.three-oesd-lowest'],
            },
            {
              text: 'Those two halves are not in tension. Betting less often is about how much of your range can afford to go in; betting bigger is about what the hands that do bet need from the street — with three live draws against you, a cheap card is worth more to them than to you.',
              sources: ['cbet.three-oesd-lowest'],
            },
            {
              text: 'The same connectivity read from the other seat: the flops the book finds get donk bet more than half the time are ranks 7-x-x and 6-x-x “with one to three possible flopped straights”. Push further along this scale and the big blind stops waiting for you and takes the lead.',
              sources: ['family.high-donk-flops'],
            },
          ],
          sources: ['cbet.three-oesd-lowest', 'cbet.oesd-subcategory'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  // No range exhibit. The claim behind this whole puzzle — that the big blind
  // holds more offsuit connectors than the button — is stated by the source in
  // words and nowhere quantified in this section, so there is no percentage,
  // breakdown or chart that could honestly be drawn for it.
  ranges: [],

  takeawayHeadline:
    'Count the board’s straights before you count your own outs — the number you are really measuring is how much of the big blind’s range just woke up.',
  headlineSources: ['cbet.straights-favor-bb'],
  takeaways: [
    {
      text: 'The big blind is the player holding the offsuit connectors, so a flop’s straight count measures how much of THEIR range it activates — and the c-bet frequency falls as that count rises.',
      sources: ['cbet.straights-favor-bb'],
    },
    {
      text: 'Flops with zero flopped straights are the highest c-bet ones. K♠8♥3♦ is one of them: no three of its cards fit inside a five-rank window, so no straight is possible for anybody.',
      sources: ['cbet.straights-favor-bb', 'flops.straight-count'],
    },
    {
      text: 'Inside that zero-straight family the book cuts again by open-enders, and the flops with three of them draw both the lowest c-bet frequency and the larger bet-sizes — fewer bets, bigger ones, because the big blind has more draws and your good hands need protection.',
      sources: ['cbet.three-oesd-lowest', 'cbet.oesd-subcategory'],
    },
    {
      text: 'The same scale read from the other seat: the boards that get donk bet more than half the time are ranks 7-x-x and 6-x-x with one to three possible flopped straights.',
      sources: ['family.high-donk-flops'],
    },
  ],

  xp: 60,

  comparesAlternativeBoards:
    'Decision 2 swaps the K♠ for the 9♠ and changes nothing else — same hand, same pot, same checked-to-you node. The two flops are alternatives shown to the same player, not a runout, which is why the second board does not extend the first.',

  endsEarlyBecause:
    'There is no turn here because there is no hand. The two flops are a controlled comparison, one card apart, and the passage behind them is about which flops get c-bet and how big — not about how either board plays afterwards. Carrying this to a turn would mean inventing the part the source does not cover.',
}

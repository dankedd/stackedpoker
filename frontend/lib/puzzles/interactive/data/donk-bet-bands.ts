import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 13 — "Which band is this flop?" (BB vs IP, single raised pot, flop only)
 *
 * ONE skill, and deliberately nothing else: putting a flop into one of Modern
 * Poker Theory's four donk-bet frequency bands from the board alone. No hand is
 * dealt, no action is chosen, and no street after the flop is played.
 *
 * THE DERIVATION, DECLARED. This puzzle is graded DERIVED. Band membership is
 * EXACT for a flop the source names individually or that matches a named
 * subfamily; for any flop outside those lists, placing it in a band is a
 * judgement the book does not make. The three flops here were chosen because the
 * source names every one of them INDIVIDUALLY, so no judgement is being taught
 * as transcription:
 *
 *   654r  → High (50%+).  Named at p.632: "the highest frequency donk betting
 *           flop is 654r (67%)". This is the one flop in the whole puzzle that
 *           carries a per-flop percentage, because it is the only one the book
 *           prints one for in this form.
 *   A76r  → None (0-10%). An AXX flop, one of the six textures p.648 names as
 *           bad donk betting flops, and the chapter's own worked example: p.635
 *           concludes the BB should "simply check 100% on A76r".
 *   764m  → Mid (25-50%). Named at p.642: of the ~100 mid-band flops, "the only
 *           monotone flop is 764".
 *
 * WHY "LOW" IS AN OPTION THAT IS NEVER THE ANSWER. That is a finding, not a
 * gap in the puzzle. The low band (p.645) is printed as subfamilies only, and
 * seven of its unpaired subfamilies — 8MM, 8ML, 8LL, 7ML, 7LL, 6LL, 5LL — are
 * the SAME seven the mid band lists (p.642). No individual flop is named in the
 * low band anywhere. So choosing a flop to represent it would have meant
 * deciding, on our own authority, which side of that overlap it falls on. The
 * flow says so, at the decision where a learner would otherwise assume the
 * distractor was arbitrary.
 *
 * TWO KINDS OF CITATION, KEPT APART. The `bands.flop-*` refs (pp.625-629) are
 * facts about cards: what a flop's rank is, how straights are counted, what
 * monotone means, what A/H/M/L stand for. They hold for any spot. Everything
 * else is simulation output from one dataset — BB vs BN and BB vs UTG, single
 * raised pots, 20bb/30bb/40bb, aggregated (p.631) — and every figure quoted
 * from it is a BAND average over tens or hundreds of flops, never the frequency
 * of one flop inside it.
 *
 * MONEY. The felt shows one illustrative single raised pot so the table can be
 * drawn at all: blinds 0.5/1, a 2.5bb button open, called, for a 5.5bb pot with
 * 27.5bb behind — the same construction puzzle 1 uses and discloses. Nothing in
 * the answers depends on it; the bands are aggregated across 20bb, 30bb and
 * 40bb, and p.647 records that donk frequency is barely affected by stack depth.
 */

/** One illustrative SRP, identical at all three flops — see the header note. */
const PREFLOP_ACTION = [
  'UTG folds',
  'HJ folds',
  'CO folds',
  'BTN raises to 2.5bb',
  'SB folds',
  'Hero calls',
]

function history(flop: string) {
  return [
    { street: 'preflop' as const, actor: 'BTN', text: 'Raises to 2.5 bb' },
    { street: 'preflop' as const, actor: 'SB', text: 'Folds' },
    { street: 'preflop' as const, actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
    { street: 'flop' as const, actor: '', text: `${flop} — pot 5.5 bb` },
  ]
}

/** The same four answers, in the same order, at every flop. */
const BAND_LABEL = {
  high: 'High 50%+',
  mid: 'Mid 25-50%',
  low: 'Low 10-25%',
  none: 'None 0-10%',
}

export const DONK_BET_BANDS: InteractivePuzzle = {
  id: 'donk-bet-bands',
  slug: 'which-donk-bet-band',
  number: 13,
  title: 'Which band is this flop?',
  topic: 'Board Reading',
  difficulty: 'advanced',
  description:
    'Three flops, no hand. Every flop in hold’em falls into one of four donk-bet frequency bands, and you can read which one from the board alone — its rank, the straights it makes, and its suits. All three flops here are ones the book names individually; classifying a flop it does not name is a judgement, and this puzzle says where that line falls.',

  setup: {
    format: '20-40bb aggregate',
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'BTN',
    heroCards: [],
    effectiveStackBb: 30,
    gameNotes:
      'Single raised pot, blinds 0.5 / 1, no ante. The pot and stack on the felt are one illustrative spot so the table can be drawn — the bands themselves are aggregated over 20bb, 30bb and 40bb, against both the button and UTG. Your cards stay face down throughout.',
  },

  readsTheBoardOnly:
    'A band is a property of the board, not of a holding: the source assigns it from rank, flopped straights and texture, and the frequency it names is the whole big blind range betting, averaged over every hand in it. Dealing you two cards would invite you to answer from your hand instead of from the structure — and would suggest, falsely, that the answer changes when the cards do. So there is no hand here, and no action to choose.',

  comparesAlternativeBoards:
    'The three decisions are not one hand advancing. They are three different flops dealt into the same seat and the same pot, so each can be classified on its own terms.',

  decisions: [
    /* ══ 1. A♠7♥6♦ — None (0-10%) ═══════════════════════════════════════
     * Deliberately first. The no-donk band holds the vast majority of flops,
     * so it is the default a learner should start from; and this board is the
     * discrimination test in miniature, because it contains a 7 and a 6 — the
     * ranks the high band is built from — sitting under an ace that overrules
     * both. */
    {
      id: 'flop-a76r',
      street: 'flop',
      board: ['As', '7h', '6d'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('A♠ 7♥ 6♦'),
      situation:
        'The button opened, you called from the big blind, and the flop is A♠ 7♥ 6♦ — rainbow. You are first to act. Do not choose an action: this puzzle deals you no cards, and the only question is what kind of flop this is.',
      question: 'Which donk-bet frequency band does this flop belong to?',
      options: [
        {
          id: 'high',
          label: BAND_LABEL.high,
          verdict: 'mistake',
          shortWhy:
            'The high band is ranks 7-x-x and 6-x-x with one to three flopped straights. This board holds a 7 and a 6, but a flop’s rank is its highest card — so the rank here is the ace. And there is no straight on it at all.',
          sources: ['family.high-donk-flops', 'bands.flop-rank'],
        },
        {
          id: 'mid',
          label: BAND_LABEL.mid,
          verdict: 'mistake',
          shortWhy:
            'Every family in the mid band is topped by an 8, 7, 6 or 5, plus three named paired flops and one monotone flop. An ace-high board is in none of them.',
          sources: ['bands.mid-flops', 'bands.flop-rank'],
        },
        {
          id: 'low',
          label: BAND_LABEL.low,
          verdict: 'mistake',
          shortWhy:
            'The closest miss on the board. The low band does contain one ace family — ALL, an ace with two LOW cards — but this is not it: under the book’s own rank letters a 7 and a 6 are Mid cards, so A76 is an ace with two mid cards, and the general statement about AXX flops applies.',
          sources: ['bands.low-flops', 'bands.rank-letters', 'contrast.no-donk-flops'],
        },
        {
          id: 'none',
          label: BAND_LABEL.none,
          verdict: 'best',
          shortWhy:
            'Right. Rank A-x-x with zero flopped straights, and AXX flops are named among the textures that make a bad donk betting flop, where a 100% checking frequency is recommended. This is also the chapter’s own worked example of a board the big blind must not lead.',
          sources: ['contrast.no-donk-flops', 'bands.a76r-check-100', 'bands.flop-rank'],
        },
      ],
      bestOptionId: 'none',
      explanation:
        'None — 0-10%, and A76r is the flop the chapter uses to show why. Take the readings in order. Rank: a flop’s rank is its highest card, so this is A-x-x; the 7 and the 6 do not set it. Straights: zero, because no five-card run contains an ace alongside a 7 and a 6. Texture: rainbow, which raises the donk frequency inside a family but cannot move a board between families. That lands it in the group the book names as bad donk betting flops — trips, monotone, high card paired, disconnected two-tone, HXX and AXX. The range theory behind it is what the ace does to the two players. IP has 62% equity here against the big blind’s 38%, and the strong hands split 8% to the big blind against a staggering 31% for IP, because every Ax that IP holds is a top pair averaging 85% equity against the big blind’s range. A range that strong does not fold to a lead and raises one often, so leading only forces the big blind’s own money in with hands that would rather see a cheap turn. The book tests every way of splitting and finds all of them worse: IP gets to c-bet 100% of their range here, and it works better for the big blind to not split their range and simply check 100%. Across the whole no-donk band the big blind averages 39% equity, under-realizes it at 76% EQR for 30% of the pot, and donks about 1% of the time.',
      unsourced: [
        {
          question: 'How firm is a band classification?',
          answer:
            'Graded DERIVED. Band membership is exact for a flop the source names individually or that matches a named subfamily — and all three flops in this puzzle are named individually, which is why they were chosen. For any flop outside those lists, putting it in a band is a judgement rather than a transcription: the book prints the bands as counts, descriptions and subfamily lists, never as an enumeration of all 1,755 distinct flops. Where the lists disagree with each other, this puzzle says so instead of picking a side.',
          nearestSources: [
            'family.high-donk-flops',
            'bands.mid-flops',
            'bands.low-flops',
            'contrast.no-donk-flops',
          ],
        },
        {
          question: 'Is every ace-high flop in the no-donk band?',
          answer:
            'No, and the two lists genuinely disagree. The no-donk group is described as including AXX flops (p.648), while the low band separately names ALL — an ace with two low cards — among its unpaired subfamilies (p.645). A76 is not ALL: under the book’s rank letters the 7 and the 6 are Mid cards, so this is an ace with two mid cards and the general AXX statement is the one that reaches it. For an ace-high flop that the two lists really do dispute, the source does not settle it, and neither does this puzzle.',
          nearestSources: ['contrast.no-donk-flops', 'bands.low-flops', 'bands.rank-letters'],
        },
      ],
      theory: [
        {
          id: 'three-readings',
          title: 'Read the board in three passes',
          body:
            'There are 1,755 strategically distinct flops and nobody can study them one at a time. The book’s answer is to classify: flops that share common characteristics tend to be played in a similar fashion, so three readings of the board — taken in this order — put a flop into a band before anyone has been dealt a hand. Every one of the three is a fact about the cards. None of them requires knowing a position, a stack depth or a holding.',
          bullets: [
            {
              text: 'Rank first, and it decides the most. A flop’s rank is its highest card — Kxx means a king and two cards a king or lower. The donk-bet bands are indexed by it: the high band is 7-x-x and 6-x-x, while an ace or a broadway on top sends a board to the other end of the scale.',
              sources: ['bands.flop-rank', 'family.high-donk-flops', 'contrast.no-donk-flops'],
            },
            {
              text: 'Then count the flopped straights: how many two-card holdings make a straight using all three board cards. The book counts them on worked examples — zero on AQ7, one on KT9 (QJ), two on 875 (96 and 64), three on JT9 (KQ, Q8 and 87).',
              sources: ['bands.straight-count'],
            },
            {
              text: 'Then read the texture. Monotone is three cards of one suit, two-tone is two of one suit and a third of another, rainbow is three different suits. Texture moves a flop inside its band and, at the extremes, between bands.',
              sources: ['bands.flop-textures', 'family.high-donk-flops'],
            },
            {
              text: 'The letters in the band lists come from the same scheme: A is the lonely ace, H is K/Q/J/T, M is 9/8/7/6, L is 5/4/3/2. So 7ML is a seven-high flop with one mid card and one low card, and 6LL is a six-high flop with two low cards.',
              sources: ['bands.rank-letters'],
            },
            {
              text: 'One warning from the author before you use the bands to explain anything: the high donk betting frequencies are an effect and not a cause. What actually differs between the bands is how the two ranges are distributed, and the frequency follows from that.',
              sources: ['bands.effect-not-cause'],
            },
          ],
          sources: ['bands.classification-purpose', 'bands.distinct-flops'],
        },
        {
          id: 'why-the-ace',
          title: 'Why the ace is the whole answer',
          body:
            'Nothing about this flop is unusual except its top card, and that is enough. An ace on the flop is the card most likely to be in the range of the player who raised preflop and least likely to be in the range of the player who only called — so it hands IP a stack of top pairs that the big blind cannot match, and every argument for leading collapses at once.',
          exhibit: {
            caption: 'A76r: what the ace does to the two ranges',
            scope:
              'BB vs IP on A76r, averaged over 20bb/30bb/40bb stacks, from the BB vs BN and BB vs UTG aggregate. The chapter’s worked example of a no-donk flop — these are figures for this board, not for the band.',
            rows: [
              { label: 'IP equity', value: '62%', pct: 62 },
              { label: 'BB equity', value: '38%', pct: 38 },
              { label: 'IP strong hands', value: '31%', pct: 31 },
              { label: 'BB strong hands', value: '8%', pct: 8 },
              {
                label: 'Average equity of IP’s top pairs (any Ax)',
                value: '85%',
                pct: 85,
                note: 'against about 65% for a top pair on 654',
              },
            ],
            sources: ['contrast.a76r', 'bands.a76r-buckets'],
          },
          bullets: [
            {
              text: 'Because IP’s range is that strong they get to c-bet 100% of it without worrying about being check-raised — so the big blind does not need to lead their best hands to get money in. IP will put it in for them.',
              sources: ['bands.a76r-check-100'],
            },
            {
              text: 'And the alternatives are worse, one at a time. Lead with many bluffs and IP calls wider and raises the leads; lead only with weak hands and IP raises 100% of the time, taking both the pot and the bet. Every way of splitting loses, which is why the conclusion is not to split at all.',
              sources: ['bands.a76r-check-100'],
            },
            {
              text: 'The cost is measurable. Force the big blind to lead top pair or better here — only 10% of hands — and their total EV falls from 25 to 13, because a checking range that was protected by never leading is suddenly stripped of its best hands, dropping its own EV to 5.6.',
              sources: ['bands.a76r-locked-strategy'],
            },
          ],
          sources: ['bands.a76r-check-100', 'bands.a76r-buckets'],
        },
        {
          id: 'the-none-band',
          title: 'The band this flop lives in',
          body:
            'None — 0-10% — is not a small exception. It is the default. The vast majority of flops belong to this category: pretty much everything not included in any of the other three groups, which is why the useful skill is spotting the exceptions rather than memorising the rule.',
          exhibit: {
            caption: 'The no-donk band (0-10%)',
            scope:
              'Averages across the WHOLE no-donk group, from the BB vs BN and BB vs UTG 20-40bb aggregate. Not the frequency of any single flop in the group.',
            rows: [
              { label: 'BB equity', value: '39%', pct: 39 },
              { label: 'BB equity realization', value: '76% EQR', pct: 76, note: 'under-realized' },
              { label: 'Share of the pot the BB captures', value: '30%', pct: 30 },
              { label: 'Average donk bet frequency', value: 'about 1%', pct: 1 },
            ],
            sources: ['bands.none-metrics'],
          },
          bullets: [
            {
              text: 'The textures in the group, named: trips, monotone, high card paired, disconnected two-tone, HXX and AXX. Playing a 100% checking frequency is recommended.',
              sources: ['contrast.no-donk-flops'],
            },
            {
              text: 'And the headline the whole taxonomy sits under: across all flops the big blind’s overall donk bet frequency is only 2%, against an 84% IP c-betting frequency. The four bands exist to find where that 2% lives.',
              sources: ['donk.baseline-frequencies'],
            },
          ],
          sources: ['bands.none-metrics', 'contrast.no-donk-flops'],
        },
      ],
    },

    /* ══ 2. 6♠5♦4♣ — High (50%+) ════════════════════════════════════════ */
    {
      id: 'flop-654r',
      street: 'flop',
      board: ['6s', '5d', '4c'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('6♠ 5♦ 4♣'),
      situation:
        'Same seat, same pot, a new flop: 6♠ 5♦ 4♣, rainbow. Still no cards of your own. Read the rank, then the straights, then the suits.',
      question: 'Which donk-bet frequency band does this flop belong to?',
      options: [
        {
          id: 'high',
          label: BAND_LABEL.high,
          verdict: 'best',
          shortWhy:
            'Right, and by the widest margin available. Rank 6-x-x, three flopped straights, rainbow — the high band’s description clause by clause. The book also prints this flop by name: on average it is the highest frequency donk betting flop there is, at 67%.',
          sources: ['family.high-donk-flops', 'donk.654r-is-highest', 'example.654r-utg-straights'],
        },
        {
          id: 'mid',
          label: BAND_LABEL.mid,
          verdict: 'mistake',
          shortWhy:
            'One band too low, and a reasonable miss: 654 is a 6LL flop, and 6LL does appear in the mid band’s subfamilies. But a subfamily is the coarser statement, and the book names this individual flop as the highest-frequency donk bet in the game.',
          sources: ['bands.mid-flops', 'donk.654r-is-highest'],
        },
        {
          id: 'low',
          label: BAND_LABEL.low,
          verdict: 'mistake',
          shortWhy:
            'Two bands too low, for the same reason and then some: 6LL is listed in the low band as well as the mid band, and the individually named flop overrides both lists.',
          sources: ['bands.low-flops', 'donk.654r-is-highest'],
        },
        {
          id: 'none',
          label: BAND_LABEL.none,
          verdict: 'mistake',
          shortWhy:
            'The exact opposite end. 654 rainbow is not trips, monotone, paired, HXX or AXX — it is the board the chapter uses as the counter-example to all of them.',
          sources: ['contrast.no-donk-flops', 'donk.654r-is-highest'],
        },
      ],
      bestOptionId: 'high',
      explanation:
        'High — 50% and up. Rank: the highest card is a 6, so this is 6-x-x, one of the two ranks the high band is built from. Straights: three of them — 32, 87 and 73, each using all three board cards — and the band’s description is one to three, with a higher count pushing the frequency up and the bet-size down. Texture: rainbow, which the book says is donked more often than two-tone and far more often than monotone. All three readings agree, and the source removes the last doubt by naming the flop directly: on average, the highest frequency donk betting flop is 654r, at 67%. The range theory is a shape worth learning to recognise. On these boards the big blind’s range is more polarized than IP’s and holds the advantage in both strong and good hands, while half of IP’s range is weak hands that would rather check behind and see a free turn — a structure the book compares to the Clairvoyance Toy game, with the depolarized player sitting out of the betting lead. So the big blind leads, denying IP that free card and forcing money in from hands that did not want to put it in. Across the band that comes to 50% average equity, over-realized at 103% EQR for 52% of the pot. It also survives the change of opener: these boards are donked 67% of the time against UTG and 53% against the button, and both are inside the band.',
      unsourced: [
        {
          question: 'Which 34 flops are in the high band?',
          answer:
            'The book does not list them. It states there are about 34, describes them as ranks 7-x-x and 6-x-x with one to three possible flopped straights, and prints a table of their averaged statistics — but no enumeration appears in the text. So a flop can be checked against the description, which this one matches on every clause while also being named individually. A flop that matches the description only loosely is a judgement the source does not make for you.',
          nearestSources: ['family.high-donk-flops', 'donk.654r-is-highest'],
        },
      ],
      theory: [
        {
          id: 'why-bb-leads',
          title: 'Why the big blind, not IP, wants to bet here',
          body:
            'The high band is not a list of boards the big blind happens to hit. It is a range shape. When the out-of-position player holds the more polarized range and the in-position player holds a pile of weak hands that want a free card, the betting lead belongs to the polarized player — and that is exactly the configuration these flops create.',
          exhibit: {
            caption: 'The high band (50%+)',
            scope:
              'Averages across ALL high-donk-frequency flops, from the BB vs BN and BB vs UTG 20-40bb aggregate — not 654r alone.',
            rows: [
              { label: 'BB equity', value: '50%', pct: 50 },
              { label: 'BB equity realization', value: '103% EQR', note: 'over-realized' },
              { label: 'Share of the pot the BB captures', value: '52%', pct: 52 },
              { label: 'IP’s range that is weak hands', value: '50%', pct: 50 },
              {
                label: 'Donk frequency, by opener',
                value: '67% vs UTG / 53% vs BN',
                note: 'both inside the band',
              },
            ],
            sources: ['family.high-donk-eqr', 'family.high-donk-polarity', 'donk.frequency-by-opener'],
          },
          bullets: [
            {
              text: 'The shape, stated: the big blind’s range is more polarized than IP’s and has the advantage in both strong and good hands, while 50% of IP’s range is weak. The book names the resemblance outright — this is the Clairvoyance Toy game with IP holding the depolarized range, which is what makes the big blind want to take the betting lead.',
              sources: ['family.high-donk-polarity'],
            },
            {
              text: 'The mechanism: IP’s weak hands would happily check behind for a free turn. Donk betting denies IP that equity realization and leverages the informational advantage of leading with a well-balanced range that cannot easily be attacked.',
              sources: ['donk.654r-denies-eqr'],
            },
            {
              text: 'On 654r specifically, the equity sits with the big blind at 51% to 49% — and every Ax IP holds is worth about 49%, an ace-high hand demoted to a weak hand by a board with no ace on it.',
              sources: ['eq.654r-vs-a76r', 'buckets.654r-ax-devalued'],
            },
            {
              text: 'It holds against either opener, and it is strongest against the tighter one: donk betting on these boards happens 67% of the time against UTG and 53% against the button, because the high donk betting boards are missed a lot more often by UTG ranges.',
              sources: ['donk.frequency-by-opener'],
            },
          ],
          sources: ['family.high-donk-eqr', 'family.high-donk-polarity'],
        },
        {
          id: 'three-straights',
          title: 'Three straights, and what they do to the size',
          body:
            'The high band’s description does not stop at rank. The straight count is doing work inside it, and the direction is stated: the higher the number of flopped straights, the smaller the donk bet-size and the higher the donk bet frequency used. Three is the maximum a flop can have, and this board has it.',
          bullets: [
            {
              text: 'The book’s own enumeration of the straights on 654 is 32, 87 and 73. Note what is not on that list: 76 is top pair plus an open-ender here, not a straight.',
              sources: ['example.654r-utg-straights'],
            },
            {
              text: 'The size follows the count. At 30-40bb the most used donk bet-size on these boards is 1/4-pot, with 2/3-pot used on average 5% of the time.',
              sources: ['family.high-donk-bucket-frequencies'],
            },
            {
              text: 'And the suits follow the same ordering: rainbow flops are donked at a higher frequency than two-tone flops, and monotone flops a lot less frequently. This board is rainbow, which puts it at the top of its own family as well as at the top of the band.',
              sources: ['family.high-donk-flops'],
            },
          ],
          unsourced: [
            {
              question: 'Why do more flopped straights mean a smaller bet?',
              answer:
                'The source states the relationship and not the reason. What it prints is the direction — the higher the number of flopped straights, the smaller the donk bet-size and the higher the donk bet frequency used — and it prints that inside the description of the high band rather than as a general law. Any causal story past that point would be ours, not the book’s.',
              nearestSources: ['family.high-donk-flops'],
            },
          ],
          sources: ['family.high-donk-flops', 'example.654r-utg-straights'],
        },
      ],
    },

    /* ══ 3. 7♦6♦4♦ — Mid (25-50%) ═══════════════════════════════════════
     * The subtlest of the three, and the reason the puzzle needs three flops
     * rather than two: rank and straights read almost like 654r, and the suits
     * alone move it down a band. It is also the only monotone flop the book
     * pulls out of the no-donk group, so the natural inference — "monotone,
     * therefore never lead" — is wrong here by name. */
    {
      id: 'flop-764m',
      street: 'flop',
      board: ['7d', '6d', '4d'],
      potBb: 5.5,
      effectiveStackBb: 27.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('7♦ 6♦ 4♦'),
      situation:
        'Last flop: 7♦ 6♦ 4♦. A seven-high board that makes two straights — and all three cards are diamonds.',
      question: 'Which donk-bet frequency band does this flop belong to?',
      options: [
        {
          id: 'high',
          label: BAND_LABEL.high,
          verdict: 'mistake',
          shortWhy:
            'It has the rank and it has the straights — 7-x-x with two of them — but not the suits. Rainbow flops are donked at a higher frequency than two-tone, and monotone flops a lot less frequently. The book puts 764 one band down.',
          sources: ['family.high-donk-flops', 'bands.mid-flops'],
        },
        {
          id: 'mid',
          label: BAND_LABEL.mid,
          verdict: 'best',
          shortWhy:
            'Right, and the source names this flop on its own rather than by family: among the roughly 100 flops donked 25-50% of the time, the only monotone one is 764.',
          sources: ['bands.mid-flops'],
        },
        {
          id: 'low',
          label: BAND_LABEL.low,
          verdict: 'mistake',
          shortWhy:
            'One band too low. 764 is a 7ML flop and 7ML does appear among the low band’s subfamilies — but the mid band names this monotone flop individually, and a named flop is the more specific statement than a family that both bands claim.',
          sources: ['bands.low-flops', 'bands.mid-flops'],
        },
        {
          id: 'none',
          label: BAND_LABEL.none,
          verdict: 'mistake',
          shortWhy:
            'The natural guess, because monotone sits on the no-donk list. This is the exception the book carves out by name — the one monotone flop that still gets donked 25-50% of the time.',
          sources: ['contrast.no-donk-flops', 'bands.mid-flops'],
        },
      ],
      bestOptionId: 'mid',
      explanation:
        'Mid — 25-50%, and this is the flop that shows how much the suits are worth. The rank and the straights read almost like the last board: 7-x-x is the other high-band rank, and there are two flopped straights here, 35 and 58, inside the band’s one-to-three. What differs is the texture. Rainbow flops are donked at a higher frequency than two-tone flops and, in general, monotone flops get donked a lot less frequently — so a board carrying the high band’s skeleton in a single suit lands a band below it. You do not have to infer that here, because the source says it about this exact flop: of the roughly 100 flops donked 25-50% of the time, the only monotone one is 764. Read the other way round, the same sentence is just as useful — monotone is otherwise a no-donk texture, and 764 is the single monotone board the book pulls out of that group. The range theory is the high band with the edges filed off. Equities run very close, IP holding a slight advantage at 52% to 48%, and the big blind’s range is still the more polarized one, with the bulk of it strong, good and trash hands while IP still holds a lot of weak hands that benefit from playing passively and seeing free cards. The betting range is built from the same hand types as on the high-donk boards, bet at a lower frequency, with everything checked more often so the checking range stays protected. Against either opener that comes to roughly 35% — the same versus UTG as versus the button, because the equity distribution barely changes between them.',
      unsourced: [
        {
          question: 'Would 764 RAINBOW also be a mid-band flop?',
          answer:
            'The source does not say, and this puzzle will not guess. 764 rainbow is a 7ML flop, and 7ML is listed as a subfamily in both the mid band (p.642) and the low band (p.645) — as are 8MM, 8ML, 8LL, 7LL, 6LL and 5LL. The lists overlap because the bands are drawn across individual flops while the text reports them as families, so an unpaired flop that only matches a subfamily cannot be pinned to one band from what is printed. What is pinned is 764 monotone, which the mid band names on its own.',
          nearestSources: ['bands.mid-flops', 'bands.low-flops'],
        },
      ],
      theory: [
        {
          id: 'suits-move-bands',
          title: 'The suits are the third reading, and they can move a band',
          body:
            'Rank and straights get a flop close. The texture decides which side of a boundary it lands on, and monotone is the texture that moves a board furthest — it appears at both ends of the chapter, once as the thing that pulls a high-band skeleton down and once in the list of textures that make a flop unleadable altogether.',
          bullets: [
            {
              text: 'The three textures, as defined: monotone is three cards of one suit, two-tone is two of one suit and a third of another, rainbow is three different suits.',
              sources: ['bands.flop-textures'],
            },
            {
              text: 'Inside the high band the ordering is explicit — rainbow flops are donked at a higher frequency than two-tone flops and, in general, monotone flops get donked a lot less frequently.',
              sources: ['family.high-donk-flops'],
            },
            {
              text: 'And monotone turns up again at the far end, in the list of textures that make a bad donk betting flop: trips, monotone, high card paired, disconnected two-tone, HXX and AXX.',
              sources: ['contrast.no-donk-flops'],
            },
            {
              text: 'So monotone pulls hard in one direction, and 764 is where the book stops it by name. That is worth holding onto as a pair: the general rule about monotone, and the single flop that is stated to escape it.',
              sources: ['bands.mid-flops'],
            },
          ],
          sources: ['bands.flop-textures', 'bands.mid-flops'],
        },
        {
          id: 'mid-band-shape',
          title: 'What the mid band looks like from the inside',
          body:
            'The mid band is not a different strategy from the high band. It is the same strategy dialled down: the same hand types go into the betting range, they are bet less often, and everything is checked more often so that the checking range stays protected. What changed underneath is that IP’s equity edge has come back.',
          exhibit: {
            caption: 'The mid band (25-50%)',
            scope:
              'Averages across ALL mid-donk-frequency flops, from the BB vs BN and BB vs UTG 20-40bb aggregate — not 764 alone.',
            rows: [
              { label: 'IP equity', value: '52%', pct: 52 },
              { label: 'BB equity', value: '48%', pct: 48 },
              {
                label: 'Donk bet frequency',
                value: 'roughly 35%',
                pct: 35,
                note: 'the same against UTG and against the button',
              },
              { label: 'Checking frequency', value: 'roughly 65%', pct: 65 },
            ],
            sources: ['bands.mid-equity', 'bands.mid-frequency'],
          },
          bullets: [
            {
              text: 'Equities run very close, with IP holding the slight advantage — but the big blind’s range is still the more polarized of the two, with the bulk of it strong, good and trash hands, while IP still has a lot of weak hands that benefit from playing passively and seeing free cards.',
              sources: ['bands.mid-equity'],
            },
            {
              text: 'At 30-40bb the betting range is the high band’s betting range at a lower frequency — the same type of hands, everything checked more often so the checking range is more protected — with strong hands preferring the bigger size on paired boards and the smaller size on unpaired ones.',
              sources: ['bands.mid-strategy'],
            },
            {
              text: 'At 20bb it changes character: the donking strategy becomes extremely polarized, betting mostly strong, good and trash hands, so a bigger bet-size is preferred and the small size is used mostly with weak hands.',
              sources: ['bands.mid-20bb'],
            },
          ],
          sources: ['bands.mid-equity', 'bands.mid-strategy'],
        },
        {
          id: 'the-low-band',
          title: 'The band you were offered three times and never needed',
          body:
            'Low — 10-25% — was an answer on all three flops and was never the right one. That is not an accident of which flops were chosen. It is a limit of what the source makes it possible to say, and it is worth seeing directly, because it is the clearest example in this chapter of the difference between a band that exists and a band you can place a flop into.',
          exhibit: {
            caption: 'The low band (10-25%)',
            scope:
              'Averages across ALL low-donk-frequency flops, from the BB vs BN and BB vs UTG 20-40bb aggregate. No individual flop is named anywhere in this band.',
            rows: [
              { label: 'BB equity', value: '45%', pct: 45 },
              { label: 'BB equity realization', value: 'under-realizes by 6%', note: 'the other direction' },
              { label: 'Share of the pot the BB captures', value: '43%', pct: 43 },
              {
                label: 'Donk frequency, by opener',
                value: '16% vs BN / 14% vs UTG',
                note: 'and barely moved by stack depth',
              },
            ],
            sources: ['bands.low-equity', 'bands.low-frequency', 'bands.low-polarity'],
          },
          bullets: [
            {
              text: 'The band is real, and it is the largest of the three that donk at all: approximately 181 distinct flops get donk bet with 10% to 25% frequency — more than the high and mid bands put together.',
              sources: ['bands.low-flops'],
            },
            {
              text: 'It is where checking takes over. IP’s range dominance is clear, the big blind’s equity drops to 45% and under-realizes by 6%, capturing only 43% of the pot, and the number of trash hands finally outweighs the number of weak ones.',
              sources: ['bands.low-equity'],
            },
            {
              text: 'When the big blind does lead here the range is a little more polarized, so a larger size is preferred — the 67%-pot bet used 9% of the time against the 25%-pot bet’s 7% — and the frequency is barely affected by stack depth, holding at 20bb, 30bb and 40bb alike.',
              sources: ['bands.low-frequency', 'bands.low-polarity'],
            },
          ],
          unsourced: [
            {
              question: 'Why is Low never the correct answer in this puzzle?',
              answer:
                'Because no flop can be put into it beyond doubt from what the book prints. The low band is given entirely as subfamilies, and seven of its unpaired subfamilies — 8MM, 8ML, 8LL, 7ML, 7LL, 6LL and 5LL — are exactly the seven the mid band also lists. Not one individual flop is named in the low band anywhere. Choosing a board to represent it would therefore have meant deciding, on our own authority, which side of that overlap it fell on — which is the kind of judgement this puzzle exists to keep separate from the source. So Low stays an answer you must be able to recognise and, on these three flops, must be able to rule out.',
              nearestSources: ['bands.low-flops', 'bands.mid-flops'],
            },
          ],
          sources: ['bands.low-flops', 'bands.low-equity'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [
    {
      id: 'bands-by-size',
      label: 'How many flops are in each band',
      kind: 'composition',
      seat: 'hero',
      description:
        'The shape of the whole problem. Donk betting is not a rare exception you will meet occasionally — it is a rare exception you will meet on roughly one flop in twelve, and never at all on the other eleven.',
      bars: [
        { label: 'None — 0-10%', pct: 82.1, note: '“the vast majority of flops”, donked about 1% of the time' },
        { label: 'Low — 10-25%', pct: 10.3, note: 'approximately 181 flops, named only as subfamilies' },
        { label: 'Mid — 25-50%', pct: 5.7, note: 'about 100 flops, donked roughly 35% of the time' },
        { label: 'High — 50%+', pct: 1.9, note: 'about 34 flops, ranks 7-x-x and 6-x-x' },
      ],
      unsourced: [
        {
          question: 'Are those four percentages printed in the book?',
          answer:
            'No — the counts are, the percentages are arithmetic on them. The source prints “about 34”, “about 100” and “approximately 181” flops for the three donking bands, and 1,755 strategically distinct flops in hold’em overall. Dividing gives 1.9%, 5.7% and 10.3%; the fourth bar is the remainder, 1,440 flops, which the book itself describes only as “the vast majority”. The counts are exact transcription and the percentages are an exact derivation from them — no band was estimated to make the bars add up.',
          nearestSources: [
            'family.high-donk-flops',
            'bands.mid-flops',
            'bands.low-flops',
            'bands.none-metrics',
            'bands.distinct-flops',
          ],
        },
      ],
      sources: [
        'family.high-donk-flops',
        'bands.mid-flops',
        'bands.low-flops',
        'bands.none-metrics',
        'bands.distinct-flops',
      ],
    },
    {
      id: 'overall-donk-frequency',
      label: 'How often the big blind actually leads',
      kind: 'aggregate',
      seat: 'both',
      headline: '2%',
      description:
        'Across all flops, the big blind’s overall donk bet frequency is only 2%, against an average IP c-betting frequency of 84%. That single number is why the bands matter: the general advice never to donk bet is very nearly right, and the whole value of the classification is knowing the handful of boards where it is wrong.',
      sources: ['donk.baseline-frequencies', 'bands.dataset'],
    },
    {
      id: 'the-dataset',
      label: 'What every band figure was measured on',
      kind: 'aggregate',
      seat: 'villain',
      headline: '20-40bb',
      description:
        'One dataset stands behind all four bands: GTO solutions aggregated across all possible flops in BB vs BN and BB vs UTG single raised pots at 20bb, 30bb and 40bb. The button and UTG were chosen because they are the widest and tightest opening ranges, with every other position falling somewhere between them — which is what lets a band be read as a property of the board rather than of one particular opponent.',
      unsourced: [
        {
          question: 'Do the bands hold at 100bb, or against a cutoff?',
          answer:
            'Not stated. The dataset is 20bb, 30bb and 40bb with the button and UTG as the two openers, and the book’s claim about other positions is only that their strategies fall somewhere in between — it gives no figures for them. On stack depth the nearest thing to an answer is that the low band’s donk frequency is barely affected by depth across the three that were solved (p.647); nothing is printed about 100bb. Every figure in this puzzle is inside that dataset, and none should be carried outside it.',
          nearestSources: ['bands.dataset', 'bands.low-polarity'],
        },
      ],
      sources: ['bands.dataset'],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  takeawayHeadline:
    'A flop’s donk-bet band is written on the board: read its rank, count its straights, then look at the suits.',
  headlineSources: ['bands.classification-purpose', 'bands.flop-rank', 'bands.effect-not-cause'],
  takeaways: [
    {
      text: 'Three readings, in order. Rank is the highest card. A flopped straight uses all three board cards plus two hole cards. Texture is monotone, two-tone or rainbow. None of the three needs a hand, a position or a stack depth.',
      sources: ['bands.flop-rank', 'bands.straight-count', 'bands.flop-textures'],
    },
    {
      text: 'High, 50%+: about 34 flops, ranks 7-x-x and 6-x-x with one to three flopped straights, donked most when rainbow and least when monotone. 654r is the highest of them all, at 67%.',
      sources: ['family.high-donk-flops', 'donk.654r-is-highest'],
    },
    {
      text: 'Mid, 25-50%: about 100 flops — the unpaired subfamilies 8MM through 5LL, the paired flops 766, 755 and 655, and exactly one monotone flop, 764. Donked roughly 35% of the time against either opener.',
      sources: ['bands.mid-flops', 'bands.mid-frequency'],
    },
    {
      text: 'Low, 10-25%: about 181 flops, printed only as subfamilies — seven of which the mid band also claims, which is why no individual flop can be pinned to this band from the text alone.',
      sources: ['bands.low-flops', 'bands.mid-flops'],
    },
    {
      text: 'None, 0-10%: the vast majority of flops. Trips, monotone, high card paired, disconnected two-tone, HXX and AXX, where the big blind averages 39% equity and a 100% checking frequency is recommended.',
      sources: ['contrast.no-donk-flops', 'bands.none-metrics'],
    },
    {
      text: 'And the author’s own warning about all of it: the high donk betting frequencies are an effect and not a cause. What actually changes from band to band is how the two ranges are distributed; the frequency is what falls out of that.',
      sources: ['bands.effect-not-cause'],
    },
  ],

  xp: 60,

  endsEarlyBecause:
    'There is no hand to play, and the source’s bands are a flop classification rather than a line. The chapter closes by telling the reader to run sample flops from each donk bet frequency group through a solver themselves in order to learn how to react to flop raises and how to follow through on future streets (p.649) — so no turn, no river, and no action is claimed here beyond the reading.',
}

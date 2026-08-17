import type { InteractivePuzzle } from '../types'

/**
 * Puzzle 17 — "Name the turn card" (board reading on 9♥8♥4♦)
 *
 * ONE idea, and deliberately no second one: the book's six turn groups, applied
 * to three cards before anybody is asked to do anything about them.
 *
 * WHY THERE IS NO HERO HAND. The source's own order is classification first —
 * "Studying each individual turn for every single flop would also be highly
 * inefficient. For this reason, we will need some sort of turn groupings"
 * (p.759). Deal a learner two cards and that order inverts instantly: they work
 * out what they want to do and stop looking at what the card did. So this puzzle
 * deals nothing, `setup.heroCards` is empty, and `readsTheBoardOnly` states it
 * (validate.ts refuses an empty hand without that statement).
 *
 * WHY THIS FLOP. 9♥8♥4♦ is two-tone, so the flush group is live rather than
 * theoretical, and it is the one board for which the book prints which turn
 * cards favour which player after the flop checks through (p.763). That sentence
 * is what makes question 3 of every decision — "whose range does this help?" —
 * answerable from the source rather than from us.
 *
 * WHY THESE THREE CARDS. Each has ONE unambiguous primary group, and between
 * them the source's own p.763 sentence covers all three directions:
 *   9♠  Paired board.  "a 9, 8 or 4 pairing the board … good turns for OOP"
 *   2♥  Flush.         "and hearts are good turns for OOP"
 *   A♣  Ace.           "particularly the aces, are good for IP"
 * A♣ is also an overcard, and that is the point of the third question rather
 * than a flaw in it — the book says a card can be in "one or more" groups, and
 * still gives the ace a group of its own. It is graded 'defensible'.
 *
 * WHAT THE PUZZLE DOES NOT CLAIM. No frequency, no sizing, no action. The source
 * classifies turn cards here; it does not attach a frequency to a category in
 * the abstract, and every decision says so in an `UnsourcedNote` rather than
 * letting a learner assume one exists. The direction-of-advantage claims are
 * scoped to this board on the x/x line, which is NOT the x/b/c node the
 * `ex3.turn-*` refs measure — same board, same seats, different line.
 *
 * MONEY (blinds 0.5/1, 40bb effective, no ante). Nothing is decided with it; it
 * is on screen only because a turn has to sit in some pot.
 *   preflop  UTG to 2.5, BB calls, SB folds  →  pot 5.5, hero 37.5 behind
 *   flop     checks through                  →  pot 5.5 unchanged
 * The 2.5bb open size is an implementation decision, as in every puzzle here —
 * the book gives no open size for this spot.
 */

/** Identical for all three candidates: same hand, same flop, only the turn differs. */
const FLOP = ['9h', '8h', '4d']

const PREFLOP_ACTION = [
  'UTG raises to 2.5bb',
  'HJ folds',
  'CO folds',
  'BTN folds',
  'SB folds',
  'Hero calls',
]

function history(turnCard: string) {
  return [
    { street: 'preflop' as const, actor: 'UTG', text: 'Raises to 2.5 bb' },
    { street: 'preflop' as const, actor: 'BB', text: 'Calls 1.5 bb', isHero: true },
    { street: 'flop' as const, actor: '', text: '9♥ 8♥ 4♦ — pot 5.5 bb' },
    { street: 'flop' as const, actor: 'BB', text: 'Checks', isHero: true },
    { street: 'flop' as const, actor: 'UTG', text: 'Checks' },
    { street: 'turn' as const, actor: '', text: `${turnCard} — pot 5.5 bb` },
  ]
}

/** The same note on all three, because the answer is the same on all three. */
function noFrequencyNote(card: string) {
  return {
    question: `How often should the big blind bet after a ${card}?`,
    answer:
      'The source classifies turn cards here; it does not attach a frequency to a category in the abstract. ' +
      'The six groups are a way of reading a board, and what a group is worth depends on the flop, on both ' +
      'ranges and on how the previous street was played — none of which a category carries with it. This ' +
      'puzzle therefore stops at the reading, and no percentage is claimed for it.',
    nearestSources: ['turn.categories', 'turn.why-groups'],
  }
}

export const TURN_CATEGORIES_984: InteractivePuzzle = {
  id: 'turn-categories-984',
  slug: 'name-the-turn-card',
  number: 17,
  title: 'Name the turn card',
  topic: 'Board Reading',
  difficulty: 'beginner',
  description:
    'One flop, three possible turns, and no hand to play. Before any decision on the turn there is a reading — the book gives you six groups to make it with, and this puzzle only asks you to make it.',

  setup: {
    format: '40bb effective',
    tableSize: 6,
    heroSeat: 'BB',
    villainSeat: 'UTG',
    heroCards: [],
    effectiveStackBb: 40,
    gameNotes:
      'Single raised pot, blinds 0.5 / 1, no ante. The flop checked through. Your cards stay face down all the way through — nothing here asks what you hold.',
  },

  readsTheBoardOnly:
    'The book puts classification before strategy: with 49 possible turn cards per flop it groups them precisely so that a player does not have to solve each one. Dealing you a hand would invert that order — you would start working out what you wanted to do and stop looking at what the card did. So there is no hand, and no action to choose.',

  comparesAlternativeBoards:
    'The three decisions are not one hand advancing. They are the same flop with three different turn cards dealt in its place, so each can be read on its own terms.',

  decisions: [
    /* ── 9♠ — paired board ───────────────────────────────────────────── */
    {
      id: 'turn-9s',
      street: 'turn',
      board: [...FLOP, '9s'],
      potBb: 5.5,
      effectiveStackBb: 37.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('9♠'),
      situation:
        'UTG opened, you called from the big blind, and the flop 9♥ 8♥ 4♦ checked through. The turn is the 9♠. Do not decide anything yet — just say what this card did to the board.',
      question: 'Which group does the 9♠ belong to?',
      options: [
        {
          id: 'overcard',
          label: 'Overcard',
          verdict: 'mistake',
          shortWhy:
            'The book’s overcard group is "turn cards higher than top pair". Top pair on 9♥8♥4♦ is a pair of nines, and a nine is not higher than a nine — it is exactly equal to it.',
          sources: ['turn.categories'],
        },
        {
          id: 'brick',
          label: 'Brick',
          verdict: 'mistake',
          shortWhy:
            'A brick is a card that "doesn’t connect with the board in a meaningful way". This one pairs the highest card on the flop — it is about as connected as a turn card can be.',
          sources: ['turn.categories'],
        },
        {
          id: 'paired',
          label: 'Pairs the board',
          verdict: 'best',
          shortWhy:
            'The board is 9-8-4 and the turn is a second nine. That is the book’s first group, word for word: "Paired Board: Turn cards that pair the board."',
          sources: ['turn.categories'],
        },
        {
          id: 'straight',
          label: 'Completes an OESD',
          verdict: 'mistake',
          shortWhy:
            'The straight group is for cards that fill an open-ender. A nine pairs the board rather than extending it — the cards the book names as completing straights on this flop are the 7, 6 and 5.',
          sources: ['turn.categories', 'ex3.turn-donk-best-cards'],
        },
      ],
      bestOptionId: 'paired',
      explanation:
        'Paired board. The test is mechanical and it is the first one on the book’s list: does the turn pair a card already on the flop? A second nine does, so the reading is finished before any judgement is involved — which is the whole reason the groups exist. It is worth noticing what the 9♠ is NOT, because two of the wrong answers are the two commonest misreads. It is not an overcard: that group is defined as cards higher than top pair, and a nine ties top pair rather than beating it. And it is not a brick: bricks are the cards that connect with nothing, and this one connects with the top of the board.',
      unsourced: [noFrequencyNote('9♠')],
      theory: [
        {
          id: 'why-groups-9s',
          title: 'Why you group the card before you play it',
          body:
            'There are 49 possible turn cards for every single flop, and each one changes the two ranges in play. The book’s response to that number is not to study 49 cards — it is to sort them, exactly as it earlier sorted flops, so that the reading is a lookup rather than a fresh problem every time. Six groups: paired board, flush, straight, ace, overcard, brick. Every turn decision you will ever make starts by putting the card in one of them.',
          bullets: [
            {
              text: 'The book’s own reason for grouping: studying each individual turn for every single flop would be highly inefficient, so it creates turn groupings the same way it created flop groupings.',
              sources: ['turn.why-groups'],
            },
            {
              text: 'A paired board is the first group on the list, and it is defined purely mechanically — a turn card that pairs the board. No range knowledge is needed to apply it.',
              sources: ['turn.categories'],
            },
            {
              text: 'On this specific board, after the flop checks through, the book puts a nine pairing the board among the good turns for the out-of-position player — along with an 8 or a 4 doing the same, low cards that complete straights, and hearts.',
              sources: ['turn.984-good-cards-xx', 'turn.984-xx-setup'],
            },
          ],
          sources: ['turn.categories', 'turn.why-groups'],
        },
        {
          id: 'whose-range-9s',
          title: 'Whose range does it help?',
          body:
            'Classifying a card and knowing who it favours are two different steps, and the second one always needs a board and two ranges — the group alone never carries it. For this exact spot the source does state it: on 9♥8♥4♦, after the flop checked through, a 9, 8 or 4 pairing the board is a good turn for the out-of-position player, which here is you in the big blind. Note the scope carefully. That is a statement about these two ranges on this board on this line, not a claim that paired boards favour the out-of-position player generally.',
          bullets: [
            {
              text: 'The setup being described is the book’s own worked example: the big blind against an UTG open at 40bb, first to act on the turn after the flop checked back.',
              sources: ['turn.984-xx-setup'],
            },
            {
              text: 'The printed sentence: low cards that complete straights, a 9, 8 or 4 pairing the board, and hearts are good turns for OOP — while overcards that don’t complete many straights, and particularly the aces, are good for IP.',
              sources: ['turn.984-good-cards-xx'],
            },
          ],
          unsourced: [
            {
              question: 'Does a paired turn always favour the player out of position?',
              answer:
                'No — and the source does not say it does. The sentence cited here is about 9♥8♥4♦ with these two ranges after the flop checked through. Which player a paired board helps depends on which of them holds more of the paired rank, and that is a property of the ranges, not of the category. The category tells you what happened to the board; it does not tell you who it happened for.',
              nearestSources: ['turn.984-good-cards-xx', 'turn.categories'],
            },
          ],
          sources: ['turn.984-good-cards-xx', 'turn.984-xx-setup'],
        },
      ],
    },

    /* ── 2♥ — completes a flush ──────────────────────────────────────── */
    {
      id: 'turn-2h',
      street: 'turn',
      board: [...FLOP, '2h'],
      potBb: 5.5,
      effectiveStackBb: 37.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('2♥'),
      situation:
        'Same hand, same flop: 9♥ 8♥ 4♦, checked through. This time the turn is the 2♥. Read it before you think about it.',
      question: 'Which group does the 2♥ belong to?',
      options: [
        {
          id: 'flush',
          label: 'Completes a flush',
          verdict: 'best',
          shortWhy:
            'The flop was two-tone with two hearts. The 2♥ is the third, so every hand holding two hearts now has a flush — and the book’s test for this group is the suit, never the rank: "Flush: Turn cards that complete a flush."',
          sources: ['turn.categories'],
        },
        {
          id: 'brick',
          label: 'Brick',
          verdict: 'mistake',
          shortWhy:
            'The trap this whole question exists for. A deuce looks like nothing, but a brick is a card that "doesn’t connect with the board in a meaningful way" — and a third heart connects with every two-heart hand at the table. Read the suit before you read the rank.',
          sources: ['turn.categories'],
        },
        {
          id: 'straight',
          label: 'Completes an OESD',
          verdict: 'mistake',
          shortWhy:
            'Right instinct to check for it on a connected board, wrong card. A deuce is far too low to fill an open-ender on 9-8-4 — the low straight-completing cards here are the 7, 6 and 5.',
          sources: ['turn.categories', 'ex3.turn-donk-best-cards'],
        },
      ],
      bestOptionId: 'flush',
      explanation:
        'Completes a flush. This is the card that catches people, and the reason is that ranks are easy to read and suits are easy to skip. The 2♥ is the lowest card in the deck and it changes nothing about straights, nothing about pairs and nothing about high cards — so it feels like a blank. It is not, because the flop was two-tone: two hearts on the flop plus one on the turn is three, and three is the number that makes a flush possible. A two-tone flop has exactly nine cards in the deck that do this, and their ranks are irrelevant. The book’s definition of the group is one line long and contains no rank at all: "Turn cards that complete a flush."',
      unsourced: [noFrequencyNote('2♥')],
      theory: [
        {
          id: 'suit-first',
          title: 'A two-tone flop has nine turn cards that change everything',
          body:
            'The flush group is the one that punishes reading a board by rank. On a rainbow flop no single turn card completes a flush, so the group is empty and you can ignore suits entirely. On a two-tone flop like 9♥8♥4♦ it is live, and it is live for a fifth of the deck: any of the remaining hearts brings a third one to the board, and the rank of that heart makes no difference at all. The 2♥ and the K♥ do the same job to the flush group — though the K♥ would land in the overcard group as well, and the 2♥ lands in nothing else.',
          bullets: [
            {
              text: 'The group’s definition contains no rank: "Flush: Turn cards that complete a flush." A card qualifies on suit alone.',
              sources: ['turn.categories'],
            },
            {
              text: 'And the group it is most often confused with is defined by the absence of any connection at all: "Brick/Blank: Turn card that doesn’t connect with the board in a meaningful way."',
              sources: ['turn.categories'],
            },
            {
              text: 'On this board after the flop checked through, hearts are named among the good turns for the out-of-position player — the big blind here.',
              sources: ['turn.984-good-cards-xx', 'turn.984-xx-setup'],
            },
          ],
          sources: ['turn.categories'],
        },
        {
          id: 'whose-range-2h',
          title: 'Whose range does it help?',
          body:
            'Here too the direction comes from the board and the ranges rather than from the group. On 9♥8♥4♦ after the flop checked through, the source lists hearts among the good turns for the out-of-position player — the same sentence that lists the board-pairing cards and the low straight completers. It is a statement about this spot, and it is worth keeping separate from the reading you just made: the reading is true of the board, the advantage is true of these two ranges.',
          bullets: [
            {
              text: 'The printed sentence again, in full: low cards that complete straights, a 9, 8 or 4 pairing the board, and hearts are good turns for OOP; overcards that don’t complete many straights, and particularly the aces, are good for IP.',
              sources: ['turn.984-good-cards-xx'],
            },
            {
              text: 'The line matters as much as the board. This is the node where the flop checked through — the same board played check / c-bet / call is a different node with its own numbers.',
              sources: ['turn.984-xx-setup'],
            },
          ],
          unsourced: [
            {
              question: 'Does a completed flush always favour the player out of position?',
              answer:
                'No. The source says hearts are good turns for OOP on this board with these ranges after this line — it makes no general claim about the flush category, and the opposite is easy to construct: a flush card that fits the in-position player’s range better favours them instead. The group tells you a flush is now possible. Who benefits is a separate question with a separate answer every time.',
              nearestSources: ['turn.984-good-cards-xx', 'turn.categories'],
            },
          ],
          sources: ['turn.984-good-cards-xx', 'turn.984-xx-setup'],
        },
      ],
    },

    /* ── A♣ — the ace ────────────────────────────────────────────────── */
    {
      id: 'turn-ac',
      street: 'turn',
      board: [...FLOP, 'Ac'],
      potBb: 5.5,
      effectiveStackBb: 37.5,
      actionBeforeHero: PREFLOP_ACTION,
      postflopAction: [],
      history: history('A♣'),
      situation:
        'The same flop one last time — 9♥ 8♥ 4♦, checked through — and now the turn is the A♣. This one belongs to more than one group, which is exactly what the question is about.',
      question: 'Which group does the A♣ belong to?',
      options: [
        {
          id: 'brick',
          label: 'Brick',
          verdict: 'mistake',
          shortWhy:
            'A brick connects with the board in no meaningful way. This card lands in two of the book’s six groups at once, which is the opposite of that.',
          sources: ['turn.categories'],
        },
        {
          id: 'ace',
          label: 'Ace',
          verdict: 'best',
          shortWhy:
            'The book gives the ace a group of its own rather than filing it under overcards: "The ace is a special card and it often has a significant effect." When an ace turns, that is the reading.',
          sources: ['turn.categories'],
        },
        {
          id: 'flush',
          label: 'Completes a flush',
          verdict: 'mistake',
          shortWhy:
            'Hearts are the suit to watch on 9♥8♥4♦, and this ace is a club — the only club on the board. It does not even bring a backdoor flush draw, which is the sub-division the book applies to cards in the overcard group.',
          sources: ['turn.categories', 'turn.category-subdivision'],
        },
        {
          id: 'overcard',
          label: 'Overcard',
          verdict: 'defensible',
          shortWhy:
            'True, and not the primary reading. An ace is higher than top pair, so it is in the overcard group too — the book says a turn card can be in "one or more" groups. But it also gives the ace its own group precisely because it is not just another overcard.',
          sources: ['turn.categories', 'turn.why-groups'],
        },
      ],
      bestOptionId: 'ace',
      explanation:
        'Ace. This is the one card in the deck the book pulls out of the ordinary ranking and names on its own: it is higher than top pair, so it is genuinely an overcard, and the book still gives it a separate group because of how much it tends to move things. Which is the second lesson of this puzzle. The groups are not mutually exclusive — the source says most turn cards can be categorised as being in "one or more" of them — so "overcard" is not wrong here, it is incomplete. Reading the A♣ as merely a high card is how you end up treating it like a K♣ or a Q♣, and the book is telling you not to. The one thing this ace does not do is anything with suits: it is a club on a board whose only relevant suit is hearts.',
      unsourced: [noFrequencyNote('A♣')],
      theory: [
        {
          id: 'one-or-more',
          title: 'A card can be in more than one group',
          body:
            'The source is explicit that these are not exclusive boxes: most turn cards can be categorised as being in one or more of the six groups. The A♣ is in two, an ace and an overcard. A K♥ on this board would also be in two — an overcard and a flush card. Reading a turn is not picking one label but listing what the card did, and the source adds one further split on top: the overcard and undercard groups divide again by whether the card brings a backdoor flush draw. The A♣ does not, since it is the only club on the board; the A♦ would, since the 4♦ is already there.',
          bullets: [
            {
              text: 'The sentence that introduces the list says it outright: most turn cards can be categorized as being in one or more of the following groups.',
              sources: ['turn.why-groups'],
            },
            {
              text: 'The full list, as printed: paired board, flush, straight, ace, overcard, brick/blank — with the ace given its own entry on the grounds that it "often has a significant effect".',
              sources: ['turn.categories'],
            },
            {
              text: 'And the refinement: the overcard and undercard categories can be subdivided into cards that bring a backdoor flush draw and cards that don’t.',
              sources: ['turn.category-subdivision'],
            },
          ],
          sources: ['turn.categories', 'turn.why-groups', 'turn.category-subdivision'],
        },
        {
          id: 'whose-range-ac',
          title: 'Whose range does it help?',
          body:
            'This is the card where the two players’ fortunes separate most sharply on this board, and it is the one direction in the p.763 sentence that points away from the big blind. Overcards that don’t complete many straights — and the aces in particular — are good for the in-position player, here UTG. An ace fits that description exactly on 9-8-4: it completes no straight at all, since neither A-2-3-4-5 nor A-K-Q-J-T is close to being on the board.',
          exhibit: {
            caption: 'The best and worst single turn cards for the big blind on 9♥8♥4♦',
            scope:
              'BB vs UTG on 9♥8♥4♦ at 40bb, AFTER THE FLOP CHECKED THROUGH (x/x). EV as a share of the pot, for one card on one board on one line — not a figure for the "ace" category anywhere else.',
            rows: [
              { label: 'Average turn card — BB equity', value: '48%', pct: 48 },
              { label: 'Average turn card — BB share of pot', value: '53%', pct: 53, note: 'over-realized' },
              { label: 'Worst turn cards — offsuit aces (A♠/A♣)', value: '25.8%', pct: 25.8 },
              { label: 'Best turn cards — offsuit 5s (5♠/5♣)', value: '64.17%', pct: 64.17 },
            ],
            sources: ['turn.984-worst-card-xx'],
          },
          bullets: [
            {
              text: 'The printed direction: overcards to the board that don’t complete many straights, and particularly the aces, are good for IP.',
              sources: ['turn.984-good-cards-xx'],
            },
            {
              text: 'The book states the mechanism on this same board one line later in the chapter — the worst cards for the out-of-position player are the ones that connect well with the in-position range, which it names as aces, high cards, and diamonds that would give a backdoor flush draw. That sentence is measured after the flop went check / c-bet / call rather than checking through, so take it as the reason rather than as a number for this node.',
              sources: ['ex3.turn-donk-best-cards'],
            },
          ],
          unsourced: [
            {
              question: 'Is an ace always the worst turn card?',
              answer:
                'No. The 25.8% figure is the big blind’s EV on this board, at this depth, after this line — the book gives it as the worst card in that specific heatmap. On a board where the ace fits the out-of-position range better, it would not be. The reason an ace gets its own group is that it is unusually likely to matter, not that it always matters in the same direction.',
              nearestSources: ['turn.984-worst-card-xx', 'turn.categories'],
            },
          ],
          sources: ['turn.984-good-cards-xx', 'turn.984-worst-card-xx'],
        },
      ],
    },
  ],

  /* ══════════════════════════════════════════════════════════════════════ */

  ranges: [],

  takeawayHeadline:
    'Name the group before you name the action. Every turn decision starts with what the card did, not with what you want to do about it.',
  headlineSources: ['turn.categories', 'turn.why-groups'],
  takeaways: [
    {
      text: 'There are 49 possible turn cards for every flop, and each one moves both ranges. The book’s answer is not to solve them one at a time but to group them — the same move it made with flops.',
      sources: ['turn.why-groups'],
    },
    {
      text: 'The six groups: a turn that pairs the board, completes a flush, completes an open-ender, is an ace, is higher than top pair, or connects with nothing in a meaningful way.',
      sources: ['turn.categories'],
    },
    {
      text: 'A card can sit in more than one group — the source says "one or more". An ace on 9♥8♥4♦ is both an ace and an overcard, and the book still lists the ace separately because of how much it tends to change.',
      sources: ['turn.why-groups', 'turn.categories'],
    },
    {
      text: 'Overcards and undercards split once more, by whether the card brings a backdoor flush draw. On 9♥8♥4♦ the A♦ does and the A♣ does not.',
      sources: ['turn.category-subdivision'],
    },
    {
      text: 'Classifying is not deciding. On this board, after the flop checked through, the source does say which cards favour whom — board pairs, hearts and low straight cards for the big blind, aces for UTG — but that is a fact about these two ranges, and no frequency is attached to any category in the abstract.',
      sources: ['turn.984-good-cards-xx', 'turn.categories'],
    },
  ],

  endsEarlyBecause:
    'There is no hand to play here, so nothing follows the turn. This puzzle stops at the reading on purpose: the source classifies turn cards without attaching a frequency or a bet-size to a category, and inventing one would be the fastest way to make a genuinely useful tool useless. What a group is worth is decided by the flop, the two ranges and the line — which is what the puzzles that do deal you a hand work through.',

  xp: 30,
}

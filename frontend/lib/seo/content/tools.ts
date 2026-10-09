import {
  alpha,
  drawProbabilityByRiver,
  drawProbabilityNextCard,
  mdf,
  outsToEquityFlop,
  requiredEquityFromPot,
} from "@/lib/theory/math";
import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { readingTimeMin } from "../reading";
import { glossaryLetterPath, lessonPath, toolPath, wikiPath } from "../routes";
import type { ArticleSection, ContentStatus, FaqItem, SeoEntry } from "../types";
import { glossaryTerms, letterOf } from "./glossary";
import { lessonsForConceptKey } from "./lessons";
import {
  bankrollExamples,
  equityExamples,
  evExamples,
  handAnalyzerExamples,
  outsExamples,
  positionExamples,
  potOddsExamples,
  startingHandExamples,
  varianceExamples,
} from "./toolContent";

/**
 * Free-tool landing pages (§9).
 *
 * Two kinds live here, and the difference is visible on the page:
 *
 *  - `published` — the page teaches the underlying calculation using
 *    lib/theory/math.ts. Every number in every table below is COMPUTED by
 *    calling those functions at build time, never typed in, so the pages
 *    cannot drift from the maths the product itself runs on. Where the
 *    interactive widget is still being built, the page says so.
 *  - `planned` — no calculation to teach yet (an equity engine and a range
 *    viewer do not exist in this codebase). These are noindex and stay out
 *    of the sitemap until there is something real to show.
 *
 * The "Poker Glossary" tool from the brief is deliberately NOT a page here:
 * it already ships at /glossary, and a second URL describing the same thing
 * would compete with it for the same query. /tools/poker-glossary is a
 * permanent redirect to /glossary instead (see next.config.ts), so the tool
 * has its expected URL without splitting the ranking signal in two.
 */

const pct = (fraction: number, decimals = 0) => `${(fraction * 100).toFixed(decimals)}%`;

interface ToolSource {
  slug: string;
  title: string;
  summary: string;
  status: ContentStatus;
  clusters: string[];
  /** Concept key used to pull related lessons. */
  lessonKey?: string;
  /** Wiki slugs this tool is the practical counterpart to. */
  wikiSlugs?: string[];
  /** Path to the live tool, when one already ships. */
  livePath?: string;
  /**
   * True when an interactive widget renders above the article. The matching
   * component lives in components/tools/index.tsx, and a test fails the build
   * if the two ever disagree — a tool page that quietly lost its calculator
   * would still look fine.
   */
  widget?: boolean;
  /** Glossary term slugs to define on the page and link to. */
  glossarySlugs?: string[];
  sections?: ArticleSection[];
  /** Appended after `sections` — computed worked examples. */
  examples?: () => ArticleSection;
  faqs?: FaqItem[];
  sourceNote: string;
}

/** Bet sizes shown in the pot-odds table, as a fraction of the pot. */
const BET_FRACTIONS = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2];

function potOddsRows() {
  return BET_FRACTIONS.map((fraction) => {
    // Villain bets `fraction` of a pot normalised to 1, so Hero calls
    // `fraction` into a pot of `1 + fraction`.
    const required = requiredEquityFromPot(1 + fraction, fraction) / 100;
    return {
      term: `Villain bets ${pct(fraction)} pot`,
      description: `You risk ${fraction} to win ${(1 + fraction).toFixed(2)}. You need ${pct(required, 1)} equity to break even, and villain's bluffs need you to fold ${pct(alpha(fraction, 1), 1)} of the time (MDF ${pct(mdf(fraction, 1), 1)}).`,
    };
  });
}

function outsRows() {
  return [4, 6, 8, 9, 12, 15].map((outs) => ({
    term: `${outs} outs`,
    description: `${pct(drawProbabilityNextCard(outs), 1)} to hit on the next card, ${pct(drawProbabilityByRiver(outs), 1)} by the river. The rule-of-4 shortcut estimates ${pct(outsToEquityFlop(outs))}.`,
  }));
}

const TOOLS: ToolSource[] = [
  {
    slug: "pot-odds-calculator",
    title: "Pot Odds Calculator",
    summary:
      "Work out the exact equity you need to call any bet, and the minimum defense frequency that goes with it.",
    status: "published",
    clusters: ["equity", "game-theory"],
    lessonKey: "pot_odds",
    wikiSlugs: ["mdf", "alpha"],
    widget: true,
    glossarySlugs: ["pot-odds", "minimum-defense-frequency-mdf"],
    examples: potOddsExamples,
    sections: [
      {
        heading: "What pot odds tell you",
        paragraphs: [
          "Pot odds convert the price of a call into the minimum equity that call needs to break even. If you must call 50 chips to win a pot of 150, you are risking 50 to win 150 — you need to win at least a third of the time.",
        ],
        formula: "Required equity = call / (pot after villain's bet + call)",
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "Add villain's bet to the pot, then add the amount you must call. Your call is that last figure divided into the total — the share of the pot you are buying with it.",
          "The same two numbers also give alpha (how often villain's bluff must work) and minimum defense frequency (how much of your range has to continue). One bet size, three readings.",
        ],
      },
      {
        heading: "Pot odds by bet size",
        definitions: potOddsRows(),
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Comparing the price to your hand instead of your equity",
            description:
              "Pot odds give you a number to beat. Beating it is a question about how often your hand wins against everything villain can hold — not about whether the hand feels strong.",
          },
          {
            term: "Using the pot before the bet",
            description:
              "The denominator is the pot AFTER villain bets and after your call. Using the pot before the bet makes every call look cheaper than it is.",
          },
          {
            term: "Treating pot odds and minimum defense frequency as the same thing",
            description:
              "Pot odds are about one hand's call. Minimum defense frequency is about how much of your whole range continues. A hand can fail the first and your range still has to satisfy the second.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "The bigger the bet, the more equity your call needs and the less of your range you are obliged to defend. Reading the two numbers together — required equity for the call, minimum defense frequency for the range — is what turns a price into a strategy.",
        ],
      },
    ],
    faqs: [
      {
        question: "How do you calculate pot odds?",
        answer:
          "Divide the amount you must call by the total pot after your call. Calling 50 into a pot that will be 200 gives 50 / 200 = 25% required equity.",
      },
      {
        question: "What equity do I need against a half-pot bet?",
        answer: `Against a half-pot bet you need ${requiredEquityFromPot(1.5, 0.5).toFixed(1)}% equity to call profitably, and minimum defense frequency says you should continue with about ${pct(mdf(0.5, 1), 0)} of your range.`,
      },
      {
        question: "Are pot odds and minimum defense frequency the same thing?",
        answer:
          "No. Pot odds tell one hand whether a call breaks even. Minimum defense frequency tells your whole range how often it must continue so the bettor's bluffs do not print money automatically.",
      },
    ],
    sourceNote:
      "Every number in the table is computed at build time by lib/theory/math.ts (requiredEquityFromPot, alpha, mdf) — the same functions the StackedPoker lessons use.",
  },
  {
    slug: "outs-calculator",
    title: "Poker Outs Calculator",
    summary:
      "Turn a count of outs into the real probability of hitting, on the next card and by the river.",
    status: "published",
    clusters: ["equity"],
    lessonKey: "outs_probability",
    wikiSlugs: ["equity-buckets"],
    glossarySlugs: ["flush-draw", "open-ended-straight-draw", "gutshot-straight-draw"],
    examples: outsExamples,
    sections: [
      {
        heading: "What an out is",
        paragraphs: [
          "An out is any unseen card that improves your hand to a winner. After the flop there are 47 cards you have not seen, so nine flush outs means nine of those 47 cards complete your flush.",
        ],
        formula: "P(hit by river) = 1 − ((47 − outs) / 47) × ((46 − outs) / 46)",
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "The exact answer comes from the chance of MISSING. With nine outs and 47 unseen cards, you miss the turn 38 times in 47 and then miss the river 37 times in 46; multiply those and subtract from one.",
          "The rule of four and two multiplies your outs instead. It is close for small draws and increasingly optimistic for big ones, because it double-counts the runouts where both cards would have helped.",
        ],
      },
      {
        heading: "Outs to equity",
        definitions: outsRows(),
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Counting outs that do not win",
            description:
              "A card that completes your straight and puts a third flush card out is not an out. Count only the cards that give you the best hand.",
          },
          {
            term: "Using the rule of four when you cannot see two cards",
            description:
              "The rule of four assumes you get both the turn and the river. Facing a bet that will be followed by another one, you are only buying one card — that is the rule of two.",
          },
          {
            term: "Treating outs as a reason to call on its own",
            description:
              "Outs give equity; the pot gives a price. A draw is a call only when the first clears the second.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "The rule of four is a shortcut, not the answer. It drifts upward as the out count rises, so with big draws use the exact figure before committing a stack.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many outs does a flush draw have?",
        answer: `A flush draw has nine outs. With two cards to come that is ${pct(drawProbabilityByRiver(9), 1)} to complete, and ${pct(drawProbabilityNextCard(9), 1)} on the very next card.`,
      },
      {
        question: "Is the rule of 4 and 2 accurate?",
        answer: `It is close for small draws and optimistic for big ones. With 15 outs the rule of four estimates ${pct(outsToEquityFlop(15))}, while the exact probability by the river is ${pct(drawProbabilityByRiver(15), 1)}.`,
      },
      {
        question: "Do outs alone tell me whether to call?",
        answer:
          "No — compare the probability of hitting with the pot odds you are being offered. Outs give the equity; pot odds give the price.",
      },
    ],
    sourceNote:
      "Probabilities are computed at build time by lib/theory/math.ts (drawProbabilityNextCard, drawProbabilityByRiver, outsToEquityFlop).",
  },
  {
    slug: "ev-calculator",
    title: "Poker EV Calculator",
    summary:
      "Put a number on a decision: expected value weighs every outcome by how often it happens.",
    status: "published",
    clusters: ["equity", "game-theory"],
    lessonKey: "expected_value",
    wikiSlugs: ["alpha"],
    glossarySlugs: ["alpha-break-even-bluff"],
    examples: evExamples,
    sections: [
      {
        heading: "What expected value measures",
        paragraphs: [
          "Expected value is the average result of a decision if you could repeat it forever. Each outcome is multiplied by how often it happens, and the products are added together.",
        ],
        formula: "EV = P(win) × amount won + P(lose) × amount lost",
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "List the outcomes, attach a probability to each, multiply and add. Two outcomes is the common case: you win the pot, or you lose what you put in.",
          "The probabilities have to sum to one and the amounts are signed from your side of the table — a loss is a negative number, not a smaller positive one.",
        ],
      },
      {
        heading: "Why bluffs have an EV too",
        paragraphs: [
          "A bluff is a decision with two outcomes: villain folds and you win the pot, or villain continues and you lose your bet. The fold frequency that makes those two cancel out is alpha.",
        ],
        definitions: BET_FRACTIONS.slice(0, 5).map((fraction) => ({
          term: `Bluffing ${pct(fraction)} pot`,
          description: `Breaks even when villain folds ${pct(alpha(fraction, 1), 1)} of the time.`,
        })),
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Judging the decision by the result",
            description:
              "A +EV call that loses was still the right call. One hand tells you nothing about the decision that produced it — that is the entire point of the measure.",
          },
          {
            term: "Counting money already in the pot as yours",
            description:
              "Chips you bet earlier are gone whatever you do next. Only the money still to be won or lost belongs in the calculation.",
          },
          {
            term: "Guessing the probability and trusting the output",
            description:
              "EV is only as good as the frequency you feed it. Changing an assumed fold percentage by ten points often flips the answer.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "A losing session is not evidence of a bad decision, and a winning one is not evidence of a good one. EV is the only measure that separates the decision from the result.",
        ],
      },
    ],
    faqs: [
      {
        question: "What does EV mean in poker?",
        answer:
          "Expected value: the average chips a decision wins or loses across every possible outcome, weighted by how often each outcome occurs.",
      },
      {
        question: "How often does a pot-sized bluff need to work?",
        answer: `A pot-sized bluff risks one pot to win one pot, so it breaks even when villain folds ${pct(alpha(1, 1), 0)} of the time and profits above that.`,
      },
    ],
    sourceNote:
      "Break-even frequencies are computed at build time by lib/theory/math.ts (alpha).",
  },
  {
    slug: "poker-hand-analyzer",
    title: "Poker Hand Analyzer",
    summary:
      "Paste or enter a hand and get the facts, the exact maths and the concepts that decide it — with the limits stated, not hidden.",
    status: "published",
    clusters: ["postflop", "equity"],
    lessonKey: "hand_vs_hand_equity",
    wikiSlugs: ["position", "mdf", "equity-realization"],
    widget: true,
    glossarySlugs: ["minimum-defense-frequency-mdf", "equity-realization", "bluff-catcher"],
    examples: handAnalyzerExamples,
    sections: [
      {
        heading: "What this analyser does",
        paragraphs: [
          "Enter a hand — your cards, your seat, the board, what happened — and it tells you three separate things: what happened, what the arithmetic says, and which poker concepts the spot turns on.",
          "The separation is the point. Most hand analysis blurs a calculation into an opinion. Here the pot odds are a calculation, the equity is a count, and the strategy is quoted from reviewed material rather than generated.",
          "The result always leads with the conclusion, then the reason for it: the decision the hand turned on, the factors that bear on it, and how they combine. Where they do not combine into an answer, it says that too — and names the missing input that would change it.",
        ],
      },
      {
        heading: "How the analysis works",
        paragraphs: [
          "Facts are read straight back from what you entered. Calculations come from the same functions the StackedPoker lessons run on — required equity, minimum defense frequency, alpha, stack-to-pot ratio, board texture and your made hand.",
          "If you know villain's cards, equity is EXACT: every remaining runout is dealt and counted, not simulated. That is the one case where the maths can settle whether a call beat its price, and the analyser says so plainly.",
        ],
        formula: "Required equity = call / (pot after the bet + call)",
      },
      {
        heading: "What it can and cannot determine",
        definitions: [
          {
            term: "It can tell you the price",
            description:
              "Pot odds, minimum defense frequency and the fold frequency a bet needs are arithmetic. They do not depend on anyone's opinion.",
          },
          {
            term: "It can settle a known-versus-known spot",
            description:
              "With both hands visible, equity is a counting problem. The analyser compares it to the price and tells you whether the call beat it.",
          },
          {
            term: "It cannot guess villain's range",
            description:
              "Equity against a RANGE needs assumptions StackedPoker has no reviewed source for, so no number is produced. The analyser reports the spot as needing review instead of inventing a percentage.",
          },
          {
            term: "It is not a solver",
            description:
              "No optimal frequencies, no GTO ranges, no EV figures. Where the reviewed theory runs out, the analysis says so rather than filling the gap.",
          },
        ],
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Judging the decision by the result",
            description:
              "Losing a hand does not make the call wrong, and winning does not make it right. The price and your equity decide that, and both are knowable before the river.",
          },
          {
            term: "Analysing your cards instead of the spot",
            description:
              "Position, the board texture and the size you are facing change the answer far more than the exact two cards do — which is why the analysis leads with those.",
          },
          {
            term: "Only reviewing the hands you lost",
            description:
              "The expensive leaks are in the pots you won with a play that was wrong anyway. A hand is worth reviewing when the decision was close, not when the outcome was bad.",
          },
          {
            term: "Trusting a confident-sounding number",
            description:
              "A tool that gives you an EV figure for a spot where villain's range is unknown has guessed at the range. Check what any analyser is assuming before you act on it.",
          },
        ],
      },
      {
        heading: "How reviewing hands makes you better",
        paragraphs: [
          "The gap between knowing a concept and using it under pressure closes by seeing the concept inside a hand you actually played. That is why every analysis ends with the concepts it exercised and the lesson that drills them.",
          "Ask the AI Coach about the same hand and it starts from the analysis you just read, with the concepts already in scope, so you can push on the part you did not follow.",
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Do not just find out whether your decision was good. Find out which number or which concept decided it — and then go and learn that one.",
        ],
      },
    ],
    faqs: [
      {
        question: "How do I analyse a poker hand?",
        answer:
          "Start with the facts — your position, the board, the size you faced. Then work out the price the pot laid you and your equity against what villain can hold. The analyser above does the arithmetic and names the concepts; the judgement about villain's range stays yours.",
      },
      {
        question: "Is this poker hand analyzer free?",
        answer:
          "Yes, and no account is needed. Create a free account only if you want to save analysed hands and carry them into the AI Coach.",
      },
      {
        question: "Can it tell me if my play was a mistake?",
        answer:
          "Only when the maths settles it — which means both hands are known and there is a price to compare against. Otherwise it reports the spot as needing review and shows you the numbers rather than inventing a verdict.",
      },
      {
        question: "Does it work like a solver?",
        answer:
          "No. It produces no optimal frequencies, ranges or EV figures. It reports what happened, what the arithmetic says and which reviewed concepts apply.",
      },
      {
        question: "Which hand histories can I paste?",
        answer:
          "PokerStars and GGPoker 6-max text histories, and any format using the *** HOLE CARDS *** / *** FLOP *** street markers. A history that only partly parses is not thrown away: whatever was read is filled in for you, and the fields it could not determine are listed so you can complete them.",
      },
      {
        question: "Is this poker hand analysis software I need to download?",
        answer:
          "No. It runs in the browser, with nothing to install and no account required. It is also not a tracker or a HUD — it does not read your hand histories from disk, watch your tables or store statistics on opponents. It analyses one hand at a time, the one you give it.",
      },
      {
        question: "What do I do when it says the hand needs review?",
        answer:
          "Read the rest. A needs-review result still lists what happened, every number that can be calculated, exactly what could not be determined and why, the concepts the spot turns on and the lesson that drills them. It also names the one input — usually villain's cards — that would let the maths settle it outright.",
      },
    ],
    sourceNote:
      "Facts are read from your input. Calculations come from lib/theory/math.ts, lib/tools/equity.ts and lib/learn/flopClassifier.ts — the maths and the board classifier the StackedPoker lessons use. Strategic explanations are quoted from the StackedPoker poker-theory concept registry; nothing is generated.",
  },
  {
    slug: "equity-calculator",
    title: "Poker Equity Calculator",
    summary:
      "Exact hand-versus-hand equity: every remaining runout dealt and counted, not simulated.",
    status: "published",
    clusters: ["equity"],
    lessonKey: "hand_vs_hand_equity",
    wikiSlugs: ["equity-realization", "equity-buckets"],
    widget: true,
    glossarySlugs: ["equity-realization", "flush-draw", "open-ended-straight-draw"],
    examples: equityExamples,
    sections: [
      {
        heading: "What equity actually measures",
        paragraphs: [
          "Equity is the share of the pot a hand wins on average if the hand is played to showdown from here. Deal every card that could still come, count who wins each time, and the fraction you take is your equity.",
          "That is a counting problem, not a judgement call, which is why this calculator returns an exact answer rather than an estimate. Nothing is simulated and no sample is taken.",
        ],
        formula: "equity = (boards you win + boards you chop / 2) / all possible boards",
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "Four cards are known — your two and villain's two. The calculator removes them from the deck and enumerates every way the remaining board can complete: 1,712,304 boards preflop, 990 on the flop, 44 on the turn, and exactly one on the river.",
          "Each board is scored for both players with the same hand evaluator, and the wins, losses and chops are counted. A chop counts as half a pot each, which is why equity and raw win percentage differ whenever a split is possible.",
        ],
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Confusing equity with the chance of winning",
            description:
              "They differ whenever a chop is possible. Two players holding the same pair have roughly 50% equity each but almost never 'win' — they split.",
          },
          {
            term: "Reading one hand's equity as a range's",
            description:
              "Equity against one specific holding tells you little about equity against everything villain would play that way. This tool answers the first question only.",
          },
          {
            term: "Forgetting that equity is not the same as profit",
            description:
              "Realising equity needs the hand to get to showdown. Position, stack depth and how often you are forced to fold all move the money you actually keep — that is equity realization, a separate idea.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Exact equity is the anchor every other decision hangs off: compare it to the price the pot is laying you and the call answers itself. What it cannot tell you is what villain actually holds, and that is the harder half of poker.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this equity calculator exact or a simulation?",
        answer:
          "Exact. Every possible board is dealt and counted — 1,712,304 of them preflop. There is no sampling, so running the same spot twice always gives the same answer.",
      },
      {
        question: "Can I calculate equity against a range?",
        answer:
          "Not here. Range-versus-range equity needs assumptions about what villain would play that way, and StackedPoker publishes ranges only where it has a reviewed source. This tool answers the exact question it can answer exactly.",
      },
      {
        question: "Why do equity and win percentage differ?",
        answer:
          "Because of chops. A split pot is counted as half a pot to each player in the equity figure, but as a tie rather than a win in the win percentage.",
      },
    ],
    sourceNote:
      "Equity is computed by exhaustive enumeration in lib/tools/equity.ts using the hand evaluator in lib/tools/handEvaluator.ts — combinatorics, verified against the textbook five-card hand frequencies. No range or solver assumptions are involved.",
  },
  {
    slug: "bankroll-calculator",
    title: "Poker Bankroll Calculator",
    summary:
      "How many buy-ins your roll covers, what your own rule asks for, and when to move up or down.",
    status: "published",
    clusters: ["equity"],
    lessonKey: "expected_value",
    widget: true,
    glossarySlugs: ["bubble-factor"],
    examples: bankrollExamples,
    sections: [
      {
        heading: "What a bankroll rule is for",
        paragraphs: [
          "A bankroll rule converts variance into a stake you can survive. It does not make you win — it stops a normal losing stretch from ending your ability to play at all.",
          "The rule is a number of buy-ins, so it moves with the stake: 40 buy-ins is $4,000 at a $100 buy-in and $400 at a $10 one.",
        ],
        formula: "required bankroll = buy-in x your buy-in rule",
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "Divide your bankroll by one buy-in to get the buy-ins you are covered for, then compare that to your own rule. Above the rule you are rolled; below it, either add funds or drop to a stake where the rule holds again.",
          "The move-up threshold used here is 1.5x the requirement — the same margin the StackedPoker bankroll tracker applies, so the public tool and the signed-in product never disagree.",
        ],
      },
      {
        heading: "Where these numbers come from, and where they do not",
        paragraphs: [
          "Modern Poker Theory states a bankroll figure for tournaments only — at least 200 buy-ins, and 1,000 to minimise the risk of going broke. It gives no figure for cash games, PLO or Spin & Go anywhere in the book.",
          "So the tournament presets are a published figure and the rest are StackedPoker's own defaults. The calculator says which is which every time you switch game type, because a house default presented as a rule is how players end up broke following advice nobody stands behind.",
        ],
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Forgetting the buy-in changes when you move up",
            description:
              "A roll that covers 40 buy-ins at one stake covers 20 at the next one up. Moving up halves your cushion at the moment your edge is smallest.",
          },
          {
            term: "Borrowing a rule from a different format",
            description:
              "Tournament variance is far larger than cash-game variance, so a tournament buy-in count applied to cash is needlessly conservative — and the reverse is dangerous.",
          },
          {
            term: "Counting money you cannot lose",
            description:
              "A bankroll is money set aside for poker. Rent inside the number makes every rule in this calculator meaningless.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Pick a buy-in count you can hold to on a bad day, then let the stake follow the roll rather than the other way round.",
        ],
      },
    ],
    faqs: [
      {
        question: "How big should my poker bankroll be?",
        answer:
          "It depends on format and your own risk tolerance. Modern Poker Theory states at least 200 buy-ins for tournaments; StackedPoker's cash-game default is 40 buy-ins, which is a house default rather than a published figure. The calculator applies whichever rule you choose.",
      },
      {
        question: "When should I move up in stakes?",
        answer:
          "This calculator flags a move up at 1.5x your requirement — enough of a cushion that one bad session at the higher stake does not immediately put you under your own rule.",
      },
      {
        question: "Does a bankroll rule make me a winning player?",
        answer:
          "No. It only controls how likely you are to still be playing after a downswing. A losing player with a large bankroll loses more slowly, not less.",
      },
    ],
    sourceNote:
      "Buy-in presets and the safe/move-up/move-down classification come from lib/bankroll/management.ts, the same module the StackedPoker bankroll tracker uses. Only the tournament figure is a published one (Modern Poker Theory p.264); the others are StackedPoker defaults and are labelled as such on the page.",
  },
  {
    slug: "variance-calculator",
    title: "Poker Variance Calculator",
    summary:
      "The swings a win rate really produces, and what a sample of that size can and cannot prove.",
    status: "published",
    clusters: ["equity"],
    lessonKey: "expected_value",
    wikiSlugs: ["equity-realization"],
    widget: true,
    glossarySlugs: ["expected-value-ev"],
    examples: varianceExamples,
    sections: [
      {
        heading: "Why a winning player still loses for months",
        paragraphs: [
          "A win rate is an average, and averages say nothing about any particular stretch. Over any sample short enough to actually play, the spread around that average is wider than most players expect — often wider than the average itself.",
          "This calculator puts a number on the spread so a downswing can be recognised as normal instead of as evidence that something is broken.",
        ],
      },
      {
        heading: "How the calculation works",
        paragraphs: [
          "Results per 100 hands are treated as independent draws with your win rate as the mean and your standard deviation as the spread. Over N hands the expectation grows linearly while the spread grows with the square root, which is exactly why more hands narrows the estimate of your win rate without narrowing the swings themselves.",
          "The confidence interval then comes from the normal approximation. Four times the hands means twice the standard deviation, never four times.",
        ],
        formula: "expected = winrate x hands/100     spread = SD x sqrt(hands/100)",
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Treating a sample as proof of a win rate",
            description:
              "100,000 hands at a 100 bb/100 standard deviation still leaves a confidence interval several big blinds wide. Most players who 'know' their win rate have a sample that cannot distinguish winning from breaking even.",
          },
          {
            term: "Guessing at standard deviation",
            description:
              "The spread depends entirely on this number, and it varies by game, format and stake. Take it from your own tracking software — StackedPoker publishes no SD figures because it has no reviewed source for them.",
          },
          {
            term: "Reading the interval as a limit on how bad things can get",
            description:
              "A 95% interval is breached one time in twenty, and real results have thicker tails than the normal model. The interval describes the ordinary case, not the worst one.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Variance decides what your results look like; your win rate decides where they end up. Sizing the first is what stops the second from being abandoned halfway through.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many hands do I need to know my win rate?",
        answer:
          "More than most players think. Enter your own numbers above — at a 100 bb/100 standard deviation, even 100,000 hands leaves a confidence interval several big blinds wide.",
      },
      {
        question: "What standard deviation should I use?",
        answer:
          "Your own, taken from your tracking software. It varies enough between games and formats that a borrowed number produces a misleading interval.",
      },
      {
        question: "Is a long losing stretch normal?",
        answer:
          "For a small edge and a normal standard deviation, yes — the calculator will show you the probability of being down after any sample size you enter.",
      },
    ],
    sourceNote:
      "Confidence intervals use the normal approximation to a sum of per-100-hand results — textbook statistics, computed in lib/tools/variance.ts. The model's assumptions are listed on the page. StackedPoker publishes no win-rate or standard-deviation figures.",
  },
  {
    slug: "starting-hand-quiz",
    title: "Poker Starting Hand Quiz",
    summary:
      "Ten hands, graded against a real preflop chart — with the chart's exact mix shown every time.",
    status: "published",
    clusters: ["preflop", "ranges"],
    lessonKey: "preflop_hand_selection",
    wikiSlugs: ["position", "range-advantage"],
    widget: true,
    glossarySlugs: ["raise-first-in", "3-bet-spot", "cold-call"],
    examples: startingHandExamples,
    sections: [
      {
        heading: "Which hands to play, and from where",
        paragraphs: [
          "Preflop is the one decision you face every single hand, and the one where a chart can actually tell you the answer. Getting it right costs nothing and compounds over every pot you play.",
          "This quiz shows a hand and a situation and asks for your action. It grades against a real chart rather than an opinion, and shows you the chart's own mix afterwards.",
        ],
      },
      {
        heading: "How the grading works",
        paragraphs: [
          "Open-or-fold questions are graded against StackedPoker's RFI baseline, ported from the backend's 100bb cash opening ranges. Big-blind defence questions are graded against a complete fold/call/3-bet chart read from Modern Poker Theory's own chart images, cited by page and figure.",
          "Real charts play many hands two ways on purpose. Where the chart is close to indifferent, both answers are accepted — marking a 52/48 hand wrong would be teaching you something false.",
        ],
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Playing the same hands from every seat",
            description:
              "The chart opens far fewer hands from under the gun than from the button, because more players still have to act behind you.",
          },
          {
            term: "Expecting every hand to have one answer",
            description:
              "A chart that plays a hand 50/50 is not undecided — it is telling you the two lines are worth the same, and that picking either consistently is fine.",
          },
          {
            term: "Treating a practical chart as solver output",
            description:
              "The opening ranges here are documented as simplified practical ranges, not solver-exact. They are a sound default, not a ceiling.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Learn the opening ranges for your seat first, then the big blind defence chart. Those two decisions cover the large majority of the hands you will ever be dealt.",
        ],
      },
    ],
    faqs: [
      {
        question: "Which hands should a beginner play preflop?",
        answer:
          "Fewer than most beginners do, and fewer from early position than from late. Start with the open-or-fold mode above — it grades every hand against a real opening chart for the seat you are in.",
      },
      {
        question: "Where do the answers come from?",
        answer:
          "Open-or-fold uses StackedPoker's RFI baseline, ported from the backend's 100bb cash opening ranges. Big-blind defence uses a complete chart from Modern Poker Theory, cited by page and figure on each answer.",
      },
      {
        question: "Why is the same hand sometimes a raise and sometimes a fold?",
        answer:
          "Because real charts mix. When a chart plays a hand close to half the time each way, the quiz accepts either answer and shows you the exact frequencies.",
      },
    ],
    sourceNote:
      "Graded against lib/learn/preflopBaselines.ts (RFI, ported from the backend's 100bb cash open ranges, documented as simplified practical ranges) and lib/learn/bbDefenseComplete.ts (Modern Poker Theory, chapter 5, cited by page and figure per matchup). The quiz decides nothing itself.",
  },
  {
    slug: "range-viewer",
    title: "Poker Range Viewer",
    summary: "Explore opening, 3-betting and defending ranges on a 13×13 grid.",
    status: "planned",
    clusters: ["preflop", "ranges"],
    lessonKey: "range_thinking",
    sourceNote:
      "The range grids currently live inside the interactive lessons; no standalone public viewer exists yet.",
  },
  {
    slug: "position-trainer",
    title: "Poker Position Trainer",
    summary:
      "Drill the six seats and the order they act in until naming them is automatic.",
    status: "published",
    clusters: ["preflop", "postflop"],
    lessonKey: "table_position",
    wikiSlugs: ["position"],
    widget: true,
    glossarySlugs: ["in-position-advantage", "out-of-position-challenge"],
    examples: positionExamples,
    sections: [
      {
        heading: "Why position is the first thing to learn",
        paragraphs: [
          "Acting last means you have seen what everybody else did before you commit. That information advantage repeats on every street of every hand, which is why the same cards are worth more on the button than under the gun.",
          "Before any of that can be used, the seats and their order have to be automatic. That is what this trainer drills.",
        ],
      },
      {
        heading: "How the order works",
        paragraphs: [
          "Six-handed the seats are, clockwise from the dealer button: button, small blind, big blind, under the gun, middle position, cutoff.",
          "Preflop the blinds are already posted, so action starts to their left — under the gun first, big blind last. Postflop the order restarts from the small blind, which is what makes the button last to act on every street after the flop.",
        ],
        definitions: [
          { term: "Preflop order", description: "UTG → MP → CO → BTN → SB → BB" },
          { term: "Postflop order", description: "SB → BB → UTG → MP → CO → BTN" },
        ],
      },
      {
        heading: "Common mistakes",
        definitions: [
          {
            term: "Assuming the blinds always act last",
            description:
              "They act last preflop only. Postflop they are first, which is the whole reason blind hands are difficult to play.",
          },
          {
            term: "Treating the cutoff as a late seat like the button",
            description:
              "The cutoff still has the button behind it. It is a strong seat, but it is not the last one to act.",
          },
          {
            term: "Counting seats from your own chair",
            description:
              "Position is defined relative to the dealer button, which moves every hand. Your seat number never enters into it.",
          },
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Two orders, six seats, and they never change. Learn them once and every strategy discussion afterwards becomes easier to follow.",
        ],
      },
    ],
    faqs: [
      {
        question: "What are the poker positions at a 6-max table?",
        answer:
          "Clockwise from the dealer button: button, small blind, big blind, under the gun, middle position, cutoff. Preflop the order runs UTG → MP → CO → BTN → SB → BB.",
      },
      {
        question: "Who acts first postflop?",
        answer:
          "The small blind. Postflop action restarts from the left of the button, which is why the button is last to act on the flop, turn and river.",
      },
      {
        question: "Why is the button the best seat?",
        answer:
          "Because it acts last on every postflop street, so it always makes its decision with the most information. StackedPoker's concept registry puts the in-position edge at roughly 10% more equity realised with symmetric ranges.",
      },
    ],
    sourceNote:
      "Seat names and action order are the rules of the game. The value of position quotes the StackedPoker poker-theory concept registry's position entry; the trainer asserts nothing further.",
  },
];

/**
 * A "Key terms" section built from the glossary registry.
 *
 * Reuses the definitions already published at /glossary rather than writing a
 * second set, and links each term to the letter page that defines it, so the
 * tool page is genuinely connected to the glossary instead of merely
 * mentioning it.
 */
function keyTermsSection(slugs: string[]): ArticleSection | null {
  const terms = glossaryTerms().filter((term) => slugs.includes(term.slug));
  if (!terms.length) return null;
  return {
    heading: "Key terms",
    definitions: terms.map((term) => ({ term: term.term, description: term.definition })),
  };
}

/** Glossary letter pages for the terms a tool defines — real internal links. */
function glossaryPathsFor(slugs: string[]): string[] {
  const letters = new Set(
    glossaryTerms()
      .filter((term) => slugs.includes(term.slug))
      .map((term) => glossaryLetterPath(letterOf(term.term))),
  );
  return [...letters];
}

function toEntry(tool: ToolSource): SeoEntry {
  const lessons = tool.lessonKey ? lessonsForConceptKey(tool.lessonKey, 4) : [];
  const keyTerms = tool.glossarySlugs ? keyTermsSection(tool.glossarySlugs) : null;

  const sections: ArticleSection[] | undefined = tool.sections
    ? [
        ...tool.sections.slice(0, -1),
        ...(tool.examples ? [tool.examples()] : []),
        ...(keyTerms ? [keyTerms] : []),
        // "Key takeaway" stays last — it is the line a generative engine
        // lifts, and the GEO structure puts it at the end.
        ...tool.sections.slice(-1),
      ]
    : undefined;

  const entry: SeoEntry = {
    kind: "tool",
    slug: tool.slug,
    path: toolPath(tool.slug),
    title: tool.title,
    summary: tool.summary,
    status: tool.status,
    tags: ["poker tool", "free poker calculator", ...tool.clusters],
    clusters: tool.clusters,
    body: sections,
    faqs: tool.faqs,
    relatedPaths: [
      ...(tool.livePath ? [tool.livePath] : []),
      ...(tool.wikiSlugs ?? []).map(wikiPath),
      ...lessons.map((l) => lessonPath(l.slug)),
      ...glossaryPathsFor(tool.glossarySlugs ?? []),
      // Every tool links to the others: a visitor who wanted pot odds is one
      // click from equity, and the tools reinforce each other's rankings.
      ...TOOLS.filter((other) => other.slug !== tool.slug && other.status === "published").map(
        (other) => toolPath(other.slug),
      ),
    ],
    priority: tool.status === "published" ? 0.7 : 0.3,
    changeFrequency: "monthly",
    sourceNote: tool.sourceNote,
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };

  return entry;
}

let cache: SeoEntry[] | null = null;

export function toolEntries(): SeoEntry[] {
  cache ??= TOOLS.map(toEntry);
  return cache;
}

export function toolEntryBySlug(slug: string): SeoEntry | undefined {
  return toolEntries().find((e) => e.slug === slug);
}

/** The live URL a shipped tool points at, if any. */
export function toolLivePath(slug: string): string | undefined {
  return TOOLS.find((t) => t.slug === slug)?.livePath;
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetToolCache(): void {
  cache = null;
}

/** Slugs that declare an interactive widget. Cross-checked against
 *  components/tools/index.tsx by lib/tools/__tests__/toolIntegration.test.ts. */
export function interactiveToolSlugs(): string[] {
  return TOOLS.filter((tool) => tool.widget).map((tool) => tool.slug);
}

export function toolHasWidget(slug: string): boolean {
  return Boolean(TOOLS.find((tool) => tool.slug === slug)?.widget);
}

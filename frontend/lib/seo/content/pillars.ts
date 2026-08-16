import { aiCoachDailyLimit, canAccessModule } from "@/lib/entitlements";
import { LEARNING_MODULES } from "@/lib/learn/curriculumPublic.generated";
import { BB_DEFENSE_COMPLETE_100BB_PROVENANCE } from "@/lib/learn/bbDefenseComplete";
import { CASH_100BB_OPEN_RESPONSE_CHARTS } from "@/lib/learn/cash100bbOpenResponseBaselines";
import { MTT_RFI_CHARTS } from "@/lib/learn/mttRfiBaselines";
import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { readingTimeMin } from "../reading";
import { lessonPath, ROUTES, toolPath, wikiPath } from "../routes";
import type { SeoEntry } from "../types";
import { courseEntries, publishedLessons } from "./lessons";
import { toolEntries } from "./tools";

/**
 * Topic pillars.
 *
 * Pages that own a broad search intent the site could already half-answer
 * across a dozen lessons but nowhere in one place. A pillar's job is to be the
 * page that DESERVES the query, and then hand the reader to whichever lesson,
 * wiki article or calculator actually owns each piece.
 *
 * The rule that shapes every line below: a pillar page states no poker theory
 * of its own. It states facts about the game's notation and arithmetic (a
 * suited hand has four combinations; there are 169 starting-hand classes),
 * facts about StackedPoker (what is taught, what is free, what exists), and
 * then links. Where a reader needs the theory itself, they are sent to the
 * page that quotes a reviewed source for it. That is what keeps a hub from
 * becoming the site's largest pile of unsourced generalisations.
 */

function facts() {
  return {
    modules: courseEntries().length,
    lessons: publishedLessons().length,
    tools: toolEntries().filter((t) => t.status === "published").length,
  };
}

// ── Preflop charts ───────────────────────────────────────────────────────────

/**
 * Exactly what chart data exists, counted from the data itself.
 *
 * Hard-coding "32 charts" here would be a claim with a shelf life. Counting
 * the registry means the page cannot promise a chart that was removed, or
 * hide one that was added.
 */
function chartInventory() {
  const mttKeys = Object.keys(MTT_RFI_CHARTS);
  const mttPositions = new Set(Object.values(MTT_RFI_CHARTS).map((c) => c.position));
  const mttDepths = [...new Set(Object.values(MTT_RFI_CHARTS).map((c) => c.stackBB))].sort(
    (a, b) => a - b,
  );
  const bbDefence = Object.keys(BB_DEFENSE_COMPLETE_100BB_PROVENANCE);
  const openResponse = Object.keys(CASH_100BB_OPEN_RESPONSE_CHARTS);
  return {
    mttCount: mttKeys.length,
    mttPositions: mttPositions.size,
    mttDepths,
    bbDefenceCount: bbDefence.length,
    openResponseCount: openResponse.length,
    total: mttKeys.length + bbDefence.length + openResponse.length,
  };
}

function preflopChartsEntry(): SeoEntry {
  const chart = chartInventory();
  const depths = chart.mttDepths.join("bb, ") + "bb";

  const entry: SeoEntry = {
    kind: "page",
    slug: "preflop-charts",
    path: "/preflop-charts",
    title: "Preflop Poker Charts: How to Read Them and Which Ones Are Real",
    summary: `What a preflop chart actually encodes, how to read a 13x13 hand grid, and the ${chart.total} charts StackedPoker publishes — every one traced to a numbered figure in a named book, with the gaps stated rather than filled in.`,
    status: "published",
    tags: [
      "preflop charts",
      "preflop poker charts",
      "poker range chart",
      "preflop ranges",
      "opening ranges",
      "rfi chart",
    ],
    clusters: ["preflop", "ranges"],
    body: [
      {
        heading: "What a preflop chart is",
        paragraphs: [
          "A preflop chart maps every starting hand to an action — raise, call, or fold — for one specific situation. Change the situation and you change the chart: the seat you are sitting in, the seat that acted before you, how deep the stacks are and how big the raise was all belong to the chart, not to the hand.",
          "That is the single most common way charts get misused. A chart is an answer to one question. Applying it to a different question is not a shortcut, it is a different answer.",
        ],
      },
      {
        heading: "How to read a 13x13 hand grid",
        paragraphs: [
          "Almost every chart you will see is the same 13-by-13 square, because that is how many distinct starting hands there are once suits that play identically are collapsed together: 169 hand classes.",
        ],
        definitions: [
          {
            term: "The diagonal",
            description:
              "Pocket pairs, AA down to 22. Each one can be dealt 6 ways, so a pair is 6 of the deck's 1,326 possible starting combinations.",
          },
          {
            term: "Above the diagonal",
            description:
              "Suited hands, written with an s — AKs. Four ways to be dealt, one per suit.",
          },
          {
            term: "Below the diagonal",
            description:
              "Offsuit hands, written with an o — AKo. Twelve ways to be dealt, which is why offsuit hands dominate the raw combination count and why a chart that looks mostly empty can still cover a lot of hands.",
          },
          {
            term: "A part-filled cell",
            description:
              "A mixed strategy: the hand takes that action some of the time. It is not indecision on the chart's part — it is the answer.",
          },
        ],
      },
      {
        heading: "Why position changes everything on the chart",
        paragraphs: [
          "The same two cards are a raise in one seat and a fold in another, and no amount of studying the hand will tell you which — the seat is the variable. StackedPoker's explainer on position covers why acting later is worth more, and the position trainer drills the seats themselves.",
        ],
      },
      {
        heading: "The charts StackedPoker publishes",
        paragraphs: [
          `There are ${chart.total}, and every one was read out of a numbered figure in Michael Acevedo's Modern Poker Theory (D&B Poker, 2019) and then checked against the aggregate percentage the book prints beneath that same figure.`,
        ],
        definitions: [
          {
            term: `First-in raising, ${chart.mttCount} charts`,
            description: `${chart.mttPositions} positions at ${depths} effective, for 9-handed tournament play with an ante. Chapter 7, Hand Ranges 96 to 139.`,
          },
          {
            term: `Big blind defence, ${chart.bbDefenceCount} charts`,
            description:
              "Fold, call and 3-bet frequencies for the big blind facing a single raise from each earlier seat, 6-max cash at 100bb. Chapter 5, Hand Ranges 76 to 84.",
          },
          {
            term: `Button versus cutoff, ${chart.openResponseCount} chart`,
            description:
              "The button's complete response to a cutoff open, 6-max cash at 100bb. Chapter 5, Hand Range 66.",
          },
        ],
      },
      {
        heading: "What is deliberately missing",
        paragraphs: [
          "There is no chart here for 6-max cash opening ranges, for facing a 3-bet, or for most defending seats. Not because they do not matter — they are among the most asked-for charts in poker — but because no published figure has been extracted for them, and a chart assembled from a general description would look exactly as authoritative as one that was measured.",
          "Where StackedPoker teaches those spots, it teaches them as lessons with the reasoning shown, and says on the page that the range is a teaching construction rather than a solver output. A chart with a citation and a chart without one are different objects, and this site does not present them as the same.",
        ],
      },
      {
        heading: "Practising a chart instead of memorising it",
        paragraphs: [
          "Reading a chart teaches you the chart. Building it from memory, hand by hand, and being told which cells you got wrong is what teaches you the shape — and the shape is what survives into a spot no chart covers.",
          "The range trainer does exactly that, and needs nothing but a free account. If you would rather start from a hand you actually played, the hand analyzer takes one and works out the maths on it with no account at all.",
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "A preflop chart is worth exactly as much as your knowledge of which question it answers. Check the seat, the stack depth and the raise size before you trust a cell — and prefer a chart that tells you where it came from.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is a preflop chart in poker?",
        answer:
          "A table mapping each of the 169 starting-hand classes to an action for one specific situation — your seat, the action before you, the stack depth and the raise size. Change any of those and the correct chart changes with it.",
      },
      {
        question: "How do you read a poker range chart?",
        answer:
          "It is a 13x13 grid. Pocket pairs run down the diagonal, suited hands sit above it and offsuit hands below. A fully coloured cell means always take that action; a part-filled cell means take it some of the time.",
      },
      {
        question: "Are StackedPoker's preflop charts free?",
        answer: `Yes. The ${chart.total} charts are used throughout the lessons and the range trainer, and no chart is behind a payment. The range trainer needs a free account; the calculators need no account at all.`,
      },
      {
        question: "Where do these preflop charts come from?",
        answer:
          "Every one was read from a numbered figure in Modern Poker Theory (Acevedo, 2019) by pixel measurement of the book's own chart images, then cross-validated against the aggregate percentage printed beneath each figure. The page names the chapter and figure numbers.",
      },
      {
        question: "Why is there no 6-max cash opening chart here?",
        answer:
          "Because no published figure for it has been extracted yet. StackedPoker publishes a chart only when it can name the source; the alternative is a chart that looks just as confident but is not measured.",
      },
    ],
    relatedPaths: [
      wikiPath("position"),
      wikiPath("range-advantage"),
      toolPath("position-trainer"),
      toolPath("poker-hand-analyzer"),
      toolPath("starting-hand-quiz"),
      ROUTES.courses,
      lessonPath("think-in-ranges"),
    ],
    priority: 0.8,
    changeFrequency: "monthly",
    sourceNote:
      "Chart counts, positions and stack depths on this page are counted from the chart registries at build time. The charts themselves come from Modern Poker Theory (Acevedo, 2019), chapters 5 and 7; no range on this page is authored by StackedPoker.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };
  return entry;
}

// ── Texas Hold'em strategy pillar ────────────────────────────────────────────

function texasHoldemStrategyEntry(): SeoEntry {
  const { modules, lessons, tools } = facts();

  const entry: SeoEntry = {
    kind: "page",
    slug: "texas-holdem-strategy",
    path: "/texas-holdem-strategy",
    title: "Texas Hold'em Strategy: What to Learn, and in What Order",
    summary: `A map of Texas Hold'em strategy — position, preflop ranges, pot odds, board texture, bet sizing — with each idea handed to the StackedPoker page that explains it properly, across ${lessons} lessons, ${modules} modules and ${tools} calculators.`,
    status: "published",
    tags: [
      "texas holdem strategy",
      "texas hold'em strategy",
      "poker strategy",
      "holdem strategy guide",
      "how to play poker well",
    ],
    clusters: ["poker-strategy", "fundamentals"],
    body: [
      {
        heading: "Strategy is a stack of decisions, not a list of rules",
        paragraphs: [
          "Most Hold'em advice arrives as rules — raise these hands, fold those, bet two-thirds. Rules work until the spot is slightly different from the one the rule was written for, which in poker is most spots.",
          "What survives is knowing which question a decision turns on. This page is the map of those questions in the order they stop costing you money, with each one linked to the page that answers it in full. Nothing here is explained twice.",
        ],
      },
      {
        heading: "1. Position — the cheapest edge in the game",
        paragraphs: [
          "Acting after your opponent means every decision you make is informed by one they have already committed to, for the entire hand. It is the one advantage that costs nothing to use and applies to every hand you play.",
          "Start here, because every later idea on this page is modified by it: the same hand, the same board and the same bet are different problems in and out of position.",
        ],
      },
      {
        heading: "2. Preflop — deciding before the board decides for you",
        paragraphs: [
          "Preflop is where the largest, cheapest mistakes live, because a hand you should not have played costs you on every street afterwards. The work is knowing which hands your seat can profitably enter with, and what to do when someone raises you back.",
          "Charts help, provided you know what a chart is an answer to — and StackedPoker's charts page is explicit about which situations it has a sourced chart for and which it does not.",
        ],
      },
      {
        heading: "3. Ranges — thinking in sets rather than hands",
        paragraphs: [
          "Strong players do not ask what their opponent has. They ask what their opponent could have, given every action taken so far, and then ask which of those hands their own hand beats.",
          "This is the shift that makes the rest of poker legible, and it is the hardest one to make from reading alone — which is why StackedPoker teaches it by making you build ranges rather than look at them.",
        ],
      },
      {
        heading: "4. Pot odds and equity — the arithmetic underneath",
        paragraphs: [
          "Two numbers decide every call: the share of the pot you need to break even at the price offered, and the share you actually have. The first is arithmetic on the bet and the pot. The second depends on your hand against theirs.",
          "None of this is advanced, and all of it is checkable — which is why StackedPoker's calculators show the formula alongside the answer rather than just the answer.",
        ],
      },
      {
        heading: "5. Board texture and postflop",
        paragraphs: [
          "A flop is not just three cards; it is a statement about which of the two ranges got helped. Whether a board is paired, connected or all one suit changes who can hold the strongest hands on it — and that, rather than your own two cards, is what most postflop decisions turn on.",
        ],
      },
      {
        heading: "6. Bet sizing — what a size is trying to do",
        paragraphs: [
          "A bet size is a question about what you want to happen. A small bet asks a lot of hands to pay a little; a large one asks a few hands to pay a lot. Sizing badly leaks money quietly, because the hand still often works.",
        ],
      },
      {
        heading: "The mistakes that cost the most",
        definitions: [
          {
            term: "Playing too many hands from early seats",
            description:
              "The most expensive habit in low-stakes poker, and the one position fixes first.",
          },
          {
            term: "Calling because the hand is pretty",
            description:
              "A hand's looks are not a price. If the pot is not laying the equity the call needs, the call is losing money however the river runs.",
          },
          {
            term: "Playing your two cards instead of your range",
            description:
              "The board interacts with everything you could have. Reading it only against what you do have is what makes good boards feel bad and bad boards feel good.",
          },
          {
            term: "Copying a chart from a different situation",
            description:
              "A chart's seat, stack depth and raise size are part of the chart. Borrowing one from elsewhere gives you a confident answer to a question nobody asked.",
          },
        ],
      },
      {
        heading: "How to actually study this",
        paragraphs: [
          "Reading strategy produces recognition, not recall — you finish an article agreeing with it and play the next session identically. What changes decisions is committing to one before you are told the answer, being wrong, and finding out why.",
          `That is the whole design of StackedPoker's ${lessons} lessons: every one is a sequence of real spots where you decide first and the reasoning arrives second. Start with the first module — it assumes nothing, and it is free.`,
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "Learn position first, preflop second, and ranges third — in that order, because each one makes the next one make sense. The maths is easier than it looks and the arithmetic is checkable. Everything else is detail on top of those.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the most important Texas Hold'em strategy to learn first?",
        answer:
          "Position. Acting after your opponent informs every other decision in the hand, it applies to every hand you play, and it costs nothing to use. Preflop hand selection comes second because it is where the largest repeated mistakes are.",
      },
      {
        question: "How long does it take to get good at Texas Hold'em?",
        answer:
          "There is no honest number — it depends on the stakes you are aiming at and how you study. What is knowable is that studying by deciding first and reading the explanation second changes decisions faster than reading alone, because recognising an idea and being able to apply it are different skills.",
      },
      {
        question: "Do I need to learn poker maths to win?",
        answer:
          "You need pot odds and a working sense of equity. Both are arithmetic on the bet, the pot and your hand — no algebra involved — and StackedPoker's calculators show the formula next to the answer so it can be checked rather than trusted.",
      },
      {
        question: "Is Texas Hold'em strategy the same for cash games and tournaments?",
        answer:
          "The concepts are. The correct ranges are not: stack depth and the presence of an ante change which hands are profitable, which is why a chart is only valid for the format and depth it was solved at.",
      },
      {
        question: "Can I learn Texas Hold'em strategy free on StackedPoker?",
        answer:
          "Partly. The wiki, the glossary and every calculator are free with no account; the first two modules are free with one. The remaining modules are on the paid plans.",
      },
    ],
    relatedPaths: [
      wikiPath("position"),
      wikiPath("range-advantage"),
      wikiPath("spr"),
      wikiPath("cbet"),
      "/preflop-charts",
      ROUTES.courses,
      ROUTES.wiki,
      toolPath("pot-odds-calculator"),
      toolPath("equity-calculator"),
      lessonPath("think-in-ranges"),
    ],
    priority: 0.9,
    changeFrequency: "monthly",
    sourceNote:
      "This page is a map, not a source: it frames each topic in a paragraph and links to the StackedPoker page that explains it against reviewed material. Lesson, module and tool counts are read from the content registries at build time.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };
  return entry;
}

// ── Free poker training ──────────────────────────────────────────────────────

/**
 * What the free tier actually gets, asked of the entitlement code itself.
 *
 * This page's whole value is that it is accurate, so no number on it is
 * typed. `canAccessModule` is the same predicate the app locks lessons with:
 * if the gate moves, this page moves, and it cannot promise something the
 * product does not give.
 */
function freeAccess() {
  const modules = [...LEARNING_MODULES].sort(
    (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
  );
  const free = modules.filter((m) => canAccessModule("free", m, modules));
  return {
    freeModuleTitles: free.map((m) => m.title),
    freeModuleCount: free.length,
    totalModules: courseEntries().length,
    coachMessages: aiCoachDailyLimit("free"),
  };
}

function freePokerTrainingEntry(): SeoEntry {
  const access = freeAccess();
  const { tools, lessons } = facts();
  const named = access.freeModuleTitles.map((t) => `"${t}"`).join(" and ");

  const entry: SeoEntry = {
    kind: "page",
    slug: "free-poker-training",
    path: "/free-poker-training",
    title: "Free Poker Training: Exactly What You Get Without Paying",
    summary: `An itemised list of what StackedPoker gives away — ${tools} calculators and the full wiki with no account, ${access.freeModuleCount} complete modules and ${access.coachMessages} AI coach messages a day with a free one — and what sits behind the paywall.`,
    status: "published",
    tags: [
      "free poker training",
      "poker training online free",
      "free poker lessons",
      "free poker course",
      "learn poker free",
    ],
    clusters: ["poker-strategy"],
    body: [
      {
        heading: "Free poker training usually means something else",
        paragraphs: [
          "Most sites advertising free poker training mean a free trial, a free first video, or a free account that unlocks a menu of things you cannot click. The word is doing marketing work rather than describing anything.",
          "So this page is an inventory instead of a pitch. Everything below is generated from the same code that locks the lessons, which means it cannot promise you something the product does not actually give.",
        ],
      },
      {
        heading: "Free with no account at all",
        definitions: [
          {
            term: `${tools} calculators`,
            description:
              "Pot odds, equity, EV, outs, bankroll, variance, a position trainer, a starting-hand quiz and the hand analyzer. No signup wall, no email, no usage cap.",
          },
          {
            term: "The whole poker wiki",
            description:
              "Every published concept explainer, with the reviewed source named on the page.",
          },
          {
            term: "The whole glossary",
            description: "Every term, defined and linked to the lesson that teaches it.",
          },
        ],
      },
      {
        heading: "Free with an account",
        paragraphs: [
          `${access.freeModuleCount} of the ${access.totalModules} modules open in full — ${named} — plus the opening lesson of every other module, so you can see what each one is before deciding about any of it.`,
        ],
        definitions: [
          {
            term: "The AI coach",
            description: `${access.coachMessages} messages a day. It answers about a specific spot using the same concept material the lessons use, and it will tell you when a question needs something it has no reviewed source for.`,
          },
          {
            term: "The range trainer",
            description:
              "Build a range from memory, submit it, and get told which hands you placed wrong.",
          },
          {
            term: "Progress, XP and streaks",
            description:
              "The whole progression system, including the leaderboard. None of it is a paid feature.",
          },
        ],
      },
      {
        heading: "What is not free",
        paragraphs: [
          `The remaining modules beyond the first ${access.freeModuleCount}, an unlimited AI coach allowance, and the Elite-only solver explorer. Prices are on the pricing page and are deliberately not repeated here, because a second copy of a price is a copy that will eventually be wrong.`,
        ],
      },
      {
        heading: "Is the free part actually enough to improve?",
        paragraphs: [
          `Honestly: for a beginner, yes, for a while. The two free modules cover how the game works, position, pot odds and the arithmetic behind a call — which is where most losing players are actually losing. The ${tools} calculators do not expire, and neither does the wiki.`,
          "What you do not get for free is the back half of the curriculum, where preflop ranges, board texture and range-versus-range thinking are built out across the remaining modules. If you finish the free modules and want the next step, that is what the paid plans are.",
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          `Start with the calculators — they need nothing. If the way they explain themselves works for you, an account opens ${access.freeModuleCount} full modules and the coach, and you can decide about paying after you have finished something.`,
        ],
      },
    ],
    faqs: [
      {
        question: "Is StackedPoker really free?",
        answer: `Partly, and this page lists which parts. ${tools} calculators, the wiki and the glossary need no account. A free account opens ${access.freeModuleCount} complete modules, the opening lesson of every other module, the range trainer and ${access.coachMessages} AI coach messages a day. The remaining modules are paid.`,
      },
      {
        question: "Do I need a credit card for the free plan?",
        answer: "No. The free tier is not a trial and does not ask for payment details.",
      },
      {
        question: "What is the best free poker training for a complete beginner?",
        answer: `Start with the first module, which assumes no knowledge at all — not even hand rankings — and is free with an account. Alongside it, the pot odds and equity calculators are free with no account and show their formulas, so the arithmetic becomes something you can check rather than memorise.`,
      },
      {
        question: "How many free poker lessons are there?",
        answer: `${access.freeModuleCount} modules open completely on the free tier, plus the first lesson of every remaining module out of ${lessons} lessons in total.`,
      },
      {
        question: "Is the free AI poker coach any good?",
        answer: `It is limited to ${access.coachMessages} messages a day on the free tier, and it is grounded in the same reviewed concept material as the lessons — including refusing to answer where no reviewed source exists rather than inventing one. That constraint is the point of it.`,
      },
    ],
    relatedPaths: [
      "/poker-training",
      ROUTES.pricing,
      ROUTES.courses,
      ROUTES.tools,
      toolPath("pot-odds-calculator"),
      toolPath("poker-hand-analyzer"),
      "/texas-holdem-strategy",
    ],
    priority: 0.9,
    changeFrequency: "monthly",
    sourceNote:
      "Every access claim on this page is derived at build time from lib/entitlements.ts — the same predicates that gate the product — and from the content registries. Prices are not restated here; they live on the pricing page.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };
  return entry;
}

let cache: SeoEntry[] | null = null;

export function pillarEntries(): SeoEntry[] {
  cache ??= [preflopChartsEntry(), texasHoldemStrategyEntry(), freePokerTrainingEntry()];
  return cache;
}

export function pillarEntryBySlug(slug: string): SeoEntry | undefined {
  return pillarEntries().find((entry) => entry.slug === slug);
}

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
import { lessonPath, toolPath, wikiPath } from "../routes";
import type { ArticleSection, ContentStatus, FaqItem, SeoEntry } from "../types";
import { lessonsForConceptKey } from "./lessons";

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
  sections?: ArticleSection[];
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
    sections: [
      {
        heading: "What pot odds tell you",
        paragraphs: [
          "Pot odds convert the price of a call into the minimum equity that call needs to break even. If you must call 50 chips to win a pot of 150, you are risking 50 to win 150 — you need to win at least a third of the time.",
        ],
        formula: "Required equity = call / (pot after villain's bet + call)",
      },
      {
        heading: "Pot odds by bet size",
        definitions: potOddsRows(),
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
    sections: [
      {
        heading: "What an out is",
        paragraphs: [
          "An out is any unseen card that improves your hand to a winner. After the flop there are 47 cards you have not seen, so nine flush outs means nine of those 47 cards complete your flush.",
        ],
        formula: "P(hit by river) = 1 − ((47 − outs) / 47) × ((46 − outs) / 46)",
      },
      {
        heading: "Outs to equity",
        definitions: outsRows(),
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
    sections: [
      {
        heading: "What expected value measures",
        paragraphs: [
          "Expected value is the average result of a decision if you could repeat it forever. Each outcome is multiplied by how often it happens, and the products are added together.",
        ],
        formula: "EV = P(win) × amount won + P(lose) × amount lost",
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
    slug: "equity-calculator",
    title: "Poker Equity Calculator",
    summary: "Hand-versus-hand and hand-versus-range equity, calculated exactly.",
    status: "planned",
    clusters: ["equity"],
    lessonKey: "hand_vs_range_equity",
    sourceNote:
      "StackedPoker has no public equity engine yet, so this page carries no equity figures.",
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
    summary: "Drill position, action order and who is in position after the flop.",
    status: "planned",
    clusters: ["preflop"],
    lessonKey: "table_position",
    wikiSlugs: ["position"],
    sourceNote:
      "Position drills currently live inside the interactive lessons; no standalone trainer exists yet.",
  },
];

function toEntry(tool: ToolSource): SeoEntry {
  const lessons = tool.lessonKey ? lessonsForConceptKey(tool.lessonKey, 4) : [];

  const entry: SeoEntry = {
    kind: "tool",
    slug: tool.slug,
    path: toolPath(tool.slug),
    title: tool.title,
    summary: tool.summary,
    status: tool.status,
    tags: ["poker tool", "free poker calculator", ...tool.clusters],
    clusters: tool.clusters,
    body: tool.sections,
    faqs: tool.faqs,
    relatedPaths: [
      ...(tool.livePath ? [tool.livePath] : []),
      ...(tool.wikiSlugs ?? []).map(wikiPath),
      ...lessons.map((l) => lessonPath(l.slug)),
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

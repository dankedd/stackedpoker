import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { readingTimeMin } from "../reading";
import { ROUTES, toolPath, wikiPath } from "../routes";
import type { SeoEntry } from "../types";
import { courseEntries, publishedLessons } from "./lessons";
import { toolEntries } from "./tools";

/**
 * Commercial landing pages (§9).
 *
 * These target the searcher who is choosing a poker training platform rather
 * than looking up a rule — the highest-intent traffic the site can attract,
 * and previously served only by the homepage and /pricing.
 *
 * Two rules govern what may go on them:
 *
 *  1. Every claim is a fact about StackedPoker, derived from the registries
 *     wherever a number is involved (module count, lesson count, tool count),
 *     so the page cannot drift from the product the way hand-typed marketing
 *     copy does.
 *  2. No claim about a competitor. "Better than X" is not something this
 *     codebase can support, and an unsupported comparison is worth less than
 *     an honest description — it is also the fastest way to lose the trust
 *     that makes an assistant willing to cite you.
 *
 * Pricing is deliberately NOT repeated here. It lives on /pricing, and a
 * second copy would drift the first time a plan changed.
 */

function facts() {
  const modules = courseEntries().length;
  const lessons = publishedLessons().length;
  const tools = toolEntries().filter((t) => t.status === "published").length;
  return { modules, lessons, tools };
}

function pokerTrainingEntry(): SeoEntry {
  const { modules, lessons, tools } = facts();

  const entry: SeoEntry = {
    kind: "page",
    slug: "poker-training",
    path: "/poker-training",
    title: "Poker Training That Explains Why",
    summary: `An interactive Texas Hold'em curriculum: ${lessons} lessons across ${modules} modules, ${tools} free calculators, and an AI coach — built so every strategy claim is traceable to a reviewed source.`,
    status: "published",
    tags: [
      "poker training",
      "poker training site",
      "poker training app",
      "poker study platform",
      "learn poker",
    ],
    clusters: ["poker-strategy"],
    body: [
      {
        heading: "What StackedPoker is",
        paragraphs: [
          `A structured Texas Hold'em course you play rather than read. Every lesson puts you in a real spot, makes you commit to a decision, and only then shows you the answer and the reasoning behind it — the commitment is what makes the concept stick.`,
          `There are ${lessons} interactive lessons across ${modules} modules, from the rules of the game through preflop ranges, board texture and range-versus-range thinking.`,
        ],
      },
      {
        heading: "Who it is for",
        definitions: [
          {
            term: "Beginners who want the real thing",
            description:
              "The first two modules assume nothing — not even hand rankings — but teach position, pot odds and ranges from the start rather than saving them for later.",
          },
          {
            term: "Players stuck at low stakes",
            description:
              "If you know the moves but not the reasons, the lessons that matter are the range and board-texture modules. They are the ones that change decisions rather than adding vocabulary.",
          },
          {
            term: "Anyone who wants to check the maths",
            description:
              "The free calculators are exact and show their working, so you can verify a claim rather than take it on trust.",
          },
        ],
      },
      {
        heading: "How the curriculum works",
        paragraphs: [
          "Modules run in order, each built on the one before. A lesson is a sequence of interactive steps — predict the decision, see the reveal, read why it works — rather than a video you watch passively.",
          "Progress, XP and per-concept mastery are tracked as you go, so the next thing to study is always visible.",
        ],
      },
      {
        heading: "The free tools",
        paragraphs: [
          `${tools} calculators, free and with no account: pot odds, outs, expected value, exact hand-vs-hand equity, bankroll requirements, variance, plus a position trainer and a starting-hand quiz graded against a real preflop chart.`,
          "The equity calculator enumerates every remaining board rather than simulating, so the number it gives is exact. The bankroll calculator states which figures come from published sources and which are StackedPoker's own defaults.",
        ],
      },
      {
        heading: "The AI Coach",
        paragraphs: [
          "Ask about a spot and get an explanation grounded in the same concept material the lessons use. Every account includes it, with a daily message allowance that rises on the paid plans.",
        ],
      },
      {
        heading: "Free versus paid",
        definitions: [
          {
            term: "Free, with an account",
            description:
              "The first two modules in full, the opening lesson of every remaining module, XP, achievements, streaks, the leaderboard, the range trainer and the AI coach on a daily allowance.",
          },
          {
            term: "Free, with no account",
            description: "Every calculator, the whole poker wiki and the whole glossary.",
          },
          {
            term: "Paid",
            description:
              "The remaining modules and every future one, the full range trainer, and a higher AI coach allowance. Current prices are on the pricing page.",
          },
        ],
      },
      {
        heading: "What makes it different",
        paragraphs: [
          "Poker content is easy to generate and hard to trust. StackedPoker's answer is traceability: every strategy claim on the public site is quoted from reviewed material, and where no reviewed source exists the page says so and stays empty rather than being filled in.",
          "That is why six concepts in the wiki are still blank, and why the equity calculator refuses range-versus-range rather than approximating it. A tool that tells you what it cannot do is more useful than one that guesses.",
        ],
      },
      {
        heading: "Key takeaway",
        paragraphs: [
          "If you want a curriculum that explains why a play works, checks its own maths, and admits what it does not know, start with the first module — it is free and needs nothing but an account.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is StackedPoker free?",
        answer: `Partly. Every calculator, the wiki and the glossary are free with no account. With a free account you get the first two modules in full plus the opening lesson of every other module. The rest is on the paid plans.`,
      },
      {
        question: "Who is StackedPoker for?",
        answer:
          "Players who want to understand why a play works rather than memorise charts — from complete beginners through low-stakes players trying to get unstuck.",
      },
      {
        question: "How is this different from watching poker videos?",
        answer:
          "You make the decision before you see the answer. A lesson is a sequence of spots you have to commit to, not a recording you watch.",
      },
      {
        question: "Do I need to pay to try it?",
        answer: `No. ${tools} calculators need no account at all, and the first two modules are free with one.`,
      },
      {
        question: "Does StackedPoker use a solver?",
        answer:
          "It is not a solver. It teaches the concepts solver output is built on, and quotes reviewed sources for its strategy claims rather than generating them.",
      },
    ],
    relatedPaths: [
      "/free-poker-training",
      "/texas-holdem-strategy",
      "/preflop-charts",
      ROUTES.courses,
      ROUTES.tools,
      ROUTES.wiki,
      ROUTES.pricing,
      toolPath("equity-calculator"),
      toolPath("pot-odds-calculator"),
      wikiPath("position"),
    ],
    priority: 0.9,
    changeFrequency: "monthly",
    sourceNote:
      "Every figure on this page is derived from the StackedPoker content registries at build time; no competitor claims are made and no prices are restated here.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };

  return entry;
}

let cache: SeoEntry[] | null = null;

export function landingEntries(): SeoEntry[] {
  cache ??= [pokerTrainingEntry()];
  return cache;
}

export function landingEntryBySlug(slug: string): SeoEntry | undefined {
  return landingEntries().find((e) => e.slug === slug);
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/reset.ts. */
export function resetLandingCache(): void {
  cache = null;
}

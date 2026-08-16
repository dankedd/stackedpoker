import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { readingTimeMin } from "../reading";
import { lessonPath, wikiPath } from "../routes";
import type { ArticleSection, ContentDifficulty, SeoEntry } from "../types";
import {
  applicationPatternsFor,
  conceptExplainer,
  firstSentence,
  mistakePatternsFor,
  type ConceptExplainer,
} from "./concepts";
import { lessonsForConceptKey, moduleForLesson } from "./lessons";

/**
 * The Poker Wiki (§5).
 *
 * Every published article is generated from one entry in
 * lib/theory/concepts.json. That registry is the only place in this repo that
 * holds written poker explanations outside the (answer-bearing, non-public)
 * curriculum, so it is the only thing the wiki is allowed to quote.
 *
 * Slugs the product wants but the registry cannot yet support are declared
 * below as `planned`. They route, they render, they are internally linked —
 * and they are explicitly noindex and excluded from every sitemap until real
 * source material exists. That is the deliberate alternative to writing
 * plausible-sounding poker theory to fill the page (CLAUDE.md; brief §24).
 */

interface WikiSource {
  /** URL slug. */
  slug: string;
  /** Key in lib/theory/concepts.json. */
  conceptId: string;
  /** Overrides the registry's `name` when it is too long for an `<h1>`. */
  title?: string;
  /**
   * How the concept is referred to inside a sentence ("What is MDF in
   * poker?"). Derived from the title when omitted, but several registry
   * names carry a parenthetical gloss that reads badly mid-question.
   */
  shortName?: string;
  /** Token key used to find related lessons. Defaults to `conceptId`. */
  lessonKey?: string;
  clusters: string[];
  difficulty?: ContentDifficulty;
}

/** Concepts with a written explanation → real, indexable articles. */
const WIKI_SOURCES: WikiSource[] = [
  { slug: "mdf", conceptId: "mdf", title: "Minimum Defense Frequency (MDF)", shortName: "MDF", clusters: ["game-theory"], difficulty: "intermediate" },
  { slug: "alpha", conceptId: "alpha", title: "Alpha (Break-Even Bluff Frequency)", shortName: "alpha", clusters: ["game-theory"], difficulty: "intermediate" },
  { slug: "nash-equilibrium", conceptId: "nash_equilibrium", shortName: "Nash equilibrium", clusters: ["game-theory"], difficulty: "advanced" },
  { slug: "indifference", conceptId: "indifference", shortName: "the indifference principle", clusters: ["game-theory"], difficulty: "advanced" },
  { slug: "equity-realization", conceptId: "equity_realization", shortName: "equity realization", clusters: ["equity"], difficulty: "intermediate" },
  { slug: "spr", conceptId: "spr_theory", title: "Stack-to-Pot Ratio (SPR)", shortName: "SPR", lessonKey: "spr", clusters: ["postflop"], difficulty: "intermediate" },
  { slug: "range-advantage", conceptId: "range_advantage", shortName: "range advantage", clusters: ["ranges", "postflop"], difficulty: "intermediate" },
  { slug: "nut-advantage", conceptId: "nut_advantage", title: "Nut Advantage: Who Holds the Best Hands", shortName: "nut advantage", clusters: ["ranges", "postflop"], difficulty: "advanced" },
  { slug: "capped-range", conceptId: "capped_range", title: "Capped Range: Spotting It and Attacking It", shortName: "a capped range", clusters: ["ranges"], difficulty: "intermediate" },
  { slug: "equity-buckets", conceptId: "equity_bucket", shortName: "an equity bucket", lessonKey: "equity_bucket", clusters: ["equity", "ranges"], difficulty: "intermediate" },
  { slug: "cbet", conceptId: "cbet_theory", title: "Continuation Bet (C-Bet)", shortName: "a c-bet", lessonKey: "cbet", clusters: ["postflop"], difficulty: "beginner" },
  { slug: "donk-bet", conceptId: "donk_bet", shortName: "a donk bet", clusters: ["postflop"], difficulty: "advanced" },
  { slug: "overbet", conceptId: "overbet", shortName: "an overbet", clusters: ["bet-sizing"], difficulty: "advanced" },
  { slug: "polarization", conceptId: "polarized_betting", title: "Polarization: Betting Nuts and Bluffs", shortName: "polarization", lessonKey: "polarized", clusters: ["ranges", "bet-sizing"], difficulty: "intermediate" },
  { slug: "merged-betting", conceptId: "merged_betting", shortName: "merged betting", clusters: ["bet-sizing"], difficulty: "intermediate" },
  { slug: "geometric-sizing", conceptId: "geometric_sizing", shortName: "geometric sizing", clusters: ["bet-sizing"], difficulty: "advanced" },
  { slug: "exploitative-play", conceptId: "exploitative_play", shortName: "exploitative play", clusters: ["exploitative"], difficulty: "advanced" },
  { slug: "position", conceptId: "position_value", title: "Position in Poker: Why Acting Last Wins More", shortName: "position", lessonKey: "position", clusters: ["preflop", "postflop"], difficulty: "beginner" },
  { slug: "blockers", conceptId: "blockers", title: "Blockers in Poker: Card Removal Explained", shortName: "a blocker", clusters: ["ranges"], difficulty: "intermediate" },
];

/**
 * Routes reserved for articles whose source material does not exist yet.
 *
 * `note` states, on the page itself, exactly what is missing. Each one has a
 * `glossarySeed`: a term that IS already defined in lib/theory/puzzleTags.ts,
 * so the visitor is sent to a real one-line definition instead of a dead end.
 */
interface PlannedWiki {
  slug: string;
  title: string;
  summary: string;
  clusters: string[];
  /** Puzzle-tag id that already carries a short definition. */
  glossarySeed?: string;
}

const PLANNED_WIKI: PlannedWiki[] = [
  {
    slug: "equity",
    title: "Equity",
    summary: "How often a hand or range wins the pot at showdown, expressed as a percentage.",
    clusters: ["equity"],
  },
  {
    slug: "3bet",
    title: "3-Betting",
    summary: "Re-raising a preflop open, and the range construction that makes it profitable.",
    clusters: ["preflop"],
    glossarySeed: "3bet_spot",
  },
  {
    slug: "squeeze",
    title: "Squeezing",
    summary: "3-betting after an open and one or more calls, using the extra dead money.",
    clusters: ["preflop"],
    glossarySeed: "squeeze_spot",
  },
  {
    slug: "check-raise",
    title: "Check-Raise",
    summary: "Checking with the intent to raise, to protect a checking range and build pots out of position.",
    clusters: ["postflop"],
    glossarySeed: "check_raise",
  },
  {
    slug: "thin-value",
    title: "Thin Value",
    summary: "Betting a hand that is only marginally ahead of the range that calls.",
    clusters: ["postflop"],
    glossarySeed: "thin_value",
  },
  {
    slug: "fold-equity",
    title: "Fold Equity",
    summary: "The share of a bet's profit that comes from opponents folding rather than from showdown.",
    clusters: ["game-theory", "postflop"],
    glossarySeed: "semi_bluff",
  },
];

// ── Article assembly ─────────────────────────────────────────────────────────

/**
 * GEO article structure (§16): short, descriptively-headed sections in the
 * order a generative engine can lift verbatim — definition first, takeaway
 * last, no walls of text.
 */
function buildSections(explainer: ConceptExplainer): ArticleSection[] {
  const sections: ArticleSection[] = [
    {
      heading: `What is ${explainer.name.replace(/\s*[—-].*$/, "")}?`,
      paragraphs: splitParagraphs(explainer.beginner),
      ...(explainer.formula ? { formula: explainer.formula } : {}),
    },
    {
      heading: "Why it matters",
      paragraphs: splitParagraphs(explainer.intermediate),
    },
  ];

  if (explainer.examples.length) {
    sections.push({
      heading: "Real examples",
      bullets: explainer.examples,
    });
  }

  const applications = applicationPatternsFor(explainer.id);
  if (applications.length) {
    sections.push({
      heading: "Where it shows up",
      definitions: applications.map((a) => ({ term: a.name, description: a.description })),
    });
  }

  const mistakes = mistakePatternsFor(explainer.id);
  if (mistakes.length) {
    sections.push({
      heading: "Common mistakes",
      definitions: mistakes.map((m) => ({ term: m.name, description: m.description })),
    });
  }

  sections.push({
    heading: "Nuance and caveats",
    paragraphs: splitParagraphs(explainer.advanced),
  });

  sections.push({
    heading: "Key takeaway",
    paragraphs: [explainer.summary ?? firstSentence(explainer.beginner)],
  });

  return sections;
}

/**
 * Splits registry prose into 1–2 sentence paragraphs.
 *
 * Purely presentational — no word is changed. Both the accessibility goal
 * (§22) and the GEO goal (§16, "avoid walls of text") want short blocks, and
 * the registry stores each explanation as a single long string.
 */
function splitParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? [text];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join(" ").trim());
  }
  return out.filter(Boolean);
}

/**
 * FAQ entries (§10). The question wording is editorial; every answer is the
 * registry's own text, so the FAQ cannot drift from the article above it —
 * which is also what keeps the FAQPage JSON-LD honest.
 */
function buildFaqs(explainer: ConceptExplainer, shortName: string) {
  const faqs = [
    {
      question: `What is ${shortName} in poker?`,
      answer: firstSentence(explainer.beginner),
    },
  ];

  if (explainer.formula) {
    faqs.push({
      question: `How do you calculate ${shortName}?`,
      answer: `${explainer.formula}. ${firstSentence(explainer.examples[0] ?? "")}`.trim(),
    });
  }

  if (explainer.examples.length) {
    faqs.push({
      question: `Can you give an example of ${shortName}?`,
      answer: explainer.examples[0],
    });
  }

  faqs.push({
    question: `Why does ${shortName} matter?`,
    answer: firstSentence(explainer.intermediate),
  });

  return faqs;
}

function shortNameOf(name: string): string {
  // "Alpha — Required Fold Frequency…" → "Alpha"; "Minimum Defense Frequency
  // (MDF)" → "MDF" reads better in a question than the full expansion.
  const abbrev = name.match(/\(([A-Z][A-Za-z-]{1,6})\)\s*$/);
  if (abbrev) return abbrev[1];
  return name.replace(/\s*[—–-]\s.*$/, "").trim();
}

function toEntry(source: WikiSource): SeoEntry | null {
  const explainer = conceptExplainer(source.conceptId);
  if (!explainer) return null;

  const title = source.title ?? explainer.name;
  const shortName = source.shortName ?? shortNameOf(title);
  const lessons = lessonsForConceptKey(source.lessonKey ?? source.conceptId);

  const entry: SeoEntry = {
    kind: "wiki",
    slug: source.slug,
    path: wikiPath(source.slug),
    title,
    summary: explainer.summary ?? firstSentence(explainer.beginner),
    status: "published",
    tags: [shortName.toLowerCase(), explainer.category, ...explainer.puzzleTags],
    clusters: source.clusters,
    body: buildSections(explainer),
    faqs: buildFaqs(explainer, shortName),
    relatedPaths: [
      ...explainer.related.map(wikiPathForConceptId).filter((p): p is string => Boolean(p)),
      ...lessons.map((l) => lessonPath(l.slug)),
    ],
    priority: 0.8,
    changeFrequency: "monthly",
    sourceNote:
      "Definition, explanation, formula and examples are quoted from the StackedPoker poker-theory concept registry (lib/theory/concepts.json).",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
    difficulty: source.difficulty,
    // "Related module" (§17) = the module of the first lesson that teaches
    // this concept — derived, so it follows curriculum changes on its own.
    relatedModuleSlug: lessons[0] ? moduleForLesson(lessons[0])?.slug : undefined,
  };

  return entry;
}

function plannedToEntry(planned: PlannedWiki): SeoEntry {
  return {
    kind: "wiki",
    slug: planned.slug,
    path: wikiPath(planned.slug),
    title: planned.title,
    summary: planned.summary,
    status: "planned",
    tags: [planned.title.toLowerCase()],
    clusters: planned.clusters,
    relatedPaths: lessonsForConceptKey(planned.slug.replace(/-/g, "_")).map((l) =>
      lessonPath(l.slug),
    ),
    priority: 0.3,
    changeFrequency: "monthly",
    sourceNote: `No StackedPoker theory-registry entry exists for "${planned.title}" yet, so no explanation is published on this page.`,
  };
}

let cache: SeoEntry[] | null = null;

/** Every wiki route, published and planned, in alphabetical title order. */
export function wikiEntries(): SeoEntry[] {
  cache ??= [
    ...WIKI_SOURCES.map(toEntry).filter((e): e is SeoEntry => e !== null),
    ...PLANNED_WIKI.map(plannedToEntry),
  ].sort((a, b) => a.title.localeCompare(b.title));
  return cache;
}

export function publishedWikiEntries(): SeoEntry[] {
  return wikiEntries().filter((e) => e.status === "published");
}

export function wikiEntryBySlug(slug: string): SeoEntry | undefined {
  return wikiEntries().find((e) => e.slug === slug);
}

/** Maps a theory concept id to its wiki URL, when one is published. */
export function wikiPathForConceptId(conceptId: string): string | undefined {
  const source = WIKI_SOURCES.find((s) => s.conceptId === conceptId);
  return source ? wikiPath(source.slug) : undefined;
}

export function wikiSlugForConceptId(conceptId: string): string | undefined {
  return WIKI_SOURCES.find((s) => s.conceptId === conceptId)?.slug;
}

/**
 * Wiki routes that exist but have no source material — the honest gap list.
 * Surfaced in the build report and asserted on by the test suite so the
 * number can only go down deliberately.
 */
export function missingWikiSources(): { slug: string; title: string }[] {
  return PLANNED_WIKI.map(({ slug, title }) => ({ slug, title }));
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetWikiCache(): void {
  cache = null;
}

import { publishedEntries, searchEntries } from "./content";
import { intentOf, type SearchIntent } from "./intent";
import type { SeoEntry } from "./types";

/**
 * The keyword/topic map (§2).
 *
 * A curated list of the things people actually search for around poker study,
 * mapped onto what this site currently has. It is NOT a keyword-volume table:
 * no search-volume figures appear anywhere here, because none are available
 * and inventing them would make every downstream priority a fiction.
 *
 * Priority is therefore QUALITATIVE and each topic records the reasoning, so a
 * human can disagree with a specific call rather than with an opaque number.
 * The three inputs to that judgement are stated per topic:
 *   - how close the searcher is to choosing a product (intent),
 *   - whether StackedPoker can answer it from reviewed source material,
 *   - whether the site already covers it.
 *
 * Coverage is computed against the live corpus, so this file never claims a
 * page exists — it asks the content index.
 */

export type TopicCategory = "education" | "strategy" | "tools" | "commercial";
export type TopicLanguage = "en" | "nl";
export type TopicPriority = "high" | "medium" | "low";

export interface TopicDefinition {
  id: string;
  /** How a person would phrase it. The first is the canonical label. */
  queries: string[];
  category: TopicCategory;
  intent: SearchIntent;
  language: TopicLanguage;
  /** Existing cluster this topic belongs to, when one applies. */
  clusterId?: string;
  priority: TopicPriority;
  /** Why that priority — the argument, not a number. */
  rationale: string;
}

/**
 * Dutch topics are listed but every one is LOW priority, and that is a
 * deliberate call rather than an oversight: the entire site is written in
 * English, `<html lang="en">`, and there is no translation pipeline. Ranking
 * for "poker leren" needs Dutch pages, not Dutch keywords bolted onto English
 * ones — which would be a doorway page. They are recorded so the opportunity
 * is visible when someone decides to localise, not so it can be faked now.
 */
/**
 * Queries deliberately left unowned, and why.
 *
 * A keyword tool cannot tell the difference between a gap worth filling and a
 * gap that exists for a reason. Without this list, every future audit
 * rediscovers these as "missing pages" and someone eventually writes one.
 *
 * Nothing here is rendered on a public page — it is a record for whoever runs
 * the next audit.
 */
export interface DeclinedTopic {
  queries: string[];
  /** What would have to change for this to become publishable. */
  reconsiderIf: string;
  rationale: string;
}

export const DECLINED_TOPICS: DeclinedTopic[] = [
  {
    queries: ["gto wizard preflop ranges", "gto wizard ranges", "gto wizard alternative"],
    rationale:
      "Serving this query means one of two pages. Publishing GTO Wizard's ranges would be redistributing another company's product — StackedPoker has no licence to them, and no way to verify a copy is faithful. A comparison page ranking for a competitor's trademark would need claims about their product that this codebase cannot source, on a page whose only real purpose is to intercept their brand traffic. Both fail the content-quality gate: the honest answer to \"what does StackedPoker offer instead\" is /preflop-charts, which names its own sources and makes no claim about anyone else.",
    reconsiderIf:
      "A licensing arrangement exists, or the page can be written as a factual description of solver-derived preflop ranges in general — with no competitor's name in the title, branding or URL, and no claim about their product.",
  },
  {
    queries: ["texas hold em strategie", "poker strategie nederlands"],
    rationale:
      "The Dutch phrasing of a query the English pillar at /texas-holdem-strategy already answers. Putting Dutch keywords on an English page is the definition of a doorway page, and the site is English-only with no translation pipeline (see the nl- topics above).",
    reconsiderIf:
      "The site gains a real Dutch locale. Then this is a translation of /texas-holdem-strategy, not a second page.",
  },
];

export const TOPICS: TopicDefinition[] = [
  // ── Education ─────────────────────────────────────────────────────────────
  {
    id: "learn-poker",
    queries: ["learn poker", "how to learn poker", "learn poker strategy"],
    category: "education",
    intent: "commercial",
    clusterId: "poker-strategy",
    priority: "high",
    language: "en",
    rationale:
      "The head term for the entire product. The homepage targets it implicitly; nothing targets it explicitly with a curriculum-first answer.",
  },
  {
    id: "poker-training",
    queries: ["poker training", "poker training site", "poker training app", "best poker training"],
    category: "commercial",
    intent: "commercial",
    clusterId: "poker-strategy",
    priority: "high",
    language: "en",
    rationale:
      "Highest commercial intent in the set — the searcher is choosing a platform. No page currently answers 'what is this and who is it for' directly.",
  },
  {
    id: "poker-courses",
    queries: ["poker course", "poker courses online", "best poker course"],
    category: "education",
    intent: "commercial",
    clusterId: "poker-strategy",
    priority: "high",
    language: "en",
    rationale: "/courses exists and is strong; the gap is that it reads as an index rather than an answer to 'is this course any good for me'.",
  },
  {
    id: "poker-lessons",
    queries: ["poker lessons", "online poker lessons", "poker lessons for beginners"],
    category: "education",
    intent: "commercial",
    clusterId: "poker-strategy",
    priority: "medium",
    language: "en",
    rationale: "Covered in substance by 100 lesson pages, but no single page owns the plural head term.",
  },
  {
    id: "poker-coaching",
    queries: ["poker coaching", "poker coach", "poker coaching alternatives"],
    category: "commercial",
    intent: "commercial",
    priority: "medium",
    language: "en",
    rationale:
      "Adjacent rather than core: StackedPoker is not a human-coaching marketplace, so the honest angle is the AI Coach as an alternative — a real differentiator, not a claim about competitors.",
  },

  // ── Strategy ──────────────────────────────────────────────────────────────
  {
    id: "pot-odds",
    queries: ["pot odds", "poker pot odds", "how to calculate pot odds"],
    category: "strategy",
    intent: "informational",
    clusterId: "equity",
    priority: "high",
    language: "en",
    rationale: "Wiki + calculator + lessons already exist and interlink. Strongest cluster on the site; worth defending rather than expanding.",
  },
  {
    id: "poker-equity",
    queries: ["poker equity", "what is equity in poker", "equity poker meaning"],
    category: "strategy",
    intent: "informational",
    clusterId: "equity",
    priority: "high",
    language: "en",
    rationale:
      "Head strategy term with a reserved URL that is still empty. The calculator ranks for the tool query but nothing answers the definition.",
  },
  {
    id: "poker-ranges",
    queries: ["poker ranges", "preflop ranges", "poker range chart"],
    category: "strategy",
    intent: "informational",
    clusterId: "ranges",
    priority: "high",
    language: "en",
    rationale: "Large existing cluster (40 pages) with no tool and no single authoritative range explainer to anchor it.",
  },
  {
    id: "preflop-strategy",
    queries: ["preflop strategy", "preflop poker strategy", "how to play preflop"],
    category: "strategy",
    intent: "informational",
    clusterId: "preflop",
    priority: "high",
    language: "en",
    rationale: "38 pages of real coverage; the cluster landing page is a search-results page rather than an explainer.",
  },
  {
    id: "postflop-strategy",
    queries: ["postflop strategy", "how to play postflop", "postflop poker"],
    category: "strategy",
    intent: "informational",
    clusterId: "postflop",
    priority: "medium",
    language: "en",
    rationale: "Same shape as preflop but with slightly less existing depth.",
  },
  {
    id: "position",
    queries: ["poker position", "position in poker", "poker positions explained"],
    category: "strategy",
    intent: "informational",
    clusterId: "preflop",
    priority: "medium",
    language: "en",
    rationale: "Wiki article, trainer and lessons all exist — a complete cluster that mainly needs external authority.",
  },
  {
    id: "three-bet",
    queries: ["3bet", "3 betting poker", "what is a 3bet"],
    category: "strategy",
    intent: "informational",
    clusterId: "preflop",
    priority: "high",
    language: "en",
    rationale: "Reserved URL, no reviewed source yet. High-volume beginner term that the preflop cluster needs to be complete.",
  },
  {
    id: "squeeze",
    queries: ["squeeze play poker", "poker squeeze", "what is a squeeze"],
    category: "strategy",
    intent: "informational",
    clusterId: "preflop",
    priority: "medium",
    language: "en",
    rationale: "Narrower than 3-betting; the book's own material is an 'Overcalling' section rather than a squeeze chart, so the source is thin.",
  },
  {
    id: "continuation-bet",
    queries: ["continuation bet", "c-bet poker", "cbet strategy"],
    category: "strategy",
    intent: "informational",
    clusterId: "postflop",
    priority: "high",
    language: "en",
    rationale: "Already published with real registry material and lesson support — a strong page worth linking to harder rather than rewriting.",
  },
  {
    id: "check-raise",
    queries: ["check raise poker", "when to check raise"],
    category: "strategy",
    intent: "informational",
    clusterId: "postflop",
    priority: "medium",
    language: "en",
    rationale: "Reserved URL, definition exists in the puzzle-tag registry but no full explanation.",
  },
  {
    id: "value-betting",
    queries: ["value bet poker", "thin value bet", "how to value bet"],
    category: "strategy",
    intent: "informational",
    clusterId: "postflop",
    priority: "medium",
    language: "en",
    rationale: "Thin-value URL reserved; the concept registry has no entry, so it stays planned.",
  },
  {
    id: "fold-equity",
    queries: ["fold equity", "what is fold equity", "fold equity poker"],
    category: "strategy",
    intent: "informational",
    clusterId: "game-theory",
    priority: "medium",
    language: "en",
    rationale:
      "Reserved URL. The maths already exists in lib/theory/math.ts (requiredFoldEquity, alpha) even though the prose does not — the most tractable of the six gaps.",
  },
  {
    id: "implied-odds",
    queries: ["implied odds", "implied odds poker", "reverse implied odds"],
    category: "strategy",
    intent: "informational",
    clusterId: "equity",
    priority: "medium",
    language: "en",
    rationale:
      "The natural next click from pot odds and completely absent — no wiki entry, no glossary term, no reserved URL. Needs a reviewed source before it can be written.",
  },

  // ── Tools ─────────────────────────────────────────────────────────────────
  {
    id: "equity-calculator",
    queries: ["poker equity calculator", "poker hand equity calculator", "holdem equity calculator"],
    category: "tools",
    intent: "transactional",
    clusterId: "equity",
    priority: "high",
    language: "en",
    rationale: "Shipped, exact and genuinely link-worthy. The best backlink asset on the site.",
  },
  {
    id: "odds-calculator",
    queries: ["poker odds calculator", "pot odds calculator", "poker outs calculator"],
    category: "tools",
    intent: "transactional",
    clusterId: "equity",
    priority: "high",
    language: "en",
    rationale: "Two shipped calculators cover this; competition is heavy, so authority rather than content is the constraint.",
  },
  {
    id: "bankroll-calculator",
    queries: ["poker bankroll calculator", "poker bankroll management", "how big should my poker bankroll be"],
    category: "tools",
    intent: "transactional",
    clusterId: "equity",
    priority: "medium",
    language: "en",
    rationale: "Shipped and honest about which figures are published vs house defaults — a differentiator most competitors do not offer.",
  },
  {
    id: "range-calculator",
    queries: ["poker range calculator", "poker range viewer", "preflop range chart tool"],
    category: "tools",
    intent: "transactional",
    clusterId: "ranges",
    priority: "high",
    language: "en",
    rationale:
      "The one tool query the site cannot answer — /tools/range-viewer is still planned, and the ranges cluster (40 pages) has no tool to anchor it.",
  },
  {
    id: "hand-analyzer",
    queries: ["poker hand analyzer", "analyse my poker hands", "poker hand analysis software"],
    category: "tools",
    intent: "transactional",
    priority: "high",
    language: "en",
    rationale:
      "Recurring AI-answer query with no StackedPoker page at all. Needs a real analyser or an honest 'what to look for' page — not a landing page for a product that does not exist.",
  },
  {
    id: "position-trainer",
    queries: ["poker position trainer", "learn poker positions", "poker position quiz"],
    category: "tools",
    intent: "transactional",
    clusterId: "preflop",
    priority: "low",
    language: "en",
    rationale: "Shipped, low competition, low volume. Complete — leave it alone.",
  },

  // ── Commercial ────────────────────────────────────────────────────────────
  {
    id: "best-poker-training-site",
    queries: ["best poker training site", "best poker training app", "best poker study site"],
    category: "commercial",
    intent: "commercial",
    priority: "high",
    language: "en",
    rationale:
      "Pure comparison intent and a frequent AI prompt. Winnable only with an honest positioning page — a page making unsupported claims about rivals would be worse than none.",
  },
  {
    id: "poker-study-software",
    queries: ["poker study software", "poker study tools", "poker solver software"],
    category: "commercial",
    intent: "commercial",
    priority: "medium",
    language: "en",
    rationale:
      "Dominated by solver vendors. StackedPoker is not a solver, so the honest angle is the difference between studying with a solver and learning with a curriculum.",
  },
  {
    id: "affordable-poker-training",
    queries: ["affordable poker training", "cheap poker coaching", "budget poker study"],
    category: "commercial",
    intent: "commercial",
    priority: "medium",
    language: "en",
    rationale:
      "Still unowned, and deliberately: this is the price-comparison intent, which /pricing serves without competing for the query. Kept separate from the free-tier intent below — a searcher looking for cheap and one looking for free want different pages, and one page written for both serves neither.",
  },
  {
    id: "free-poker-training",
    queries: ["free poker training", "poker training online free", "free poker lessons"],
    category: "commercial",
    intent: "commercial",
    priority: "high",
    language: "en",
    rationale:
      "A genuine strength — every calculator needs no account and two modules open on the free tier — and previously stated only in passing on /pricing and /poker-training. /free-poker-training now itemises it from the entitlement code itself.",
  },

  // ── Dutch ─────────────────────────────────────────────────────────────────
  {
    id: "nl-poker-leren",
    queries: ["poker leren", "leren pokeren", "poker leren voor beginners"],
    category: "education",
    intent: "commercial",
    priority: "low",
    language: "nl",
    rationale: "No Dutch content and no translation pipeline. Real opportunity, but it needs Dutch pages — not Dutch keywords on English ones.",
  },
  {
    id: "nl-poker-cursus",
    queries: ["poker cursus", "online poker cursus", "poker training nederlands"],
    category: "education",
    intent: "commercial",
    priority: "low",
    language: "nl",
    rationale: "Same as above. Recorded so the decision to localise is a decision, not an oversight.",
  },
  {
    id: "nl-poker-strategie",
    queries: ["poker strategie", "poker strategie leren", "poker tips nederlands"],
    category: "strategy",
    intent: "informational",
    priority: "low",
    language: "nl",
    rationale: "Would follow a localisation of the wiki, which is the largest body of translatable material.",
  },
];

export interface TopicCoverage {
  topic: TopicDefinition;
  /** Pages the internal search finds for this topic's canonical query. */
  matches: SeoEntry[];
  /** Which content kinds cover it. */
  kinds: SeoEntry["kind"][];
  /** A page whose title directly targets the topic, if one exists. */
  anchor?: SeoEntry;
  /** True when a reserved-but-unpublished page exists for it. */
  hasPlannedPage: boolean;
}

/**
 * Words too common on a poker site to carry any signal.
 *
 * "poker" is in almost every title on the site, so a query containing it
 * matches everything unless it is ignored. The rest are query scaffolding
 * rather than subject matter.
 */
const STOPWORDS = new Set([
  "poker", "the", "a", "an", "in", "for", "my", "of", "to", "and",
  "how", "what", "is", "are", "do", "i", "best", "online", "free",
]);

/**
 * A page covers a topic when it mentions EVERY meaningful word in the query,
 * not merely one of them.
 *
 * The site's own search is deliberately permissive — it ranks, so a partial
 * match belongs in the results. Coverage is a different question: "poker hand
 * analyzer" matching every page with "hand" in its slug reports 60 pages of
 * coverage for a topic the site does not cover at all, which is worse than no
 * number. This is the stricter test.
 */
function significantWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function coversQuery(entry: SeoEntry, words: string[]): boolean {
  if (!words.length) return false;
  const haystack = normalise(
    [entry.title, entry.slug, entry.summary, (entry.tags ?? []).join(" ")].join(" "),
  );
  return words.every((word) => haystack.includes(normalise(word)));
}

/** Cheap normaliser so "3bet" and "3-bet" compare equal. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * What the corpus currently offers for a topic.
 *
 * Uses the site's own search rather than a second matching rule, so the report
 * measures what a visitor would actually find.
 */
export function coverageFor(topic: TopicDefinition, allWithPlanned: SeoEntry[]): TopicCoverage {
  const words = significantWords(topic.queries[0]);
  const matches = searchEntries(topic.queries[0], 200)
    .map((hit) => hit.entry)
    .filter((entry) => coversQuery(entry, words));
  const queryKeys = topic.queries.map(normalise);

  const targets = (entry: SeoEntry) => {
    const label = normalise(`${entry.title} ${entry.slug}`);
    // Every significant word of some phrasing must appear in the title or
    // slug. Matching the whole normalised phrase would never fire: the wiki
    // article for "poker position" is titled simply "Position".
    return topic.queries.some((query) => {
      const words = significantWords(query);
      return words.length > 0 && words.every((word) => label.includes(normalise(word)));
    });
  };

  // Prefer a page whose own intent matches the topic's. "poker equity" is an
  // informational query, so the wiki article owns it even though the equity
  // CALCULATOR also has "equity" in its title — otherwise every strategy topic
  // would report itself as owned by whichever tool shares a word with it.
  const anchor =
    matches.find((entry) => targets(entry) && intentOf(entry) === topic.intent) ??
    matches.find(targets);

  const hasPlannedPage = allWithPlanned.some(
    (entry) =>
      entry.status === "planned" &&
      queryKeys.some((q) => normalise(entry.slug).includes(q) || normalise(entry.title).includes(q)),
  );

  return {
    topic,
    matches,
    kinds: [...new Set(matches.map((m) => m.kind))].sort(),
    anchor,
    hasPlannedPage,
  };
}

export function allCoverage(allWithPlanned: SeoEntry[] = publishedEntries()): TopicCoverage[] {
  return TOPICS.map((topic) => coverageFor(topic, allWithPlanned));
}

export function topicById(id: string): TopicDefinition | undefined {
  return TOPICS.find((t) => t.id === id);
}

import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { searchPath, toSlug } from "../routes";
import type { SeoEntry } from "../types";
import { TOPIC_CLUSTERS } from "./clusters";
import { publishedWikiEntries } from "./wiki";
import { publishedEntries, searchEntries } from "./index";

/**
 * Indexable topic/search pages (§8).
 *
 * The topic list is DERIVED, not hand-written: every published wiki slug,
 * every topic cluster and a short list of head keywords become candidate
 * pages, and a candidate only becomes a real page if it actually returns
 * enough results. That gate is the point — an indexable search page with two
 * results is thin content, and thin content on a search-results URL is the
 * classic way to earn a site-wide quality penalty.
 *
 * Anything not on the derived list still resolves (people and crawlers follow
 * odd URLs) but renders `noindex` and stays out of the sitemap.
 */

/** Minimum results before a topic page is worth indexing. */
const MIN_RESULTS_TO_INDEX = 4;

/**
 * Head terms worth their own landing page that are not a wiki slug or a
 * cluster id. Kept short on purpose — this is the only hand-maintained part,
 * and everything else grows on its own as content is added.
 */
const HEAD_TERMS = [
  "preflop",
  "postflop",
  "range",
  "cbet",
  "blockers",
  "gto",
  "bluff",
  "value",
  "equity",
  "position",
  "bet sizing",
  "3bet",
];

export interface SearchTopic {
  /** URL segment. */
  slug: string;
  /** The query actually run. */
  query: string;
  title: string;
  description: string;
  resultCount: number;
  /** Set when this topic page IS a topic cluster's landing page. */
  clusterId?: string;
}

interface TopicCandidate {
  slug: string;
  query: string;
  clusterId?: string;
}

/**
 * Candidates, most-authoritative first.
 *
 * Clusters come first AND pin their slug to the cluster id, not to a slug
 * derived from the title. That is what makes `/search/game-theory` the
 * cluster's own landing page: the breadcrumb "category" crumb and the topics
 * hub both link to `/search/<clusterId>`, so if the slug were derived from
 * the title those links would point at an uncurated, noindex URL.
 */
function candidateTopics(): TopicCandidate[] {
  return [
    ...TOPIC_CLUSTERS.filter((c) => c.parentId).map((c) => ({
      slug: c.id,
      query: c.title.replace(/\s*&.*$/, "").trim(),
      clusterId: c.id,
    })),
    ...publishedWikiEntries().map((e) => {
      const query = e.title.replace(/\s*\(.*\)\s*$/, "");
      return { slug: toSlug(query), query };
    }),
    ...HEAD_TERMS.map((query) => ({ slug: toSlug(query), query })),
  ];
}

let topicCache: SearchTopic[] | null = null;

/** Topic pages good enough to index, deduped by slug. */
export function searchTopics(): SearchTopic[] {
  if (topicCache) return topicCache;

  const bySlug = new Map<string, SearchTopic>();

  for (const candidate of candidateTopics()) {
    const { slug, query, clusterId } = candidate;
    if (!slug || bySlug.has(slug)) continue;

    const results = searchEntries(query, 100);
    if (results.length < MIN_RESULTS_TO_INDEX) continue;

    const label = query.charAt(0).toUpperCase() + query.slice(1);
    bySlug.set(slug, {
      slug,
      query,
      title: `${label} — Poker Lessons, Concepts & Terms`,
      description: `${results.length} StackedPoker resources on ${query.toLowerCase()}: concept articles, interactive lessons, glossary terms and free tools.`,
      resultCount: results.length,
      ...(clusterId ? { clusterId } : {}),
    });
  }

  topicCache = [...bySlug.values()].sort((a, b) => b.resultCount - a.resultCount);
  return topicCache;
}

/** The indexable topic page for a cluster, if it has enough results. */
export function topicForCluster(clusterId: string): SearchTopic | undefined {
  return searchTopics().find((t) => t.clusterId === clusterId);
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetSearchCache(): void {
  topicCache = null;
}

export function searchTopicBySlug(slug: string): SearchTopic | undefined {
  return searchTopics().find((t) => t.slug === slug);
}

/**
 * Turns a URL segment back into a query. `/search/bet-sizing` → "bet sizing",
 * so an uncurated slug still runs a sensible search.
 */
export function queryFromSlug(slug: string): string {
  const topic = searchTopicBySlug(slug);
  return topic?.query ?? decodeURIComponent(slug).replace(/[-_+]+/g, " ").trim();
}

export function searchTopicEntries(): SeoEntry[] {
  return searchTopics().map((topic) => ({
    kind: "search" as const,
    slug: topic.slug,
    path: searchPath(topic.slug),
    title: topic.title,
    summary: topic.description,
    status: "published" as const,
    tags: [topic.query, "poker"],
    clusters: [],
    priority: 0.4,
    changeFrequency: "weekly" as const,
    authority: {
      reviewedBy: AUTHORITY_TEAM,
      updated: DEFAULT_CONTENT_DATE,
      readingTimeMin: 1,
    },
  }));
}

/**
 * The SeoEntry for any topic URL.
 *
 * Curated topics return their real entry. An uncurated slug returns a
 * transient `planned` entry rather than nothing, so the page still gets
 * breadcrumbs, a canonical and structured data — and, because it is
 * `planned`, the same noindex treatment every other unpublished route gets.
 * One status switch, no special case.
 */
export function searchEntryForSlug(slug: string): SeoEntry {
  const curated = searchTopicEntries().find((e) => e.slug === slug);
  if (curated) return curated;

  const term = queryFromSlug(slug);
  const label = term.charAt(0).toUpperCase() + term.slice(1);
  return {
    kind: "search",
    slug,
    path: searchPath(slug),
    title: `${label} — Poker Lessons, Concepts & Terms`,
    summary: `StackedPoker lessons, concept articles and glossary terms matching "${term}".`,
    status: "planned",
    tags: [term],
    clusters: [],
    priority: 0.2,
    changeFrequency: "weekly",
  };
}

/** Total corpus size, shown on the search hub. */
export function corpusSize(): number {
  return publishedEntries().length;
}

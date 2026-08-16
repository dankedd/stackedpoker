import { ROUTES } from "../routes";
import type { SeoEntry, TopicCluster } from "../types";
import { blogEntries } from "./blog";
import { ROOT_CLUSTER_ID, TOPIC_CLUSTERS } from "./clusters";
import { glossaryEntries } from "./glossary";
import { landingEntries } from "./landing";
import { pillarEntries } from "./pillars";
import { courseEntries, lessonEntries } from "./lessons";
import { toolEntries } from "./tools";
import { wikiEntries } from "./wiki";
import { staticPageEntries } from "./pages";

/**
 * The unified content index.
 *
 * Every indexable URL on the site resolves to one `SeoEntry` here, and every
 * consumer — sitemaps, llms.txt, the AI content index, internal search,
 * related-content strips, breadcrumbs — reads from this one function. That is
 * the mechanism behind §23: a new lesson, wiki article, glossary term, tool
 * or post is picked up by all of them at once, because none of them maintain
 * their own list.
 */

let cache: SeoEntry[] | null = null;

export function allEntries(): SeoEntry[] {
  cache ??= [
    ...staticPageEntries(),
    ...landingEntries(),
    ...pillarEntries(),
    ...courseEntries(),
    ...lessonEntries(),
    ...wikiEntries(),
    ...glossaryEntries(),
    ...blogEntries(),
    ...toolEntries(),
  ];
  return cache;
}

/** Only what belongs in a sitemap and in front of an LLM crawler. */
export function publishedEntries(): SeoEntry[] {
  return allEntries().filter((e) => e.status === "published");
}

export function entriesOfKind(kind: SeoEntry["kind"]): SeoEntry[] {
  return allEntries().filter((e) => e.kind === kind);
}

export function entryByPath(path: string): SeoEntry | undefined {
  return allEntries().find((e) => e.path === path);
}

/**
 * The hub page that lists entries of a given kind.
 *
 * Declared once because three things need to agree on it: the breadcrumb
 * "section" crumb, the link graph's hub → children edges, and the orphan
 * check. `lesson` points at /courses rather than /learn — /learn is the
 * signed-in app and is disallowed in robots.txt, so a lesson's taxonomy
 * parent is the course that contains it, not the app hub.
 */
const HUB_BY_KIND: Record<SeoEntry["kind"], string | undefined> = {
  page: undefined,
  course: ROUTES.courses,
  lesson: ROUTES.courses,
  wiki: ROUTES.wiki,
  glossary: ROUTES.glossary,
  blog: ROUTES.blog,
  tool: ROUTES.tools,
  search: ROUTES.search,
};

export function hubPathForKind(kind: SeoEntry["kind"]): string | undefined {
  return HUB_BY_KIND[kind];
}

/** Kinds whose entries a hub page lists, keyed by the hub's own path. */
export function kindsListedByHub(hubPath: string): SeoEntry["kind"][] {
  return (Object.keys(HUB_BY_KIND) as SeoEntry["kind"][]).filter(
    (kind) => HUB_BY_KIND[kind] === hubPath,
  );
}

/**
 * Clears this module's memoised index.
 *
 * Registry-level caches are cleared by resetSeoCaches() in ./reset.ts, which
 * lives in its own file so this module never has to import ./search — that
 * would close an import cycle, since search reads back from here.
 */
export function resetEntryCache(): void {
  cache = null;
  clusterCache = null;
  clusterMembersCache = null;
}

// ── Clusters ─────────────────────────────────────────────────────────────────

/**
 * Resolves the declared taxonomy into clusters with real membership.
 *
 * Members come from the entries themselves; `pathway` only controls the
 * order of the ones it names. Paths in a pathway that no longer resolve are
 * dropped rather than rendered as dead links.
 */
let clusterCache: TopicCluster[] | null = null;

export function resolvedClusters(): TopicCluster[] {
  if (clusterCache) return clusterCache;
  const published = publishedEntries();
  const byPath = new Map(allEntries().map((e) => [e.path, e]));

  clusterCache = TOPIC_CLUSTERS.map((cluster) => {
    const members =
      cluster.id === ROOT_CLUSTER_ID
        ? published.filter((e) => e.kind !== "page")
        : published.filter((e) => e.clusters?.includes(cluster.id));

    const ordered = (cluster.pathway ?? [])
      .filter((p) => byPath.get(p)?.status === "published")
      .filter((p) => members.some((m) => m.path === p));

    const rest = members.map((m) => m.path).filter((p) => !ordered.includes(p));

    return {
      id: cluster.id,
      title: cluster.title,
      description: cluster.description,
      parentId: cluster.parentId,
      memberPaths: [...ordered, ...rest],
    };
  });
  return clusterCache;
}

export function clusterWithMembers(id: string): TopicCluster | undefined {
  return resolvedClusters().find((c) => c.id === id);
}

let clusterMembersCache: Map<string, SeoEntry[]> | null = null;

/**
 * Entries in a cluster, memoised.
 *
 * `relatedTo` calls this once per cluster per entry, so rebuilding the
 * path→entry index each time made related-content resolution quadratic over
 * the whole corpus — noticeable during static generation, not just in tests.
 */
export function entriesInCluster(id: string): SeoEntry[] {
  if (!clusterMembersCache) {
    const byPath = new Map(allEntries().map((e) => [e.path, e]));
    clusterMembersCache = new Map(
      resolvedClusters().map((cluster) => [
        cluster.id,
        cluster.memberPaths
          .map((p) => byPath.get(p))
          .filter((e): e is SeoEntry => Boolean(e)),
      ]),
    );
  }
  return clusterMembersCache.get(id) ?? [];
}

// ── Internal search (§8) ─────────────────────────────────────────────────────

export interface SearchHit {
  entry: SeoEntry;
  score: number;
}

/**
 * Field-weighted keyword search over the index.
 *
 * Deliberately a small, dependency-free scorer rather than a search service:
 * the corpus is a few hundred entries, it must run inside a Server Component
 * during static generation, and the ranking only has to be good enough to
 * make the category pages useful.
 */
export function searchEntries(query: string, limit = 24): SearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  if (!terms.length) return [];

  const hits: SearchHit[] = [];

  for (const entry of publishedEntries()) {
    const title = entry.title.toLowerCase();
    const summary = entry.summary.toLowerCase();
    const tags = (entry.tags ?? []).join(" ").toLowerCase();
    const bodyText = (entry.body ?? [])
      .map((s) =>
        [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? []),
         ...(s.definitions ?? []).map((d) => `${d.term} ${d.description}`)].join(" "),
      )
      .join(" ")
      .toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (title === term) score += 40;
      else if (title.includes(term)) score += 18;
      if (entry.slug.includes(term)) score += 12;
      if (tags.includes(term)) score += 8;
      if (summary.includes(term)) score += 6;
      if (bodyText.includes(term)) score += 2;
    }

    // Reference content answers a bare keyword query better than a lesson does.
    if (score > 0) {
      if (entry.kind === "wiki") score += 6;
      if (entry.kind === "glossary") score += 2;
      hits.push({ entry, score });
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit);
}

export { ROUTES };

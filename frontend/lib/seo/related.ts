import { allEntries, entriesInCluster, hubPathForKind, publishedEntries } from "./content";
import { clusterTitle } from "./content/clusters";
import { topicForCluster } from "./content/search";
import { ROUTES, searchPath } from "./routes";
import type { SeoEntry } from "./types";

/**
 * Internal linking: related content + breadcrumb derivation.
 *
 * Both are computed from the entry itself. Nothing here is curated, so a new
 * lesson, article, term or post joins the link graph the moment it exists.
 */

// ── Breadcrumbs ──────────────────────────────────────────────────────────────

export interface Crumb {
  name: string;
  path: string;
}

const SECTION_LABELS: Record<string, string> = {
  [ROUTES.courses]: "Courses",
  [ROUTES.wiki]: "Poker Wiki",
  [ROUTES.glossary]: "Glossary",
  [ROUTES.blog]: "Blog",
  [ROUTES.tools]: "Free Tools",
  [ROUTES.search]: "Topics",
};

/**
 * The taxonomy parent between the section hub and the page itself.
 *
 * A lesson's category is the course that contains it. Everything else uses
 * its primary topic cluster, whose landing page is `/search/<clusterId>` —
 * which is exactly why cluster ids are pinned as topic slugs in
 * content/search.ts. The crumb is omitted rather than rendered dead when the
 * cluster has no published landing page.
 */
function categoryCrumb(entry: SeoEntry): Crumb | undefined {
  if (entry.kind === "lesson") {
    const coursePath = (entry.relatedPaths ?? []).find((p) => p.startsWith(`${ROUTES.courses}/`));
    const course = coursePath ? allEntries().find((e) => e.path === coursePath) : undefined;
    return course ? { name: course.title, path: course.path } : undefined;
  }

  // A topic page IS a category; it must not be its own parent.
  if (entry.kind === "search" || entry.kind === "page") return undefined;

  const clusterId = entry.clusters?.[0];
  if (!clusterId) return undefined;
  const topic = topicForCluster(clusterId);
  if (!topic) return undefined;

  return { name: clusterTitle(clusterId), path: searchPath(topic.slug) };
}

/**
 * Breadcrumb trail for any entry (§1, §12).
 *
 * Home → Section → Category (when one applies) → Current page. The trail is
 * the site's taxonomy, not its URL structure — a lesson lives at
 * `/learn/<slug>` but belongs under Courses → its module, and rendering it
 * that way keeps the trail off `/learn`, which robots.txt disallows.
 *
 * The last crumb is always the current page and is rendered as text, never
 * as a link (see components/seo/Breadcrumbs.tsx).
 */
export function breadcrumbsFor(entry: SeoEntry): Crumb[] {
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];

  const hubPath = hubPathForKind(entry.kind);
  if (hubPath && hubPath !== entry.path) {
    crumbs.push({ name: SECTION_LABELS[hubPath] ?? hubPath, path: hubPath });
  }

  const category = categoryCrumb(entry);
  if (category && category.path !== entry.path) crumbs.push(category);

  if (entry.path !== "/") crumbs.push({ name: entry.title, path: entry.path });

  const seen = new Set<string>();
  return crumbs.filter((c) => (seen.has(c.path) ? false : (seen.add(c.path), true)));
}

/** Every path a page's breadcrumb links to, excluding the page itself. */
export function breadcrumbAncestors(entry: SeoEntry): string[] {
  return breadcrumbsFor(entry)
    .map((c) => c.path)
    .filter((p) => p !== entry.path);
}

// ── Related content ──────────────────────────────────────────────────────────

export interface RelatedOptions {
  limit?: number;
  /** Restrict suggestions to these kinds. */
  kinds?: SeoEntry["kind"][];
  /** Include hub/marketing pages. Off by default — they are already in the nav. */
  includePages?: boolean;
  /** Most suggestions of any single kind. Keeps the strip cross-linking. */
  maxPerKind?: number;
}

/**
 * Score weights, in the priority order the linking strategy calls for:
 *
 *   1. same topic      — shares a topic cluster
 *   2. same concept    — shares concept tags
 *   3. same module     — same curriculum module, or same difficulty
 *   4. closely related — reachable in two hops through the related graph
 *
 * Editorial intent (`relatedPaths`) outranks all of them, and a cross-kind
 * candidate gets a nudge so a wiki article surfaces the lesson that drills it
 * instead of four more wiki articles.
 */
const WEIGHTS = {
  explicit: 120,
  primaryCluster: 60,
  sharedCluster: 30,
  sharedTag: 14,
  maxSharedTags: 4,
  sameModule: 25,
  sameDifficulty: 6,
  secondDegree: 10,
  crossKind: 8,
  wikiBonus: 4,
} as const;

function tagSet(entry: SeoEntry): Set<string> {
  return new Set((entry.tags ?? []).map((t) => t.toLowerCase()));
}

/**
 * Related pages for any entry (§2).
 *
 * Guarantees, all asserted in lib/seo/__tests__/related.test.ts:
 *  - never the page itself, never `planned` content;
 *  - no duplicates;
 *  - never a page the breadcrumb already links to, so a page never renders
 *    the same internal link twice;
 *  - a spread of content kinds rather than N of the same thing;
 *  - a minimum number of links, backfilled from the cluster and then the
 *    section, so no published page is ever a link dead end.
 */
export function relatedTo(entry: SeoEntry, options: RelatedOptions = {}): SeoEntry[] {
  const { limit = 6, kinds, includePages = false, maxPerKind = 3 } = options;

  const ancestors = new Set(breadcrumbAncestors(entry));
  const eligible = (candidate: SeoEntry) =>
    candidate.path !== entry.path &&
    candidate.status === "published" &&
    !ancestors.has(candidate.path) &&
    (includePages || candidate.kind !== "page") &&
    (!kinds || kinds.includes(candidate.kind));

  const explicit = new Set(entry.relatedPaths ?? []);
  const primaryCluster = entry.clusters?.[0];
  const clusterMembership = new Map<string, number>();
  for (const clusterId of entry.clusters ?? []) {
    for (const member of entriesInCluster(clusterId)) {
      clusterMembership.set(
        member.path,
        (clusterMembership.get(member.path) ?? 0) +
          (clusterId === primaryCluster ? WEIGHTS.primaryCluster : WEIGHTS.sharedCluster),
      );
    }
  }

  // Two-hop reach: pages our direct relations point at. This is the
  // "closely related concepts" tier — a wiki article's neighbours' neighbours
  // are usually the next thing a reader wants.
  const secondDegree = new Set<string>();
  for (const path of explicit) {
    const neighbour = allEntries().find((e) => e.path === path);
    for (const onward of neighbour?.relatedPaths ?? []) secondDegree.add(onward);
  }

  const ownTags = tagSet(entry);
  const ownModule = entry.authority?.relatedModuleSlug;
  const ownDifficulty = entry.authority?.difficulty;

  const scored = publishedEntries()
    .filter(eligible)
    .map((candidate) => {
      let score = clusterMembership.get(candidate.path) ?? 0;

      if (explicit.has(candidate.path)) score += WEIGHTS.explicit;

      const shared = [...tagSet(candidate)].filter((t) => ownTags.has(t)).length;
      score += Math.min(shared, WEIGHTS.maxSharedTags) * WEIGHTS.sharedTag;

      const candidateModule = candidate.authority?.relatedModuleSlug;
      if (ownModule && candidateModule === ownModule) score += WEIGHTS.sameModule;
      if (ownDifficulty && candidate.authority?.difficulty === ownDifficulty) {
        score += WEIGHTS.sameDifficulty;
      }

      if (secondDegree.has(candidate.path)) score += WEIGHTS.secondDegree;
      if (candidate.kind !== entry.kind) score += WEIGHTS.crossKind;
      if (candidate.kind === "wiki") score += WEIGHTS.wikiBonus;

      return { candidate, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));

  const picked: SeoEntry[] = [];
  const perKind = new Map<string, number>();
  const seen = new Set<string>();

  const take = (candidate: SeoEntry, respectKindCap: boolean) => {
    if (picked.length >= limit || seen.has(candidate.path)) return;
    const used = perKind.get(candidate.kind) ?? 0;
    if (respectKindCap && used >= maxPerKind) return;
    perKind.set(candidate.kind, used + 1);
    seen.add(candidate.path);
    picked.push(candidate);
  };

  for (const { candidate } of scored) take(candidate, true);
  // Second pass ignores the per-kind cap: a full strip of same-kind links
  // still beats a half-empty one.
  for (const { candidate } of scored) take(candidate, false);

  if (picked.length < limit) {
    for (const fallback of fallbackCandidates(entry)) {
      if (eligible(fallback)) take(fallback, false);
    }
  }

  return picked;
}

/**
 * Backfill for entries with few scored matches — cluster siblings first, then
 * anything under the same section hub. This is what makes the "every page has
 * multiple meaningful outgoing links" guarantee hold for the thinnest pages
 * in the corpus rather than only the well-connected ones.
 */
function fallbackCandidates(entry: SeoEntry): SeoEntry[] {
  const clusterSiblings = (entry.clusters ?? []).flatMap((id) => entriesInCluster(id));
  const hubPath = hubPathForKind(entry.kind);
  const sectionSiblings = hubPath
    ? publishedEntries().filter((e) => hubPathForKind(e.kind) === hubPath)
    : [];
  const wikiAnchors = publishedEntries().filter((e) => e.kind === "wiki");

  return [...clusterSiblings, ...sectionSiblings, ...wikiAnchors];
}

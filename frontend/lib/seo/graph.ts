import {
  allEntries,
  entriesInCluster,
  hubPathForKind,
  kindsListedByHub,
  resolvedClusters,
  searchEntries,
} from "./content";
import { termsForLetter } from "./content/glossary";
import { LESSONS_BY_MODULE, MODULES_BY_SLUG } from "./content/lessons";
import { searchTopicEntries, searchTopics } from "./content/search";
import { globalLinkTargets } from "./navigation";
import { breadcrumbAncestors, relatedTo } from "./related";
import { lessonPath } from "./routes";
import type { SeoEntry } from "./types";

/**
 * The internal-link graph (§3, §8).
 *
 * Modelled from what the pages ACTUALLY render, not from an idealised map:
 * every edge below corresponds to a real `<a href>` in the output. That is
 * what makes the orphan check meaningful — if this file drifts from the
 * components, the orphan report becomes fiction.
 *
 * Edge sources, one per rendering surface:
 *   - global nav + both footers            (lib/seo/navigation.ts)
 *   - breadcrumbs                          (components/seo/Breadcrumbs.tsx)
 *   - the related strip                    (components/seo/RelatedContent.tsx)
 *   - hub listings                         (/wiki, /courses, /glossary, …)
 *   - in-body listings                     (course → lessons, letter → terms,
 *                                            topic page → results)
 */

/** Entries that can appear in the graph: everything with a URL. */
function graphEntries(): SeoEntry[] {
  return [...allEntries(), ...searchTopicEntries()];
}

/** Paths linked from the chrome on every page. */
function globalTargets(): Set<string> {
  return new Set(globalLinkTargets());
}

/**
 * Links a page renders in its own body, beyond breadcrumbs and the related
 * strip. Each branch mirrors one component.
 */
function bodyLinks(entry: SeoEntry): string[] {
  const links: string[] = [];

  // Hub pages list their children — app/wiki/page.tsx and its siblings. The
  // wiki and tools hubs additionally render a "being written" / "in
  // development" list, so their planned children are reachable by a human
  // even while they are noindex.
  const listedKinds = kindsListedByHub(entry.path);
  if (listedKinds.length) {
    const hubShowsPlanned = entry.path === "/wiki" || entry.path === "/tools";
    links.push(
      ...graphEntries()
        .filter(
          (e) =>
            e.path !== entry.path &&
            listedKinds.includes(e.kind) &&
            (e.status === "published" || hubShowsPlanned),
        )
        .map((e) => e.path),
    );
  }

  switch (entry.kind) {
    case "course": {
      // app/courses/[slug]/page.tsx renders the full lesson list.
      const courseModule = MODULES_BY_SLUG[entry.slug];
      if (courseModule) {
        links.push(...(LESSONS_BY_MODULE[courseModule.id] ?? []).map((l) => lessonPath(l.slug)));
      }
      break;
    }
    case "glossary": {
      // app/glossary/[letter]/page.tsx links each term's wiki article and lessons.
      for (const term of termsForLetter(entry.slug)) {
        if (term.wikiPath) links.push(term.wikiPath);
        links.push(...term.lessonPaths.slice(0, 2).map((l) => l.path));
      }
      break;
    }
    case "search": {
      // app/search/[query]/page.tsx renders its result list.
      const topic = searchTopics().find((t) => t.slug === entry.slug);
      if (topic) links.push(...searchEntries(topic.query, 40).map((hit) => hit.entry.path));
      break;
    }
    default:
      break;
  }

  return links;
}

export interface PageLinks {
  entry: SeoEntry;
  outgoing: string[];
  incoming: string[];
}

export interface LinkGraph {
  pages: Map<string, PageLinks>;
  /** Paths linked from every page's chrome. */
  global: Set<string>;
}

let graphCache: LinkGraph | null = null;

/** Builds (and memoises) the whole graph. */
export function linkGraph(): LinkGraph {
  if (graphCache) return graphCache;

  const entries = graphEntries();
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const known = new Set(byPath.keys());

  const pages = new Map<string, PageLinks>(
    entries.map((e) => [e.path, { entry: e, outgoing: [], incoming: [] }]),
  );

  const global = globalTargets();

  for (const entry of entries) {
    const targets = new Set<string>([
      ...breadcrumbAncestors(entry),
      ...relatedTo(entry).map((e) => e.path),
      ...(entry.relatedPaths ?? []),
      ...bodyLinks(entry),
      ...global,
    ]);
    targets.delete(entry.path);

    const outgoing = [...targets].filter((t) => known.has(t));
    pages.get(entry.path)!.outgoing = outgoing;

    for (const target of outgoing) {
      pages.get(target)!.incoming.push(entry.path);
    }
  }

  graphCache = { pages, global };
  return graphCache;
}

export function resetLinkGraph(): void {
  graphCache = null;
}

// ── Orphan detection (§3) ────────────────────────────────────────────────────

export interface OrphanReport {
  /** Indexable pages nothing links to. */
  orphans: SeoEntry[];
  /** Indexable pages with fewer outgoing links than the site guarantees. */
  underlinked: { entry: SeoEntry; outgoing: number }[];
}

/** Minimum outgoing internal links a public page must render. */
export const MIN_OUTGOING_LINKS = 3;

/**
 * Pages with zero incoming internal links.
 *
 * Only indexable pages count: `planned` content is noindex on purpose, and a
 * redirect source has no page at all, so neither can be an orphan. The
 * homepage is exempt — nothing on the site needs to link "up" to it for a
 * crawler to find it, though in practice the logo does.
 */
export function findOrphans(): OrphanReport {
  const graph = linkGraph();
  const orphans: SeoEntry[] = [];
  const underlinked: { entry: SeoEntry; outgoing: number }[] = [];

  for (const { entry, incoming, outgoing } of graph.pages.values()) {
    if (entry.status !== "published") continue;
    if (entry.path === "/") continue;

    if (incoming.length === 0) orphans.push(entry);
    if (outgoing.length < MIN_OUTGOING_LINKS) underlinked.push({ entry, outgoing: outgoing.length });
  }

  return { orphans, underlinked };
}

// ── Cluster scoring (§8) ─────────────────────────────────────────────────────

export interface PageScore {
  path: string;
  title: string;
  kind: SeoEntry["kind"];
  incoming: number;
  outgoing: number;
  related: number;
  clusters: string[];
  /** Size of the entry's primary cluster. */
  clusterSize: number;
  orphan: boolean;
}

export interface ClusterScore {
  id: string;
  title: string;
  size: number;
  /** Links from a member of this cluster to a member of another. */
  outboundLinks: number;
  /** Links into this cluster from outside it. */
  inboundLinks: number;
  /** True when the cluster barely connects to the rest of the site. */
  isolated: boolean;
}

export interface LinkingReport {
  pages: PageScore[];
  clusters: ClusterScore[];
  orphans: SeoEntry[];
  underlinked: { entry: SeoEntry; outgoing: number }[];
  totals: {
    indexable: number;
    edges: number;
    avgIncoming: number;
    avgOutgoing: number;
  };
}

/**
 * A cluster is "isolated" when almost nothing outside it links in. Such a
 * cluster ranks on its own instead of lending authority to the rest of the
 * site, and it is invisible to a crawler that entered anywhere else.
 */
const ISOLATION_THRESHOLD = 2;

export function scoreLinking(): LinkingReport {
  const graph = linkGraph();
  const { orphans, underlinked } = findOrphans();

  const pages: PageScore[] = [...graph.pages.values()]
    .filter((p) => p.entry.status === "published")
    .map(({ entry, incoming, outgoing }) => {
      const primary = entry.clusters?.[0];
      return {
        path: entry.path,
        title: entry.title,
        kind: entry.kind,
        incoming: incoming.length,
        outgoing: outgoing.length,
        related: relatedTo(entry).length,
        clusters: entry.clusters ?? [],
        clusterSize: primary ? entriesInCluster(primary).length : 0,
        orphan: incoming.length === 0 && entry.path !== "/",
      };
    })
    .sort((a, b) => a.incoming - b.incoming || a.path.localeCompare(b.path));

  const clusters: ClusterScore[] = resolvedClusters()
    .filter((c) => c.parentId)
    .map((cluster) => {
      const members = new Set(cluster.memberPaths);
      let outboundLinks = 0;
      let inboundLinks = 0;

      for (const { entry, outgoing } of graph.pages.values()) {
        const fromInside = members.has(entry.path);
        for (const target of outgoing) {
          const toInside = members.has(target);
          if (fromInside && !toInside) outboundLinks += 1;
          if (!fromInside && toInside && !graph.global.has(target)) inboundLinks += 1;
        }
      }

      return {
        id: cluster.id,
        title: cluster.title,
        size: members.size,
        outboundLinks,
        inboundLinks,
        isolated: inboundLinks < ISOLATION_THRESHOLD,
      };
    })
    .sort((a, b) => a.inboundLinks - b.inboundLinks);

  const indexable = pages.length;
  const edges = pages.reduce((sum, p) => sum + p.outgoing, 0);

  return {
    pages,
    clusters,
    orphans,
    underlinked,
    totals: {
      indexable,
      edges,
      avgIncoming: indexable ? round(pages.reduce((s, p) => s + p.incoming, 0) / indexable) : 0,
      avgOutgoing: indexable ? round(edges / indexable) : 0,
    },
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Used by the report to show which hub a page hangs off. */
export function sectionOf(entry: SeoEntry): string {
  return hubPathForKind(entry.kind) ?? "/";
}

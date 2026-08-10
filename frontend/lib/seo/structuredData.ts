import { getSiteUrl } from "@/lib/site-url";
import { allEntries } from "./content";
import { blogPublishedDate } from "./content/blog";
import { glossaryTerms, termsForLetter } from "./content/glossary";
import { LESSONS_BY_MODULE, MODULES_BY_SLUG, publishedLessons } from "./content/lessons";
import { searchTopicEntries } from "./content/search";
import {
  article,
  breadcrumbList,
  course,
  definedTerm,
  definedTermSet,
  faqPage,
  itemList,
  learningResource,
  webApplicationTool,
  type JsonLdNode,
} from "./jsonld";
import { entryText, wordCount } from "./reading";
import { breadcrumbsFor } from "./related";
import { absoluteUrl, coursePath, ROUTES } from "./routes";
import type { SeoEntry } from "./types";

/**
 * The single place that decides which JSON-LD a page emits (§7).
 *
 * Pages call `structuredDataFor(entry)` and render the result; the Rich
 * Results validator calls the SAME function and checks it. That is the whole
 * point of centralising it — a validator that builds its own idea of the
 * markup proves nothing about the markup the page actually ships.
 *
 * The site-level Organization / WebSite / SoftwareApplication nodes are NOT
 * here: they are emitted once from the root layout for every route, and
 * repeating them per page would duplicate entities across the graph.
 */

/** Emitted on every content page — the page itself as a WebPage node. */
function webPage(entry: SeoEntry, origin: string): JsonLdNode {
  const url = absoluteUrl(entry.path, origin);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    name: entry.title,
    description: entry.summary,
    url,
    inLanguage: "en",
    isPartOf: { "@id": `${origin.replace(/\/$/, "")}/#website` },
    ...(entry.authority?.updated ? { dateModified: entry.authority.updated } : {}),
    // Ties the page to its trail without repeating the BreadcrumbList body.
    breadcrumb: { "@id": `${url}#breadcrumb` },
  };
}

function breadcrumbNode(entry: SeoEntry, origin: string): JsonLdNode | null {
  const crumbs = breadcrumbsFor(entry);
  if (crumbs.length < 2) return null;
  const node = breadcrumbList(crumbs, origin);
  node["@id"] = `${absoluteUrl(entry.path, origin)}#breadcrumb`;
  return node;
}

/** The kind-specific primary node: Article, Course, LearningResource, … */
function primaryNode(entry: SeoEntry, origin: string): JsonLdNode | null {
  switch (entry.kind) {
    case "wiki":
      return article(
        {
          headline: entry.title,
          description: entry.summary,
          path: entry.path,
          published: entry.authority?.updated,
          modified: entry.authority?.updated,
          section: entry.clusters?.[0],
          keywords: entry.tags,
          wordCount: wordCount(entryText(entry)),
        },
        origin,
      );

    case "blog":
      return article(
        {
          headline: entry.title,
          description: entry.summary,
          path: entry.path,
          published: blogPublishedDate(entry.slug) ?? entry.authority?.updated,
          modified: entry.authority?.updated,
          section: entry.clusters?.[0],
          keywords: entry.tags,
          wordCount: wordCount(entryText(entry)),
        },
        origin,
      );

    case "course": {
      const courseModule = MODULES_BY_SLUG[entry.slug];
      const lessons = courseModule ? (LESSONS_BY_MODULE[courseModule.id] ?? []) : [];
      const minutes = lessons.reduce((sum, l) => sum + l.estimated_min, 0);
      return course(
        {
          name: entry.title,
          description: entry.summary,
          path: entry.path,
          lessonTitles: lessons.map((l) => l.title),
          difficulty: courseModule?.difficulty,
          duration: `PT${Math.floor(minutes / 60)}H${minutes % 60}M`,
        },
        origin,
      );
    }

    case "lesson": {
      const lesson = publishedLessons().find((l) => l.slug === entry.slug);
      const moduleSlug = entry.authority?.relatedModuleSlug;
      return learningResource(
        {
          name: entry.title,
          description: entry.summary,
          path: entry.path,
          teaches: lesson?.concept_ids,
          difficulty: entry.authority?.difficulty,
          timeRequiredMin: lesson?.estimated_min,
          updated: entry.authority?.updated,
          partOfCoursePath: moduleSlug ? coursePath(moduleSlug) : undefined,
        },
        origin,
      );
    }

    case "tool":
      return webApplicationTool(
        { name: entry.title, description: entry.summary, path: entry.path },
        origin,
      );

    default:
      return null;
  }
}

/** Nodes that list other entities: hub pages, glossary letters, topic pages. */
function collectionNodes(entry: SeoEntry, origin: string): JsonLdNode[] {
  if (entry.kind === "glossary") {
    const terms = termsForLetter(entry.slug);
    return [
      definedTermSet(
        {
          name: "StackedPoker Poker Glossary",
          description: "Every poker term StackedPoker teaches, defined.",
          path: ROUTES.glossary,
        },
        origin,
      ),
      ...terms.map((term) =>
        definedTerm(
          {
            name: term.term,
            description: term.definition,
            path: `${entry.path}#${term.slug}`,
          },
          ROUTES.glossary,
          origin,
        ),
      ),
    ];
  }
  return [];
}

export interface StructuredDataOptions {
  /**
   * Extra entries to advertise as an ItemList — used by hub pages, which pass
   * the very list they render.
   */
  listEntries?: SeoEntry[];
  origin?: string;
}

/**
 * Every JSON-LD node for one page, in emission order.
 *
 * `planned` entries get the WebPage and BreadcrumbList only: they are
 * noindex, and claiming an Article for a page with no article on it would be
 * markup that does not match the content.
 */
export function structuredDataFor(
  entry: SeoEntry,
  options: StructuredDataOptions = {},
): JsonLdNode[] {
  const origin = options.origin ?? getSiteUrl();
  const nodes: JsonLdNode[] = [webPage(entry, origin)];

  const crumbs = breadcrumbNode(entry, origin);
  if (crumbs) nodes.push(crumbs);

  if (entry.status === "published") {
    const primary = primaryNode(entry, origin);
    if (primary) nodes.push(primary);
    nodes.push(...collectionNodes(entry, origin));

    if (entry.faqs?.length) {
      nodes.push(faqPage(entry.faqs, origin, entry.path));
    }

    if (options.listEntries?.length) {
      nodes.push(
        itemList(
          {
            name: entry.title,
            description: entry.summary,
            path: entry.path,
            entries: options.listEntries,
          },
          origin,
        ),
      );
    }
  }

  return nodes;
}

/**
 * What a hub page lists, so `structuredDataFor` can be called with the same
 * data the page renders without each hub restating it.
 */
export function hubListEntries(entry: SeoEntry): SeoEntry[] {
  const published = allEntries().filter((e) => e.status === "published");
  switch (entry.path) {
    case ROUTES.wiki:
      return published.filter((e) => e.kind === "wiki");
    case ROUTES.courses:
      return published.filter((e) => e.kind === "course");
    case ROUTES.tools:
      return published.filter((e) => e.kind === "tool");
    case ROUTES.blog:
      return published.filter((e) => e.kind === "blog");
    case ROUTES.glossary:
      // The hub links letter pages; the terms themselves live on those pages.
      return published.filter((e) => e.kind === "glossary");
    case ROUTES.search:
      // Topic pages are generated, so they are not in the content index —
      // they come from their own registry.
      return searchTopicEntries();
    default:
      return [];
  }
}

/** Glossary term count, used by the hub copy. Kept next to its markup. */
export function glossaryTermCount(): number {
  return glossaryTerms().length;
}

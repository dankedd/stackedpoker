import { AUTHORITY_TEAM } from "../config";
import { readingTimeMin } from "../reading";
import { blogPath } from "../routes";
import type { ArticleSection, ContentDifficulty, FaqItem, SeoEntry } from "../types";

/**
 * The blog (§2, §3, §13).
 *
 * The registry below is intentionally EMPTY. The brief is explicit that
 * placeholder articles must not be generated (§24), and this repository
 * contains no written blog material to publish, so shipping invented posts
 * would put fabricated poker theory on an indexed URL.
 *
 * Everything around the content is built and tested: routing, metadata,
 * Article JSON-LD, breadcrumbs, OG images, the sitemap section, related
 * links, reading time and the authority byline. Adding a real post means
 * appending one object to `POSTS` — no other file changes (§23).
 */

export interface BlogPostSource {
  slug: string;
  title: string;
  /** One-sentence summary — becomes the meta description and card text. */
  summary: string;
  /** ISO date, YYYY-MM-DD. */
  published: string;
  /** ISO date. Defaults to `published`. */
  updated?: string;
  author?: string;
  tags: string[];
  clusters?: string[];
  difficulty?: ContentDifficulty;
  /** Body in the GEO section order — definition/explanation/example/summary. */
  sections: ArticleSection[];
  faqs?: FaqItem[];
  relatedPaths?: string[];
  /** Where the poker claims in this post come from. Required, not optional. */
  sourceNote: string;
}

export const POSTS: BlogPostSource[] = [];

function toEntry(post: BlogPostSource): SeoEntry {
  const entry: SeoEntry = {
    kind: "blog",
    slug: post.slug,
    path: blogPath(post.slug),
    title: post.title,
    summary: post.summary,
    status: "published",
    tags: post.tags,
    clusters: post.clusters ?? [],
    body: post.sections,
    faqs: post.faqs,
    relatedPaths: post.relatedPaths ?? [],
    priority: 0.6,
    changeFrequency: "monthly",
    sourceNote: post.sourceNote,
  };

  entry.authority = {
    reviewedBy: post.author ?? AUTHORITY_TEAM,
    updated: post.updated ?? post.published,
    readingTimeMin: readingTimeMin(entry),
    difficulty: post.difficulty,
  };

  return entry;
}

let cache: SeoEntry[] | null = null;

/** Newest first. */
export function blogEntries(): SeoEntry[] {
  cache ??= POSTS.slice()
    .sort((a, b) => b.published.localeCompare(a.published))
    .map(toEntry);
  return cache;
}

export function blogEntryBySlug(slug: string): SeoEntry | undefined {
  return blogEntries().find((e) => e.slug === slug);
}

export function blogPublishedDate(slug: string): string | undefined {
  return POSTS.find((p) => p.slug === slug)?.published;
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetBlogCache(): void {
  cache = null;
}

/**
 * Builds the SeoEntry for a post without touching the registry.
 *
 * Exported so the blog pipeline can be proven end-to-end (§9) while POSTS is
 * still empty: a test can derive an entry and run it through the same
 * metadata, JSON-LD and validation code every other page uses.
 */
export function blogEntryFrom(post: BlogPostSource): SeoEntry {
  return toEntry(post);
}

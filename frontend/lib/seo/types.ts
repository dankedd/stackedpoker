/**
 * Shared content models for every indexable surface (§20).
 *
 * Wiki articles, glossary entries, blog posts, tool pages, public lesson
 * pages and course pages all normalise to `SeoEntry`. That single shape is
 * what the sitemap builder, the llms.txt writer, the related-content engine,
 * the internal search pages and the metadata generator consume — which is
 * why adding a new content type never means touching any of them (§23).
 */

/** Where an entry lives. Drives the sitemap section it lands in and its icon. */
export type ContentKind =
  | "page"
  | "course"
  | "lesson"
  | "wiki"
  | "glossary"
  | "blog"
  | "tool"
  | "search";

/**
 * Publication state. This is the project's honesty switch: `planned` entries
 * render an explicit "not published yet" page, are `noindex`, and never enter
 * a sitemap or llms.txt. Turning real content on is a one-word change.
 *
 * See CLAUDE.md — poker theory is never invented to fill a gap, so a route
 * whose source material does not exist yet stays `planned` rather than being
 * padded with generated prose.
 */
export type ContentStatus = "published" | "planned";

export type ContentDifficulty = "beginner" | "intermediate" | "advanced" | "elite";

export interface FaqItem {
  question: string;
  answer: string;
}

/** A prose block in the GEO-friendly article structure (§16). */
export interface ArticleSection {
  /** Rendered as the section's `<h2>` — descriptive, never "Introduction". */
  heading: string;
  /** Short paragraphs. Each string is one `<p>`. */
  paragraphs?: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
  /** Optional `term`/`description` rows — the shape LLMs extract most reliably. */
  definitions?: { term: string; description: string }[];
  /** Optional monospace formula callout. */
  formula?: string;
}

/** Authority signals shown on every educational page (§17). */
export interface AuthoritySignals {
  reviewedBy: string;
  /** ISO date (YYYY-MM-DD). */
  updated: string;
  /** Minutes, derived from the entry's own text — never hand-set. */
  readingTimeMin: number;
  difficulty?: ContentDifficulty;
  /** Slug of the module this concept is taught in, when one exists. */
  relatedModuleSlug?: string;
}

/**
 * The normalised record for one indexable URL.
 *
 * `body` is optional because index pages (`/wiki`, `/glossary`) are entries
 * too — they need metadata, breadcrumbs and a sitemap row, but no article.
 */
export interface SeoEntry {
  kind: ContentKind;
  /** Slug within its kind, e.g. "mdf". Unique per kind, not globally. */
  slug: string;
  /** Absolute-from-root canonical path, e.g. "/wiki/mdf". */
  path: string;
  /** `<h1>` and the un-suffixed `<title>` seed. */
  title: string;
  /** One sentence. Becomes the meta description and the llms.txt summary. */
  summary: string;
  status: ContentStatus;
  /** Freeform topical tags — the substrate the related-content engine matches on. */
  tags: string[];
  /** Cluster ids this entry belongs to (§7). */
  clusters?: string[];
  /** Ordered prose sections, in GEO order (definition → … → key takeaway). */
  body?: ArticleSection[];
  faqs?: FaqItem[];
  authority?: AuthoritySignals;
  /** Explicit cross-links that outrank the automatic suggestions. */
  relatedPaths?: string[];
  /** Sitemap hints. */
  priority?: number;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  /** Absolute or root-relative image URLs for the image sitemap (§13). */
  images?: string[];
  /**
   * Provenance for anything that makes a poker-theory claim. Mirrors
   * lib/learn/types.ts's `LessonSource` intent: every strategy statement on
   * the public site is traceable to material that already exists in this
   * repo, never to prose written for SEO.
   */
  sourceNote?: string;
}

/** A named group of entries used for internal linking (§7). */
export interface TopicCluster {
  id: string;
  title: string;
  /** Shown on the cluster's hub/search page. */
  description: string;
  /** Ordered — this is the reading order rendered as the cluster pathway. */
  memberPaths: string[];
  /** Parent cluster id, forming the Strategy → Preflop → 3-Betting hierarchy. */
  parentId?: string;
}

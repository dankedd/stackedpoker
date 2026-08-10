import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { allEntries, publishedEntries, searchEntries } from "../content";
import { blogEntries, POSTS, type BlogPostSource } from "../content/blog";
import { resetSeoCaches } from "../content/reset";
import { entriesInCluster } from "../content";
import { findOrphans, linkGraph, resetLinkGraph } from "../graph";
import { entryMetadata } from "../metadata";
import { resolveOgImageFile } from "../ogAssets";
import { breadcrumbsFor, relatedTo } from "../related";
import { entriesForSection } from "../sitemap";
import { structuredDataFor } from "../structuredData";
import { validateSeo } from "../validate";

/**
 * §9 — the blog registry is empty, and everything downstream must still work
 * the moment it is not.
 *
 * "It should just work" is a claim, not a fact, until a post actually goes
 * through the pipeline. This test appends a real post, rebuilds the caches,
 * and asserts it reaches every surface — sitemap, search, related links,
 * clusters, metadata, JSON-LD, breadcrumbs, OG image — with no registration
 * step anywhere. Then it removes it again, so the corpus the other tests see
 * is unchanged.
 */

const POST: BlogPostSource = {
  slug: "how-mdf-decides-your-river-calls",
  title: "How MDF Decides Your River Calls",
  summary:
    "Minimum defense frequency turns a river bet size into the share of your range that has to continue.",
  published: "2026-08-01",
  tags: ["mdf", "river", "poker strategy"],
  clusters: ["game-theory"],
  difficulty: "intermediate",
  sections: [
    {
      heading: "What MDF is",
      paragraphs: ["MDF is the share of your range you must continue with facing a bet."],
    },
    { heading: "Key takeaway", paragraphs: ["Bigger bets let you fold more often."] },
  ],
  faqs: [{ question: "What is MDF?", answer: "The minimum share of a range that must continue." }],
  sourceNote: "Test fixture — quotes the StackedPoker concept registry entry for MDF.",
};

const BLOG_PATH = `/blog/${POST.slug}`;

describe("publishing a blog post requires no registration", () => {
  beforeAll(() => {
    POSTS.push(POST);
    resetSeoCaches();
    resetLinkGraph();
  });

  afterAll(() => {
    const index = POSTS.indexOf(POST);
    if (index >= 0) POSTS.splice(index, 1);
    resetSeoCaches();
    resetLinkGraph();
  });

  it("appears in the content index as a published entry", () => {
    const entry = allEntries().find((e) => e.path === BLOG_PATH);
    expect(entry).toBeTruthy();
    expect(entry!.status).toBe("published");
    expect(entry!.kind).toBe("blog");
  });

  it("derives authority signals, including a computed reading time", () => {
    const entry = blogEntries()[0];
    expect(entry.authority?.reviewedBy).toBeTruthy();
    expect(entry.authority?.updated).toBe(POST.published);
    expect(entry.authority?.readingTimeMin).toBeGreaterThan(0);
  });

  it("generates metadata with its own canonical and no duplication", () => {
    const entry = blogEntries()[0];
    const meta = entryMetadata(entry, { origin: CANONICAL_SITE_URL });
    expect(meta.alternates?.canonical).toBe(`${CANONICAL_SITE_URL}${BLOG_PATH}`);
    expect((meta.openGraph as { type?: string })?.type).toBe("article");
    expect((meta.robots as { index: boolean }).index).toBe(true);

    const titles = publishedEntries().map((e) => entryMetadata(e).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("generates Article, WebPage and BreadcrumbList JSON-LD", () => {
    const entry = blogEntries()[0];
    const types = structuredDataFor(entry, { origin: CANONICAL_SITE_URL }).map((n) => n["@type"]);
    expect(types).toContain("WebPage");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("Article");
    expect(types).toContain("FAQPage");
  });

  it("generates breadcrumbs ending at itself", () => {
    const entry = blogEntries()[0];
    const crumbs = breadcrumbsFor(entry);
    expect(crumbs[0].path).toBe("/");
    expect(crumbs[1].path).toBe("/blog");
    expect(crumbs.at(-1)?.path).toBe(BLOG_PATH);
  });

  it("resolves an OG image through the blog route's own generator", () => {
    const entry = blogEntries()[0];
    const file = resolveOgImageFile(entry);
    expect(file).toBeTruthy();
    expect(file!.replace(/\\/g, "/")).toContain("blog");
  });

  it("enters the blog sitemap section", () => {
    const paths = entriesForSection("blog").map((e) => e.path);
    expect(paths).toContain(BLOG_PATH);
  });

  it("flips the blog hub from noindex back to indexable", () => {
    const hub = allEntries().find((e) => e.path === "/blog");
    expect(hub?.status).toBe("published");
    expect(entriesForSection("pages").some((e) => e.path === "/blog")).toBe(true);
  });

  it("becomes findable through internal search", () => {
    const hits = searchEntries("MDF river").map((h) => h.entry.path);
    expect(hits).toContain(BLOG_PATH);
  });

  it("joins its topic cluster", () => {
    expect(entriesInCluster("game-theory").map((e) => e.path)).toContain(BLOG_PATH);
  });

  it("gets related links, and is suggested from other pages", () => {
    const entry = blogEntries()[0];
    expect(relatedTo(entry).length).toBeGreaterThanOrEqual(4);

    const suggestedSomewhere = publishedEntries().some((other) =>
      other.path !== BLOG_PATH && relatedTo(other).some((r) => r.path === BLOG_PATH),
    );
    expect(suggestedSomewhere).toBe(true);
  });

  it("is not an orphan", () => {
    const graph = linkGraph();
    expect(graph.pages.get(BLOG_PATH)?.incoming.length).toBeGreaterThan(0);
    expect(findOrphans().orphans.map((o) => o.path)).not.toContain(BLOG_PATH);
  });

  it("keeps the whole corpus valid", () => {
    const result = validateSeo(CANONICAL_SITE_URL);
    expect(result.errors.map((e) => `[${e.check}] ${e.subject}: ${e.message}`)).toEqual([]);
  });
});

describe("after the post is removed", () => {
  it("leaves no trace in the index", () => {
    expect(allEntries().some((e) => e.path === BLOG_PATH)).toBe(false);
    expect(blogEntries()).toEqual([]);
  });

  it("returns the blog hub to noindex, since an empty index is a soft 404", () => {
    const hub = allEntries().find((e) => e.path === "/blog");
    expect(hub?.status).toBe("planned");
  });
});

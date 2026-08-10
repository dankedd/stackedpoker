import { describe, expect, it } from "vitest";
import { allEntries, hubPathForKind, publishedEntries } from "../content";
import { topicForCluster } from "../content/search";
import { breadcrumbAncestors, breadcrumbsFor, relatedTo } from "../related";
import { searchPath } from "../routes";
import type { SeoEntry } from "../types";

/**
 * §1 — visible breadcrumbs. The trail these assertions cover is the one
 * `components/seo/Breadcrumbs.tsx` renders and the one
 * `structuredDataFor` marks up: both call `breadcrumbsFor`, so a change here
 * moves the visible nav and the BreadcrumbList together or not at all.
 */
describe("breadcrumbsFor", () => {
  it("always starts at Home and ends at the current page", () => {
    for (const entry of allEntries()) {
      const crumbs = breadcrumbsFor(entry);
      expect(crumbs[0], entry.path).toEqual({ name: "Home", path: "/" });
      if (entry.path !== "/") {
        expect(crumbs.at(-1)?.path, entry.path).toBe(entry.path);
        expect(crumbs.at(-1)?.name, entry.path).toBe(entry.title);
      }
    }
  });

  it("never repeats a path in one trail", () => {
    for (const entry of allEntries()) {
      const paths = breadcrumbsFor(entry).map((c) => c.path);
      expect(new Set(paths).size, entry.path).toBe(paths.length);
    }
  });

  it("only links to pages that exist", () => {
    const known = new Set(allEntries().map((e) => e.path));
    known.add("/");
    for (const entry of allEntries()) {
      for (const ancestor of breadcrumbAncestors(entry)) {
        // Topic pages live in their own registry; accept their URL shape.
        const resolvable = known.has(ancestor) || ancestor.startsWith("/search/");
        expect(resolvable, `${entry.path} -> ${ancestor}`).toBe(true);
      }
    }
  });

  it("puts the section hub second", () => {
    for (const entry of publishedEntries()) {
      const hub = hubPathForKind(entry.kind);
      if (!hub || hub === entry.path) continue;
      expect(breadcrumbsFor(entry)[1]?.path, entry.path).toBe(hub);
    }
  });

  it("renders Home → Courses → Module → Lesson for a lesson", () => {
    const lesson = publishedEntries().find((e) => e.kind === "lesson")!;
    const crumbs = breadcrumbsFor(lesson);
    expect(crumbs).toHaveLength(4);
    expect(crumbs.map((c) => c.path.split("/")[1])).toEqual(["", "courses", "courses", "learn"]);
  });

  it("renders Home → Wiki → Topic → Article for a wiki article", () => {
    const article = publishedEntries().find((e) => e.kind === "wiki" && e.clusters?.length)!;
    const crumbs = breadcrumbsFor(article);
    const topic = topicForCluster(article.clusters![0]);
    expect(crumbs[1].path).toBe("/wiki");
    if (topic) {
      expect(crumbs[2].path).toBe(searchPath(topic.slug));
      expect(crumbs).toHaveLength(4);
    }
  });

  it("never routes a breadcrumb through /learn, which robots.txt disallows", () => {
    for (const entry of allEntries()) {
      for (const ancestor of breadcrumbAncestors(entry)) {
        expect(ancestor === "/learn" || ancestor.startsWith("/learn/"), entry.path).toBe(false);
      }
    }
  });

  it("gives the homepage no trail to render", () => {
    const home = allEntries().find((e) => e.path === "/")!;
    expect(breadcrumbsFor(home)).toHaveLength(1);
  });
});

/**
 * §2 — internal linking. These are the guarantees the orphan check depends
 * on; if related content stops being generated, the graph collapses.
 */
describe("relatedTo", { timeout: 60_000 }, () => {
  const linkable = publishedEntries().filter((e) => e.kind !== "page");

  it("returns links for every published content page", () => {
    for (const entry of linkable) {
      expect(relatedTo(entry).length, entry.path).toBeGreaterThanOrEqual(4);
    }
  });

  it("never suggests the page itself, a duplicate, or planned content", () => {
    for (const entry of linkable) {
      const related = relatedTo(entry);
      const paths = related.map((r) => r.path);
      expect(paths, entry.path).not.toContain(entry.path);
      expect(new Set(paths).size, entry.path).toBe(paths.length);
      for (const suggestion of related) {
        expect(suggestion.status, `${entry.path} -> ${suggestion.path}`).toBe("published");
      }
    }
  });

  it("never repeats a link the breadcrumb already renders", () => {
    for (const entry of linkable) {
      const ancestors = new Set(breadcrumbAncestors(entry));
      for (const suggestion of relatedTo(entry)) {
        expect(ancestors.has(suggestion.path), `${entry.path} -> ${suggestion.path}`).toBe(false);
      }
    }
  });

  it("mixes content kinds instead of returning six of the same thing", () => {
    const singleKind = linkable.filter((entry) => {
      const kinds = new Set(relatedTo(entry).map((r) => r.kind));
      return kinds.size === 1;
    });
    // A handful of very narrow pages can legitimately have one-kind strips;
    // the corpus as a whole must not.
    expect(singleKind.length / linkable.length).toBeLessThan(0.1);
  });

  it("ranks same-cluster pages above unrelated ones", () => {
    const article = publishedEntries().find((e) => e.path === "/wiki/mdf")!;
    const related = relatedTo(article, { limit: 6 });
    const sameCluster = related.filter((r) => r.clusters?.includes(article.clusters![0]));
    expect(sameCluster.length).toBeGreaterThan(0);
  });

  it("prefers the module a lesson belongs to when ranking sibling lessons", () => {
    const lesson = publishedEntries().find(
      (e) => e.kind === "lesson" && e.authority?.relatedModuleSlug,
    )!;
    const siblings = relatedTo(lesson, { kinds: ["lesson"], limit: 4 });
    const sameModule = siblings.filter(
      (s) => s.authority?.relatedModuleSlug === lesson.authority?.relatedModuleSlug,
    );
    expect(sameModule.length).toBeGreaterThan(0);
  });

  it("honours the kinds filter", () => {
    const entry = publishedEntries().find((e) => e.kind === "wiki")!;
    for (const suggestion of relatedTo(entry, { kinds: ["lesson"] })) {
      expect(suggestion.kind).toBe("lesson");
    }
  });

  it("links every content kind into the graph", () => {
    const linkedKinds = new Set<SeoEntry["kind"]>();
    for (const entry of linkable) {
      for (const suggestion of relatedTo(entry)) linkedKinds.add(suggestion.kind);
    }
    for (const kind of ["lesson", "course", "wiki", "glossary", "tool"] as const) {
      expect(linkedKinds.has(kind), kind).toBe(true);
    }
  });
});

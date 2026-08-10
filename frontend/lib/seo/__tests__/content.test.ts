import { describe, expect, it } from "vitest";
import { allEntries, entriesInCluster, publishedEntries, resolvedClusters, searchEntries } from "../content";
import { courseEntries, lessonEntries, publishedLessons } from "../content/lessons";
import { glossaryLetters, glossaryTerms, termsForLetter } from "../content/glossary";
import { missingWikiSources, publishedWikiEntries, wikiEntries } from "../content/wiki";
import { toolEntries } from "../content/tools";
import { blogEntries } from "../content/blog";
import { searchTopics } from "../content/search";
import { relatedTo } from "../related";
import { readingTimeMin } from "../reading";

describe("content index integrity", () => {
  it("has no duplicate paths", () => {
    const paths = allEntries().map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every entry a leading-slash path matching its kind", () => {
    const prefixes: Record<string, RegExp> = {
      lesson: /^\/learn\/[a-z0-9-]+$/,
      course: /^\/courses\/[a-z0-9-]+$/,
      wiki: /^\/wiki\/[a-z0-9-]+$/,
      glossary: /^\/glossary\/[a-z0-9-]+$/,
      blog: /^\/blog\/[a-z0-9-]+$/,
      tool: /^\/tools\/[a-z0-9-]+$/,
    };
    for (const entry of allEntries()) {
      const pattern = prefixes[entry.kind];
      if (pattern) expect(entry.path, entry.path).toMatch(pattern);
    }
  });

  it("gives every entry a non-empty title and summary", () => {
    for (const entry of allEntries()) {
      expect(entry.title.trim().length, entry.path).toBeGreaterThan(0);
      expect(entry.summary.trim().length, entry.path).toBeGreaterThan(0);
    }
  });

  it("never links to a path that does not resolve", () => {
    const known = new Set(allEntries().map((e) => e.path));
    for (const entry of allEntries()) {
      for (const related of entry.relatedPaths ?? []) {
        expect(known.has(related), `${entry.path} -> ${related}`).toBe(true);
      }
    }
  });

  it("attaches authority signals to every educational page", () => {
    const educational = allEntries().filter(
      (e) => e.status === "published" && e.kind !== "page" && e.kind !== "search",
    );
    expect(educational.length).toBeGreaterThan(0);
    for (const entry of educational) {
      expect(entry.authority, entry.path).toBeTruthy();
      expect(entry.authority!.reviewedBy, entry.path).toBeTruthy();
      expect(entry.authority!.updated, entry.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.authority!.readingTimeMin, entry.path).toBeGreaterThan(0);
    }
  });

  it("records provenance on every page that states poker theory", () => {
    for (const entry of allEntries().filter((e) => e.kind === "wiki" || e.kind === "tool")) {
      expect(entry.sourceNote, entry.path).toBeTruthy();
    }
  });
});

describe("wiki", () => {
  it("publishes an article for every concept in the theory registry", () => {
    // 19 concepts in lib/theory/concepts.json, all of them mapped.
    expect(publishedWikiEntries().length).toBe(19);
  });

  it("gives every published article the full GEO section structure", () => {
    for (const entry of publishedWikiEntries()) {
      const headings = (entry.body ?? []).map((s) => s.heading);
      expect(headings.length, entry.path).toBeGreaterThanOrEqual(4);
      expect(headings.at(0), entry.path).toMatch(/^What is /);
      expect(headings, entry.path).toContain("Why it matters");
      expect(headings.at(-1), entry.path).toBe("Key takeaway");
      expect(entry.faqs?.length, entry.path).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps planned articles empty, noindex-eligible and out of the published set", () => {
    const planned = wikiEntries().filter((e) => e.status === "planned");
    expect(planned.length).toBe(missingWikiSources().length);
    for (const entry of planned) {
      expect(entry.body, entry.path).toBeUndefined();
      expect(entry.faqs, entry.path).toBeUndefined();
      expect(publishedEntries().some((p) => p.path === entry.path), entry.path).toBe(false);
    }
  });

  it("covers the slugs the product asked for", () => {
    const slugs = new Set(wikiEntries().map((e) => e.slug));
    for (const slug of [
      "equity",
      "cbet",
      "range-advantage",
      "blockers",
      "polarization",
      "3bet",
      "squeeze",
      "check-raise",
      "thin-value",
      "fold-equity",
    ]) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });
});

describe("lessons and courses", () => {
  it("publishes a page per playable lesson and per live module", () => {
    expect(lessonEntries().length).toBe(publishedLessons().length);
    expect(lessonEntries().length).toBeGreaterThan(50);
    expect(courseEntries().length).toBeGreaterThan(5);
  });

  it("never exposes lesson step content", () => {
    // The public entry is built from metadata only; if `steps` ever leaked
    // into it, answer keys would be on a crawlable URL.
    for (const entry of lessonEntries()) {
      expect(JSON.stringify(entry)).not.toContain('"steps"');
    }
  });

  it("links every lesson to its module and back", () => {
    for (const entry of lessonEntries()) {
      const modulePath = (entry.relatedPaths ?? []).find((p) => p.startsWith("/courses/"));
      expect(modulePath, entry.path).toBeTruthy();
      const module = courseEntries().find((c) => c.path === modulePath);
      expect(module?.relatedPaths, entry.path).toContain(entry.path);
    }
  });
});

describe("glossary", () => {
  it("defines every term with a non-empty definition", () => {
    expect(glossaryTerms().length).toBeGreaterThan(50);
    for (const term of glossaryTerms()) {
      expect(term.definition.trim().length, term.term).toBeGreaterThan(10);
    }
  });

  it("only creates letter pages that have terms", () => {
    for (const letter of glossaryLetters()) {
      expect(termsForLetter(letter).length, letter).toBeGreaterThan(0);
    }
  });

  it("buckets non-alphabetic terms under a URL-safe segment", () => {
    // "#" would produce /glossary/# — a fragment, not a path. See letterOf().
    for (const letter of glossaryLetters()) {
      expect(letter, letter).toMatch(/^[a-z]$|^0-9$/);
    }
  });

  it("has no duplicate term slugs", () => {
    const slugs = glossaryTerms().map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("tools and blog", () => {
  it("marks tools without an engine as planned", () => {
    const planned = toolEntries().filter((t) => t.status === "planned");
    expect(planned.map((t) => t.slug)).toEqual([
      "equity-calculator",
      "range-viewer",
      "position-trainer",
    ]);
    for (const tool of planned) expect(tool.body).toBeUndefined();
  });

  it("ships no placeholder blog posts", () => {
    // Deliberate: see lib/seo/content/blog.ts. Real posts are appended to
    // POSTS; nothing is generated to fill the section.
    expect(blogEntries()).toEqual([]);
  });
});

describe("topic clusters and related content", () => {
  it("gives every non-root cluster at least one member", () => {
    for (const cluster of resolvedClusters().filter((c) => c.parentId)) {
      expect(entriesInCluster(cluster.id).length, cluster.id).toBeGreaterThan(0);
    }
  });

  it("only lists published members", () => {
    for (const cluster of resolvedClusters()) {
      for (const entry of entriesInCluster(cluster.id)) {
        expect(entry.status, `${cluster.id} -> ${entry.path}`).toBe("published");
      }
    }
  });

  it("suggests related pages for every published entry, never itself, never planned", () => {
    for (const entry of publishedEntries().filter((e) => e.kind !== "page")) {
      const related = relatedTo(entry);
      expect(related.length, entry.path).toBeGreaterThan(0);
      for (const suggestion of related) {
        expect(suggestion.path, entry.path).not.toBe(entry.path);
        expect(suggestion.status, suggestion.path).toBe("published");
      }
    }
  });
});

describe("internal search", () => {
  it("ranks the concept article first for its own term", () => {
    const top = searchEntries("range advantage")[0];
    expect(top.entry.path).toBe("/wiki/range-advantage");
  });

  it("returns nothing for an empty query", () => {
    expect(searchEntries("")).toEqual([]);
    expect(searchEntries("  ")).toEqual([]);
  });

  it("only indexes topic pages with enough results to be worth a URL", () => {
    const topics = searchTopics();
    expect(topics.length).toBeGreaterThan(5);
    for (const topic of topics) {
      expect(topic.resultCount, topic.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("has no duplicate topic slugs", () => {
    const slugs = searchTopics().map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("reading time", () => {
  it("scales with the amount of text", () => {
    const short = readingTimeMin({ title: "T", summary: "S" });
    const long = readingTimeMin({
      title: "T",
      summary: "S",
      body: [{ heading: "H", paragraphs: [Array(600).fill("word").join(" ")] }],
    });
    expect(short).toBe(1);
    expect(long).toBeGreaterThan(short);
  });
});

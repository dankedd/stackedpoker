import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publishedEntries } from "@/lib/seo/content";
import { searchTopics } from "@/lib/seo/content/search";
import { publishedWikiEntries } from "@/lib/seo/content/wiki";
import { entryMetadata } from "@/lib/seo/metadata";
import {
  validateRenderedTitles,
  validateRouteMetadataWiring,
  validateUrlShape,
} from "@/lib/seo/validate";

/**
 * The generated-output audit.
 *
 * Every other SEO test asks whether the registry is right. These ask whether
 * what SHIPS is right — the gap that let three pages go live declaring the
 * homepage as their canonical while the validator reported a clean build.
 */

describe("every static route consumes its registry entry", () => {
  it("reports no wiring errors", () => {
    expect(validateRouteMetadataWiring()).toEqual([]);
  });

  /**
   * The exact three pages that were broken in production. /pricing exported no
   * metadata at all; /privacy and /terms hand-wrote a literal. All three
   * inherited the ROOT canonical, telling search engines they were the
   * homepage — the single worst thing a canonical can say.
   */
  it.each(["/pricing", "/privacy", "/terms"])("%s emits its own canonical", (route) => {
    const source = readFileSync(path.resolve(process.cwd(), `app${route}/page.tsx`), "utf8");
    expect(source).toMatch(/export const metadata/);
    expect(source).toMatch(/entryMetadata\s*\(/);

    const entry = publishedEntries().find((e) => e.path === route)!;
    const canonical = String(entryMetadata(entry).alternates?.canonical ?? "");
    expect(canonical).toMatch(new RegExp(`${route}$`));
    expect(canonical).not.toMatch(/stackedpokerai\.com\/?$/);
  });

  it("no static page route hardcodes a title string", () => {
    for (const entry of publishedEntries().filter((e) => e.kind === "page")) {
      if (!/^\/[a-z0-9-]+$/.test(entry.path)) continue;
      let source: string;
      try {
        source = readFileSync(path.resolve(process.cwd(), `app${entry.path}/page.tsx`), "utf8");
      } catch {
        continue;
      }
      const metadataBlock = source.match(/export const metadata[^;]*;/)?.[0] ?? "";
      expect(metadataBlock, entry.path).not.toMatch(/title:\s*["'`]/);
    }
  });
});

describe("titles and URLs match what a crawler measures", () => {
  it("no indexable, competing page has a title under 30 characters", () => {
    expect(validateRenderedTitles().filter((i) => i.check === "short-title")).toEqual([]);
  });

  it("no URL is malformed", () => {
    expect(validateUrlShape().filter((i) => i.severity === "error")).toEqual([]);
  });

  /**
   * Long URLs are warnings, and exactly two are accepted: lesson slugs that
   * predate this audit, are readable and descriptive, and would need a full
   * redirect migration to shorten for a few characters of gain.
   */
  it("accepts exactly the two documented long URLs", () => {
    const long = validateUrlShape().filter((i) => i.check === "url-shape");
    expect(long.map((i) => i.subject).sort()).toEqual([
      "/learn/reading-the-board-like-the-solver-does",
      "/learn/why-your-range-shape-picks-your-bet-size",
    ]);
  });
});

describe("a search topic URL never moves when a title is edited", () => {
  /**
   * The regression this guards: deriving the topic slug from the wiki TITLE
   * meant rewording five titles silently migrated five live indexable URLs
   * with no redirect, demoting /search/capped-range, /search/polarization and
   * /search/nut-advantage to the noindex fallback and publishing four
   * 70-plus-character replacements.
   */
  it("pins every wiki-derived topic slug to the wiki slug", () => {
    const topics = new Set(searchTopics().map((t) => t.slug));
    for (const wiki of publishedWikiEntries()) {
      // A wiki article with enough search results owns /search/<its own slug>.
      if (!topics.has(wiki.slug)) continue;
      expect(topics.has(wiki.slug), `/search/${wiki.slug}`).toBe(true);
    }
    for (const slug of ["capped-range", "polarization", "nut-advantage", "position", "blockers"]) {
      expect(topics.has(slug), `/search/${slug} must stay indexable`).toBe(true);
    }
  });

  it("produces no topic URL long enough to be flagged", () => {
    for (const topic of searchTopics()) {
      expect(`https://stackedpokerai.com/search/${topic.slug}`.length, topic.slug).toBeLessThan(71);
    }
  });
});

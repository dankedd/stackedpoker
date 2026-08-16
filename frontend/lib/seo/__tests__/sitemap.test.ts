import { describe, expect, it } from "vitest";
import {
  SITEMAP_SECTIONS,
  entriesForSection,
  nonEmptySections,
  renderSitemap,
  renderSitemapIndex,
} from "../sitemap";
import { allEntries, publishedEntries } from "../content";
import { renderAiIndex, renderLlmsTxt } from "../llms";
import { missingWikiSources } from "../content/wiki";

const ORIGIN = "https://stackedpokerai.com";

describe("sitemap index", () => {
  const xml = renderSitemapIndex(ORIGIN);

  it("is well-formed and lists only non-empty sections", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<sitemapindex");
    for (const section of nonEmptySections()) {
      expect(xml).toContain(`${ORIGIN}/sitemaps/${section}.xml`);
    }
    const empty = SITEMAP_SECTIONS.filter((s) => !nonEmptySections().includes(s));
    for (const section of empty) {
      expect(xml).not.toContain(`/sitemaps/${section}.xml`);
    }
  });

  it("gives each child sitemap a lastmod", () => {
    const lastmods = xml.match(/<lastmod>([^<]+)<\/lastmod>/g) ?? [];
    expect(lastmods.length).toBe(nonEmptySections().length);
    for (const lastmod of lastmods) {
      expect(lastmod).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });
});

describe("section sitemaps", () => {
  it("contain only published URLs", () => {
    const publishedPaths = new Set(publishedEntries().map((e) => e.path));
    for (const section of nonEmptySections()) {
      for (const entry of entriesForSection(section)) {
        expect(entry.status, entry.path).toBe("published");
        if (section !== "topics") {
          expect(publishedPaths.has(entry.path), entry.path).toBe(true);
        }
      }
    }
  });

  it("never contain a planned URL", () => {
    const plannedPaths = allEntries()
      .filter((e) => e.status === "planned")
      .map((e) => e.path);
    expect(plannedPaths.length).toBeGreaterThan(0);

    const everyXml = nonEmptySections()
      .map((section) => renderSitemap(section, ORIGIN))
      .join("");
    for (const path of plannedPaths) {
      expect(everyXml).not.toContain(`<loc>${ORIGIN}${path}</loc>`);
    }
  });

  it("emit absolute URLs, a lastmod and a priority", () => {
    const xml = renderSitemap("wiki", ORIGIN);
    expect(xml).toContain(`<loc>${ORIGIN}/wiki/mdf</loc>`);
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    expect(xml).toMatch(/<priority>\d\.\d<\/priority>/);
  });

  it("escapes XML metacharacters", () => {
    const xml = nonEmptySections()
      .map((section) => renderSitemap(section, ORIGIN))
      .join("");
    // A raw & outside an entity would make the document invalid.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("declares the image namespace only on the image sitemap", () => {
    expect(renderSitemap("wiki", ORIGIN)).not.toContain("sitemap-image");
    expect(renderSitemap("images", ORIGIN)).toContain("sitemap-image");
  });
});

describe("llms.txt", () => {
  const txt = renderLlmsTxt(ORIGIN);

  it("has the sections an LLM reader expects", () => {
    for (const heading of [
      "## Main topics",
      "## Content hierarchy",
      "## Key concept articles",
      "## Known gaps",
      "## Machine-readable index",
      "## Contact",
      "## License",
    ]) {
      expect(txt).toContain(heading);
    }
  });

  it("names the topics with no published article", () => {
    for (const gap of missingWikiSources()) {
      expect(txt).toContain(gap.title);
    }
  });

  it("only advertises absolute, published URLs", () => {
    const urls = [...txt.matchAll(/\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(10);

    const publishedUrls = new Set(publishedEntries().map((e) => `${ORIGIN}${e.path}`));
    const plannedUrls = new Set(
      allEntries().filter((e) => e.status === "planned").map((e) => `${ORIGIN}${e.path}`),
    );
    for (const url of urls) {
      expect(url.startsWith(ORIGIN), url).toBe(true);
      // Planned URLs appear only in the "Known gaps" list, which is prose
      // rather than a markdown link.
      if (plannedUrls.has(url)) continue;
      if (url.includes("/sitemap") || url.includes("/robots") || url.includes("/ai-sitemap")) continue;
      expect(publishedUrls.has(url), url).toBe(true);
    }
  });
});

describe("ai-sitemap.json", () => {
  const index = renderAiIndex(ORIGIN);

  it("describes every published document that is its own canonical", () => {
    // A page that names another page canonical is a navigation slice of it —
    // handing an assistant both would be offering the same content twice and
    // inviting it to cite the copy rather than the original.
    const canonical = publishedEntries().filter((entry) => !entry.canonicalTo);
    expect(index.documentCount).toBe(canonical.length);
    expect(index.documents.length).toBe(index.documentCount);

    const listed = new Set(index.documents.map((doc) => doc.path));
    for (const entry of publishedEntries()) {
      expect(listed.has(entry.path), entry.path).toBe(!entry.canonicalTo);
    }
  });

  it("gives documents an outline and provenance where the page has them", () => {
    const wiki = index.documents.filter((d) => d.type === "wiki");
    expect(wiki.length).toBeGreaterThan(0);
    for (const doc of wiki) {
      expect(doc.outline?.length, doc.url).toBeGreaterThan(3);
      expect(doc.answers?.length, doc.url).toBeGreaterThan(1);
      expect(doc.provenance, doc.url).toBeTruthy();
    }
  });

  it("declares the known gaps", () => {
    expect(index.knownGaps.length).toBe(missingWikiSources().length);
  });

  it("serialises to valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(index))).not.toThrow();
  });
});

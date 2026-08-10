import { describe, expect, it } from "vitest";
import { buildDescription, buildMetadata, buildTitle, clamp, entryMetadata } from "../metadata";
import { DESCRIPTION_MAX_CHARS, SITE_NAME, TITLE_MAX_CHARS } from "../config";
import { allEntries } from "../content";
import { searchTopicEntries } from "../content/search";

describe("clamp", () => {
  it("leaves short strings alone", () => {
    expect(clamp("Range advantage", 60)).toBe("Range advantage");
  });

  it("cuts on a word boundary and adds an ellipsis", () => {
    const result = clamp("Minimum defense frequency tells you how often to continue", 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it("normalises whitespace", () => {
    expect(clamp("a  \n b", 20)).toBe("a b");
  });
});

describe("buildTitle", () => {
  it("appends the brand when it fits", () => {
    expect(buildTitle("Range Advantage")).toBe(`Range Advantage | ${SITE_NAME}`);
  });

  it("drops the brand rather than truncating it", () => {
    const long = "A poker page title that is already far too long to carry a brand suffix";
    const title = buildTitle(long);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(title).not.toContain("| Stacked");
  });

  it("does not double the suffix", () => {
    expect(buildTitle(`Pricing | ${SITE_NAME}`)).toBe(`Pricing | ${SITE_NAME}`);
  });
});

describe("buildDescription", () => {
  it("joins fragments and clamps", () => {
    const description = buildDescription("First sentence.", "Second sentence.");
    expect(description).toBe("First sentence. Second sentence.");
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
  });

  it("skips empty fragments", () => {
    expect(buildDescription("Only this.", "", undefined, null)).toBe("Only this.");
  });
});

describe("buildMetadata", () => {
  const meta = buildMetadata({
    title: "Range Advantage",
    description: "What range advantage means and why it decides c-bet strategy.",
    path: "/wiki/range-advantage",
  });

  it("sets an absolute canonical", () => {
    expect(String(meta.alternates?.canonical)).toMatch(/^https?:\/\/.+\/wiki\/range-advantage$/);
  });

  it("sets Open Graph and Twitter from the same title and description", () => {
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.twitter?.title).toBe(meta.title);
    expect((meta.twitter as { card?: string })?.card).toBe("summary_large_image");
  });

  it("emits noindex-but-follow when asked not to index", () => {
    const noindex = buildMetadata({
      title: "Planned",
      description: "Not published yet.",
      path: "/wiki/equity",
      index: false,
    });
    // follow stays true so an unindexed page still passes link equity on.
    expect(noindex.robots).toMatchObject({ index: false, follow: true });
  });

  it("does not set openGraph.images, so the file convention wins", () => {
    // Setting it here would override every colocated opengraph-image.tsx.
    expect(meta.openGraph && "images" in meta.openGraph).toBe(false);
  });
});

/**
 * "No duplicate metadata" (§2) is only a guarantee if it is checked. These
 * run over the entire generated corpus, so a future lesson or wiki article
 * that collides is caught by the test suite rather than by Search Console.
 */
describe("corpus metadata uniqueness", () => {
  const entries = [...allEntries(), ...searchTopicEntries()];

  it("has a unique path per entry", () => {
    const paths = entries.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("has a unique title per indexable entry", () => {
    const titles = entries
      .filter((e) => e.status === "published")
      .map((e) => entryMetadata(e).title as string);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(duplicates).toEqual([]);
  });

  it("has a unique description per indexable entry", () => {
    const descriptions = entries
      .filter((e) => e.status === "published")
      .map((e) => entryMetadata(e).description as string);
    const duplicates = descriptions.filter((d, i) => descriptions.indexOf(d) !== i);
    expect(duplicates).toEqual([]);
  });

  it("keeps every title and description inside the SERP budget", () => {
    for (const entry of entries) {
      const meta = entryMetadata(entry);
      expect((meta.title as string).length, entry.path).toBeLessThanOrEqual(TITLE_MAX_CHARS);
      expect((meta.description as string).length, entry.path).toBeLessThanOrEqual(
        DESCRIPTION_MAX_CHARS,
      );
    }
  });

  it("noindexes exactly the unpublished entries", () => {
    for (const entry of entries) {
      const robots = entryMetadata(entry).robots as { index: boolean };
      expect(robots.index, entry.path).toBe(entry.status === "published");
    }
  });
});

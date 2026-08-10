import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  isPublicSeoPath,
  normalizePath,
  PRIVATE_LEARN_SEGMENTS,
  toSlug,
} from "../routes";
import { publishedLessons } from "../content/lessons";

/**
 * The public/private split is the highest-consequence thing in this system:
 * getting it wrong either hides the content from Google or exposes the
 * signed-in product. middleware.ts and app/robots.ts both delegate here, so
 * these assertions cover both.
 */
describe("isPublicSeoPath", () => {
  it("keeps the signed-in app private", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/anything",
      "/settings",
      "/bankroll/sessions",
      "/coach",
      "/solver/123",
      "/admin/debug-strategy",
      "/api/lessons",
      "/progress",
      "/history/42",
    ]) {
      expect(isPublicSeoPath(path), path).toBe(false);
    }
  });

  it("keeps the /learn app surfaces private", () => {
    expect(isPublicSeoPath("/learn")).toBe(false);
    for (const segment of PRIVATE_LEARN_SEGMENTS) {
      expect(isPublicSeoPath(`/learn/${segment}`), segment).toBe(false);
      expect(isPublicSeoPath(`/learn/${segment}/anything`), segment).toBe(false);
    }
  });

  it("exposes every public lesson page", () => {
    for (const lesson of publishedLessons()) {
      expect(isPublicSeoPath(`/learn/${lesson.slug}`), lesson.slug).toBe(true);
    }
  });

  it("exposes the marketing and reference surfaces", () => {
    for (const path of [
      "/",
      "/wiki",
      "/wiki/mdf",
      "/glossary",
      "/glossary/b",
      "/courses",
      "/courses/blockers-module",
      "/tools/pot-odds-calculator",
      "/blog",
      "/search/cbet",
      "/pricing",
    ]) {
      expect(isPublicSeoPath(path), path).toBe(true);
    }
  });

  it("ignores a trailing slash", () => {
    expect(isPublicSeoPath("/dashboard/")).toBe(false);
    expect(isPublicSeoPath("/wiki/mdf/")).toBe(true);
  });
});

/**
 * A lesson slug equal to a reserved segment would silently shadow the
 * signed-in route (or be shadowed by it). Cheap to assert, very expensive to
 * discover in production.
 */
describe("lesson slugs", () => {
  it("never collide with a reserved /learn segment", () => {
    for (const lesson of publishedLessons()) {
      expect(PRIVATE_LEARN_SEGMENTS.has(lesson.slug), lesson.slug).toBe(false);
    }
  });

  it("are URL-safe", () => {
    for (const lesson of publishedLessons()) {
      expect(lesson.slug, lesson.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe("normalizePath", () => {
  it("collapses slashes and strips a trailing one", () => {
    expect(normalizePath("//wiki//mdf/")).toBe("/wiki/mdf");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});

describe("absoluteUrl", () => {
  it("joins against the origin without doubling the slash", () => {
    expect(absoluteUrl("/wiki/mdf", "https://stackedpokerai.com")).toBe(
      "https://stackedpokerai.com/wiki/mdf",
    );
    expect(absoluteUrl("/wiki/mdf", "https://stackedpokerai.com/")).toBe(
      "https://stackedpokerai.com/wiki/mdf",
    );
  });

  it("passes an already-absolute URL through", () => {
    expect(absoluteUrl("https://example.com/x", "https://stackedpokerai.com")).toBe(
      "https://example.com/x",
    );
  });
});

describe("toSlug", () => {
  it("produces stable URL segments", () => {
    expect(toSlug("Minimum Defense Frequency (MDF)")).toBe("minimum-defense-frequency-mdf");
    expect(toSlug("bet sizing")).toBe("bet-sizing");
    expect(toSlug("C-Bet")).toBe("c-bet");
  });
});

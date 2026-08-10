import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allEntries, publishedEntries } from "../content";
import { searchTopicEntries } from "../content/search";
import { missingWikiSources } from "../content/wiki";
import { scoreLinking } from "../graph";
import {
  completeness,
  renderCompletenessReport,
  renderLinkingReport,
  renderValidationReport,
} from "../report";
import { validateSeo } from "../validate";
import { CANONICAL_SITE_URL } from "@/lib/site-url";

/** §10 — the content completeness report. */
describe("completeness report", () => {
  const report = completeness();

  it("counts every entry exactly once", () => {
    const total = [...allEntries(), ...searchTopicEntries()].length;
    expect(report.publishedTotal + report.plannedTotal).toBe(total);
  });

  it("reports published and indexable as the same set", () => {
    // Status is the only switch driving indexability; if these ever diverge,
    // something has started deciding robots directives on its own.
    expect(report.indexableTotal).toBe(publishedEntries().length + searchTopicEntries().length);
    expect(report.indexableTotal).toBe(report.publishedTotal);
  });

  it("breaks the published set down by content type", () => {
    const summed = report.published.reduce((sum, row) => sum + row.count, 0);
    expect(summed).toBe(report.publishedTotal);
    expect(report.published.map((r) => r.kind)).toContain("lesson");
    expect(report.published.map((r) => r.kind)).toContain("wiki");
  });

  it("groups every planned page by type", () => {
    const listed = report.planned.flatMap((g) => g.entries);
    expect(listed.length).toBe(report.plannedTotal);
    for (const group of report.planned) expect(group.entries.length).toBeGreaterThan(0);
  });

  it("names every high-priority topic that is still unpublished", () => {
    const text = renderCompletenessReport(report);
    // The tool gaps closed in Module 14 except the range viewer, which still
    // has no public range data behind it.
    const expected = [
      "/wiki/equity",
      "/wiki/3bet",
      "/wiki/squeeze",
      "/wiki/check-raise",
      "/wiki/thin-value",
      "/wiki/fold-equity",
      "/tools/range-viewer",
    ];
    for (const path of expected) expect(text, path).toContain(path);
  });

  it("keeps the wiki gap list and the report in agreement", () => {
    const plannedWikiPaths = report.planned
      .filter((g) => g.kind === "wiki")
      .flatMap((g) => g.entries.map((e) => e.slug));
    expect(plannedWikiPaths.sort()).toEqual(missingWikiSources().map((g) => g.slug).sort());
  });

  it("explains why each gap exists", () => {
    const text = renderCompletenessReport(report);
    expect(text).toContain("No StackedPoker theory-registry entry exists");
  });
});

/** §8 — the internal-linking diagnostic. */
describe("linking report", () => {
  const text = renderLinkingReport(scoreLinking());

  it("reports every metric the diagnostic is meant to surface", () => {
    for (const heading of [
      "Indexable pages",
      "Internal links",
      "Avg incoming / page",
      "Avg outgoing / page",
      "Orphan pages",
      "Under-linked pages",
      "Topic clusters",
      "Least-linked pages",
    ]) {
      expect(text, heading).toContain(heading);
    }
  });

  it("labels each cluster connected or isolated", () => {
    expect(text).toMatch(/connected|ISOLATED/);
  });
});

describe("validation report", () => {
  it("says PASS when the corpus is clean", () => {
    expect(renderValidationReport(validateSeo(CANONICAL_SITE_URL))).toContain("PASS");
  });

  it("says FAIL and names the check when something is broken", () => {
    const text = renderValidationReport({
      issues: [],
      errors: [
        { severity: "error", check: "orphan", subject: "/wiki/x", message: "zero incoming links" },
      ],
      warnings: [],
      ok: false,
    });
    expect(text).toContain("FAIL");
    expect(text).toContain("[orphan]");
    expect(text).toContain("/wiki/x");
  });
});

/**
 * §10 — "for developers only and must not be publicly accessible."
 *
 * Enforced structurally: no route may import the report module. A gated page
 * would still be a page; a CLI cannot be crawled, cached or leaked.
 */
describe("the reports are not reachable over HTTP", () => {
  const appDir = path.resolve(process.cwd(), "app");

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }

  const routeFiles = walk(appDir).filter((f) => /\.(tsx?|jsx?)$/.test(f));

  it("has no route importing lib/seo/report", () => {
    const offenders = routeFiles.filter((file) =>
      readFileSync(file, "utf8").includes("lib/seo/report"),
    );
    expect(offenders).toEqual([]);
  });

  it("has no route importing the validator or its node-only helpers", () => {
    const offenders = routeFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("lib/seo/validate") || source.includes("lib/seo/ogAssets");
    });
    expect(offenders).toEqual([]);
  });
});

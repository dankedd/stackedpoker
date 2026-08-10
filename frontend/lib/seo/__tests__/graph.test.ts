import { describe, expect, it } from "vitest";
import { allEntries, publishedEntries } from "../content";
import { searchTopicEntries } from "../content/search";
import { findOrphans, linkGraph, MIN_OUTGOING_LINKS, scoreLinking } from "../graph";
import { globalLinkTargets } from "../navigation";

/**
 * §3 — orphan elimination, and §8 — cluster scoring.
 *
 * The graph is modelled on what the pages render. These assertions are the
 * guard on that modelling: if a component stops rendering a link the graph
 * still counts, the numbers here go quiet but the site gets worse — so the
 * checks are written against invariants (every page reachable, every page
 * links out) rather than against specific counts that would drift.
 */
describe("link graph", { timeout: 60_000 }, () => {
  const graph = linkGraph();

  it("covers every entry that has a URL", () => {
    const expected = new Set(
      [...allEntries(), ...searchTopicEntries()].map((e) => e.path),
    );
    expect(graph.pages.size).toBe(expected.size);
    for (const path of expected) expect(graph.pages.has(path), path).toBe(true);
  });

  it("never records an edge to a page that does not exist", () => {
    for (const { entry, outgoing } of graph.pages.values()) {
      for (const target of outgoing) {
        expect(graph.pages.has(target), `${entry.path} -> ${target}`).toBe(true);
      }
    }
  });

  it("never records a self-link", () => {
    for (const [path, links] of graph.pages) {
      expect(links.outgoing, path).not.toContain(path);
    }
  });

  it("keeps incoming and outgoing consistent", () => {
    for (const [path, links] of graph.pages) {
      for (const target of links.outgoing) {
        expect(graph.pages.get(target)!.incoming, `${path} -> ${target}`).toContain(path);
      }
    }
  });

  it("treats the global nav and footers as links from every page", () => {
    for (const target of globalLinkTargets()) {
      if (!graph.pages.has(target)) continue;
      expect(graph.pages.get(target)!.incoming.length, target).toBeGreaterThan(1);
    }
  });
});

describe("orphan detection", () => {
  const { orphans, underlinked } = findOrphans();

  it("finds no orphan pages", () => {
    expect(orphans.map((o) => o.path)).toEqual([]);
  });

  it("finds no under-linked pages", () => {
    expect(underlinked.map((u) => `${u.entry.path} (${u.outgoing})`)).toEqual([]);
  });

  it("gives every indexable page at least the minimum outgoing links", () => {
    const graph = linkGraph();
    for (const entry of publishedEntries()) {
      const links = graph.pages.get(entry.path)!;
      expect(links.outgoing.length, entry.path).toBeGreaterThanOrEqual(MIN_OUTGOING_LINKS);
    }
  });

  it("ignores planned pages — they are noindex by design", () => {
    const planned = allEntries().filter((e) => e.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const entry of planned) {
      expect(orphans, entry.path).not.toContain(entry);
    }
  });
});

describe("linking report", () => {
  const report = scoreLinking();

  it("scores every indexable page", () => {
    expect(report.pages.length).toBe(publishedEntries().length + searchTopicEntries().length);
    for (const page of report.pages) {
      expect(page.incoming, page.path).toBeGreaterThan(0);
      expect(page.outgoing, page.path).toBeGreaterThan(0);
    }
  });

  it("sorts least-linked pages first, so the report leads with the problems", () => {
    const incoming = report.pages.map((p) => p.incoming);
    expect([...incoming].sort((a, b) => a - b)).toEqual(incoming);
  });

  it("reports a size and a link count for every cluster", () => {
    expect(report.clusters.length).toBeGreaterThan(5);
    for (const cluster of report.clusters) {
      expect(cluster.size, cluster.id).toBeGreaterThan(0);
    }
  });

  it("finds no isolated clusters", () => {
    expect(report.clusters.filter((c) => c.isolated).map((c) => c.id)).toEqual([]);
  });

  it("reports believable totals", () => {
    expect(report.totals.indexable).toBe(report.pages.length);
    expect(report.totals.edges).toBeGreaterThan(report.totals.indexable);
    expect(report.totals.avgOutgoing).toBeGreaterThanOrEqual(MIN_OUTGOING_LINKS);
  });
});

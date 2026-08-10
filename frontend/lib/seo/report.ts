import { allEntries } from "./content";
import { searchTopicEntries } from "./content/search";
import { scoreLinking, type LinkingReport } from "./graph";
import { SEO_REDIRECTS } from "./redirects";
import type { SeoEntry } from "./types";
import type { SeoIssue, ValidationResult } from "./validate";

/**
 * Developer-facing reports (§8, §10).
 *
 * Printed by `npm run seo:report` and `npm run seo:validate`. Deliberately
 * plain text on stdout rather than a route: §10 requires the completeness
 * report to be developer-only, and a page — even a gated one — is a page
 * somebody can eventually reach. A CLI cannot be crawled, cached or leaked.
 */

const KIND_ORDER: SeoEntry["kind"][] = [
  "page",
  "course",
  "lesson",
  "wiki",
  "glossary",
  "tool",
  "blog",
  "search",
];

const KIND_LABEL: Record<SeoEntry["kind"], string> = {
  page: "Hub & marketing pages",
  course: "Courses (modules)",
  lesson: "Lessons",
  wiki: "Wiki articles",
  glossary: "Glossary letter pages",
  tool: "Free tools",
  blog: "Blog posts",
  search: "Topic pages",
};

function bar(count: number, max: number, width = 24): string {
  if (max <= 0) return "";
  return "█".repeat(Math.max(1, Math.round((count / max) * width)));
}

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

// ── §10 Content completeness ─────────────────────────────────────────────────

export interface CompletenessReport {
  published: { kind: SeoEntry["kind"]; count: number }[];
  publishedTotal: number;
  indexableTotal: number;
  planned: { kind: SeoEntry["kind"]; entries: SeoEntry[] }[];
  plannedTotal: number;
  redirects: number;
}

export function completeness(): CompletenessReport {
  const entries = [...allEntries(), ...searchTopicEntries()];
  const published = entries.filter((e) => e.status === "published");
  const planned = entries.filter((e) => e.status === "planned");

  return {
    published: KIND_ORDER.map((kind) => ({
      kind,
      count: published.filter((e) => e.kind === kind).length,
    })).filter((row) => row.count > 0),
    publishedTotal: published.length,
    // Published and indexable are the same set by construction — `status`
    // drives the robots directive — so reporting both makes a regression in
    // that invariant visible rather than implicit.
    indexableTotal: published.length,
    planned: KIND_ORDER.map((kind) => ({
      kind,
      entries: planned.filter((e) => e.kind === kind),
    })).filter((row) => row.entries.length > 0),
    plannedTotal: planned.length,
    redirects: SEO_REDIRECTS.length,
  };
}

export function renderCompletenessReport(report = completeness()): string {
  const lines: string[] = [];
  const max = Math.max(...report.published.map((r) => r.count), 1);

  lines.push("CONTENT COMPLETENESS");
  lines.push("=".repeat(64));
  lines.push("");
  lines.push(`Published pages : ${report.publishedTotal}`);
  lines.push(`Indexable pages : ${report.indexableTotal}`);
  lines.push(`Planned pages   : ${report.plannedTotal}`);
  lines.push(`Redirects       : ${report.redirects}`);
  lines.push("");
  lines.push("By content type");
  lines.push("-".repeat(64));
  for (const row of report.published) {
    lines.push(`  ${pad(KIND_LABEL[row.kind], 24)} ${pad(row.count, 5)} ${bar(row.count, max)}`);
  }

  lines.push("");
  lines.push("PLANNED — routed, noindex, excluded from sitemaps");
  lines.push("-".repeat(64));
  if (!report.planned.length) {
    lines.push("  (none)");
  }
  for (const group of report.planned) {
    lines.push(`  ${KIND_LABEL[group.kind]}`);
    for (const entry of group.entries) {
      lines.push(`    ${pad(entry.path, 30)} ${entry.title}`);
    }
  }

  lines.push("");
  lines.push("MISSING AUTHORITY PAGES — high-priority topics with no reviewed source");
  lines.push("-".repeat(64));
  const gaps = report.planned.flatMap((g) => g.entries);
  if (!gaps.length) {
    lines.push("  (none — every reserved route has published content)");
  }
  for (const entry of gaps) {
    lines.push(`  ${pad(entry.path, 30)} ${entry.title}`);
    if (entry.sourceNote) lines.push(`  ${" ".repeat(30)} ${entry.sourceNote}`);
  }

  return lines.join("\n");
}

// ── §8 Internal linking ──────────────────────────────────────────────────────

export function renderLinkingReport(report: LinkingReport = scoreLinking()): string {
  const lines: string[] = [];

  lines.push("INTERNAL LINKING");
  lines.push("=".repeat(64));
  lines.push("");
  lines.push(`Indexable pages     : ${report.totals.indexable}`);
  lines.push(`Internal links      : ${report.totals.edges}`);
  lines.push(`Avg incoming / page : ${report.totals.avgIncoming}`);
  lines.push(`Avg outgoing / page : ${report.totals.avgOutgoing}`);
  lines.push(`Orphan pages        : ${report.orphans.length}`);
  lines.push(`Under-linked pages  : ${report.underlinked.length}`);
  lines.push("");

  lines.push("Topic clusters");
  lines.push("-".repeat(64));
  lines.push(`  ${pad("CLUSTER", 26)}${pad("SIZE", 6)}${pad("IN", 7)}${pad("OUT", 7)}STATUS`);
  for (const cluster of report.clusters) {
    lines.push(
      `  ${pad(cluster.title, 26)}${pad(cluster.size, 6)}${pad(cluster.inboundLinks, 7)}` +
        `${pad(cluster.outboundLinks, 7)}${cluster.isolated ? "ISOLATED" : "connected"}`,
    );
  }

  lines.push("");
  lines.push("Least-linked pages (bottom 15 by incoming links)");
  lines.push("-".repeat(64));
  lines.push(`  ${pad("IN", 5)}${pad("OUT", 6)}${pad("REL", 5)}PAGE`);
  for (const page of report.pages.slice(0, 15)) {
    lines.push(
      `  ${pad(page.incoming, 5)}${pad(page.outgoing, 6)}${pad(page.related, 5)}${page.path}` +
        (page.orphan ? "   ← ORPHAN" : ""),
    );
  }

  if (report.orphans.length) {
    lines.push("");
    lines.push("ORPHANS — indexable pages with zero incoming internal links");
    lines.push("-".repeat(64));
    for (const entry of report.orphans) {
      lines.push(`  ${pad(entry.path, 34)} ${entry.title}`);
    }
  }

  return lines.join("\n");
}

// ── Validation output ────────────────────────────────────────────────────────

function renderIssues(title: string, issues: SeoIssue[]): string[] {
  if (!issues.length) return [];
  const lines = ["", title, "-".repeat(64)];
  const byCheck = new Map<string, SeoIssue[]>();
  for (const issue of issues) {
    byCheck.set(issue.check, [...(byCheck.get(issue.check) ?? []), issue]);
  }
  for (const [check, group] of byCheck) {
    lines.push(`  [${check}] ${group.length}`);
    for (const issue of group.slice(0, 25)) {
      lines.push(`    ${pad(issue.subject, 34)} ${issue.message}`);
    }
    if (group.length > 25) lines.push(`    …and ${group.length - 25} more`);
  }
  return lines;
}

export function renderValidationReport(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push("SEO VALIDATION");
  lines.push("=".repeat(64));
  lines.push(`  errors   : ${result.errors.length}`);
  lines.push(`  warnings : ${result.warnings.length}`);
  lines.push(...renderIssues("ERRORS — these fail the build", result.errors));
  lines.push(...renderIssues("WARNINGS", result.warnings));
  lines.push("");
  lines.push(result.ok ? "PASS — SEO integrity checks passed." : "FAIL — fix the errors above.");
  return lines.join("\n");
}

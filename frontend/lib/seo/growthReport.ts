import { promptVisibility, visibilitySummary } from "./aiVisibility";
import { allEntries, publishedEntries } from "./content";
import { searchTopicEntries } from "./content/search";
import { linkGraph } from "./graph";
import { intentOf, primaryQuestion, type SearchIntent } from "./intent";
import {
  backlinkTargets,
  clusterHealth,
  CLUSTER_ROLES,
  linkWorthyAssets,
  opportunities,
  topicCoverage,
} from "./opportunity";

/**
 * The SEO growth audit report (§1, §2, §5, §8, §12, §15).
 *
 * Developer/admin only — printed by `npm run seo:growth`, never rendered. It
 * is the roadmap artefact: what the corpus covers, where the clusters are
 * incomplete, which topics are worth work next, and — the distinction the
 * whole exercise turns on — whether each gap is a CONTENT problem or an
 * AUTHORITY problem, because only the first is solved by writing a page.
 */

function pad(value: string | number, width: number): string {
  const text = String(value);
  return text.length >= width ? text.slice(0, width - 1) + " " : text.padEnd(width);
}

function tick(value: boolean): string {
  return value ? "yes" : " - ";
}

const RULE = "=".repeat(72);
const THIN = "-".repeat(72);

// ── §1 corpus audit ──────────────────────────────────────────────────────────

export function renderCorpusAudit(): string {
  const graph = linkGraph();
  const corpus = [...publishedEntries(), ...searchTopicEntries()];
  const lines: string[] = ["CORPUS AUDIT", RULE, ""];

  const byIntent = new Map<SearchIntent, number>();
  for (const entry of corpus) {
    const intent = intentOf(entry);
    byIntent.set(intent, (byIntent.get(intent) ?? 0) + 1);
  }

  lines.push("Indexable pages by search intent");
  lines.push(THIN);
  for (const [intent, count] of [...byIntent.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${pad(intent, 18)}${count}`);
  }

  // The pages that carry commercial intent are the ones worth auditing by
  // hand, so they are listed rather than counted.
  lines.push("");
  lines.push("Commercial-intent pages — the ones closest to a signup");
  lines.push(THIN);
  for (const entry of corpus.filter((e) => intentOf(e) === "commercial")) {
    const links = graph.pages.get(entry.path)?.incoming.length ?? 0;
    lines.push(`  ${pad(entry.path, 34)}in:${pad(links, 5)}${primaryQuestion(entry)}`);
  }

  return lines.join("\n");
}

// ── §2 topic map ─────────────────────────────────────────────────────────────

export function renderTopicMap(): string {
  const lines: string[] = ["KEYWORD / TOPIC MAP", RULE, ""];
  lines.push("No search volumes: none are available, and inventing them would");
  lines.push("make every priority below a fiction. Priority is a stated judgement.");
  lines.push("");
  lines.push(`  ${pad("TOPIC", 26)}${pad("INTENT", 15)}${pad("PRI", 8)}${pad("OWNED BY", 30)}COVER`);
  lines.push(THIN);

  for (const coverage of topicCoverage()) {
    const { topic, anchor, matches } = coverage;
    const owner = anchor?.path ?? (coverage.hasPlannedPage ? "(reserved, unpublished)" : "(nothing)");
    lines.push(
      `  ${pad(topic.queries[0], 26)}${pad(topic.intent, 15)}${pad(topic.priority, 8)}${pad(owner, 30)}${matches.length}`,
    );
  }

  const dutch = topicCoverage().filter((c) => c.topic.language === "nl");
  lines.push("");
  lines.push("Dutch-language opportunities");
  lines.push(THIN);
  lines.push("  The site is English-only (<html lang=\"en\">) with no translation");
  lines.push("  pipeline. These need Dutch PAGES; Dutch keywords on English pages");
  lines.push("  would be a doorway page. Recorded so localising stays a decision.");
  for (const coverage of dutch) {
    lines.push(`  ${pad(coverage.topic.queries[0], 26)}${coverage.topic.rationale}`);
  }

  return lines.join("\n");
}

// ── §5 cluster health ────────────────────────────────────────────────────────

export function renderClusterHealth(): string {
  const lines: string[] = ["TOPIC CLUSTER HEALTH", RULE, ""];
  lines.push(`  ${pad("CLUSTER", 24)}${pad("N", 5)}${CLUSTER_ROLES.map((r) => pad(r, 9)).join("")}${pad("FULL", 7)}PRIORITY`);
  lines.push(THIN);

  for (const cluster of clusterHealth()) {
    lines.push(
      `  ${pad(cluster.title, 24)}${pad(cluster.size, 5)}` +
        CLUSTER_ROLES.map((role) => pad(tick(cluster.roles[role]), 9)).join("") +
        `${pad(`${Math.round(cluster.completeness * 100)}%`, 7)}${cluster.priority}`,
    );
  }

  lines.push("");
  for (const cluster of clusterHealth().filter((c) => c.missing.length)) {
    lines.push(`  ${cluster.title}: missing ${cluster.missing.join(", ")}`);
  }

  return lines.join("\n");
}

// ── §12 opportunity score ────────────────────────────────────────────────────

export function renderOpportunities(): string {
  const rows = opportunities();
  const lines: string[] = ["SEO OPPORTUNITY SCORE", RULE, ""];
  lines.push("Score ranks TOPICS, not pages: one missing explainer can unlock a");
  lines.push("whole cluster, which a page-level ranking would bury under 100");
  lines.push("lesson pages. Components are shown so a call can be overruled.");
  lines.push("");

  for (const band of ["HIGH", "MEDIUM", "LOW"] as const) {
    const inBand = rows.filter((r) => r.priority === band);
    if (!inBand.length) continue;
    lines.push(`${band} PRIORITY`);
    lines.push(THIN);
    inBand.forEach((row, index) => {
      lines.push(
        `  ${pad(`${index + 1}.`, 4)}${pad(row.label, 28)}${pad(row.score, 5)}${pad(`gap:${row.gap}`, 16)}${row.path ?? "-"}`,
      );
      lines.push(`      ${row.reason}`);
      lines.push(`      -> ${row.recommendation}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

// ── §8 AI visibility ─────────────────────────────────────────────────────────

export function renderAiVisibility(): string {
  const summary = visibilitySummary();
  const rows = promptVisibility();
  const lines: string[] = ["AI VISIBILITY", RULE, ""];

  lines.push(`  prompts tracked : ${summary.total}`);
  lines.push(`  runs recorded   : ${summary.tested}`);
  lines.push(`  mentioned       : ${summary.mentioned}`);
  lines.push(`  absent          : ${summary.absent}`);
  lines.push(`  never tested    : ${summary.neverTested}`);
  lines.push(`  content gaps    : ${summary.contentGaps}`);
  lines.push(`  authority gaps  : ${summary.authorityGaps}`);
  lines.push("");

  if (summary.tested === 0) {
    lines.push("  NOTHING HAS BEEN RUN YET. Every prompt below reports as");
    lines.push("  \"never tested\" rather than \"not mentioned\" — the observation log");
    lines.push("  ships empty because fabricating model answers would poison the");
    lines.push("  one dataset meant to tell the truth about our visibility.");
    lines.push("  Run the prompts, then append to OBSERVATIONS in aiVisibility.ts.");
    lines.push("");
  }

  if (summary.competitors.length) {
    lines.push("Competitors seen across recorded runs");
    lines.push(THIN);
    for (const competitor of summary.competitors) {
      lines.push(`  ${pad(competitor.name, 30)}${competitor.appearances}`);
    }
    lines.push("");
  }

  lines.push("Prompts with no page nominated to answer them — the content gaps");
  lines.push(THIN);
  for (const row of rows.filter((r) => r.gap === "content")) {
    lines.push(`  [${pad(row.prompt.intent, 14)}] ${row.prompt.prompt}`);
    lines.push(`      best current page: ${row.bestPage?.path ?? "(none)"}`);
    lines.push(`      -> ${row.recommendation}`);
  }

  lines.push("");
  lines.push("Prompts we should already be able to win");
  lines.push(THIN);
  for (const row of rows.filter((r) => r.gap !== "content")) {
    lines.push(`  ${pad(row.prompt.targetPath ?? "-", 34)}${row.prompt.prompt}`);
  }

  return lines.join("\n");
}

// ── §15 backlinks ────────────────────────────────────────────────────────────

export function renderBacklinkTargets(): string {
  const lines: string[] = ["BACKLINK OPPORTUNITIES", RULE, ""];
  lines.push("Topics where on-site work is done and the constraint is external.");
  lines.push("Writing more pages for these will not move them.");
  lines.push("");

  const targets = backlinkTargets();
  if (!targets.length) {
    lines.push("  (none — every tracked topic still has on-site work outstanding)");
  }
  for (const row of targets) {
    lines.push(`  ${pad(row.label, 28)}${row.path ?? "-"}`);
  }

  lines.push("");
  lines.push("Assets worth pitching — pages good enough that a link is earned");
  lines.push(THIN);
  for (const asset of linkWorthyAssets().slice(0, 12)) {
    lines.push(`  ${pad(asset.path, 34)}${asset.title}`);
  }

  return lines.join("\n");
}

// ── §15 health summary ───────────────────────────────────────────────────────

export function renderGrowthSummary(): string {
  const all = [...allEntries(), ...searchTopicEntries()];
  const published = all.filter((e) => e.status === "published");
  const planned = all.filter((e) => e.status === "planned");
  const clusters = clusterHealth();

  const lines: string[] = ["SEO HEALTH", RULE, ""];
  lines.push(`  indexable pages     : ${published.length}`);
  lines.push(`  planned (noindex)   : ${planned.length}`);
  lines.push(`  clusters            : ${clusters.length}`);
  lines.push(`  complete clusters   : ${clusters.filter((c) => c.missing.length === 0).length}`);
  lines.push(`  clusters w/o anchor : ${clusters.filter((c) => !c.roles.wiki).length}`);
  lines.push("");
  lines.push("Planned pages, by what they are waiting on");
  lines.push(THIN);
  for (const entry of planned) {
    lines.push(`  ${pad(entry.path, 34)}${entry.sourceNote ?? "no reason recorded"}`);
  }
  return lines.join("\n");
}

export function renderGrowthReport(): string {
  return [
    renderGrowthSummary(),
    "",
    renderCorpusAudit(),
    "",
    renderTopicMap(),
    "",
    renderClusterHealth(),
    "",
    renderOpportunities(),
    renderAiVisibility(),
    "",
    renderBacklinkTargets(),
  ].join("\n");
}

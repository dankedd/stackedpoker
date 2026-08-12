import { allEntries, entriesInCluster, publishedEntries, resolvedClusters } from "./content";
import { clusterTitle } from "./content/clusters";
import { glossaryTerms } from "./content/glossary";
import { searchTopicEntries } from "./content/search";
import { linkGraph } from "./graph";
import { INTENT_WEIGHT } from "./intent";
import { allCoverage, TOPICS, type TopicCoverage } from "./topics";
import type { SeoEntry } from "./types";

/**
 * Cluster completeness (§5) and the SEO opportunity score (§12).
 *
 * Both are computed from the live corpus and the live link graph — nothing
 * here is a stored judgement about a specific page, so the roadmap re-derives
 * itself as content lands.
 *
 * The score is explicitly a PRIORITISATION aid, not a prediction. It cannot
 * know search volume (none is available) or difficulty, so it ranks on what is
 * knowable: how valuable the intent is, how complete the cluster is, how much
 * internal authority the page already has, and whether the gap is content or
 * authority. Every component is reported alongside the total so a human can
 * see why something ranked where it did and overrule it.
 */

// ── Cluster completeness ─────────────────────────────────────────────────────

/** The shape a healthy topic cluster has. */
export const CLUSTER_ROLES = ["wiki", "glossary", "lesson", "tool", "blog", "faq"] as const;
export type ClusterRole = (typeof CLUSTER_ROLES)[number];

export interface ClusterHealth {
  id: string;
  title: string;
  size: number;
  /** Which roles are filled. */
  roles: Record<ClusterRole, boolean>;
  missing: ClusterRole[];
  /** 0–1. */
  completeness: number;
  /** Links into the cluster from outside it. */
  inboundLinks: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * A cluster is judged on the roles it fills, not on how many pages it has.
 *
 * Twenty lessons and no explainer is a weaker cluster than one wiki article
 * plus one tool: the first has nothing that can rank for the topic itself or
 * be cited by an AI answer.
 */
export function clusterHealth(): ClusterHealth[] {
  const graph = linkGraph();

  // Glossary pages are grouped ALPHABETICALLY, so they all sit in the
  // "glossary" cluster and every topical cluster would otherwise report a
  // glossary gap it does not have. A cluster genuinely has glossary coverage
  // when a defined term points at one of its pages, which is what the terms'
  // own wikiPath records.
  const glossaryCovered = new Set<string>();
  const byPath = new Map(publishedEntries().map((e) => [e.path, e]));
  for (const term of glossaryTerms()) {
    const target = term.wikiPath ? byPath.get(term.wikiPath) : undefined;
    for (const clusterId of target?.clusters ?? []) glossaryCovered.add(clusterId);
  }

  return resolvedClusters()
    .filter((cluster) => cluster.parentId) // the root is every page, not a topic
    .map((cluster) => {
      const members = entriesInCluster(cluster.id);
      const kinds = new Set(members.map((m) => m.kind));

      const roles: Record<ClusterRole, boolean> = {
        wiki: kinds.has("wiki"),
        glossary: kinds.has("glossary") || glossaryCovered.has(cluster.id),
        lesson: kinds.has("lesson") || kinds.has("course"),
        tool: kinds.has("tool"),
        blog: kinds.has("blog"),
        // An FAQ counts when a member page actually renders questions — that
        // is what produces the FAQPage markup an AI answer can lift.
        faq: members.some((m) => (m.faqs?.length ?? 0) > 0),
      };

      const missing = CLUSTER_ROLES.filter((role) => !roles[role]);
      const completeness = (CLUSTER_ROLES.length - missing.length) / CLUSTER_ROLES.length;

      const memberPaths = new Set(members.map((m) => m.path));
      let inboundLinks = 0;
      for (const { entry, outgoing } of graph.pages.values()) {
        if (memberPaths.has(entry.path)) continue;
        for (const target of outgoing) if (memberPaths.has(target)) inboundLinks += 1;
      }

      // A cluster missing its authoritative explainer is the urgent case: it
      // cannot rank for its own topic no matter how many lessons sit under it.
      const priority: ClusterHealth["priority"] = !roles.wiki
        ? "HIGH"
        : completeness < 0.7
          ? "MEDIUM"
          : "LOW";

      return {
        id: cluster.id,
        title: cluster.title,
        size: members.length,
        roles,
        missing,
        completeness,
        inboundLinks,
        priority,
      };
    })
    .sort((a, b) => a.completeness - b.completeness || b.size - a.size);
}

// ── Opportunity score ────────────────────────────────────────────────────────

export type GapKind = "content" | "authority" | "none";

export interface OpportunityRow {
  id: string;
  label: string;
  /** The URL that would own the topic, when one exists or is reserved. */
  path?: string;
  score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  intentWeight: number;
  clusterCompleteness: number;
  internalAuthority: number;
  /** Whether the constraint is missing content or missing external authority. */
  gap: GapKind;
  reason: string;
  recommendation: string;
}

const PRIORITY_WEIGHT = { high: 1, medium: 0.6, low: 0.25 } as const;

/**
 * Ranks topics, not pages.
 *
 * A page-level ranking would put 100 lesson pages ahead of the one missing
 * explainer that would let a whole cluster rank. Topics are the unit the
 * roadmap acts on.
 */
export function opportunities(): OpportunityRow[] {
  const graph = linkGraph();
  const health = new Map(clusterHealth().map((c) => [c.id, c]));
  const corpus = [...allEntries(), ...searchTopicEntries()];
  const coverage = allCoverage(corpus);

  const rows = coverage.map((cov): OpportunityRow => {
    const { topic } = cov;
    const cluster = topic.clusterId ? health.get(topic.clusterId) : undefined;
    const clusterCompleteness = cluster?.completeness ?? 0;

    // Internal authority of the page that would own this topic, normalised
    // against the best-linked page on the site.
    const anchorLinks = cov.anchor ? (graph.pages.get(cov.anchor.path)?.incoming.length ?? 0) : 0;
    const maxIncoming = Math.max(
      ...[...graph.pages.values()].map((p) => p.incoming.length),
      1,
    );
    const internalAuthority = anchorLinks / maxIncoming;

    // The central judgement: is the constraint content or authority?
    //   - no page at all, or a reserved-but-empty one  → content gap
    //   - a good page that nothing links to            → content gap (internal)
    //   - a good, well-linked page that still is not
    //     winning the query                            → authority gap
    const gap: GapKind = !cov.anchor
      ? "content"
      : internalAuthority < 0.25
        ? "content"
        : "authority";

    const intentWeight = INTENT_WEIGHT[topic.intent];
    const priorityWeight = PRIORITY_WEIGHT[topic.priority];

    // Weighted so that a valuable intent on an incomplete cluster with no
    // anchor page scores highest. `1 - clusterCompleteness` is the headroom:
    // a finished cluster scores low precisely because there is little to do.
    const score = Math.round(
      100 *
        (0.35 * intentWeight +
          0.3 * priorityWeight +
          0.2 * (1 - clusterCompleteness) +
          0.15 * (1 - internalAuthority)),
    );

    const reason = !cov.anchor
      ? `No page owns "${topic.queries[0]}" — ${cov.matches.length} pages mention it, none targets it.`
      : gap === "content"
        ? `${cov.anchor.path} targets it but has only ${anchorLinks} incoming internal links.`
        : `${cov.anchor.path} targets it and is well linked internally; the constraint is external authority.`;

    const recommendation = !cov.anchor
      ? cov.hasPlannedPage
        ? "Publish the reserved page — it needs reviewed source material, not new routing."
        : "Decide whether a page can be written from reviewed sources; if not, leave it unowned."
      : gap === "content"
        ? "Link to it from the cluster's other pages before writing anything new."
        : "On-site work is done. This one needs citations and links from outside the site.";

    return {
      id: topic.id,
      label: topic.queries[0],
      path: cov.anchor?.path,
      score,
      priority: score >= 70 ? "HIGH" : score >= 55 ? "MEDIUM" : "LOW",
      intentWeight,
      clusterCompleteness,
      internalAuthority,
      gap,
      reason,
      recommendation,
    };
  });

  return rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/** Topics whose constraint is external authority rather than more content (§15). */
export function backlinkTargets(): OpportunityRow[] {
  return opportunities().filter((row) => row.gap === "authority");
}

/**
 * Pages that are strong enough to be worth earning links to.
 *
 * Deliberately narrow: a tool that does something exactly and for free, or an
 * explainer with real worked examples. These are what a link campaign should
 * point at — pitching a thin page wastes the outreach.
 */
export function linkWorthyAssets(): SeoEntry[] {
  return publishedEntries()
    .filter((entry) => {
      if (entry.kind === "tool") return true;
      if (entry.kind !== "wiki") return false;
      const sections = entry.body?.length ?? 0;
      const hasExamples = entry.body?.some((s) => s.heading === "Real examples") ?? false;
      return sections >= 5 && hasExamples;
    })
    .sort((a, b) => (b.body?.length ?? 0) - (a.body?.length ?? 0));
}

/** Coverage rows for the topic-map section of the report. */
export function topicCoverage(): TopicCoverage[] {
  return allCoverage([...allEntries(), ...searchTopicEntries()]);
}

export { TOPICS, clusterTitle };
export type { TopicCoverage };

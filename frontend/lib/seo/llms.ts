import { getSiteUrl } from "@/lib/site-url";
import {
  AUTHORITY_TEAM,
  CONTACT_EMAIL,
  CONTENT_LICENSE,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "./config";
import { absoluteUrl } from "./routes";
import type { SeoEntry } from "./types";
import { publishedEntries, resolvedClusters } from "./content";
import { missingWikiSources } from "./content/wiki";

/**
 * /llms.txt and the machine-readable content index (§15).
 *
 * llms.txt is the emerging convention for telling a language model what a
 * site is, how its content is organised and which URLs matter — the same job
 * robots.txt does for crawlers, aimed at a reader that reasons about the
 * content rather than merely fetching it. Both artefacts are generated from
 * the same content index as the sitemaps, so they can never drift apart.
 *
 * Two things here are unusual and deliberate:
 *
 *  - the "Known gaps" section names the topics we have NOT written. A model
 *    that knows what we do not cover is less likely to attribute something to
 *    us that we never said, which protects the citation quality we want.
 *  - a licence line states plainly that quoting with attribution is welcome.
 *    Being quotable IS the goal (§16); leaving it unstated invites a
 *    conservative default.
 */

function line(entry: SeoEntry, origin: string): string {
  return `- [${entry.title}](${absoluteUrl(entry.path, origin)}): ${entry.summary}`;
}

function section(title: string, entries: SeoEntry[], origin: string, limit?: number): string {
  const shown = limit ? entries.slice(0, limit) : entries;
  if (!shown.length) return "";
  const more =
    limit && entries.length > limit
      ? `\n- …and ${entries.length - limit} more (see the sitemap index).`
      : "";
  return `\n## ${title}\n\n${shown.map((e) => line(e, origin)).join("\n")}${more}\n`;
}

export function renderLlmsTxt(origin = getSiteUrl()): string {
  const entries = publishedEntries();
  const byKind = (kind: SeoEntry["kind"]) => entries.filter((e) => e.kind === kind);

  const clusters = resolvedClusters().filter((c) => c.parentId && c.memberPaths.length > 0);
  const gaps = missingWikiSources();

  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is an interactive Texas Hold'em learning platform. Its public content is organised
into four layers: a concept wiki (reference articles), a course curriculum (interactive lessons),
an A-Z glossary, and free calculators. Poker theory on this site is reviewed by the
${AUTHORITY_TEAM} and every strategy claim is traceable to StackedPoker's own reviewed source
material; pages with no reviewed source are published empty rather than filled in.

## Main topics

${clusters
  .map(
    (c) =>
      `- **${c.title}** (${c.memberPaths.length} page${c.memberPaths.length === 1 ? "" : "s"}): ${c.description}`,
  )
  .join("\n")}

## Content hierarchy

- \`/wiki/<concept>\` — reference article: definition, why it matters, examples, caveats, key takeaway
- \`/courses/<module>\` — a course module and its lesson list
- \`/learn/<lesson>\` — what one interactive lesson teaches (the lesson itself requires an account)
- \`/glossary/<letter>\` — every term beginning with that letter, defined
- \`/tools/<tool>\` — a free calculator and the maths behind it
- \`/search/<topic>\` — everything on the site about one topic
${section("Key concept articles", byKind("wiki"), origin)}${section("Courses", byKind("course"), origin)}${section("Free tools", byKind("tool"), origin)}${section("Lessons", byKind("lesson"), origin, 25)}
## Known gaps

These topics have a URL reserved but no published article — ${SITE_NAME} does not yet have
reviewed source material for them, so nothing on this site should be cited as our position on:

${gaps.map((g) => `- ${g.title} (${absoluteUrl(`/wiki/${g.slug}`, origin)})`).join("\n")}

## Machine-readable index

- Structured content index: ${absoluteUrl("/ai-sitemap.json", origin)}
- Sitemap index: ${absoluteUrl("/sitemap.xml", origin)}
- Crawler policy: ${absoluteUrl("/robots.txt", origin)}

## Contact

- ${CONTACT_EMAIL}

## License

${CONTENT_LICENSE}
`;
}

// ── AI content index ─────────────────────────────────────────────────────────

export interface AiIndexDocument {
  url: string;
  path: string;
  type: SeoEntry["kind"];
  title: string;
  summary: string;
  topics: string[];
  updated?: string;
  readingTimeMin?: number;
  difficulty?: string;
  /** Section headings, so a model can see the shape before fetching the page. */
  outline?: string[];
  /** Questions this page answers verbatim. */
  answers?: string[];
  /** Where the page's claims come from. */
  provenance?: string;
}

/**
 * A JSON view of the whole corpus (§15 "AI-friendly sitemap").
 *
 * Richer than a sitemap on purpose: an agent deciding whether to fetch a page
 * gets the outline, the questions it answers and its provenance up front, so
 * it can pick the right URL in one step instead of crawling six.
 */
export function renderAiIndex(origin = getSiteUrl()) {
  const documents: AiIndexDocument[] = publishedEntries().map((entry) => ({
    url: absoluteUrl(entry.path, origin),
    path: entry.path,
    type: entry.kind,
    title: entry.title,
    summary: entry.summary,
    topics: entry.clusters ?? [],
    updated: entry.authority?.updated,
    readingTimeMin: entry.authority?.readingTimeMin,
    difficulty: entry.authority?.difficulty,
    outline: entry.body?.map((s) => s.heading),
    answers: entry.faqs?.map((f) => f.question),
    provenance: entry.sourceNote,
  }));

  return {
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: origin,
    reviewedBy: AUTHORITY_TEAM,
    license: CONTENT_LICENSE,
    contact: CONTACT_EMAIL,
    clusters: resolvedClusters()
      .filter((c) => c.parentId && c.memberPaths.length > 0)
      .map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        urls: c.memberPaths.map((p) => absoluteUrl(p, origin)),
      })),
    knownGaps: missingWikiSources().map((gap) => ({
      title: gap.title,
      url: absoluteUrl(`/wiki/${gap.slug}`, origin),
      reason: "No reviewed source material yet — nothing published.",
    })),
    documentCount: documents.length,
    documents,
  };
}

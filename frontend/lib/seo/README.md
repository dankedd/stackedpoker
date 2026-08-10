# SEO / GEO system

Everything that decides how StackedPoker appears in Google and in AI answers
lives here. The design goal is that **adding content is a content change, not
an engineering change**.

## The one rule

Every indexable URL is a `SeoEntry` (see `types.ts`). Sitemaps, `llms.txt`,
`ai-sitemap.json`, internal search, related-links and metadata all read from
`content/index.ts` — none of them keep their own list. Add an entry and all of
them pick it up.

## Adding content

| To add… | Edit | You get, automatically |
| --- | --- | --- |
| a lesson or module | `lib/learn/curriculum.ts`, then `npm run generate:curriculum-public` | public page, metadata, OG image, Course/LearningResource JSON-LD, sitemap row, breadcrumbs, related links, search |
| a wiki article | `lib/theory/concepts.json` + one row in `content/wiki.ts` | the full article page from the registry's own text |
| a glossary term | `lib/theory/concepts.json` or `lib/theory/puzzleTags.ts` | the term on its letter page, with DefinedTerm markup |
| a blog post | append to `POSTS` in `content/blog.ts` | post page, Article JSON-LD, index row, sitemap row |
| a tool | append to `TOOLS` in `content/tools.ts` | landing page, SoftwareApplication JSON-LD, sitemap row |
| a topic cluster | `content/clusters.ts` | cluster listing, `/search/<id>` page, llms.txt section |

No route, sitemap or metadata file needs touching for any of these.

## `published` vs `planned`

`planned` is the honesty switch. A `planned` entry routes and renders, but:

- shows an explicit "not published yet" notice,
- is `noindex, follow`,
- is excluded from every sitemap, from `llms.txt` and from related links.

This exists because StackedPoker does not invent poker theory to fill a page
(see `CLAUDE.md`). A concept with no reviewed source stays `planned`, and
`missingWikiSources()` reports the gap. Promoting content is a one-word change.

## Where the poker content comes from

Public pages only ever quote material that already exists in the repository:

- `lib/theory/concepts.json` — 19 concepts, each with beginner/intermediate/
  advanced explanations, formulas and worked examples. This is what the wiki
  renders.
- `lib/theory/puzzleTags.ts` — 50 one-sentence definitions. Glossary terms,
  "Common mistakes" and "Where it shows up" sections.
- `lib/theory/math.ts` — every number in the tool pages is *computed* by these
  functions at build time, never typed in.
- `lib/learn/curriculumPublic.generated.ts` — lesson titles/objectives only.
  **Never import `lib/learn/curriculum.ts` from a public page**: it embeds
  every step's answer key.

## Public vs private URLs

`routes.ts` → `isPublicSeoPath()` is the single source of truth, imported by
both `middleware.ts` and `app/robots.ts`. It is what allows
`/learn/<lesson-slug>` to be crawlable while `/learn`, `/learn/lesson/*` and
`/learn/module/*` stay behind auth. Change the split there, not in two places.

## Build-time validation

`npm run build` runs `npm run seo:validate` first (npm's `prebuild` hook), and
a failure stops the build. The checks run against the real generated output —
the same `entryMetadata` the pages call, the same `structuredDataFor` they
render, the same sitemap XML that ships:

| Check | Fails when |
| --- | --- |
| canonical | a page has no canonical, a relative one, one pointing elsewhere, two pages claiming the same URL, or a robots directive that disagrees with its `status` |
| open-graph | a page has no title/description/og:title/og:url/twitter:card, falls back to the generic site description, or no `opengraph-image` file cascades to its route |
| structured-data | a node is missing a required property, a required node type is absent, a page renders FAQs without FAQPage markup, an `@id` is duplicated, or a URL is relative |
| sitemap | a planned page, a redirect source or a duplicate URL is in a sitemap, or a `lastmod` is not an ISO date |
| orphan | an indexable page has zero incoming internal links, or fewer than `MIN_OUTGOING_LINKS` outgoing ones |

Run them on their own with `npm run seo:validate`.

## Developer reports

`npm run seo:report` prints, to stdout only:

- **content completeness** — published pages by type, every planned page, and
  the high-priority topics still missing a reviewed source;
- **internal linking** — incoming/outgoing links per page, related counts,
  cluster sizes, inbound/outbound links per cluster, isolated-cluster
  detection, and the fifteen least-linked pages;
- **validation** — the same output as the build gate.

These are CLI-only on purpose. A gated page is still a page; a script cannot
be crawled, cached or leaked. `lib/seo/__tests__/report.test.ts` asserts that
no route imports the report or validator modules.

## The link graph

`graph.ts` models the links the site actually renders — global nav and both
footers (from `navigation.ts`, which the components themselves read),
breadcrumb ancestors, the related strip, hub listings, and in-body lists
(course → lessons, glossary letter → terms, topic page → results). If a
component stops rendering a link this file still counts, the orphan report
becomes fiction, so the components and the graph read the same sources.

## Files

```
config.ts       brand, authority, OG dimensions, licence
routes.ts       canonical paths + the public/private split
types.ts        SeoEntry and friends
metadata.ts     buildMetadata / entryMetadata  — every page's <head>
jsonld.ts       structured-data builders + validateJsonLd
sitemap.ts      sitemap index + per-section XML
llms.ts         /llms.txt and /ai-sitemap.json
related.ts      related-content ranking + breadcrumb derivation
structuredData.ts  the JSON-LD every page emits (and the validator checks)
graph.ts        internal-link graph, orphan detection, cluster scoring
validate.ts     the build-gate checks
report.ts       developer report rendering
navigation.ts   nav/footer links — one source for components and the graph
redirects.ts    SEO redirects, shared with next.config.ts
ogAssets.ts     resolves which opengraph-image serves a route (node-only)
reading.ts      derived reading time
analytics.ts    GA4 event names and helpers
og.tsx          shared Open Graph image renderer
content/        the registries (the only files with content in them)
```

## Tests

`lib/seo/__tests__` runs against the real corpus, not fixtures. It asserts
unique titles/descriptions, valid JSON-LD on every generated page, that no
`planned` URL reaches a sitemap, that lesson step content never leaks into a
public entry, and that internal links resolve. If a new lesson collides with a
wiki article's title, the suite fails — not Search Console.

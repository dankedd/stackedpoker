import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SearchBox } from "@/components/seo/SearchBox";
import { SignupCta } from "@/components/seo/SignupCta";
import { resolvedClusters } from "@/lib/seo/content";
import { corpusSize, searchTopics } from "@/lib/seo/content/search";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { ROUTES, searchPath, toSlug } from "@/lib/seo/routes";

/**
 * The topics hub (§7, §8).
 *
 * Also the landing point for the WebSite SearchAction (`/search?q=…`): a
 * `?q=` request is redirected to the canonical `/search/<slug>` topic URL, so
 * search-box traffic and organic traffic converge on the same indexable page
 * instead of creating a parallel, parameterised duplicate of it.
 *
 * Reading `searchParams` makes this the one dynamically-rendered SEO page.
 * That is the deliberate trade: the alternative (a static hub that ignores
 * `?q=`) would leave the SearchAction pointing at a URL that does nothing.
 * Every other content route below is static or ISR (§19).
 */

const entry = staticPageEntry(ROUTES.search)!;

export const metadata: Metadata = entryMetadata(entry);

export default async function SearchHubPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  if (q?.trim()) redirect(searchPath(toSlug(q)));

  const topics = searchTopics();
  const clusters = resolvedClusters().filter(
    (c) => c.parentId && c.memberPaths.length > 0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Browse
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Search Poker Topics
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {corpusSize()} pages across the wiki, the curriculum, the glossary and the free tools —
            searchable in one place.
          </p>
        </header>

        <div className="mt-6 max-w-2xl">
          <SearchBox />
        </div>

        <section aria-labelledby="clusters-heading" className="mt-12">
          <h2 id="clusters-heading" className="text-lg font-semibold tracking-tight text-foreground">
            By subject
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {clusters.map((cluster) => (
              <li key={cluster.id}>
                <Link
                  href={searchPath(cluster.id)}
                  className="flex h-full flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-medium text-foreground">{cluster.title}</span>
                  <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {cluster.description}
                  </span>
                  <span className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    {cluster.memberPaths.length} pages
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="topics-heading" className="mt-12">
          <h2 id="topics-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Popular topics
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li key={topic.slug}>
                <Link
                  href={searchPath(topic.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {topic.query}
                  <span className="text-[10px] text-muted-foreground/60">{topic.resultCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <SignupCta context={{ contentKind: "page", contentSlug: "search" }} />
      </main>

      <Footer />
    </div>
  );
}

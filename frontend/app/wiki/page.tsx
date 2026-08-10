import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignupCta } from "@/components/seo/SignupCta";
import { publishedWikiEntries, wikiEntries } from "@/lib/seo/content/wiki";
import { publishedLessons } from "@/lib/seo/content/lessons";
import { TOPIC_CLUSTERS } from "@/lib/seo/content/clusters";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { ROUTES } from "@/lib/seo/routes";

/**
 * The wiki index (§5).
 *
 * Grouped by topic cluster rather than shown as one long alphabetical list:
 * the grouping IS the internal-linking structure from §7, and it gives a
 * crawler (and a reader) the shape of the subject instead of 19 equal links.
 */
export const revalidate = 86400;

const entry = staticPageEntry(ROUTES.wiki)!;

export const metadata: Metadata = entryMetadata(entry);

export default function WikiIndexPage() {
  const published = publishedWikiEntries();
  const planned = wikiEntries().filter((e) => e.status === "planned");

  const grouped = TOPIC_CLUSTERS.filter((c) => c.id !== "poker-strategy" && c.id !== "glossary")
    .map((cluster) => ({
      cluster,
      articles: published.filter((a) => a.clusters?.includes(cluster.id)),
    }))
    .filter((group) => group.articles.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Reference
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            The Poker Wiki
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {published.length} plain-English articles on the concepts that actually decide poker
            hands. Each one gives you the definition, why it matters, worked examples and the
            StackedPoker lessons that drill it.
          </p>
        </header>

        <div className="mt-12 space-y-12">
          {grouped.map(({ cluster, articles }) => (
            <section key={cluster.id} aria-labelledby={`cluster-${cluster.id}`}>
              <h2
                id={`cluster-${cluster.id}`}
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {cluster.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{cluster.description}</p>

              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {articles.map((articleEntry) => (
                  <li key={articleEntry.path}>
                    <Link
                      href={articleEntry.path}
                      className="flex h-full flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {articleEntry.title}
                      </span>
                      <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {articleEntry.summary}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {planned.length > 0 && (
          <section aria-labelledby="planned-heading" className="mt-14">
            <h2 id="planned-heading" className="text-lg font-semibold tracking-tight text-foreground">
              Being written
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These concepts have a place in the wiki but no reviewed article yet. We publish poker
              theory only when it is traceable to a source, so they stay empty until then.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {planned.map((plannedEntry) => (
                <li key={plannedEntry.path}>
                  <Link
                    href={plannedEntry.path}
                    className="inline-flex rounded-full border border-border/60 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {plannedEntry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <SignupCta
          context={{ contentKind: "page", contentSlug: "wiki" }}
          heading="Turn reading into results"
          body={`The wiki explains the concept. The lessons make you use it — ${publishedLessons().length} interactive lessons across the StackedPoker curriculum, free to start.`}
        />
      </main>

      <Footer />
    </div>
  );
}

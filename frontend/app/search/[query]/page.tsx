import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SearchBox } from "@/components/seo/SearchBox";
import { SearchResultsBeacon } from "@/components/seo/SearchResultsBeacon";
import { SignupCta } from "@/components/seo/SignupCta";
import { searchEntries } from "@/lib/seo/content";
import {
  queryFromSlug,
  searchEntryForSlug,
  searchTopicBySlug,
  searchTopics,
} from "@/lib/seo/content/search";
import { entryMetadata } from "@/lib/seo/metadata";
import { structuredDataFor } from "@/lib/seo/structuredData";
import { ROUTES } from "@/lib/seo/routes";

/**
 * An indexable topic page (§8).
 *
 * Curated topics (enough results to be worth a URL) are statically generated
 * and indexable. Any other slug still renders — people and crawlers follow
 * odd URLs — but is `noindex`, because an indexable results page with two
 * hits is exactly the thin-content pattern search engines penalise across a
 * whole domain.
 */
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return searchTopics().map((topic) => ({ query: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ query: string }>;
}): Promise<Metadata> {
  const { query } = await params;
  // Curated or not, the entry drives the metadata — an uncurated slug gets a
  // `planned` entry, and `planned` already means noindex everywhere else.
  return entryMetadata(searchEntryForSlug(query));
}

export default async function SearchTopicPage({
  params,
}: {
  params: Promise<{ query: string }>;
}) {
  const { query } = await params;
  const entry = searchEntryForSlug(query);
  const topic = searchTopicBySlug(query);
  const term = queryFromSlug(query);
  const results = searchEntries(term, 40);
  const label = term.charAt(0).toUpperCase() + term.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <SearchResultsBeacon query={term} resultCount={results.length} curated={Boolean(topic)} />
      <JsonLd
        data={structuredDataFor(entry, { listEntries: results.map((r) => r.entry) })}
      />

      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Topic
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            {label} in poker
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {results.length === 0
              ? `Nothing on StackedPoker matches "${term}" yet.`
              : `${results.length} StackedPoker resources on ${term.toLowerCase()} — concept articles, interactive lessons, glossary terms and free tools.`}
          </p>
        </header>

        <div className="mt-6">
          <SearchBox />
        </div>

        {results.length > 0 ? (
          <ul className="mt-10 space-y-3">
            {results.map(({ entry }) => (
              <li key={entry.path}>
                <Link
                  href={entry.path}
                  className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-violet-400/80">
                    {entry.kind}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground">
                    {entry.title}
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                    {entry.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 rounded-xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
            Try one of the topics on the{" "}
            <Link href={ROUTES.search} className="text-violet-400 underline-offset-4 hover:underline">
              topics index
            </Link>
            , or browse the{" "}
            <Link href={ROUTES.wiki} className="text-violet-400 underline-offset-4 hover:underline">
              Poker Wiki
            </Link>
            .
          </p>
        )}

        <SignupCta context={{ contentKind: "search", contentSlug: query }} />
      </main>

      <Footer />
    </div>
  );
}

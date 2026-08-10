import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignupCta } from "@/components/seo/SignupCta";
import { blogEntries } from "@/lib/seo/content/blog";
import { publishedWikiEntries } from "@/lib/seo/content/wiki";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { ROUTES } from "@/lib/seo/routes";

/**
 * The blog index (§2).
 *
 * The post registry ships empty on purpose — see lib/seo/content/blog.ts. An
 * index with nothing on it would normally be a soft-404, so when there are no
 * posts this page redirects attention (and link equity) to the wiki instead
 * of leaving a dead end, and marks itself noindex.
 */
export const revalidate = 86400;

const entry = staticPageEntry(ROUTES.blog)!;

export const metadata: Metadata = entryMetadata(entry);

export default function BlogIndexPage() {
  const posts = blogEntries();
  const wiki = publishedWikiEntries().slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Writing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Poker Strategy Blog
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Longer-form strategy writing from the StackedPoker Theory Team.
          </p>
        </header>

        {posts.length === 0 ? (
          <section aria-labelledby="no-posts" className="mt-10">
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <h2 id="no-posts" className="text-base font-semibold text-foreground">
                No posts published yet
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We would rather have nothing here than filler. Everything StackedPoker publishes has
                to be traceable to reviewed source material, and the first posts are still in
                review. In the meantime, the Poker Wiki has the concepts written up in full.
              </p>
            </div>

            <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground">
              Start with these instead
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {wiki.map((article) => (
                <li key={article.path}>
                  <Link
                    href={article.path}
                    className="flex h-full flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-medium text-foreground">{article.title}</span>
                    <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {article.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <ul className="mt-10 space-y-3">
            {posts.map((post) => (
              <li key={post.path}>
                <Link
                  href={post.path}
                  className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-sm font-semibold text-foreground">{post.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {post.summary}
                  </span>
                  {post.authority && (
                    <time
                      dateTime={post.authority.updated}
                      className="mt-2 block text-[11px] uppercase tracking-wide text-muted-foreground/70"
                    >
                      {post.authority.updated} · {post.authority.readingTimeMin} min read
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <SignupCta context={{ contentKind: "page", contentSlug: "blog" }} />
      </main>

      <Footer />
    </div>
  );
}

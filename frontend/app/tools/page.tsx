import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignupCta } from "@/components/seo/SignupCta";
import { toolEntries } from "@/lib/seo/content/tools";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { ROUTES } from "@/lib/seo/routes";

export const revalidate = 86400;

const entry = staticPageEntry(ROUTES.tools)!;

export const metadata: Metadata = entryMetadata(entry);

export default function ToolsIndexPage() {
  const all = toolEntries();
  // Planned tools are not listed: their pages redirect to a working page
  // (PLANNED_TOOL_REDIRECT in lib/seo/navigation.ts) until they ship.
  const live = all.filter((t) => t.status === "published");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            Free, no account
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Free Poker Tools
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Calculators and references built on the same maths as the StackedPoker curriculum —
            pot odds, outs, expected value and the vocabulary that ties them together.
          </p>
        </header>

        <section aria-labelledby="live-tools" className="mt-12">
          <h2 id="live-tools" className="text-lg font-semibold tracking-tight text-foreground">
            Available now
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {live.map((tool) => (
              <li key={tool.path}>
                <Link
                  href={tool.path}
                  className="flex h-full flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-medium text-foreground">{tool.title}</span>
                  <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {tool.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <SignupCta
          context={{ contentKind: "page", contentSlug: "tools" }}
          heading="Tools tell you the number. Lessons teach you the decision."
          body="StackedPoker puts you in the spot, makes you choose, then shows you the reasoning. Free to start."
        />
      </main>

      <Footer />
    </div>
  );
}

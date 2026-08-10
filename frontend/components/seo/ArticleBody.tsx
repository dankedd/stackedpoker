import type { ArticleSection } from "@/lib/seo/types";

/**
 * Renders the GEO article structure (§16).
 *
 * Every section is a `<section>` with an `<h2>` — never a bare `<div>` and
 * never a skipped heading level (§22). Short blocks with descriptive
 * headings are what both a screen-reader user navigating by heading and a
 * generative engine chunking the page for retrieval need; a wall of text
 * serves neither.
 *
 * Headings get deterministic ids so the table of contents, in-page anchors
 * and any future "jump to answer" deep links all agree.
 */
export function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ArticleBody({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="space-y-9">
      {sections.map((section) => (
        <section key={section.heading} aria-labelledby={sectionId(section.heading)}>
          <h2
            id={sectionId(section.heading)}
            className="scroll-mt-24 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {section.heading}
          </h2>

          {section.paragraphs?.map((paragraph, index) => (
            <p key={index} className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}

          {section.formula && (
            <p className="mt-4 overflow-x-auto rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 font-mono text-sm text-violet-200">
              {section.formula}
            </p>
          )}

          {section.bullets && section.bullets.length > 0 && (
            <ul className="mt-3 space-y-2">
              {section.bullets.map((bullet, index) => (
                <li
                  key={index}
                  className="flex gap-2.5 text-[15px] leading-relaxed text-muted-foreground"
                >
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {section.definitions && section.definitions.length > 0 && (
            // A description list, not a table: these are term/definition
            // pairs, and <dl> is both the correct semantic and the structure
            // LLM retrieval extracts most reliably.
            <dl className="mt-4 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card/40">
              {section.definitions.map((definition) => (
                <div key={definition.term} className="px-4 py-3">
                  <dt className="text-sm font-medium text-foreground">{definition.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {definition.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}

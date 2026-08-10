import { faqPage } from "@/lib/seo/jsonld";
import type { FaqItem } from "@/lib/seo/types";
import { JsonLd } from "./JsonLd";

/**
 * The single FAQ component used on every educational page (§10).
 *
 * Renders the questions as real HTML *and* as FAQPage JSON-LD from the same
 * array — never one without the other. Both matter for different readers:
 * Google needs the markup to consider the rich result, and generative
 * engines lift the visible question/answer pairs, which is the highest-value
 * pattern in GEO because the answer arrives pre-chunked.
 *
 * Native `<details>` rather than JS state: collapsed answers stay in the DOM
 * for crawlers, keyboard support and screen-reader semantics come free, and
 * the component stays a Server Component with zero client JavaScript.
 */
export function FaqSection({
  faqs,
  heading = "Frequently asked questions",
  path,
  emitJsonLd = true,
}: {
  faqs: FaqItem[];
  heading?: string;
  /** Canonical path, used to give the FAQPage node a stable @id. */
  path?: string;
  /**
   * Set false when another FAQ block on the same page already emits the
   * markup — two FAQPage nodes on one URL is an invalid-structured-data
   * warning.
   */
  emitJsonLd?: boolean;
}) {
  if (!faqs.length) return null;

  return (
    <section aria-labelledby="faq-heading" className="mt-12">
      {emitJsonLd && <JsonLd data={faqPage(faqs, undefined, path)} />}

      <h2 id="faq-heading" className="text-xl font-semibold tracking-tight text-foreground">
        {heading}
      </h2>

      <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <h3 className="text-sm font-medium">{faq.question}</h3>
              <span
                aria-hidden="true"
                className="shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

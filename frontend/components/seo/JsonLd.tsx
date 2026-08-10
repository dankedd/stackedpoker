import { assertValidJsonLd, serializeJsonLd, type JsonLdNode } from "@/lib/seo/jsonld";

/**
 * Renders one or more JSON-LD nodes into the document (§3).
 *
 * Server-only by design — structured data must be present in the initial
 * HTML, because most crawlers (and every LLM fetcher) read the raw response
 * rather than a hydrated DOM.
 *
 * In development an invalid node throws instead of rendering. A malformed
 * `@type` or a missing required property is silent in production and can sit
 * broken for months, so the failure is made loud at the only point where
 * somebody is looking at it.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const nodes = Array.isArray(data) ? data : [data];

  if (process.env.NODE_ENV !== "production") {
    nodes.forEach(assertValidJsonLd);
  }

  return (
    <>
      {nodes.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          // The payload is built by lib/seo/jsonld.ts from our own content
          // registries and escaped by serializeJsonLd, which neutralises "<"
          // so a description can never close the <script> element early.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
    </>
  );
}

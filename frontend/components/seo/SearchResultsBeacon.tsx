"use client";

import { useEffect, useRef } from "react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";

/**
 * Reports which topic pages were viewed and how many results they returned (§21).
 *
 * Renders nothing. Pairing the query with its result count is what makes the
 * data actionable: a topic people land on repeatedly that returns four thin
 * results is the clearest possible signal of what to write next.
 */
export function SearchResultsBeacon({
  query,
  resultCount,
  curated,
}: {
  query: string;
  resultCount: number;
  /** Whether this topic has its own indexable landing page. */
  curated: boolean;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent(SEO_EVENTS.searchResultsView, {
      search_term: query.toLowerCase(),
      result_count: resultCount,
      curated_topic: curated,
    });
  }, [query, resultCount, curated]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import {
  SCROLL_DEPTH_THRESHOLDS,
  SEO_EVENTS,
  contentParams,
  trackEvent,
  type ContentContext,
} from "@/lib/seo/analytics";

/**
 * Reports how far readers get through a content page (§21).
 *
 * Renders nothing. Each threshold fires at most once per mount, and the
 * scroll handler is passive + rAF-throttled so measuring engagement never
 * becomes the reason a page feels slow (§19).
 */
export function ScrollDepthTracker({ context }: { context: ContentContext }) {
  const fired = useRef<Set<number>>(new Set());
  // Depend on the primitives, not the object: `context` is a fresh literal on
  // every render of the parent, so using it directly would tear down and
  // re-arm the listener (and re-fire the 25% event) on each one.
  const { contentKind, contentSlug, cluster } = context;

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // A page shorter than the viewport is 100% read the moment it loads;
      // reporting 25/50/75 for it would inflate every engagement average.
      const percent = scrollable <= 0 ? 100 : ((window.scrollY / scrollable) * 100);

      for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
        if (percent + 0.5 >= threshold && !fired.current.has(threshold)) {
          fired.current.add(threshold);
          trackEvent(SEO_EVENTS.scrollDepth, {
            ...contentParams({ contentKind, contentSlug, cluster }),
            percent_scrolled: threshold,
          });
        }
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [contentKind, contentSlug, cluster]);

  return null;
}

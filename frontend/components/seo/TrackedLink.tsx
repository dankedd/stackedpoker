"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SEO_EVENTS, contentParams, trackEvent, type ContentContext } from "@/lib/seo/analytics";

/**
 * An internal link that reports the click to GA4 (§21).
 *
 * The one client component in the SEO surface, and it stays this small on
 * purpose: it renders a plain `next/link`, so the anchor is in the server
 * HTML with a real href — a crawler follows it whether or not the JavaScript
 * ever runs.
 */
export function TrackedLink({
  href,
  children,
  context,
  label,
  event = "internal",
  className,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  context: ContentContext;
  /** Distinguishes placements, e.g. "hero-cta" vs "footer-cta". */
  label: string;
  /** "cta" reports a conversion-intent click; "internal" a navigation click. */
  event?: "cta" | "internal";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={() =>
        trackEvent(
          event === "cta" ? SEO_EVENTS.contentCtaClick : SEO_EVENTS.internalLinkClick,
          { ...contentParams(context), link_label: label, link_target: href },
        )
      }
    >
      {children}
    </Link>
  );
}

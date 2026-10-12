"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useConsent } from "./useConsent";

// StackedPoker's GA4 property. Not secret — a Measurement ID is meant to be
// public (it ends up in the rendered page source for every visitor
// regardless), so there's no need to route it through an env var the way
// NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_API_URL are.
const GA_MEASUREMENT_ID = "G-73F5D7609C";

type Gtag = (...args: unknown[]) => void;

/**
 * Google Analytics 4, loaded the official Next.js way (two next/script tags,
 * never a raw <script> injected into the page). Rendered once from the root
 * layout (see app/layout.tsx) so every route gets it — nothing else in the
 * app should import GoogleAnalytics or touch gtag directly.
 *
 * Behind the same cookie consent as the Meta Pixel (ConsentBanner,
 * sp_consent): without "granted" there is no script tag and no request to
 * Google. Accepting loads it and the config call sends the current page view.
 * Declining sets GA's own opt-out flag, so a page that already loaded GA
 * stops sending at once; the next page load does not load it at all.
 *
 * Gated to production so local development never reports pageviews.
 */
export function GoogleAnalytics() {
  const consent = useConsent();
  const granted = consent === "granted";
  const loaded = useRef(false);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown> & { gtag?: Gtag };
    w[`ga-disable-${GA_MEASUREMENT_ID}`] = !granted;
    if (!granted) return;
    // Accepted again after declining on a page where GA already loaded: the
    // scripts will not run twice, so send this page's view by hand. (The
    // first accept is covered by the config call.)
    if (loaded.current) w.gtag?.("event", "page_view");
    loaded.current = true;
  }, [granted]);

  if (process.env.NODE_ENV !== "production" || !granted) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        // The library itself waits for the page to finish loading so it never
        // competes with the LCP render (it cost ~0.8s of main thread on mobile).
        // The tiny stub below still runs early: pageviews and events queue in
        // dataLayer and are sent as soon as the library arrives.
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}

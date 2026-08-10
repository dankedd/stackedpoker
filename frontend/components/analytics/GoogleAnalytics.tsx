import Script from "next/script";

// StackedPoker's GA4 property. Not secret — a Measurement ID is meant to be
// public (it ends up in the rendered page source for every visitor
// regardless), so there's no need to route it through an env var the way
// NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_API_URL are.
const GA_MEASUREMENT_ID = "G-6X2VJBQDCG";

/**
 * Google Analytics 4, loaded the official Next.js way (two next/script tags,
 * never a raw <script> injected into the page). Rendered once from the root
 * layout (see app/layout.tsx) so every route gets it — nothing else in the
 * app should import GoogleAnalytics or touch gtag directly.
 *
 * Gates itself to production so local development never reports pageviews:
 * `strategy="afterInteractive"` still means the script downloads and runs
 * during hydration, not on the initial static request, matching this
 * codebase's existing `process.env.NODE_ENV === "production"` convention
 * (see e.g. lib/site-url.ts) rather than introducing a second on/off switch.
 */
export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
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

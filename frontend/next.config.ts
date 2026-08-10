import type { NextConfig } from "next";

// Strip any accidental /api suffix so the rewrite never doubles it:
// "https://app.railway.app"      → "https://app.railway.app/api/:path*"  ✅
// "https://app.railway.app/api"  → "https://app.railway.app/api/:path*"  ✅
const backendBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

// ── Security headers ─────────────────────────────────────────────────────────
// Applied to every response. In production these are the primary defence layer;
// the FastAPI backend also sets its own headers for direct API calls.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block the page from being framed (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Legacy XSS filter (defence-in-depth for old browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Only send full Referer to same origin; send just the origin to cross-origin HTTPS
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app doesn't use
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=()",
  },
  // HSTS — tells browsers to always use HTTPS for the next 2 years.
  // Only meaningful in production (Next.js dev runs on HTTP).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content-Security-Policy
  // Allows:
  //   - Scripts: same origin + nonces (Next.js inlines small scripts) + GA4's gtag.js
  //   - Styles:  same origin + 'unsafe-inline' (Tailwind requires this)
  //   - Images:  same origin + data URIs (base64 screenshots) + Supabase storage
  //   - Fonts:   same origin
  //   - Connect: same origin + Supabase + backend API (localhost in dev) + GA4's collect beacon
  //   - Frames:  none (DENY)
  //   - Objects: none (no Flash/plugins)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its inline runtime scripts in dev;
      // in production it uses nonces — but we keep unsafe-inline here as a
      // safe default until nonce injection is wired in.
      // googletagmanager.com is GA4's gtag.js loader (see
      // components/analytics/GoogleAnalytics.tsx) — without it explicitly
      // allowed here, the browser silently blocks the script entirely (the
      // <script> tag still renders in the HTML, so this looked "installed"
      // from a plain curl/view-source check, but nothing ever actually loads
      // or reports data).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      // data: for base64 screenshots; blob: for canvas exports; GA4's
      // fallback beacon can fire as an image pixel on very old browsers.
      `img-src 'self' data: blob: https://www.googletagmanager.com https://www.google-analytics.com ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
      "font-src 'self'",
      // Backend API (dev: localhost, prod: same origin via rewrite) + Supabase
      // + GA4's own collect endpoints (www.google-analytics.com and its
      // regional subdomains, e.g. region1.google-analytics.com — gtag.js
      // picks one at runtime, so the wildcard covers all of them) + gtag.js's
      // own config fetches back to googletagmanager.com.
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"} https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Block mixed content
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },

  // stackedpokerai.com is the ONLY canonical production hostname.
  // www → apex is NOT handled here — it's owned by Vercel's own Domains
  // config (Project → Settings → Domains), which intercepts at the edge
  // before the app is reached. Adding a second www→apex rule here created
  // an infinite redirect loop (Vercel apex→www, then this rule www→apex).
  // Only the *.vercel.app production alias is redirected in code, since
  // Vercel has no dashboard toggle for that. Preview deployment URLs
  // (random-hash.vercel.app) are untouched — Vercel's own infrastructure
  // still needs those to work.
  async redirects() {
    const vercelProductionHosts = [
      "stackedpoker.vercel.app",
      "stacked-poker.vercel.app",
    ];
    return vercelProductionHosts.map((value) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value }],
      destination: "https://stackedpokerai.com/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;

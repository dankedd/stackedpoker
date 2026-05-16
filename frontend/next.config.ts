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
  //   - Scripts: same origin + nonces (Next.js inlines small scripts)
  //   - Styles:  same origin + 'unsafe-inline' (Tailwind requires this)
  //   - Images:  same origin + data URIs (base64 screenshots) + Supabase storage
  //   - Fonts:   same origin
  //   - Connect: same origin + Supabase + backend API (localhost in dev)
  //   - Frames:  none (DENY)
  //   - Objects: none (no Flash/plugins)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its inline runtime scripts in dev;
      // in production it uses nonces — but we keep unsafe-inline here as a
      // safe default until nonce injection is wired in.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // data: for base64 screenshots; blob: for canvas exports
      `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
      "font-src 'self'",
      // Backend API (dev: localhost, prod: same origin via rewrite) + Supabase
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}`,
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
};

export default nextConfig;

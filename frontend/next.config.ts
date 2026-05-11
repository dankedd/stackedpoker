import type { NextConfig } from "next";

// Strip any accidental /api suffix so the rewrite never doubles it:
// "https://app.railway.app"      → "https://app.railway.app/api/:path*"  ✅
// "https://app.railway.app/api"  → "https://app.railway.app/api/:path*"  ✅
const backendBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
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

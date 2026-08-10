import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LearnProgressProvider } from "@/contexts/LearnProgressContext";
import { Toaster } from "sonner";
import { getSiteUrl } from "@/lib/site-url";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/config";
import { organization, softwareApplication, webSite } from "@/lib/seo/jsonld";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/**
 * Root metadata (§1).
 *
 * Built through lib/seo/metadata.ts like every other route, so the homepage
 * gets the same canonical/robots/OG/Twitter treatment as generated content
 * instead of a second, hand-maintained shape. `title.template` gives every
 * descendant route that sets a bare string title the brand suffix for free.
 */
export const metadata: Metadata = {
  // Without this, Next.js falls back to Vercel's VERCEL_URL env var for
  // resolving relative OG images/canonical links — which is always the
  // *.vercel.app deployment URL, not the custom domain. Setting it
  // explicitly keeps every canonical/OG URL pinned to stackedpokerai.com.
  metadataBase: new URL(getSiteUrl()),
  ...buildMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    path: "/",
    keywords: [
      "poker",
      "poker strategy",
      "learn poker",
      "poker course",
      "poker training",
      "GTO poker",
      "poker ranges",
      "StackedPoker",
    ],
  }),
  applicationName: SITE_NAME,
  category: "education",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        {/* Site-level structured data (§3). Emitted once from the root layout
            so every URL — not just the homepage — carries the Organization,
            WebSite and SoftwareApplication nodes that page-level nodes
            reference by @id. */}
        <JsonLd data={[organization(), webSite(), softwareApplication()]} />
        <AuthProvider>
          <LearnProgressProvider>
            {children}
          </LearnProgressProvider>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}

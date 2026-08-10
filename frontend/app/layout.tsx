import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LearnProgressProvider } from "@/contexts/LearnProgressContext";
import { Toaster } from "sonner";
import { getSiteUrl } from "@/lib/site-url";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Without this, Next.js falls back to Vercel's VERCEL_URL env var for
  // resolving relative OG images/canonical links — which is always the
  // *.vercel.app deployment URL, not the custom domain. Setting it
  // explicitly keeps every canonical/OG URL pinned to stackedpokerai.com.
  metadataBase: new URL(getSiteUrl()),
  title: "Stacked Poker — Learn Poker Strategy the Right Way",
  description:
    "A structured, interactive platform for learning poker strategy — predict the decision, see the reveal, understand why it works.",
  keywords: ["poker", "poker strategy", "learn poker", "poker course", "poker training", "range training", "Stacked Poker"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Stacked Poker",
    description: "A structured, interactive platform for learning poker strategy.",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
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

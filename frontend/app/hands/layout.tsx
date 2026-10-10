import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { HAND_HISTORY_ENABLED } from "@/lib/handHistory/feature";

export const metadata: Metadata = {
  title: "Mijn handen",
  robots: { index: false, follow: false },
};

/**
 * Hand history section: /hands (overview), /hands/import (upload) and
 * /hands/[id] (replayer + notes). Behind NEXT_PUBLIC_FEATURE_HAND_HISTORY —
 * with the flag off every route here 404s (lib/handHistory/feature.ts).
 * Signed-out users are sent to /login by middleware.ts.
 */
export default function HandsLayout({ children }: { children: React.ReactNode }) {
  if (!HAND_HISTORY_ENABLED) notFound();

  return (
    <div className="min-h-screen bg-background" lang="nl">
      <Navbar variant="static" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <Footer />
    </div>
  );
}

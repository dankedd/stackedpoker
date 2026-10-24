import type { Metadata } from "next";
import { SharedHandView } from "@/components/social/share/SharedHandView";
import { loadShareForViewer } from "@/lib/social/share/server";
import { SHARED_HAND } from "@/lib/social/strings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Compact, iframe-friendly replayer (frame-ancestors * for /embed only, next.config.ts). */
export default async function EmbedSharedHandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await loadShareForViewer(slug);
  return (
    <main className="min-h-dvh bg-background">
      {share ? <SharedHandView initial={share} embed /> : <p className="p-6 text-center text-sm text-muted-foreground">{SHARED_HAND.notFound}</p>}
    </main>
  );
}

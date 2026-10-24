import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { SharedHandView } from "@/components/social/share/SharedHandView";
import { shareUrl } from "@/lib/social/share/api";
import { loadShareForViewer } from "@/lib/social/share/server";
import { summarizeShare } from "@/lib/social/share/summary";
import { SHARED_HAND } from "@/lib/social/strings";
import { fmtBb } from "@/lib/handHistory/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const share = await loadShareForViewer(slug);
  if (!share) return { title: SHARED_HAND.notFound, robots: { index: false, follow: false } };
  const s = summarizeShare(share.hand);
  const title = SHARED_HAND.metaTitle(share.question || SHARED_HAND.defaultQuestion);
  const description = SHARED_HAND.metaDescription(s.position, fmtBb(s.stackBb).replace(/\s*BB$/i, ""), fmtBb(s.potBb).replace(/\s*BB$/i, ""));
  // Only public shares may be indexed; links and friends-only shares never.
  const indexable = share.visibility === "public" && !share.revoked && !share.hidden;
  return {
    title,
    description,
    alternates: { canonical: shareUrl(slug) },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: "article", url: shareUrl(slug) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedHandPage({ params }: Props) {
  const { slug } = await params;
  const share = await loadShareForViewer(slug);
  return (
    <div className="min-h-dvh bg-background">
      <Navbar variant="static" />
      <main className="container mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8">
        {share ? (
          <SharedHandView initial={share} />
        ) : (
          <p role="alert" className="mt-10 rounded-xl border border-border/60 bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {SHARED_HAND.notFound}
          </p>
        )}
      </main>
    </div>
  );
}

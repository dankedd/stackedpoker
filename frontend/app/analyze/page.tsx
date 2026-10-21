import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Spade } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";
import { PRODUCT_AREAS } from "@/lib/seo/navigation";

// Unfinished (PRODUCT_AREAS.analyze in lib/seo/navigation.ts): never indexed, and
// while it is "off" old links land on a working page instead of a placeholder.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AnalyzeHubPage() {
  const area = PRODUCT_AREAS.analyze as { status: string; redirectTo: string };
  if (area.status === "off") redirect(area.redirectTo);
  return (
    <DevelopmentPage
      icon={Spade}
      status="development"
      title="AI Hand Analysis"
      description="Analyze your own hands with strategy-backed AI coaching."
      note="We're rebuilding analysis around a reliable strategy foundation before making it available."
    />
  );
}

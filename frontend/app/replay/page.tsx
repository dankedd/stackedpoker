import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Film } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";
import { PRODUCT_AREAS } from "@/lib/seo/navigation";

// Unfinished (PRODUCT_AREAS.replay in lib/seo/navigation.ts): never indexed, and
// while it is "off" old links land on a working page instead of a placeholder.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReplayPage() {
  const area = PRODUCT_AREAS.replay as { status: string; redirectTo: string };
  if (area.status === "off") redirect(area.redirectTo);
  return (
    <DevelopmentPage
      icon={Film}
      status="development"
      title="Hand Replay"
      description="Replay hands street by street with accurate actions, stacks, pots and decisions."
      note="Replay will return as part of Stacked's strategy-backed study system."
    />
  );
}

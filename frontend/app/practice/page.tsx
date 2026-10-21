import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Puzzle } from "lucide-react";
import { DevelopmentPage } from "@/components/dev/DevelopmentPage";
import { PRODUCT_AREAS } from "@/lib/seo/navigation";

// Unfinished (PRODUCT_AREAS.practice in lib/seo/navigation.ts): never indexed, and
// while it is "off" old links land on a working page instead of a placeholder.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PracticePage() {
  const area = PRODUCT_AREAS.practice as { status: string; redirectTo: string };
  if (area.status === "off") redirect(area.redirectTo);
  return (
    <DevelopmentPage
      icon={Puzzle}
      status="next"
      title="Practice"
      description="Turn concepts into instinct with strategy-backed training — GTO decision drills, range exercises, board reading, and adaptive repetition."
      note="Practice is the next thing we're building on Stacked, using the same verified strategy foundation as Learn."
    />
  );
}

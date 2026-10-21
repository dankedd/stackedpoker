import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRODUCT_AREAS } from "@/lib/seo/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Old link: straight to the working page while the area is "off" (no redirect chain), else to its hub. */
export default function AnalyzePuzzlesPage() {
  const area = PRODUCT_AREAS.practice as { status: string; redirectTo: string };
  redirect(area.status === "off" ? area.redirectTo : "/practice");
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** The "← Bankroll" link every /bankroll/* subpage uses to get back to the dashboard. Extracted since it was duplicated verbatim across 7 pages. */
export function BankrollBackLink() {
  return (
    <Link href="/bankroll" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors mb-3">
      <ArrowLeft className="h-3.5 w-3.5" />
      Bankroll
    </Link>
  );
}

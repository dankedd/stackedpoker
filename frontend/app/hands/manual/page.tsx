import { Suspense } from "react";
import { ManualHandEntry } from "@/components/hand-history/manual/ManualHandEntry";

/** Enter a hand by hand (/hands/manual), or edit one (?edit=<id>). */
export default function ManualHandPage() {
  return (
    <Suspense fallback={null}>
      <ManualHandEntry />
    </Suspense>
  );
}

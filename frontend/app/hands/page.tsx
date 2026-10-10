import { Suspense } from "react";
import { HandsOverview } from "@/components/hand-history/HandsOverview";

export default function HandsPage() {
  return (
    <Suspense>
      <HandsOverview />
    </Suspense>
  );
}

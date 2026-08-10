import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared "badge beside a paragraph" row — the pattern used throughout Learn
// for term/description lists (Theory Engine factor breakdowns, concept
// glossaries, structured feedback). A `shrink-0` badge next to a paragraph
// is fine at desktop width, but on a phone it permanently eats the badge's
// width out of an already-narrow card, squeezing prose into a column far
// narrower than the card actually is. Below 480px this stacks the badge
// above the paragraph instead, which then spans the full row; at 480px and
// up it's byte-identical to the original side-by-side layout (same
// threshold StepFeedback's card grid uses, and for the same reason — see
// that file's comment for the measured trade-off behind 480px specifically).
export function TermDescriptionRow({
  badge,
  description,
  className,
}: {
  badge: ReactNode;
  description: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1.5 min-[480px]:gap-y-0 px-4 py-3",
        className,
      )}
    >
      <div className="col-start-1 row-start-1 shrink-0">{badge}</div>
      <p className="col-start-1 col-span-2 row-start-2 min-[480px]:col-start-2 min-[480px]:col-span-1 min-[480px]:row-start-1 min-w-0 text-sm text-muted-foreground leading-relaxed min-[480px]:pt-0.5">
        {description}
      </p>
    </div>
  );
}

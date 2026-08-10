"use client";

import { useId, useState, Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared collapsible tag-row primitive: shows a short preview of `items`,
// with the rest revealed behind a "Show all / Show less" toggle. Height
// animates via the same grid-template-rows technique as PricingFAQ
// (app/pricing/faq.tsx) rather than an abrupt show/hide — the hidden tags
// stay mounted (not re-rendered on expand) inside a 0fr/1fr grid track.
export function ExpandableTagList({
  items,
  renderItem,
  previewCount = 6,
  label = "concepts",
  className,
  rowClassName,
  toggleClassName,
}: {
  items: string[];
  renderItem: (id: string) => ReactNode;
  previewCount?: number;
  label?: string;
  className?: string;
  rowClassName?: string;
  toggleClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  if (!items.length) return null;

  const hasOverflow = items.length > previewCount;
  const previewItems = hasOverflow ? items.slice(0, previewCount) : items;
  const restItems = hasOverflow ? items.slice(previewCount) : [];

  return (
    <div className={className}>
      <div className={cn("flex flex-wrap items-center gap-1.5", rowClassName)}>
        {previewItems.map((id) => (
          <Fragment key={id}>{renderItem(id)}</Fragment>
        ))}
        {!expanded && hasOverflow && (
          <span className="text-[10px] font-semibold text-muted-foreground/50 px-1">
            +{restItems.length} more
          </span>
        )}
      </div>

      {hasOverflow && (
        <div
          id={contentId}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className={cn("flex flex-wrap items-center gap-1.5 pt-1.5", rowClassName)}>
              {restItems.map((id) => (
                <Fragment key={id}>{renderItem(id)}</Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasOverflow && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400/80 hover:text-violet-300 transition-colors",
            toggleClassName,
          )}
        >
          {expanded ? `▲ Show less` : `▼ Show all ${label}`}
        </button>
      )}
    </div>
  );
}

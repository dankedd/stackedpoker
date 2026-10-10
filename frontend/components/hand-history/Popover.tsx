"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal popover for the filter bar: a button that opens a panel below it.
 * Closes on outside click and Escape; focus returns to the trigger.
 */
export function Popover({
  label,
  trigger,
  children,
  align = "start",
  triggerClassName,
  panelClassName,
  active,
  dataFilter,
}: {
  /** Accessible name of the trigger. */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
  panelClassName?: string;
  /** Shown as pressed (a filter in effect). */
  active?: boolean;
  /** Stable hook for tests and the video ads: data-filter on the trigger. */
  dataFilter?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-pressed={active}
        data-filter={dataFilter}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-30 mt-2 rounded-xl border border-white/10 bg-[#0B1120] p-3 shadow-2xl shadow-black/60 animate-fade-in",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

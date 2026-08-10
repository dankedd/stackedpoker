"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  SEO_EVENTS,
  rememberToolUse,
  trackEvent,
} from "@/lib/seo/analytics";

/**
 * The shell every tool widget renders inside.
 *
 * Owns the parts that are identical across all six — reset, copy/share,
 * the analytics contract, the live region that announces results to a screen
 * reader — so a tool file contains only its own inputs, its own maths and its
 * own result.
 *
 * Accessibility: results live in an `aria-live="polite"` region. These tools
 * recalculate as you type, and without a live region a screen-reader user
 * would change an input and be told nothing at all.
 */

export interface ToolPanelProps {
  /** Slug from the SEO tools registry — the analytics dimension. */
  toolSlug: string;
  title: string;
  description?: string;
  /** The inputs. */
  children: ReactNode;
  /** The results. Rendered inside the live region. */
  results?: ReactNode;
  /** Plain-text summary for the copy button. Omit to hide it. */
  copyText?: string;
  onReset?: () => void;
  /** Extra content below the results, outside the live region. */
  footer?: ReactNode;
}

export function ToolPanel({
  toolSlug,
  title,
  description,
  children,
  results,
  copyText,
  onReset,
  footer,
}: ToolPanelProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Tool opened" — once per mount, and the point at which this visitor
  // becomes attributable to the tool if they later sign up.
  useEffect(() => {
    trackEvent(SEO_EVENTS.toolOpen, { tool_slug: toolSlug });
    rememberToolUse(toolSlug);
  }, [toolSlug]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      trackEvent(SEO_EVENTS.toolShare, { tool_slug: toolSlug });
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission). The result is
      // on screen and selectable, so this is a missing convenience, not a
      // failure worth interrupting anyone with.
    }
  }, [copyText, toolSlug]);

  return (
    <section
      aria-labelledby={`${toolSlug}-heading`}
      className="mt-8 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] via-card/70 to-blue-500/[0.05]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div>
          <h2 id={`${toolSlug}-heading`} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {copyText && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-violet-400" />
              ) : (
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy result"}
            </button>
          )}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {children}

        {results && (
          <div aria-live="polite" aria-atomic="true">
            {results}
          </div>
        )}

        {footer}
      </div>
    </section>
  );
}

/** One labelled result number. */
export function ResultStat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        emphasis
          ? "border-violet-500/40 bg-violet-500/[0.10]"
          : "border-border/60 bg-background/40"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          emphasis ? "text-2xl text-violet-200" : "text-lg text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The explanation paragraph under a result. */
export function ResultNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border/50 bg-background/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** A validation problem. `role="alert"` so it is announced immediately. */
export function ToolError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-200"
    >
      {children}
    </p>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

interface RevealOnScrollProps {
  children: React.ReactNode;
  /** Stagger delay in ms — pass `index * 60` (or similar) for groups. */
  delayMs?: number;
  /** 'y' (default, translateY) | 'scale' | 'x' — vary reveal style per
   *  section rather than using the identical animation everywhere. */
  variant?: "y" | "scale" | "x";
  className?: string;
  threshold?: number;
}

const VARIANT_CLASS: Record<NonNullable<RevealOnScrollProps["variant"]>, string> = {
  y: "scroll-reveal",
  scale: "scroll-reveal-scale",
  x: "scroll-reveal-x",
};

/**
 * Shared scroll-triggered reveal — thin wrapper around the existing
 * `useInView` hook + the `scroll-reveal*` CSS classes (one-shot: fires once,
 * never re-hides on scroll-up, and is neutralized under
 * prefers-reduced-motion by CSS alone — no JS timer involved).
 */
export function RevealOnScroll({ children, delayMs = 0, variant = "y", className, threshold }: RevealOnScrollProps) {
  const { ref, visible } = useInView(threshold);
  return (
    <div
      ref={ref}
      className={cn(VARIANT_CLASS[variant], visible && "visible", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

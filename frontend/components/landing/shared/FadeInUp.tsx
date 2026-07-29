import { cn } from "@/lib/utils";

interface FadeInUpProps {
  children: React.ReactNode;
  delayMs?: number;
  /** 'up' (default, animate-reveal-up) | 'fade' (animate-fade-in, no translate) */
  variant?: "up" | "fade";
  className?: string;
}

/**
 * Mount-time entrance (as opposed to `RevealOnScroll`'s scroll-time
 * entrance) — used for the Hero's own first-paint sequence. Wraps the
 * existing `animate-reveal-up`/`animate-fade-in` keyframes (already
 * covered by the reduced-motion media query in globals.css) with a
 * `delayMs` prop instead of repeating inline `style={{animationDelay}}`
 * at every call site.
 */
export function FadeInUp({ children, delayMs = 0, variant = "up", className }: FadeInUpProps) {
  return (
    <div
      className={cn(variant === "up" ? "animate-reveal-up" : "animate-fade-in", className)}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "forwards" }}
    >
      {children}
    </div>
  );
}

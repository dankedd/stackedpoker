import { cn } from "@/lib/utils";

interface FadeInUpProps {
  children: React.ReactNode;
  delayMs?: number;
  /** 'up' (default, animate-reveal-up) | 'fade' (animate-fade-in, no translate) */
  variant?: "up" | "fade";
  /**
   * Set on content that is above the fold on mobile and therefore on the
   * critical rendering path — most importantly whatever element ends up being
   * the Largest Contentful Paint.
   *
   * The default entrance starts at `opacity: 0`, and LCP/FCP do not count a
   * paint at zero opacity. Combined with `delayMs`, that makes the browser
   * report the element as "rendered" only after animation-delay + duration have
   * elapsed — which, on a throttled mobile main thread that is also busy
   * hydrating, measured as roughly 1.4s of LCP delay that no user actually
   * perceives as faster or slower content.
   *
   * `critical` swaps in a transform-only entrance: the exact same staggered
   * rise, but the text is opaque from its very first paint, so LCP is recorded
   * when the pixels genuinely appear. Use it for the hero heading/copy/CTA;
   * leave it off for anything below the fold, where the fade is free.
   */
  critical?: boolean;
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
export function FadeInUp({ children, delayMs = 0, variant = "up", critical = false, className }: FadeInUpProps) {
  const animation = critical
    ? "animate-reveal-up-critical"
    : variant === "up"
      ? "animate-reveal-up"
      : "animate-fade-in";

  return (
    <div
      className={cn(animation, className)}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "forwards" }}
    >
      {children}
    </div>
  );
}

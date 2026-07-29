import { cn } from "@/lib/utils";

interface AmbientFloatProps {
  children: React.ReactNode;
  durationS?: number;
  delayS?: number;
  distancePx?: number;
  className?: string;
}

/**
 * Continuous, very slow vertical drift for hero product-surface cards.
 * Pure CSS (`.sp-float` in globals.css, already reduced-motion-safe) —
 * duration/delay/distance are per-instance custom properties so multiple
 * floating cards never move in sync (a synchronized float reads as the
 * whole page "breathing," which is exactly what to avoid).
 */
export function AmbientFloat({ children, durationS = 10, delayS = 0, distancePx = 6, className }: AmbientFloatProps) {
  return (
    <div
      className={cn("sp-float", className)}
      style={
        {
          "--sp-float-duration": `${durationS}s`,
          "--sp-float-delay": `${delayS}s`,
          "--sp-float-distance": `${distancePx}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface MarketingEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

/** Centered, tracked uppercase section marker flanked by fading hairlines —
 *  the one recurring "we're starting a new section" signal used site-wide. */
export function MarketingEyebrow({ children, className }: MarketingEyebrowProps) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <span className="h-px w-10 bg-gradient-to-r from-transparent to-[rgba(186,215,247,0.16)]" aria-hidden />
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-violet-300/80 whitespace-nowrap">
        {children}
      </span>
      <span className="h-px w-10 bg-gradient-to-l from-transparent to-[rgba(186,215,247,0.16)]" aria-hidden />
    </div>
  );
}

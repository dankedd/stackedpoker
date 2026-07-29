import { cn } from "@/lib/utils";
import { MarketingEyebrow } from "@/components/landing/shared/MarketingEyebrow";

interface MarketingSectionHeaderProps {
  eyebrow: string;
  heading: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
  id?: string;
}

/** The shared "eyebrow → heading → short body" opener used at the top of
 *  every homepage section below the hero. */
export function MarketingSectionHeader({
  eyebrow,
  heading,
  body,
  align = "center",
  className,
  id,
}: MarketingSectionHeaderProps) {
  const isCenter = align === "center";
  return (
    <div
      id={id}
      className={cn(
        "mb-12 md:mb-16",
        isCenter ? "text-center mx-auto max-w-2xl" : "text-left max-w-2xl",
        className
      )}
    >
      <MarketingEyebrow className={isCenter ? undefined : "justify-start"}>{eyebrow}</MarketingEyebrow>
      <h2 className="mt-4 font-black tracking-tight text-foreground text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.15]">
        {heading}
      </h2>
      {body && (
        <p className="mt-4 text-base sm:text-lg text-muted-foreground/70 leading-relaxed">
          {body}
        </p>
      )}
    </div>
  );
}

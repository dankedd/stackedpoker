"use client";

import { GraduationCap, Puzzle, Spade, Film } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { StatusBadge, type ProductStatus } from "@/components/layout/StatusBadge";

const TIERS: {
  icon: typeof GraduationCap;
  title: string;
  status: ProductStatus;
  description: string;
  accent: string;
}[] = [
  {
    icon: GraduationCap,
    title: "Learn",
    status: "available",
    description: "Build your strategic foundation through structured, interactive lessons.",
    accent: "border-violet-500/30 bg-violet-500/[0.04]",
  },
  {
    icon: Puzzle,
    title: "Practice",
    status: "next",
    description: "Turn concepts into instinct through strategy-backed training.",
    accent: "border-blue-500/20 bg-blue-500/[0.02]",
  },
  {
    icon: Spade,
    title: "Analyze",
    status: "later",
    description: "Study your own hands with strategy-backed explanations.",
    accent: "border-border/40 bg-card/40",
  },
  {
    icon: Film,
    title: "Replay",
    status: "later",
    description: "Reconstruct hands street by street and inspect the decisions that mattered.",
    accent: "border-border/40 bg-card/40",
  },
];

export function StudySystemRoadmap() {
  const { ref: headerRef, visible: headerVisible } = useInView();
  const { ref: gridRef, visible: gridVisible } = useInView();

  return (
    <section className="relative py-24 sm:py-28 overflow-hidden">
      <div
        ref={headerRef}
        className={`mx-auto mb-14 max-w-2xl text-center px-4 scroll-reveal ${headerVisible ? "visible" : ""}`}
      >
        <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] text-muted-foreground">
          The Stacked Study System
        </div>
        <h2 className="mb-4 text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-[1.05]">
          Learn it. Train it. Apply it. Review it.
        </h2>
        <p className="text-muted-foreground/65 text-base leading-relaxed">
          A complete poker study system is the long-term vision — right now, Learn is the one
          part of it built and reliable enough to stand on its own.
        </p>
      </div>

      <div
        ref={gridRef}
        className="mx-auto max-w-5xl px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {TIERS.map((tier, i) => (
          <div
            key={tier.title}
            className={`rounded-2xl border p-5 scroll-reveal scroll-delay-${i + 1} ${tier.accent} ${gridVisible ? "visible" : ""}`}
          >
            <div className="flex items-center justify-between mb-4">
              <tier.icon className={`h-5 w-5 ${tier.status === "available" ? "text-violet-400" : "text-muted-foreground/50"}`} />
              <StatusBadge status={tier.status} className="text-[9px] py-0.5 px-2" />
            </div>
            <h3 className={`text-base font-bold mb-1.5 ${tier.status === "available" ? "text-foreground" : "text-muted-foreground/70"}`}>
              {tier.title}
            </h3>
            <p className="text-[13px] text-muted-foreground/55 leading-relaxed">
              {tier.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

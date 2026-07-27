"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { LEARNING_PATHS, LEARNING_MODULES } from "@/lib/learn/curriculum";

const MAX_MODULES_SHOWN = 4;

function isAvailable(status: string | undefined) {
  return !status || status === "complete";
}

export function CurriculumPreview() {
  const { ref: headerRef, visible: headerVisible } = useInView();
  const { ref: gridRef, visible: gridVisible } = useInView();

  const paths = [...LEARNING_PATHS]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((path) => {
      const modules = LEARNING_MODULES.filter((m) => m.path_id === path.id).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const availableCount = modules.filter((m) => isAvailable(m.contentStatus)).length;
      return { path, modules, availableCount };
    })
    .filter((p) => p.modules.length > 0);

  return (
    <section id="curriculum" className="relative bg-secondary/10 py-24 sm:py-28 overflow-hidden">
      <div
        ref={headerRef}
        className={`mx-auto mb-14 max-w-2xl text-center px-4 scroll-reveal ${headerVisible ? "visible" : ""}`}
      >
        <div className="mb-5 inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/8 px-4 py-1.5 text-[13px] text-violet-300">
          The curriculum
        </div>
        <h2 className="mb-4 text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-[1.05]">
          There is a path — not a pile of articles.
        </h2>
        <p className="text-muted-foreground/65 text-base leading-relaxed">
          Every module builds on the last, from absolute fundamentals to advanced postflop strategy.
        </p>
      </div>

      <div
        ref={gridRef}
        className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {paths.map(({ path, modules, availableCount }, i) => {
          const shown = modules.slice(0, MAX_MODULES_SHOWN);
          const remaining = modules.length - shown.length;

          return (
            <div
              key={path.id}
              className={`rounded-2xl border border-border/50 bg-card/60 p-5 scroll-reveal scroll-delay-${i + 1} ${gridVisible ? "visible" : ""}`}
            >
              <h3 className="text-base font-bold text-foreground mb-1">{path.title}</h3>
              <p className="text-[12px] text-muted-foreground/55 leading-relaxed mb-4">
                {path.description}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/60 mb-3">
                {availableCount} of {modules.length} modules available
              </p>

              <div className="space-y-1.5">
                {shown.map((m) => {
                  const available = isAvailable(m.contentStatus);
                  const Icon = available ? CheckCircle2 : Clock;
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-[12px]">
                      <Icon className={`h-3 w-3 shrink-0 ${available ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                      <span className={available ? "text-foreground/75" : "text-muted-foreground/40"}>
                        {m.title}
                      </span>
                    </div>
                  );
                })}
                {remaining > 0 && (
                  <p className="text-[11px] text-muted-foreground/35 pl-5">+{remaining} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/learn/journey"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
        >
          See the full roadmap
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

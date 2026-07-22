"use client";

import Link from "next/link";
import { ChevronLeft, CheckCircle, Circle, Clock as ClockIcon, Map } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { LEARNING_MODULES } from "@/lib/learn/curriculum";
import {
  JOURNEY_STAGES,
  getCompletedModuleIds,
  getModuleDisplayStatus,
  getStageStatus,
  type ModuleDisplayStatus,
} from "@/lib/learn/journey";
import { cn } from "@/lib/utils";

const DOT_ICON: Record<ModuleDisplayStatus, typeof Circle> = {
  complete: CheckCircle,
  available: Circle,
  coming_soon: ClockIcon,
};

const DOT_STYLE: Record<ModuleDisplayStatus, string> = {
  complete: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  available: "border-violet-500/50 bg-violet-500/10 text-violet-400",
  coming_soon: "border-border/20 bg-card/30 text-muted-foreground/25",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const { progress } = useLearnProgress();
  const completedModuleIds = getCompletedModuleIds(progress.lessons);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="h-4 w-4" />
            Learning Hub
          </Link>

          <div className="mb-10">
            <div className="flex items-start gap-4 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shrink-0">
                <Map className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-1">
                  The Full Roadmap
                </p>
                <h1 className="text-3xl font-bold text-foreground">Poker Journey</h1>
              </div>
            </div>
            <p className="text-muted-foreground ml-16">
              Your journey from fundamentals to elite poker strategy — 13 stages, 28 modules, one straight line.
              No branches, no skill tree: just what to learn next.
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-violet-500/30 via-border/30 to-transparent"
            />

            <div className="space-y-6">
              {JOURNEY_STAGES.map((stage) => {
                const stageModules = LEARNING_MODULES.filter((m) => stage.moduleIds.includes(m.id)).sort(
                  (a, b) => (a.order ?? 0) - (b.order ?? 0)
                );
                const status = getStageStatus(stage, completedModuleIds);

                return (
                  <div key={stage.id} className="relative flex gap-4">
                    <div
                      className={cn(
                        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background text-xs font-bold",
                        status === "complete"
                          ? "border-emerald-500/50 text-emerald-400"
                          : status === "current"
                          ? "border-violet-500/50 text-violet-400"
                          : "border-border/40 text-muted-foreground/40"
                      )}
                    >
                      {stage.order}
                    </div>

                    <div
                      className={cn(
                        "flex-1 min-w-0 rounded-2xl border p-4 sm:p-5",
                        status === "current"
                          ? "border-violet-500/25 bg-violet-500/[0.03]"
                          : "border-border/40 bg-card/40"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                        <h2 className="text-sm font-bold text-foreground">{stage.title}</h2>
                        {status === "current" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400">
                            You are here
                          </span>
                        )}
                      </div>
                      {stage.subtitle && (
                        <p className="text-xs text-muted-foreground/70 mb-3">{stage.subtitle}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {stageModules.map((mod) => {
                          const modStatus = getModuleDisplayStatus(mod, completedModuleIds);
                          const Icon = DOT_ICON[modStatus];
                          const clickable = modStatus !== "coming_soon";

                          const pill = (
                            <div
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                DOT_STYLE[modStatus],
                                clickable && "hover:border-violet-500/60 cursor-pointer"
                              )}
                              title={mod.title}
                            >
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[10rem]">{mod.title}</span>
                            </div>
                          );

                          return clickable ? (
                            <Link key={mod.id} href={`/learn/module/${mod.slug}`}>
                              {pill}
                            </Link>
                          ) : (
                            <div key={mod.id}>{pill}</div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

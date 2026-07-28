"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  CheckCircle,
  Circle,
  Lock,
  BookOpen,
  Star,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { LEARNING_PATHS, MODULES_BY_PATH, LESSONS_BY_MODULE } from "@/lib/learn/curriculum";
import {
  getCompletedModuleIds,
  getNextLessonTarget,
  getModuleRowStatus,
  isModuleImplemented,
  type ModuleRowStatus,
} from "@/lib/learn/journey";
import { cn } from "@/lib/utils";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.04]", className)} />;
}

// ── Status styling ────────────────────────────────────────────────────────────
//
// Status itself comes from the shared lib/learn/journey.ts#getModuleRowStatus
// (same function /learn's stage accordion uses) — only the visual mapping
// lives here, so this page and /learn can never disagree on what's current.

const STATUS_ICON: Record<ModuleRowStatus, typeof Circle> = {
  complete: CheckCircle,
  current: Circle,
  available: Circle,
  planned: Lock,
};

const STATUS_STYLE: Record<
  ModuleRowStatus,
  { card: string; icon: string; badge: string; ring: string }
> = {
  complete: {
    card: "border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-500/40",
    icon: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    ring: "border-emerald-500/50",
  },
  current: {
    card: "border-violet-500/30 bg-violet-500/[0.04] hover:border-violet-500/45",
    icon: "text-violet-400",
    badge: "bg-violet-500/10 border-violet-500/25 text-violet-400",
    ring: "border-violet-500/50",
  },
  available: {
    card: "border-border/50 bg-card/60 hover:border-violet-500/25 hover:bg-violet-500/[0.03]",
    icon: "text-muted-foreground/60",
    badge: "bg-secondary/25 border-border/25 text-muted-foreground/60",
    ring: "border-border/40",
  },
  planned: {
    card: "border-border/25 bg-card/25",
    icon: "text-muted-foreground/40",
    badge: "bg-secondary/20 border-border/20 text-muted-foreground/45",
    ring: "border-border/30",
  },
};

const STATUS_LABEL: Record<ModuleRowStatus, string> = {
  complete: "Completed",
  current: "Current",
  available: "Available",
  planned: "Planned",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PathPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const { progress } = useLearnProgress();
  const loading = progress.loading;

  const path = LEARNING_PATHS.find((p) => p.id === pathId);
  const modules = useMemo(
    () => (MODULES_BY_PATH[pathId] ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [pathId]
  );

  const completedIds = useMemo(
    () => getCompletedModuleIds(progress.lessons),
    [progress.lessons]
  );
  const currentModuleId = useMemo(
    () => getNextLessonTarget(progress.lessons)?.module.id ?? null,
    [progress.lessons]
  );

  // ── Live header stats — "available" only counts built modules; "total"
  // includes planned ones, so the two numbers diverge honestly the moment a
  // module is added to this path before it's built. Never hardcoded.
  const totalModules = modules.length;
  const availableModulesList = modules.filter(isModuleImplemented);
  const availableModules = availableModulesList.length;
  const availableLessons = availableModulesList.reduce(
    (sum, m) => sum + (LESSONS_BY_MODULE[m.id]?.length ?? 0),
    0
  );
  const availableXp = availableModulesList.reduce((sum, m) => sum + m.xp_reward, 0);

  if (!path) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar variant="static" />
        <main className="flex-1 py-14 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">Path not found</p>
            <Link href="/learn" className="text-sm text-violet-400 hover:text-violet-300 mt-2 inline-block">
              Back to learning hub
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link href="/learn" className="hover:text-foreground transition-colors">
              Learning Hub
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            <span className="text-foreground">{path.title}</span>
          </div>

          {/* Path header */}
          <div className="mb-10">
            <div className="flex items-start gap-4 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shrink-0">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-1">
                  Learning Path
                </p>
                <h1 className="text-3xl font-bold text-foreground">{path.title}</h1>
              </div>
            </div>
            <p className="text-muted-foreground ml-16">{path.description}</p>

            {/* Stats — available now vs full roadmap, never conflated */}
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 ml-16 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{availableModules}</span> available modules
                {" · "}
                <span className="font-semibold text-foreground">{totalModules}</span> total modules
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-1 ml-16 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{availableLessons}</span> available lessons
              </span>
              <span>
                <span className="font-semibold text-amber-400">{availableXp}</span> XP available
              </span>
            </div>
          </div>

          {/* Roadmap */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <div className="relative">
              {/* Vertical spine line — runs the full column height, so it
                  continues through planned cards automatically. */}
              <div
                aria-hidden
                className="absolute left-[23px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-violet-500/30 via-border/30 to-transparent"
              />

              <div className="space-y-4">
                {modules.map((mod) => {
                  const status = getModuleRowStatus(mod, completedIds, currentModuleId);
                  const styles = STATUS_STYLE[status];
                  const Icon = STATUS_ICON[status];
                  const isPlanned = status === "planned";
                  const isClickable = !isPlanned;

                  if (isPlanned) {
                    // Compact, muted card — visible enough to create
                    // anticipation, never showing fake lesson/XP data and
                    // never navigable to unfinished lesson content.
                    return (
                      <div
                        key={mod.id}
                        className={cn("relative rounded-2xl border p-4 sm:p-5", styles.card)}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div
                            className={cn(
                              "relative z-10 flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                              styles.ring
                            )}
                          >
                            <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", styles.icon)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", styles.badge)}>
                                {STATUS_LABEL[status]}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">
                                Module {mod.order ?? "—"}
                              </span>
                            </div>
                            <h3 className="font-semibold text-muted-foreground/80 text-sm truncate">{mod.title}</h3>
                            {mod.description && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed line-clamp-2">
                                {mod.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const card = (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 transition-all duration-200",
                        styles.card,
                        "cursor-pointer"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Node icon */}
                        <div
                          className={cn(
                            "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                            styles.ring
                          )}
                        >
                          <Icon className={cn("h-4 w-4", styles.icon)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", styles.badge)}>
                                  {STATUS_LABEL[status]}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Module {mod.order ?? "—"}
                                </span>
                              </div>
                              <h3 className="font-semibold text-foreground">{mod.title}</h3>
                              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                {mod.description}
                              </p>
                            </div>

                            <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-4 mt-3 flex-wrap">
                            {/* Concept tags */}
                            <div className="flex flex-wrap gap-1.5">
                              {mod.concept_ids.slice(0, 3).map((c) => (
                                <span
                                  key={c}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/40 border border-border/30 text-muted-foreground/60"
                                >
                                  {c.replace(/-/g, " ")}
                                </span>
                              ))}
                            </div>

                            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {LESSONS_BY_MODULE[mod.id]?.length ?? 0} lesson
                                {(LESSONS_BY_MODULE[mod.id]?.length ?? 0) !== 1 ? "s" : ""}
                              </span>
                              <span className="flex items-center gap-1 text-amber-400">
                                <Zap className="h-3 w-3" />
                                {mod.xp_reward} XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div key={mod.id} className="relative pl-0">
                      {isClickable ? (
                        <Link href={`/learn/module/${mod.slug}`}>{card}</Link>
                      ) : (
                        card
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          {path.tier_required !== "free" && (
            <div className="mt-10 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-6 text-center">
              <Star className="h-8 w-8 text-violet-400 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">
                Requires{" "}
                <span className="capitalize text-violet-400">{path.tier_required}</span> plan
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unlock this learning path and all its modules with a subscription upgrade.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Upgrade now <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

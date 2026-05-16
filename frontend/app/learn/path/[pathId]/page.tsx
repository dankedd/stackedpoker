"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle,
  Lock,
  Circle,
  ChevronRight,
  BookOpen,
  Star,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import {
  LEARNING_PATHS,
  LEARNING_MODULES,
  MODULES_BY_PATH,
  LESSONS_BY_MODULE,
} from "@/lib/learn/curriculum";
import type { LearningModule } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.04]", className)} />;
}

// ── Status helpers ────────────────────────────────────────────────────────────

type ModuleStatus = "locked" | "available" | "complete";

function getModuleStatus(
  module: LearningModule,
  completedModuleIds: Set<string>
): ModuleStatus {
  if (completedModuleIds.has(module.id)) return "complete";
  const prereqsMet = module.unlock_after.every((dep) => completedModuleIds.has(dep));
  return prereqsMet ? "available" : "locked";
}

const STATUS_ICON: Record<ModuleStatus, typeof Circle> = {
  complete: CheckCircle,
  available: Circle,
  locked: Lock,
};

const STATUS_STYLE: Record<
  ModuleStatus,
  { card: string; icon: string; badge: string }
> = {
  complete: {
    card: "border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-500/40",
    icon: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
  },
  available: {
    card: "border-border/50 bg-card/60 hover:border-violet-500/30 hover:bg-violet-500/[0.03]",
    icon: "text-violet-400",
    badge: "bg-violet-500/10 border-violet-500/25 text-violet-400",
  },
  locked: {
    card: "border-border/30 bg-card/30 opacity-60",
    icon: "text-muted-foreground/40",
    badge: "bg-secondary/30 border-border/30 text-muted-foreground/40",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PathPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const { session } = useAuth();
  const [completedIds] = useState<Set<string>>(new Set());
  const [loading] = useState(false);

  const path = LEARNING_PATHS.find((p) => p.id === pathId);
  const modules = MODULES_BY_PATH[pathId] ?? [];

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

          {/* Back link */}
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="h-4 w-4" />
            Learning Hub
          </Link>

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

            {/* Stats */}
            <div className="flex gap-6 mt-4 ml-16 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{modules.length}</span> modules
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {modules.reduce((s, m) => s + (LESSONS_BY_MODULE[m.id]?.length ?? 0), 0)}
                </span>{" "}
                lessons
              </span>
              <span>
                <span className="font-semibold text-amber-400">
                  {modules.reduce((s, m) => s + m.xp_reward, 0)}
                </span>{" "}
                XP available
              </span>
            </div>
          </div>

          {/* Skill tree */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <div className="relative">
              {/* Vertical spine line */}
              <div
                aria-hidden
                className="absolute left-[23px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-violet-500/30 via-border/30 to-transparent"
              />

              <div className="space-y-4">
                {modules.map((mod, idx) => {
                  const status = getModuleStatus(mod, completedIds);
                  const styles = STATUS_STYLE[status];
                  const Icon = STATUS_ICON[status];
                  const lessonCount = LESSONS_BY_MODULE[mod.id]?.length ?? 0;
                  const isClickable = status !== "locked";

                  const card = (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 transition-all duration-200",
                        styles.card,
                        isClickable && status !== "locked" ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Node icon */}
                        <div
                          className={cn(
                            "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                            status === "complete"
                              ? "border-emerald-500/50"
                              : status === "available"
                              ? "border-violet-500/50"
                              : "border-border/40"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              styles.icon
                            )}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                                    styles.badge
                                  )}
                                >
                                  {status}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Module {idx + 1}
                                </span>
                              </div>
                              <h3 className="font-semibold text-foreground">{mod.title}</h3>
                              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                {mod.description}
                              </p>
                            </div>

                            {isClickable && (
                              <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                            )}
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-4 mt-3">
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
                                {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
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

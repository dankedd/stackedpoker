"use client";

import type { StudyRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookOpen, Dumbbell, Lightbulb, Tag, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Props {
  recommendations: StudyRecommendation[];
}

function RecommendationCard({ rec, rank }: { rec: StudyRecommendation; rank: number }) {
  const [open, setOpen] = useState(rank === 1);

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-card/70 transition-colors"
      >
        <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30 text-[10px] font-black text-violet-400 mt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{rec.leak_title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {rec.puzzle_count_target} targeted puzzles · {rec.articles.length} study articles
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        }
      </button>

      {open && (
        <div className="border-t border-border/40 p-4 space-y-4">
          {/* GTO Concept */}
          {rec.gto_concept && (
            <div className="flex gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide mb-1">
                  GTO Concept
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{rec.gto_concept}</p>
              </div>
            </div>
          )}

          {/* Puzzle tags */}
          {rec.puzzle_tags.length > 0 && (
            <div className="flex gap-2">
              <Tag className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1.5">
                  Recommended Puzzles ({rec.puzzle_count_target} sessions)
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {rec.puzzle_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/analyze/puzzles?tags=${encodeURIComponent(rec.puzzle_tags.join(","))}`}
                  className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Start puzzle drills →
                </Link>
              </div>
            </div>
          )}

          {/* Custom drill */}
          {rec.drill_description && (
            <div className="flex gap-2">
              <Dumbbell className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide mb-1">
                  Custom Drill Exercise
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{rec.drill_description}</p>
              </div>
            </div>
          )}

          {/* Articles */}
          {rec.articles.length > 0 && (
            <div className="flex gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2">
                  Study Articles
                </p>
                <div className="space-y-3">
                  {rec.articles.map((article, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{article.title}</p>
                        <span className={cn(
                          "shrink-0 text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                          article.difficulty === "beginner"     ? "bg-green-500/15 text-green-400"  :
                          article.difficulty === "intermediate" ? "bg-blue-500/15 text-blue-400"    :
                          "bg-violet-500/15 text-violet-400",
                        )}>
                          {article.difficulty}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-violet-400">{article.concept}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{article.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StudyPlan({ recommendations }: Props) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Study plan unlocks after leaks are detected (5+ hand analyses required).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => (
        <RecommendationCard key={rec.leak_category} rec={rec} rank={i + 1} />
      ))}
    </div>
  );
}

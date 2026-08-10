import Link from "next/link";
import { Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { LEAGUE_META, topicLabel } from "@/lib/learn/leagueMeta";
import type { AssessmentLeague, AssessmentTopic } from "@/lib/learn/assessmentQuestions";

export interface SkillProfileData {
  estimatedLeague: AssessmentLeague;
  weakestTopics: AssessmentTopic[];
  completedAt: string | null;
}

// Deliberately its own color scale (see leagueMeta.ts) — never reuses
// PlanBadge's Free/Plus/Elite styling. Skill league and subscription tier
// are unrelated axes and must never look like the same concept on the
// dashboard, where both could plausibly appear near each other.
export function SkillProfileWidget({ data }: { data: SkillProfileData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-card/60 to-card/60 p-5 flex items-center gap-4 card-lift">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Take your skill assessment</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            A 2-minute quiz to personalize your learning path.
          </p>
        </div>
        <Link
          href="/learn/onboarding"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Start
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const meta = LEAGUE_META[data.estimatedLeague];
  const lastCheck = data.completedAt
    ? new Date(data.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 space-y-4 card-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
            Current Skill Estimate
          </p>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${meta.classes}`}>
            <span>{meta.emoji}</span>
            {meta.label}
          </div>
        </div>
        <Link
          href="/settings"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Retake assessment from Settings"
        >
          <RotateCcw className="h-3 w-3" />
          Retake
        </Link>
      </div>

      {data.weakestTopics.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
            Recommended Focus
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.weakestTopics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/18 text-amber-400/80 font-semibold"
              >
                {topicLabel(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/40">Last skill check: {lastCheck}</p>
    </div>
  );
}

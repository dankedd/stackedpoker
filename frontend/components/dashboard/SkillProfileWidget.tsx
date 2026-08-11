import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { EXPERIENCE_LEVEL_META } from "@/lib/learn/experienceLevel";
import type { ExperienceLevel } from "@/lib/learn/experienceLevel";

export interface SkillProfileData {
  experienceLevel: ExperienceLevel;
  recommendedModuleTitle: string | null;
}

// Deliberately its own color scale (see experienceLevel.ts) — never reuses
// PlanBadge's Free/Plus/Elite styling. Poker experience and subscription
// tier are unrelated axes and must never look like the same concept on the
// dashboard, where both could plausibly appear near each other.
export function SkillProfileWidget({ data }: { data: SkillProfileData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-card/60 to-card/60 p-5 flex items-center gap-4 card-lift">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Tell us your poker level</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            One question, under a minute, to personalize your dashboard.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Start
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const meta = EXPERIENCE_LEVEL_META[data.experienceLevel];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 flex items-center justify-between gap-4 card-lift">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
          Poker Experience
        </p>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${meta.classes}`}>
          {meta.label}
        </div>
        {data.recommendedModuleTitle && (
          <p className="text-xs text-muted-foreground/60 mt-2">
            Recommended: {data.recommendedModuleTitle}
          </p>
        )}
      </div>
      <Link
        href="/settings"
        className="shrink-0 text-[11px] font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        Change
      </Link>
    </div>
  );
}

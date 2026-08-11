"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPERIENCE_LEVEL_OPTIONS, computeRecommendation, type ExperienceLevel } from "@/lib/learn/experienceLevel";
import { submitAssessment } from "@/lib/learn/assessmentApi";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

// Updating the level here re-POSTs to the same /assessment/submit endpoint
// onboarding uses — there's no multi-step quiz to "retake," and this
// endpoint never touches course-progress tables, so changing the level here
// can't reset any progress (per the spec's explicit requirement).
export function PokerExperiencePicker({ currentLevel }: { currentLevel: ExperienceLevel | null }) {
  const router = useRouter();
  const { session } = useAuth();
  const { subscription } = useSubscription();
  const [level, setLevel] = useState<ExperienceLevel | null>(currentLevel);
  const [saving, setSaving] = useState<ExperienceLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(next: ExperienceLevel) {
    if (next === level || saving) return;
    setSaving(next);
    setError(null);
    try {
      const rec = computeRecommendation(next, subscription?.tier);
      await submitAssessment(session?.access_token ?? "", {
        experience_level: next,
        recommended_module_id: rec.startModuleId,
      });
      setLevel(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {EXPERIENCE_LEVEL_OPTIONS.map((opt) => {
          const active = level === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePick(opt.id)}
              disabled={saving !== null}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all disabled:opacity-60",
                active
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-violet-500/25 hover:text-foreground",
              )}
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {saving === opt.id ? "Saving…" : opt.title}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-300/90">{error}</p>}
    </div>
  );
}

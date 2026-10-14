"use client";

import { useEffect, useState } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { getAssessmentStatus, submitAssessment } from "@/lib/learn/assessmentApi";
import { computeRecommendation, EXPERIENCE_LEVEL_META, type ExperienceLevel } from "@/lib/learn/experienceLevel";

const LEVELS: ExperienceLevel[] = ["beginner", "recreational", "intermediate", "advanced"];

/**
 * Asked once, after the user's first AI Coach answer: "How would you describe
 * your level?". The level moved out of onboarding; until it is set the coach
 * assumes "recreational". Users who already picked one (Settings) are never
 * asked. Saved with the same endpoint as the Settings picker.
 */
export function LevelPrompt({ token }: { token: string }) {
  const ob = useOnboarding();
  const { subscription } = useSubscription();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const due = ob.loaded && !ob.row?.level_prompt_seen_at;
  const { markLevelPromptSeen } = ob;

  useEffect(() => {
    if (!due || !token) return;
    let cancelled = false;
    getAssessmentStatus(token)
      .then((s) => {
        if (cancelled) return;
        if (s.experience_level) void markLevelPromptSeen();
        else setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [due, token, markLevelPromptSeen]);

  if (!show || !due) return null;

  async function pick(level: ExperienceLevel) {
    setSaving(true);
    try {
      await submitAssessment(token, { experience_level: level, recommended_module_id: computeRecommendation(level, subscription?.tier).startModuleId });
    } catch {
      // Not saved: the coach keeps assuming "recreational"; Settings can change it any time.
    }
    setShow(false);
    void markLevelPromptSeen();
  }

  return (
    <div className="mb-2 rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.07] px-3 py-2.5 animate-fade-in" role="group" aria-label="Your poker level">
      <p className="text-xs font-medium text-foreground/85">How would you describe your level? The coach adapts its answers.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={saving}
            onClick={() => pick(l)}
            className="rounded-full border border-[#7C5CFF]/30 bg-[#0B0E1A]/60 px-2.5 py-1 text-[11px] font-medium text-foreground/85 transition hover:border-[#7C5CFF]/60 disabled:opacity-60"
          >
            {EXPERIENCE_LEVEL_META[l].label}
          </button>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setShow(false);
            void markLevelPromptSeen();
          }}
          className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

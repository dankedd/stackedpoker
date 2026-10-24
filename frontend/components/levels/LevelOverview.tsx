"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dismissLevelsNotice, fetchMyXpProfile, type XpProfile } from "@/lib/levels/api";
import { LEVELS } from "@/lib/levels/strings";
import { LevelCard } from "./LevelCard";

/**
 * Dashboard: the one-time "levels were rebalanced" note and the level card.
 * Renders nothing until the profile loads, and nothing at all before the
 * XP migration has run.
 */
export function LevelOverview({ className }: { className?: string }) {
  const [profile, setProfile] = useState<XpProfile | null>(null);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyXpProfile(createClient()).then((p) => {
      if (cancelled || !p) return;
      setProfile(p);
      setNotice(p.levelsNotice);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) return null;

  const dismiss = () => {
    setNotice(false);
    void dismissLevelsNotice(createClient());
  };

  return (
    <div className={className}>
      {notice && (
        <div
          role="status"
          className="mb-3 flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm text-muted-foreground"
        >
          <p className="flex-1">{LEVELS.notice}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={LEVELS.dismiss}
            className="-m-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <LevelCard profile={profile} />
    </div>
  );
}

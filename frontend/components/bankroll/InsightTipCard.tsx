"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, Sparkles, AlertTriangle, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InsightTip, InsightTone } from "@/lib/bankroll/insights";

const TONE_META: Record<InsightTone, { icon: LucideIcon; cls: string }> = {
  positive: { icon: TrendingUp, cls: "text-emerald-400" },
  warning: { icon: AlertTriangle, cls: "text-amber-400" },
  neutral: { icon: Sparkles, cls: "text-violet-400" },
};

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** Same collapsible-card / bold-paragraph shell as components/poker/CoachingCard.tsx, adapted for a list of distinct tips rather than one long analysis. */
export function InsightTipCard({ tips }: { tips: InsightTip[] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-card to-card/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
              <Brain className="h-4 w-4 text-violet-400" />
            </div>
            Coach&apos;s Tips
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3.5">
          {tips.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">Log a few more sessions and your coach will start spotting patterns here.</p>
          ) : (
            tips.map((tip) => {
              const meta = TONE_META[tip.tone];
              const Icon = meta.icon;
              return (
                <div key={tip.id} className="flex items-start gap-2.5">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.cls)} />
                  <p className="text-sm leading-relaxed text-muted-foreground">{renderBold(tip.text)}</p>
                </div>
              );
            })
          )}
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { Trophy, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, scoreToLabel } from "@/lib/utils";
import type { OverallVerdict } from "@/lib/types";

interface VerdictCardProps {
  verdict: OverallVerdict;
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  const { label, color } = scoreToLabel(verdict.score);

  return (
    <Card className="border-poker-green/20 bg-gradient-to-br from-card to-poker-felt/30 animate-slide-up">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-poker-gold/20">
            <Trophy className="h-4 w-4 text-poker-gold" />
          </div>
          Hand Verdict
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 border-poker-green/30 bg-poker-green/10">
            <span className={cn("text-2xl font-bold tabular-nums", color)}>{verdict.score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-base font-bold", color)}>{label}</p>
            <p className="text-xs text-muted-foreground truncate">{verdict.title}</p>
            <Progress value={verdict.score} className="h-1.5 mt-2" />
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs leading-relaxed text-muted-foreground">{verdict.summary}</p>

        {/* Mistakes & strengths */}
        <div className="grid grid-cols-2 gap-3">
          {verdict.key_mistakes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/80">
                Leaks
              </p>
              {verdict.key_mistakes.map((m, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">{m}</p>
                </div>
              ))}
            </div>
          )}
          {verdict.key_strengths.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-poker-green/80">
                Strengths
              </p>
              {verdict.key_strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-poker-green mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">{s}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

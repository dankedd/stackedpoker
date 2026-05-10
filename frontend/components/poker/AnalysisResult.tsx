"use client";

import { cn, severityColor, severityIcon, scoreToLabel, formatBB } from "@/lib/utils";
import type { AnalysisResponse } from "@/lib/types";
import { BoardDisplay } from "./BoardDisplay";
import { HoleCards } from "./PlayingCard";
import { ActionTimeline } from "./ActionTimeline";
import { CoachingCard } from "./CoachingCard";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Coins,
} from "lucide-react";

interface AnalysisResultProps {
  result: AnalysisResponse;
}

export function AnalysisResult({ result }: AnalysisResultProps) {
  const { parsed_hand: hand, spot_classification: spot, board_texture: texture, findings, overall_score, recommendations } = result;
  const { label: scoreLabel, color: scoreColor } = scoreToLabel(overall_score);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Score Overview */}
      <Card className="border-border/50 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-poker-green/50 via-poker-green to-poker-green/50" />
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Score */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-poker-green/30 bg-poker-green/10">
                <span className={cn("text-2xl font-bold", scoreColor)}>{overall_score}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Hand Score</p>
                <p className={cn("text-lg font-bold", scoreColor)}>{scoreLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.mistakes_count} mistake{result.mistakes_count !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <Progress value={overall_score} className="h-2" />
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Badge variant="outline">{hand.site}</Badge>
              <Badge variant="outline">${hand.stakes}</Badge>
              <Badge variant="green">{spot.pot_type}</Badge>
              <Badge variant="outline">{hand.hero_position}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hand Info */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-poker-green" />
              Hand Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hero cards */}
            {hand.hero_cards.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Hero&apos;s Hand</p>
                <div className="flex items-center gap-4">
                  <HoleCards cards={hand.hero_cards} size="lg" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{hand.hero_name}</p>
                    <p className="text-muted-foreground">{hand.hero_position}</p>
                    <p className="text-muted-foreground">{formatBB(hand.effective_stack_bb)} effective</p>
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Spot details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pot Type</p>
                <Badge variant="green">{spot.pot_type}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stack Depth</p>
                <Badge variant="outline">{spot.stack_depth}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Position</p>
                <p className="font-medium">{spot.hero_is_ip ? "In Position (IP)" : "Out of Position (OOP)"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Role</p>
                <p className="font-medium">{spot.hero_is_pfr ? "Preflop Raiser" : "Caller"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pot size:</span>
              <span className="font-medium">{formatBB(hand.pot_size_bb)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Board */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-poker-green" />
              Board Texture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BoardDisplay board={hand.board} texture={texture} />
          </CardContent>
        </Card>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-poker-green" />
              Analysis Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.map((finding, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4 space-y-2",
                  severityColor(finding.severity)
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{severityIcon(finding.severity)}</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                        {finding.street} — {finding.severity}
                      </p>
                      <p className="text-sm font-medium mt-0.5">{finding.action_taken}</p>
                    </div>
                  </div>
                  {finding.freq_recommendation && (
                    <span className="text-xs opacity-60 text-right flex-shrink-0 max-w-[140px]">
                      {finding.freq_recommendation}
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-90 leading-relaxed">{finding.explanation}</p>
                <div className="flex items-start gap-1.5 pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 opacity-70 flex-shrink-0" />
                  <p className="text-xs opacity-80 font-medium">{finding.recommendation}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-poker-green" />
              Key Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* AI Coaching */}
      <CoachingCard coaching={result.ai_coaching} score={overall_score} />

      {/* Action Timeline */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Hand Replay</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionTimeline actions={hand.actions} heroName={hand.hero_name} />
        </CardContent>
      </Card>
    </div>
  );
}

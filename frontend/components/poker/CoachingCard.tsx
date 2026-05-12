"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CoachingCardProps {
  coaching: string;
  score: number;
}

export function CoachingCard({ coaching, score }: CoachingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coaching);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paragraphs = coaching
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const scoreColor =
    score >= 80
      ? "text-violet-400"
      : score >= 60
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-card to-poker-card/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
              <Brain className="h-4 w-4 text-violet-400" />
            </div>
            AI Coach Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-bold", scoreColor)}>{score}/100</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              title="Copy coaching"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-violet-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="prose-poker space-y-3">
            {paragraphs.map((para, i) => {
              // Render markdown-style bold
              const parts = para.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {parts.map((part, j) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={j} className="text-foreground font-semibold">
                        {part.slice(2, -2)}
                      </strong>
                    ) : (
                      <span key={j}>{part}</span>
                    )
                  )}
                </p>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Brain, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VisionAnalysisResponse, ReplayAnalysis } from "@/lib/types";

function buildCoachingMarkdown(analysis: ReplayAnalysis): string {
  const { overall_verdict, actions } = analysis;
  const lines: string[] = [];

  lines.push(`# ${overall_verdict.title}`);
  lines.push(overall_verdict.summary);

  if (overall_verdict.key_mistakes.length > 0) {
    lines.push("", "# Key Mistakes");
    overall_verdict.key_mistakes.forEach((m) => lines.push(`- ${m}`));
  }

  if (overall_verdict.key_strengths.length > 0) {
    lines.push("", "# Key Strengths");
    overall_verdict.key_strengths.forEach((s) => lines.push(`- ${s}`));
  }

  const feedbackActions = actions.filter((a) => a.is_hero && a.feedback);
  if (feedbackActions.length > 0) {
    lines.push("", "# Action Feedback");
    feedbackActions.forEach((a) => {
      if (!a.feedback) return;
      lines.push(`## ${a.feedback.title}`);
      lines.push(a.feedback.explanation);
      if (a.feedback.gto_note) lines.push(`- ${a.feedback.gto_note}`);
    });
  }

  return lines.join("\n");
}

interface VisionCoachingResultProps {
  result: VisionAnalysisResponse;
}

// Inline markdown: handles **bold** and plain text
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-foreground font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "li"; text: string }
  | { kind: "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    // List items are already pushed individually; buffer is only used to
    // detect list boundaries — nothing to flush here beyond resetting.
    listBuffer = [];
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushList();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
    } else if (/^[-*] /.test(line)) {
      listBuffer.push(line);
      blocks.push({ kind: "li", text: line.slice(2).trim() });
    } else if (line.trim()) {
      flushList();
      blocks.push({ kind: "p", text: line.trim() });
    }
  }

  return blocks;
}

// Section colors keyed by h1 title keywords
function sectionAccent(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("mistake")) return "border-red-500/30 bg-red-500/5";
  if (t.includes("alternative") || t.includes("better")) return "border-yellow-500/30 bg-yellow-500/5";
  if (t.includes("verdict") || t.includes("gto")) return "border-violet-500/30 bg-violet-500/5";
  if (t.includes("coaching") || t.includes("summary")) return "border-blue-500/30 bg-blue-500/5";
  return "border-border/50";
}

export function VisionCoachingResult({ result }: VisionCoachingResultProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const coachingMarkdown = buildCoachingMarkdown(result.analysis);
  const blocks = parseBlocks(coachingMarkdown);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coachingMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group blocks into sections split by h1 headings
  type Section = { heading: string; blocks: Block[]; index: number };
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const block of blocks) {
    if (block.kind === "h1") {
      if (current) sections.push(current);
      current = { heading: block.text, blocks: [], index: sections.length };
    } else if (current) {
      current.blocks.push(block);
    }
  }
  if (current) sections.push(current);

  const toggleSection = (index: number) =>
    setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header card */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-card to-poker-card/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
                <Brain className="h-4 w-4 text-violet-400" />
              </div>
              AI Vision Analysis
              <span className="text-xs text-muted-foreground font-normal ml-1">
                · {result.filename}
              </span>
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copy full analysis">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-violet-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Sections */}
      {sections.map((section) => {
        const isCollapsed = collapsed[section.index];
        return (
          <Card key={section.index} className={cn("border overflow-hidden", sectionAccent(section.heading))}>
            <button
              type="button"
              onClick={() => toggleSection(section.index)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <h2 className="text-sm font-semibold text-foreground">{section.heading}</h2>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>

            {!isCollapsed && (
              <CardContent className="pt-0 pb-4 space-y-3">
                {section.blocks.map((block, i) => {
                  if (block.kind === "h2") {
                    return (
                      <h3 key={i} className="text-xs font-semibold uppercase tracking-wider text-violet-400/80 mt-4 mb-1">
                        {block.text}
                      </h3>
                    );
                  }
                  if (block.kind === "li") {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {renderInline(block.text)}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {renderInline(block.text)}
                    </p>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Bug, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineResult } from "@/lib/hand-schema";

interface PipelineDebugPanelProps {
  pipeline: PipelineResult;
  className?: string;
}

type Tab = "canonical" | "validation" | "entities" | "diagnostics";

export function PipelineDebugPanel({ pipeline, className }: PipelineDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("validation");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded border border-border/30 bg-secondary/30 px-2 py-1",
          "text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors",
          className,
        )}
      >
        <Bug className="h-3 w-3" />
        Debug pipeline
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }

  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: "validation",   label: "Validation",   available: true },
    { id: "canonical",    label: "Canonical JSON", available: true },
    { id: "entities",     label: "Raw Entities",  available: !!pipeline.raw_extracted_entities },
    { id: "diagnostics",  label: "Parse Diag.",   available: !!pipeline.parse_diagnostics },
  ];

  const content: Record<Tab, unknown> = {
    validation:  pipeline.validation,
    canonical:   pipeline.canonical,
    entities:    pipeline.raw_extracted_entities,
    diagnostics: pipeline.parse_diagnostics,
  };

  return (
    <div className={cn(
      "rounded-lg border border-amber-500/20 bg-amber-500/4",
      className,
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/3 transition-colors rounded-t-lg"
      >
        <Bug className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-medium text-amber-300 flex-1 text-left">
          Pipeline Debug
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400/60">
          <span className="text-emerald-400/60">
            {pipeline.validation.valid ? "✓ valid" : "✗ invalid"}
          </span>
          <span>·</span>
          <span>{(pipeline.validation.confidence * 100).toFixed(0)}% conf</span>
          <span>·</span>
          <span>{pipeline.canonical.site}</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-amber-400/60" />
      </button>

      {/* Tabs */}
      <div className="flex border-t border-amber-500/10 px-3 gap-1 pt-2">
        {tabs.filter(t => t.available).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-2 py-1 text-[10px] rounded font-medium transition-colors",
              activeTab === tab.id
                ? "bg-amber-500/15 text-amber-300"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-3 pb-3 pt-2">
        {activeTab === "validation" && (
          <ValidationDebug pipeline={pipeline} />
        )}
        {activeTab !== "validation" && content[activeTab] != null && (
          <JsonViewer data={content[activeTab]} />
        )}
      </div>
    </div>
  );
}

// ── Validation debug view ─────────────────────────────────────────────────────

function ValidationDebug({ pipeline }: { pipeline: PipelineResult }) {
  const { validation, canonical } = pipeline;
  return (
    <div className="space-y-3 text-[11px]">
      {/* Summary row */}
      <div className="flex gap-3 flex-wrap">
        <Stat label="Valid"      value={validation.valid ? "YES" : "NO"}       ok={validation.valid} />
        <Stat label="Can Analyze" value={validation.can_analyze ? "YES" : "NO"} ok={validation.can_analyze} />
        <Stat label="Confidence" value={`${(validation.confidence * 100).toFixed(1)}%`} ok={validation.confidence >= 0.7} />
        <Stat label="Errors"     value={String(validation.errors.length)}   ok={validation.errors.length === 0} />
        <Stat label="Warnings"   value={String(validation.warnings.length)} ok={validation.warnings.length === 0} />
        <Stat label="Hero"       value={validation.hero_detected_by || "?"} ok />
      </div>

      {/* Hand summary */}
      <div className="rounded bg-black/20 p-2 space-y-0.5 font-mono">
        <Row label="hand_id"    value={canonical.hand_id} />
        <Row label="site"       value={canonical.site} />
        <Row label="game_type"  value={canonical.game_type} />
        <Row label="players"    value={String(canonical.players.length)} />
        <Row label="streets"    value={canonical.streets.map(s => s.name).join(", ")} />
        <Row label="eff_stack"  value={`${canonical.effective_stack_bb.toFixed(1)}bb`} />
        <Row label="final_pot"  value={`${canonical.final_pot_bb.toFixed(1)}bb`} />
        <Row label="hero_id"    value={canonical.hero_id} />
      </div>

      {/* Errors list */}
      {validation.errors.length > 0 && (
        <div>
          <p className="text-red-400 font-medium mb-1">Errors ({validation.errors.length})</p>
          <div className="space-y-1">
            {validation.errors.map((e, i) => (
              <div key={i} className="rounded bg-red-500/10 px-2 py-1 font-mono">
                <span className="text-red-400">[{e.code}]</span>
                <span className="text-red-300/80 ml-1">{e.message}</span>
                {e.field && <span className="text-red-400/40 ml-1">@ {e.field}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings list */}
      {validation.warnings.length > 0 && (
        <div>
          <p className="text-amber-400 font-medium mb-1">Warnings ({validation.warnings.length})</p>
          <div className="space-y-1">
            {validation.warnings.map((w, i) => (
              <div key={i} className="rounded bg-amber-500/10 px-2 py-1 font-mono">
                <span className="text-amber-400">[{w.code}]</span>
                <span className="text-amber-300/80 ml-1">{w.message}</span>
                {w.field && <span className="text-amber-400/40 ml-1">@ {w.field}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex flex-col items-center rounded bg-black/20 px-2 py-1 min-w-[56px]">
      <span className={cn("font-mono font-bold", ok ? "text-emerald-400" : "text-red-400")}>
        {value}
      </span>
      <span className="text-muted-foreground/50 text-[9px] uppercase">{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/40 w-24 shrink-0">{label}</span>
      <span className="text-muted-foreground/80 truncate">{value}</span>
    </div>
  );
}

// ── JSON viewer ───────────────────────────────────────────────────────────────

function JsonViewer({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1 rounded border border-border/30 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="max-h-80 overflow-auto rounded bg-black/30 p-3 text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
        {json}
      </pre>
    </div>
  );
}

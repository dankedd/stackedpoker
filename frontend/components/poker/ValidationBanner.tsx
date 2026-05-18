"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineValidationResult, PipelineValidationError } from "@/lib/hand-schema";

interface ValidationBannerProps {
  validation: PipelineValidationResult;
  className?: string;
}

export function ValidationBanner({ validation, className }: ValidationBannerProps) {
  const hasErrors   = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  if (validation.valid && !hasWarnings) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5",
        className,
      )}>
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-emerald-300">Hand validated</span>
          <span className="ml-2 text-xs text-emerald-400/60">
            Confidence {(validation.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Confidence bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              validation.confidence >= 0.8 ? "bg-emerald-500" :
              validation.confidence >= 0.5 ? "bg-amber-500" : "bg-red-500",
            )}
            style={{ width: `${validation.confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {(validation.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 divide-y divide-red-500/10">
          {validation.errors.map((e, i) => (
            <ErrorRow key={i} error={e} icon="error" />
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/6 divide-y divide-amber-500/10">
          {validation.warnings.map((w, i) => (
            <ErrorRow key={i} error={w} icon="warning" />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorRow({
  error,
  icon,
}: {
  error: PipelineValidationError;
  icon: "error" | "warning";
}) {
  const Icon = icon === "error" ? XCircle : AlertTriangle;
  const colorClass = icon === "error" ? "text-red-400" : "text-amber-400";
  const msgClass   = icon === "error" ? "text-red-300" : "text-amber-300";
  const codeClass  = icon === "error" ? "text-red-400/50" : "text-amber-400/50";

  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", colorClass)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs leading-relaxed", msgClass)}>{error.message}</p>
        {error.field && (
          <p className={cn("text-[11px] mt-0.5 font-mono", codeClass)}>
            {error.field}
          </p>
        )}
      </div>
      <span className={cn("text-[10px] font-mono shrink-0 mt-0.5 opacity-60", colorClass)}>
        {error.code}
      </span>
    </div>
  );
}

/** Compact inline badge for use inside cards/timelines */
export function ConfidencePill({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
      pct >= 80 ? "bg-emerald-500/15 text-emerald-400" :
      pct >= 50 ? "bg-amber-500/15 text-amber-400"   :
                  "bg-red-500/15 text-red-400",
      className,
    )}>
      <Info className="h-2.5 w-2.5" />
      {pct}%
    </span>
  );
}

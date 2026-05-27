"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, RotateCcw, FileText, ImageIcon,
  Zap, AlertTriangle, BookmarkCheck, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HandInput } from "@/components/poker/HandInput";
import { ImageUpload } from "@/components/poker/ImageUpload";
import { AnalysisResult } from "@/components/poker/AnalysisResult";
import { AnalysisSetup, ANALYSIS_SETUP_DEFAULT } from "@/components/poker/AnalysisSetup";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";
import { UsageWidget } from "@/components/poker/UsageWidget";
import { UpgradePrompt, LoginCTA } from "@/components/poker/UpgradePrompt";
import { GGPokerImportGuide } from "@/components/onboarding/GGPokerImportGuide";
import { HandReplay } from "@/components/replay/HandReplay";
import { HandConfirmation } from "@/components/replay/HandConfirmation";
import { HandRepairUI } from "@/components/poker/HandRepairUI";
import { PipelineDebugPanel } from "@/components/poker/PipelineDebugPanel";
import { ValidationBanner } from "@/components/poker/ValidationBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePipeline } from "@/hooks/usePipeline";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useSolver } from "@/hooks/useSolver";
import { useUsage } from "@/hooks/useUsage";
import { useAuth } from "@/contexts/AuthContext";
import SolverPanel from "@/components/solver/SolverPanel";
import { cn } from "@/lib/utils";
import type { PipelineResult } from "@/lib/hand-schema";

type Tab = "text" | "image";

// Show debug panel only in dev builds
const IS_DEV = process.env.NODE_ENV === "development";

const SETUP_KEY     = "poker_analysis_setup";
const HAND_KEY      = "poker_session_hand_prefill";
const SES_SETUP_KEY = "poker_session_hand_setup";

const PIPELINE_STAGES = [
  "Parsing hand history…",
  "Normalizing entities…",
  "Validating structure…",
  "Checking pot math…",
  "Evaluating decisions…",
  "Generating coaching…",
];

export default function AnalyzePage() {
  const [fromSession] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("from") === "session";
  });

  const [activeTab, setActiveTab] = useState<Tab>("text");

  const [setup, setSetup] = useState<AnalysisSetupValue>(() => {
    if (typeof window === "undefined") return ANALYSIS_SETUP_DEFAULT;
    try {
      const ses = sessionStorage.getItem(SES_SETUP_KEY);
      if (ses) { sessionStorage.removeItem(SES_SETUP_KEY); return JSON.parse(ses); }
      const loc = localStorage.getItem(SETUP_KEY);
      return loc ? JSON.parse(loc) : ANALYSIS_SETUP_DEFAULT;
    } catch { return ANALYSIS_SETUP_DEFAULT; }
  });

  const [prefillHand] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const t = sessionStorage.getItem(HAND_KEY) ?? "";
    if (t) sessionStorage.removeItem(HAND_KEY);
    return t;
  });

  const { user, loading: authLoading } = useAuth();
  const { usage, loading: usageLoading, refetch: refetchUsage } = useUsage();

  // ── Hooks ────────────────────────────────────────────────────────────────
  const pipeline = usePipeline();
  const image    = useImageAnalysis();
  const solver   = useSolver();

  const [stageIdx, setStageIdx] = useState(0);
  const resultRef    = useRef<HTMLDivElement>(null);
  const autoAnalyzed = useRef(false);

  const scrollToResult = () =>
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  const handleSetupChange = (v: AnalysisSetupValue) => {
    setSetup(v);
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(v)); } catch {}
  };

  // Auto-analyze from session flow
  useEffect(() => {
    if (
      prefillHand && fromSession && !autoAnalyzed.current &&
      !authLoading && !usageLoading && user && !usage?.isOverLimit
    ) {
      autoAnalyzed.current = true;
      pipeline.prepare(prefillHand, IS_DEV).then(() => {
        scrollToResult();
        refetchUsage();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, usageLoading, user, usage?.isOverLimit]);

  const handleTextSubmit = async (text: string) => {
    if (!user) return;
    await pipeline.prepare(text, IS_DEV);
    scrollToResult();
    if (pipeline.stage !== "error") refetchUsage();
  };

  const handleRepairAnalyze = async (repaired: PipelineResult) => {
    if (!user) return;
    await pipeline.analyze(repaired, setup);
    scrollToResult();
    refetchUsage();
  };

  const handleImageUpload = async (file: File) => {
    await image.extract(file);
    scrollToResult();
  };

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    pipeline.reset();
    image.reset();
  };

  // Loading stage animation
  const isTextLoading = pipeline.stage === "preparing" || pipeline.stage === "analyzing";
  const isLoading = activeTab === "text" ? isTextLoading : (image.isExtracting || image.isAnalyzing);

  useEffect(() => {
    if (!isLoading) { setStageIdx(0); return; }
    const t = setInterval(() => setStageIdx(i => (i + 1) % PIPELINE_STAGES.length), 2000);
    return () => clearInterval(t);
  }, [isLoading]);

  // ── Derived state ────────────────────────────────────────────────────────
  const imgBusy       = image.isExtracting || image.isAnalyzing;
  const imgConfirming = activeTab === "image" && image.isConfirming;
  const imgSuccess    = activeTab === "image" && image.isSuccess;

  const textRepairing = activeTab === "text" && pipeline.stage === "repairing";
  const textSuccess   = activeTab === "text" && pipeline.stage === "success";
  const textError     = activeTab === "text" && pipeline.stage === "error";
  const imgError      = activeTab === "image" && image.isError && !image.extraction;

  const hasError  = textError || imgError;
  const hasResult = textSuccess || imgSuccess;

  const handleReset = activeTab === "text" ? pipeline.reset : image.reset;

  const isAuthLoading = authLoading || (!!user && usageLoading);
  const isGated       = !authLoading && !user;
  const isOverLimit   = !isGated && !!usage?.isOverLimit;
  const canAnalyze    = !isGated && !isOverLimit;

  const hideInput = fromSession && !!prefillHand && autoAnalyzed.current;

  const backHref  = fromSession ? "/analyze/session" : "/analyze";
  const backLabel = fromSession ? "Back to Session"  : "Back to Analyze";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className={cn(
          "mx-auto px-4 sm:px-6",
          hasResult || textRepairing ? "max-w-[1680px] xl:px-10" : "max-w-2xl",
        )}>

          {/* ── Navigation: back link OR "New Hand" ghost button ──── */}
          {hasResult ? (
            <button
              type="button"
              onClick={() => {
                handleReset();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground/70 hover:text-violet-400 transition-colors group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              New Hand
            </button>
          ) : (
            <Link
              href={backHref}
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          )}

          {/* Import guide */}
          {!hideInput && !imgConfirming && !imgSuccess && !hasResult && !isLoading && !textRepairing && (
            <GGPokerImportGuide className="mb-5" />
          )}

          {/* ── Input card ─────────────────────────────────────────────── */}
          {!hideInput && !hasResult && !imgConfirming && !imgSuccess && !textRepairing && (
            <Card className={cn("border-border/50", hasResult && "border-violet-500/20 mb-8")}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                      <Zap className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <CardTitle>Hand Analysis</CardTitle>
                      <CardDescription className="mt-0.5">
                        Paste a hand history or upload a screenshot. The hand is validated before any analysis runs.
                      </CardDescription>
                    </div>
                  </div>

                  {user && usage && !isAuthLoading && (
                    <UsageWidget usage={usage} className="mt-0.5 shrink-0" />
                  )}
                </div>

                {canAnalyze && (
                  <div className="mt-3 inline-flex rounded-lg border border-border/60 bg-secondary/40 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("text")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        activeTab === "text"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Hand History
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("image")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        activeTab === "image"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Screenshot
                    </button>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                {isAuthLoading && (
                  <div className="py-10 flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-t-violet-500 animate-spin" />
                  </div>
                )}

                {!isAuthLoading && isGated && <LoginCTA />}
                {!isAuthLoading && isOverLimit && usage && (
                  <UpgradePrompt used={usage.used} limit={usage.limit} />
                )}

                {!isAuthLoading && canAnalyze && (
                  <div className="space-y-4">
                    <AnalysisSetup
                      value={setup}
                      onChange={handleSetupChange}
                      className="pb-4 border-b border-border/30"
                    />

                    {activeTab === "text" ? (
                      <HandInput
                        onAnalyze={handleTextSubmit}
                        isLoading={isTextLoading}
                        initialValue={prefillHand || undefined}
                      />
                    ) : (
                      <ImageUpload onAnalyze={handleImageUpload} isLoading={imgBusy} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Loading ─────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-7 animate-fade-in">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border border-violet-500/15" />
                <div className="absolute inset-0 rounded-full border border-t-violet-400 border-r-violet-300/40 animate-spin" style={{ animationDuration: "1.1s" }} />
                <div className="absolute inset-[6px] rounded-full border border-t-blue-400/50 border-l-transparent animate-spin" style={{ animationDuration: "1.7s", animationDirection: "reverse" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-violet-500/60 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="font-medium text-foreground animate-fade-in" key={stageIdx}>
                  {image.isExtracting ? "Extracting poker state…" :
                   image.isAnalyzing  ? "Generating AI coaching…" :
                   pipeline.stage === "preparing" ? PIPELINE_STAGES[Math.min(stageIdx, 3)] :
                   PIPELINE_STAGES[Math.max(stageIdx, 4)]}
                </p>

                {/* Stage dots */}
                {!image.isExtracting && !image.isAnalyzing && (
                  <div className="flex items-center justify-center gap-1.5">
                    {PIPELINE_STAGES.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          background: i < stageIdx
                            ? "rgba(124, 92, 255, 0.5)"
                            : i === stageIdx
                            ? "rgba(124, 92, 255, 0.9)"
                            : "rgba(255,255,255,0.1)",
                          width: i === stageIdx ? "16px" : "4px",
                          height: "4px",
                        }}
                      />
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground/60">
                  {pipeline.stage === "preparing"
                    ? "Parse → normalize → validate (deterministic, no AI)"
                    : pipeline.stage === "analyzing"
                    ? "GTO analysis in progress"
                    : "Processing…"}
                </p>
              </div>
            </div>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {hasError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-destructive">Analysis failed</p>
                <p className="text-sm text-destructive/80">
                  {activeTab === "text" ? pipeline.error : image.error}
                </p>
                <div className="flex items-center gap-3">
                  {image.extraction && (
                    <Button variant="outline" size="sm" onClick={image.backToConfirm} className="gap-2 text-xs">
                      ← Back to review
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 text-xs">
                    <RotateCcw className="h-3 w-3" />
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Repair UI (validation failed or low confidence) ───────────── */}
          {textRepairing && pipeline.pipeline && (
            <div ref={resultRef}>
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-amber-300/70">
                  Validation required before analysis
                </span>
              </div>

              <Card className="border-amber-500/20">
                <CardContent className="pt-5">
                  <HandRepairUI
                    pipeline={pipeline.pipeline}
                    onRepaired={pipeline.acceptRepair}
                    onAnalyze={r => handleRepairAnalyze(r)}
                    onReset={handleReset}
                    isAnalyzing={pipeline.stage === "analyzing"}
                  />
                </CardContent>
              </Card>

              {IS_DEV && pipeline.pipeline && (
                <PipelineDebugPanel
                  pipeline={pipeline.pipeline}
                  className="mt-4"
                />
              )}
            </div>
          )}

          {/* ── Image confirmation ─────────────────────────────────────────── */}
          {imgConfirming && image.extraction && (
            <div ref={resultRef}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Review Extraction</h2>
                <Button variant="outline" size="sm" onClick={image.reset} className="gap-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  New Screenshot
                </Button>
              </div>
              <HandConfirmation
                extraction={image.extraction}
                onConfirm={image.confirm}
                onReset={image.reset}
                isAnalyzing={image.isAnalyzing}
              />
            </div>
          )}

          {/* Image: analysis in progress (blurred confirmation) */}
          {image.isAnalyzing && image.extraction && (
            <div ref={resultRef} className="opacity-50 pointer-events-none">
              <HandConfirmation
                extraction={image.extraction}
                onConfirm={() => {}}
                onReset={() => {}}
                isAnalyzing={true}
              />
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────────── */}
          {hasResult && (
            <div ref={resultRef}>
              {activeTab === "text" && pipeline.result && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">
                      Analysis Results
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        {pipeline.result.parsed_hand.site} · ${pipeline.result.parsed_hand.stakes}
                      </span>
                    </h2>
                  </div>

                  {/* Validation summary chip */}
                  {pipeline.pipeline && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/6 px-3 py-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">
                        Validated · {(pipeline.pipeline.validation.confidence * 100).toFixed(0)}% confidence
                        {pipeline.pipeline.validation.warnings.length > 0 && (
                          <span className="ml-2 text-amber-400/70">
                            {pipeline.pipeline.validation.warnings.length} warning{pipeline.pipeline.validation.warnings.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {user && pipeline.result.saved_id && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                      <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">Saved to your account</span>
                      <Link href="/history" className="ml-auto text-xs text-emerald-400/70 hover:text-emerald-400 underline underline-offset-2 transition-colors">
                        View History →
                      </Link>
                    </div>
                  )}

                  {user && !pipeline.result.saved_id && pipeline.result.save_error && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-400">
                        Analysis complete — history save failed
                        <span className="ml-1 opacity-70">({pipeline.result.save_error})</span>
                      </span>
                    </div>
                  )}

                  {pipeline.result.replay ? (
                    <HandReplay
                      analysis={pipeline.result.replay}
                      filename={pipeline.result.parsed_hand.hand_id}
                      validation={{
                        confidence: pipeline.pipeline?.validation.confidence ?? 1.0,
                        hero_detected_by: pipeline.pipeline?.validation.hero_detected_by ?? "hand_history",
                        warnings: (pipeline.pipeline?.validation.warnings ?? []).map(w => w.message),
                        errors: [],
                        is_valid: true,
                      }}
                      engineVersion={pipeline.result.engine_version}
                      correctionsApplied={pipeline.result.corrections_applied}
                      solver={pipeline.result.solver}
                      trace={pipeline.result.trace}
                    />
                  ) : (
                    <AnalysisResult result={pipeline.result} />
                  )}

                  {/* Solver Panel — detailed GTO strategy with combo breakdowns */}
                  <div className="mt-4">
                    <SolverPanel
                      state={solver.state}
                      strategy={solver.strategy}
                      error={solver.error}
                      onSolve={() => {
                        const board = pipeline.result?.parsed_hand?.board;
                        const spot = pipeline.result?.spot_classification;
                        if (!board || !spot) return;
                        const flopCards = board.flop ?? [];
                        if (flopCards.length < 3) return;
                        solver.solve({
                          spot_type: spot.pot_type ?? "SRP",
                          positions: spot.position_matchup ?? "BTN_vs_BB",
                          stack_depth: pipeline.result?.parsed_hand?.effective_stack_bb ?? 100,
                          board: flopCards,
                          max_iterations: 100,
                          accuracy_target: 0.5,
                        });
                      }}
                    />
                  </div>

                  {/* Debug panel (dev only) */}
                  {IS_DEV && pipeline.pipeline && (
                    <PipelineDebugPanel
                      pipeline={pipeline.pipeline}
                      className="mt-6"
                    />
                  )}
                </>
              )}

              {activeTab === "image" && image.result && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">Screenshot Analysis</h2>
                  </div>
                  {user && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                      <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">Saved to your account</span>
                      <Link href="/history" className="ml-auto text-xs text-emerald-400/70 hover:text-emerald-400 underline underline-offset-2 transition-colors">
                        View History →
                      </Link>
                    </div>
                  )}
                  <HandReplay
                    analysis={image.result.analysis}
                    filename={image.filename}
                    validation={image.result.validation}
                  />
                </>
              )}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

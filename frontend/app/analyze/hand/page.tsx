"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, RotateCcw, FileText, ImageIcon,
  Zap, AlertTriangle, ShieldCheck, TreePine, BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HandInput } from "@/components/poker/HandInput";
import { ImageUpload } from "@/components/poker/ImageUpload";
import HandSolverWalkthrough from "@/components/solver/HandSolverWalkthrough";
import { useHandSolverWalkthrough } from "@/hooks/useHandSolverWalkthrough";
import { AnalysisSetup, ANALYSIS_SETUP_DEFAULT } from "@/components/poker/AnalysisSetup";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";
import { UsageWidget } from "@/components/poker/UsageWidget";
import { UpgradePrompt, LoginCTA } from "@/components/poker/UpgradePrompt";
import { GGPokerImportGuide } from "@/components/onboarding/GGPokerImportGuide";
import CanonicalHandTimeline from "@/components/replay/CanonicalHandTimeline";
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
import type { PipelineResult, CanonicalHand } from "@/lib/hand-schema";

type Tab = "text" | "image";

// Show debug panel only in dev builds
const IS_DEV = process.env.NODE_ENV === "development";

const SETUP_KEY     = "poker_analysis_setup";
const HAND_KEY      = "poker_session_hand_prefill";
const SES_SETUP_KEY = "poker_session_hand_setup";

// ── Derive solver spot from canonical hand (no AI analysis needed) ────────────

function deriveSpotFromCanonical(canonical: CanonicalHand): {
  spot_type: string;
  positions: string;
  board: string[];
} {
  const flopStreet = canonical.streets.find(s => s.name === "flop");
  const preflopStreet = canonical.streets.find(s => s.name === "preflop");

  const board = flopStreet?.board_cards.map(c => c.notation) ?? [];

  // Spot type: count preflop raises (1=SRP, 2=3BP, 3+=4BP)
  const raises = preflopStreet?.actions.filter(a => a.action === "raise").length ?? 0;
  const spot_type = raises >= 3 ? "4BP" : raises === 2 ? "3BP" : "SRP";

  // Positions: first two unique flop actors (OOP acts first, IP acts second)
  const flopActorIds: string[] = [];
  for (const a of flopStreet?.actions ?? []) {
    if (!a.action.startsWith("post_") && !flopActorIds.includes(a.player_id)) {
      flopActorIds.push(a.player_id);
      if (flopActorIds.length === 2) break;
    }
  }
  const playerById = Object.fromEntries(canonical.players.map(p => [p.id, p]));
  let positions = "BTN_vs_BB";
  if (flopActorIds.length >= 2) {
    const oopPos = playerById[flopActorIds[0]]?.position ?? "BB";
    const ipPos  = playerById[flopActorIds[1]]?.position ?? "BTN";
    positions = `${ipPos}_vs_${oopPos}`;
  }

  return { spot_type, positions, board };
}

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
  const pipeline    = usePipeline({ skipAnalyze: true });
  const image       = useImageAnalysis();
  const solver      = useSolver();
  const walkthrough = useHandSolverWalkthrough();

  const resultRef        = useRef<HTMLDivElement>(null);
  const autoAnalyzed     = useRef(false);
  const autoSolvedRef    = useRef(false);
  const autoWalkthroughRef = useRef(false);

  // ── Hero side: derived from canonical hand (first flop actor = OOP) ─────────
  const heroSide = useMemo<"ip" | "oop">(() => {
    const canonical = pipeline.pipeline?.canonical;
    if (!canonical) return "oop";
    const hero = canonical.players.find(p => p.is_hero);
    if (!hero) return "oop";
    const flopStreet = canonical.streets.find(s => s.name === "flop");
    const flopActorIds: string[] = [];
    for (const a of flopStreet?.actions ?? []) {
      if (!a.action.startsWith("post_") && !flopActorIds.includes(a.player_id)) {
        flopActorIds.push(a.player_id);
        if (flopActorIds.length === 2) break;
      }
    }
    if (flopActorIds.length >= 2) {
      return flopActorIds[0] === hero.id ? "oop" : "ip";
    }
    return hero.position === "BB" ? "oop" : "ip";
  }, [pipeline.pipeline?.canonical]);

  // ── Reset auto-flags + solver when pipeline resets ───────────────────────
  useEffect(() => {
    if (pipeline.stage === "idle") {
      autoSolvedRef.current = false;
      autoWalkthroughRef.current = false;
      solver.reset();
      walkthrough.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.stage]);

  // ── Auto-trigger solver once parse succeeds ───────────────────────────────
  useEffect(() => {
    if (pipeline.stage !== "success" || autoSolvedRef.current) return;
    const canonical = pipeline.pipeline?.canonical;
    if (!canonical) return;

    const { spot_type, positions, board } = deriveSpotFromCanonical(canonical);
    if (board.length < 3) return;

    autoSolvedRef.current = true;
    solver.solve({
      spot_type,
      positions,
      stack_depth: canonical.effective_stack_bb ?? 100,
      board,
      // Use SolveJobConfig server default (500 iter, 0.3% accuracy)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.stage, pipeline.pipeline?.canonical]);

  // ── Auto-run walkthrough once solver completes ────────────────────────────
  useEffect(() => {
    if (
      solver.state === "completed" &&
      solver.jobId &&
      pipeline.pipeline?.canonical &&
      !autoWalkthroughRef.current
    ) {
      autoWalkthroughRef.current = true;
      walkthrough.run(solver.jobId, pipeline.pipeline.canonical);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solver.state, solver.jobId, pipeline.pipeline?.canonical]);

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
    solver.reset();
    walkthrough.reset();
  };

  // Loading: covers parse phase + all solver states until completion
  const solverBusy = solver.state === "submitting" || solver.state === "queued" || solver.state === "running";
  const isTextLoading =
    pipeline.stage === "preparing" ||
    (pipeline.stage === "success" && (solverBusy || walkthrough.state.loading));
  const isLoading = activeTab === "text" ? isTextLoading : (image.isExtracting || image.isAnalyzing);

  // ── Derived state ────────────────────────────────────────────────────────
  const imgBusy       = image.isExtracting || image.isAnalyzing;
  const imgConfirming = activeTab === "image" && image.isConfirming;
  const imgSuccess    = activeTab === "image" && image.isSuccess;

  const textRepairing = activeTab === "text" && pipeline.stage === "repairing";
  // Gate results display on solver completing — nothing shown until tree is done
  const textSuccess   = activeTab === "text" && solver.state === "completed";
  const textError     = activeTab === "text" && (pipeline.stage === "error" || solver.state === "error" || solver.state === "failed");
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
                <p className="font-medium text-foreground animate-fade-in" key={solver.state + pipeline.stage}>
                  {image.isExtracting ? "Extracting poker state…" :
                   image.isAnalyzing  ? "Generating AI coaching…" :
                   pipeline.stage === "preparing"  ? "Parsing hand history…" :
                   solver.state === "submitting"   ? "Submitting to solver…" :
                   solver.state === "queued"        ? "Queued — waiting for worker…" :
                   solver.state === "running"       ? "Solving game tree…" :
                   walkthrough.state.loading        ? "Tracing decisions through tree…" :
                   "Almost ready…"}
                </p>

                {/* Step indicators (parse → solve → trace) */}
                {!image.isExtracting && !image.isAnalyzing && (
                  <div className="flex items-center justify-center gap-2 text-[9px] font-bold tracking-wider uppercase">
                    {[
                      { label: "Parse",  done: pipeline.stage === "success", active: pipeline.stage === "preparing" },
                      { label: "Solve",  done: solver.state === "completed", active: solverBusy },
                      { label: "Trace",  done: !walkthrough.state.loading && walkthrough.state.decisions.length > 0, active: walkthrough.state.loading },
                    ].map((step, i, arr) => (
                      <span key={step.label} className="flex items-center gap-2">
                        <span style={{
                          color: step.done
                            ? "rgba(52,211,153,0.9)"
                            : step.active
                            ? "rgba(124,92,255,0.9)"
                            : "rgba(255,255,255,0.2)",
                        }}>
                          {step.done ? "✓ " : ""}{step.label}
                        </span>
                        {i < arr.length - 1 && (
                          <span style={{ color: "rgba(255,255,255,0.1)" }}>›</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
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
                  {activeTab === "text"
                    ? (pipeline.error ?? solver.error ?? "Unknown error")
                    : image.error}
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
              {activeTab === "text" && pipeline.pipeline?.canonical && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">
                      Hand Analysis
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        {pipeline.pipeline.canonical.site} · {pipeline.pipeline.canonical.stakes.display}
                      </span>
                    </h2>
                  </div>

                  {/* Validation summary chip */}
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

                  {/* Hand timeline — canonical action-by-action replay */}
                  <CanonicalHandTimeline hand={pipeline.pipeline.canonical} />

                  {/* Decision review — solver verdict on every hero action */}
                  {(walkthrough.state.decisions.length > 0 || walkthrough.state.error) && (
                    <div className="mt-4">
                      <HandSolverWalkthrough walkthroughState={walkthrough.state} />
                    </div>
                  )}

                  {/* Solver panel — root node frequencies + combo grid */}
                  <div className="mt-4">
                    <SolverPanel
                      state={solver.state}
                      strategy={solver.strategy}
                      error={solver.error}
                      heroSide={heroSide}
                    />
                  </div>

                  {/* Explore full tree link */}
                  {solver.jobId && (
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/solver/${solver.jobId}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors"
                        style={{ color: "rgba(167,139,250,0.6)" }}
                      >
                        <TreePine className="h-3 w-3" />
                        Explore Full Tree
                      </Link>
                    </div>
                  )}

                  {/* Debug panel (dev only) */}
                  {IS_DEV && (
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

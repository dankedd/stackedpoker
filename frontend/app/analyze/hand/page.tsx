"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, RotateCcw, FileText, ImageIcon,
  Zap, AlertTriangle, BookmarkCheck,
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
import { HandReplay } from "@/components/replay/HandReplay";
import { HandConfirmation } from "@/components/replay/HandConfirmation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useUsage } from "@/hooks/useUsage";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "text" | "image";

const SETUP_KEY    = "poker_analysis_setup";
const HAND_KEY     = "poker_session_hand_prefill";
const SES_SETUP_KEY = "poker_session_hand_setup";

export default function AnalyzePage() {
  // Read once on mount — no useSearchParams needed
  const [fromSession] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("from") === "session";
  });

  const [activeTab, setActiveTab] = useState<Tab>("text");

  // Initialise setup: sessionStorage (from session flow) → localStorage → default
  const [setup, setSetup] = useState<AnalysisSetupValue>(() => {
    if (typeof window === "undefined") return ANALYSIS_SETUP_DEFAULT;
    try {
      const ses = sessionStorage.getItem(SES_SETUP_KEY);
      if (ses) { sessionStorage.removeItem(SES_SETUP_KEY); return JSON.parse(ses); }
      const loc = localStorage.getItem(SETUP_KEY);
      return loc ? JSON.parse(loc) : ANALYSIS_SETUP_DEFAULT;
    } catch { return ANALYSIS_SETUP_DEFAULT; }
  });

  // Prefill text from session flow
  const [prefillHand] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const t = sessionStorage.getItem(HAND_KEY) ?? "";
    if (t) sessionStorage.removeItem(HAND_KEY);
    return t;
  });

  const { user, loading: authLoading } = useAuth();
  const { usage, loading: usageLoading, refetch: refetchUsage } = useUsage();

  const handleSetupChange = (v: AnalysisSetupValue) => {
    setSetup(v);
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(v)); } catch {}
  };

  const text  = useAnalysis();
  const image = useImageAnalysis();

  const resultRef    = useRef<HTMLDivElement>(null);
  const autoAnalyzed = useRef(false);

  const scrollToResult = () =>
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  // Auto-analyze when arriving from session and auth is ready
  useEffect(() => {
    if (
      prefillHand &&
      fromSession &&
      !autoAnalyzed.current &&
      !authLoading &&
      !usageLoading &&
      user &&
      !usage?.isOverLimit
    ) {
      autoAnalyzed.current = true;
      text.analyze(prefillHand, setup).then(() => {
        scrollToResult();
        refetchUsage();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, usageLoading, user, usage?.isOverLimit]);

  const handleTextAnalyze = async (t: string) => {
    await text.analyze(t, setup);
    scrollToResult();
    if (text.status !== "error") refetchUsage();
  };

  const handleImageUpload = async (file: File) => {
    await image.extract(file);
    scrollToResult();
  };

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    text.reset();
    image.reset();
  };

  // ── Derived state ──────────────────────────────────────────────────────
  const imgBusy       = image.isExtracting || image.isAnalyzing;
  const imgLoading    = activeTab === "image" && imgBusy;
  const imgError      = activeTab === "image" && image.isError;
  const imgConfirming = activeTab === "image" && image.isConfirming;
  const imgSuccess    = activeTab === "image" && image.isSuccess;

  const isLoading = activeTab === "text" ? text.status === "loading" : imgLoading;
  const hasError  = activeTab === "text" ? text.status === "error"   : imgError && !image.extraction;
  const hasResult = activeTab === "text" ? text.status === "success" : imgSuccess;

  const handleReset = activeTab === "text" ? text.reset : image.reset;

  const isAuthLoading = authLoading || (!!user && usageLoading);
  const isGated       = !authLoading && !user;
  const isOverLimit   = !isGated && !!usage?.isOverLimit;
  const canAnalyze    = !isGated && !isOverLimit;

  // Hide input card when auto-analyzing from session (hand is already submitted)
  const hideInput = fromSession && !!prefillHand && autoAnalyzed.current;

  const backHref  = fromSession ? "/analyze/session" : "/analyze";
  const backLabel = fromSession ? "Back to Session"  : "Back to Analyze";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className={cn(
          "mx-auto px-4 sm:px-6",
          hasResult ? "max-w-[1680px] xl:px-10" : "max-w-2xl",
        )}>

          {/* Back */}
          <Link
            href={backHref}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>

          {/* ── Input card ─────────────────────────────────────────────── */}
          {!hideInput && !imgConfirming && !imgSuccess && (
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
                        Paste a hand history or upload a GGPoker screenshot for instant GTO-inspired coaching.
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
                        onAnalyze={handleTextAnalyze}
                        isLoading={isLoading}
                        initialValue={prefillHand || undefined}
                      />
                    ) : (
                      <ImageUpload onAnalyze={handleImageUpload} isLoading={imgLoading} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Loading ────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-violet-400 animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-medium text-foreground">
                  {image.isExtracting ? "Extracting poker state…" :
                   image.isAnalyzing  ? "Generating AI coaching…" :
                   "Analyzing your hand…"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {image.isExtracting
                    ? "Preprocessing → OCR → AI extraction → validation"
                    : image.isAnalyzing
                    ? "Running GTO coaching on confirmed hand"
                    : "Parsing → Classifying → Running heuristics → AI coaching"}
                </p>
              </div>
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────────── */}
          {(hasError || (imgError && !image.extraction)) && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-destructive">Analysis failed</p>
                <p className="text-sm text-destructive/80">
                  {activeTab === "text" ? text.error : image.error}
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

          {/* ── Image: confirmation ────────────────────────────────────── */}
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

          {/* ── Image: coaching generating (blurred confirmation) ──────── */}
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

          {/* ── Results ────────────────────────────────────────────────── */}
          {hasResult && (
            <div ref={resultRef}>
              {activeTab === "text" && text.result && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">
                      Analysis Results
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        {text.result.parsed_hand.site} · ${text.result.parsed_hand.stakes}
                      </span>
                    </h2>
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                      <RotateCcw className="h-3.5 w-3.5" />
                      New Hand
                    </Button>
                  </div>
                  {user && text.result.saved_id && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                      <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">Saved to your account</span>
                      <Link href="/history" className="ml-auto text-xs text-emerald-400/70 hover:text-emerald-400 underline underline-offset-2 transition-colors">
                        View History →
                      </Link>
                    </div>
                  )}
                  {user && !text.result.saved_id && (() => {
                    if (text.result.save_error) {
                      console.error("[history-save] failed:", text.result.save_error);
                    }
                    return (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs text-amber-400">
                          Analysis complete — history save failed
                          {text.result.save_error && (
                            <span className="ml-1 opacity-70">({text.result.save_error})</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                  {text.result.replay ? (
                    <HandReplay
                      analysis={text.result.replay}
                      filename={text.result.parsed_hand.hand_id}
                      validation={{
                        confidence: 1.0,
                        hero_detected_by: "hand_history",
                        warnings: [],
                        errors: [],
                        is_valid: true,
                      }}
                    />
                  ) : (
                    <AnalysisResult result={text.result} />
                  )}
                </>
              )}

              {activeTab === "image" && image.result && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Screenshot Analysis</h2>
                    <Button variant="outline" size="sm" onClick={image.reset} className="gap-2">
                      <RotateCcw className="h-3.5 w-3.5" />
                      New Screenshot
                    </Button>
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

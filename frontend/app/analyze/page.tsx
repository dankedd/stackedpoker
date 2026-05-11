"use client";

import { useRef, useState } from "react";
import { ArrowLeft, RotateCcw, FileText, ImageIcon } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HandInput } from "@/components/poker/HandInput";
import { ImageUpload } from "@/components/poker/ImageUpload";
import { AnalysisResult } from "@/components/poker/AnalysisResult";
import { HandReplay } from "@/components/replay/HandReplay";
import { HandConfirmation } from "@/components/replay/HandConfirmation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { cn } from "@/lib/utils";

type Tab = "text" | "image";

export default function AnalyzePage() {
  const [activeTab, setActiveTab] = useState<Tab>("text");

  const text  = useAnalysis();
  const image = useImageAnalysis();

  const resultRef = useRef<HTMLDivElement>(null);

  const scrollToResult = () =>
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  const handleTextAnalyze = async (t: string) => {
    await text.analyze(t);
    scrollToResult();
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

  // ── Image tab state derivation ─────────────────────────────────────────
  const imgBusy       = image.isExtracting || image.isAnalyzing;
  const imgLoading    = activeTab === "image" && imgBusy;
  const imgError      = activeTab === "image" && image.isError;
  const imgConfirming = activeTab === "image" && image.isConfirming;
  const imgSuccess    = activeTab === "image" && image.isSuccess;

  const isLoading = activeTab === "text" ? text.status === "loading" : imgLoading;
  const hasError  = activeTab === "text" ? text.status === "error"   : imgError && !image.extraction;
  const hasResult = activeTab === "text" ? text.status === "success" : imgSuccess;

  const handleReset = activeTab === "text" ? text.reset : image.reset;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 py-10 sm:py-14">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">

          {/* Back link */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          {/* Input card — hidden once image confirmation screen is showing */}
          {!imgConfirming && !imgSuccess && (
            <Card className={cn("mb-8 border-border/50", hasResult && "border-poker-green/20")}>
              <CardHeader className="pb-4">
                <CardTitle>Hand Analysis</CardTitle>
                <CardDescription>
                  Paste a hand history or upload a GGPoker screenshot for instant GTO-inspired coaching.
                </CardDescription>

                {/* Tab switcher */}
                <div className="mt-3 inline-flex rounded-lg border border-border/60 bg-secondary/40 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch("text")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      activeTab === "text"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Screenshot
                  </button>
                </div>
              </CardHeader>

              <CardContent>
                {activeTab === "text" ? (
                  <HandInput onAnalyze={handleTextAnalyze} isLoading={isLoading} />
                ) : (
                  <ImageUpload onAnalyze={handleImageUpload} isLoading={imgLoading} />
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Loading state ─────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-poker-green/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-poker-green animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium">
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

          {/* ── Error state ───────────────────────────────────────────── */}
          {(hasError || (imgError && !image.extraction)) && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
              <p className="font-semibold text-red-400">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">
                {activeTab === "text" ? text.error : image.error}
              </p>
              <div className="flex items-center justify-center gap-3">
                {image.extraction && (
                  <Button variant="outline" size="sm" onClick={image.backToConfirm} className="gap-2">
                    ← Back to review
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* ── Image: confirmation screen ─────────────────────────────── */}
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

          {/* ── Image: coaching generating (show confirmation screen blurred) */}
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

          {/* ── Results ───────────────────────────────────────────────── */}
          {hasResult && (
            <div ref={resultRef}>
              {activeTab === "text" && text.result && (
                <>
                  <div className="mb-6 flex items-center justify-between">
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

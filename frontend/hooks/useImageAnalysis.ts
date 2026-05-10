"use client";

import { useState, useCallback } from "react";
import { extractHand, confirmHand } from "@/lib/api";
import type { ConfirmedPokerState, ExtractionResult, VisionAnalysisResponse } from "@/lib/types";

export type ImageAnalysisStatus =
  | "idle"
  | "extracting"   // uploading + Phase 1+2 running
  | "confirming"   // waiting for user review
  | "analyzing"    // Phase 3+4 running (coaching)
  | "success"
  | "error";

export function useImageAnalysis() {
  const [status, setStatus]         = useState<ImageAnalysisStatus>("idle");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [result, setResult]         = useState<VisionAnalysisResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [filename, setFilename]     = useState<string>("");

  /** Step 1: Upload screenshot, get ExtractionResult for user review. */
  const extract = useCallback(async (file: File) => {
    setStatus("extracting");
    setError(null);
    setExtraction(null);
    setResult(null);
    setFilename(file.name);

    try {
      const data = await extractHand(file);
      setExtraction(data);
      setStatus("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setStatus("error");
    }
  }, []);

  /** Step 2: User confirms/edits state, get coaching + replay. */
  const confirm = useCallback(async (state: ConfirmedPokerState) => {
    setStatus("analyzing");
    setError(null);

    try {
      const data = await confirmHand(state);
      setResult(data);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coaching failed");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setExtraction(null);
    setResult(null);
    setError(null);
    setFilename("");
  }, []);

  /** Go back to the confirmation screen after an error. */
  const backToConfirm = useCallback(() => {
    if (extraction) {
      setStatus("confirming");
      setError(null);
    } else {
      reset();
    }
  }, [extraction, reset]);

  return {
    status,
    extraction,
    result,
    error,
    filename,
    extract,
    confirm,
    reset,
    backToConfirm,
    isExtracting:  status === "extracting",
    isConfirming:  status === "confirming",
    isAnalyzing:   status === "analyzing",
    isSuccess:     status === "success",
    isError:       status === "error",
  };
}

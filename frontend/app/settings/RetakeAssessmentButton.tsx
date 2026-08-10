"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retakeAssessment } from "@/lib/learn/assessmentApi";
import { useAuth } from "@/contexts/AuthContext";

export function RetakeAssessmentButton() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleRetake() {
    setLoading(true);
    try {
      await retakeAssessment(session?.access_token ?? "");
      router.push("/learn/onboarding");
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRetake} disabled={loading}>
      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
      {loading ? "Starting…" : "Retake skill assessment"}
    </Button>
  );
}

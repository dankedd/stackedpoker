"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TreePine } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSolverReplay } from "@/hooks/useSolverReplay";
import SolverReplay from "@/components/solver/SolverReplay";

export default function SolverReplayPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const replay = useSolverReplay();

  const jobId = params.jobId;

  // Load tree on mount
  useEffect(() => {
    if (jobId && !replay.currentNode && !replay.loading) {
      replay.openTree(jobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0B0518" }}>
      <Navbar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider mb-6 transition-colors"
          style={{ color: "rgba(148,163,184,0.45)" }}
        >
          <ArrowLeft size={14} />
          Back to Analyze
        </Link>

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <TreePine size={20} style={{ color: "#7C5CFF" }} />
            <h1 className="text-xl font-bold" style={{ color: "#E2E8F0" }}>
              Solver Tree Explorer
            </h1>
          </div>
          {jobId && (
            <p className="text-[11px] font-mono" style={{ color: "rgba(148,163,184,0.3)" }}>
              Job: {jobId}
            </p>
          )}
        </div>

        {/* Replay UI */}
        <SolverReplay replay={replay} />
      </main>

      <Footer />
    </div>
  );
}

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

  // Validate jobId is a real UUID, not a literal placeholder
  const isValidJobId = jobId && /^[0-9a-f-]{8,}/i.test(jobId) && !jobId.includes("{");

  // Load tree on mount
  useEffect(() => {
    if (isValidJobId && !replay.currentNode && !replay.loading) {
      replay.openTree(jobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isValidJobId]);

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

        {/* Invalid job ID guard */}
        {jobId && !isValidJobId && (
          <div
            className="rounded-xl px-6 py-5 mb-6"
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <p className="text-[12px] font-bold text-red-400 mb-1">Invalid Job ID</p>
            <p className="text-[11px]" style={{ color: "rgba(248,113,113,0.7)" }}>
              &quot;{jobId}&quot; is not a valid solver job ID. Enter a UUID from a completed solve.
            </p>
          </div>
        )}

        {/* Replay UI */}
        {isValidJobId && <SolverReplay replay={replay} />}
      </main>

      <Footer />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TreePine, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function SolverIndexPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState("");

  const handleOpen = () => {
    const trimmed = jobId.trim();
    if (trimmed) router.push(`/solver/${trimmed}`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0B0518" }}>
      <Navbar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider mb-6 transition-colors"
          style={{ color: "rgba(148,163,184,0.45)" }}
        >
          <ArrowLeft size={14} />
          Back to Analyze
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <TreePine size={24} style={{ color: "#7C5CFF" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>
            Solver Tree Explorer
          </h1>
        </div>

        {/* Job ID entry */}
        <div
          className="rounded-xl p-6"
          style={{ background: "rgba(16,8,42,0.65)", border: "1px solid rgba(124,92,255,0.18)" }}
        >
          <h2 className="text-sm font-bold mb-1" style={{ color: "#E2E8F0" }}>
            Open a Solver Tree
          </h2>
          <p className="text-[11px] mb-4" style={{ color: "rgba(148,163,184,0.45)" }}>
            Enter a completed solver job ID to explore its game tree node-by-node.
          </p>

          <div className="flex gap-3">
            <input
              type="text"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleOpen()}
              placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              className="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-mono outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(124,92,255,0.15)",
                color: "#E2E8F0",
              }}
            />
            <button
              onClick={handleOpen}
              disabled={!jobId.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: "linear-gradient(135deg, #7C5CFF 0%, #6344E8 100%)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(124,92,255,0.25)",
              }}
            >
              Explore
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 px-5 py-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(148,163,184,0.35)" }}>
            Solver trees are created when you run TexasSolver on a hand spot.
            After the solve completes, you can navigate the full game tree —
            viewing GTO frequencies, per-combo strategies, and available actions
            at every decision point.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

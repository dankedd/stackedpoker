"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RotateCcw, BarChart2, ChevronRight,
  TrendingUp, Target, Zap, AlertTriangle,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnalysisSetup, ANALYSIS_SETUP_DEFAULT } from "@/components/poker/AnalysisSetup";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSessionAnalysis } from "@/hooks/useSessionAnalysis";
import { useAuth } from "@/contexts/AuthContext";
import { LoginCTA } from "@/components/poker/UpgradePrompt";
import { cn } from "@/lib/utils";
import type { SessionHandCandidate } from "@/lib/types";

const SETUP_KEY = "poker_analysis_setup";

const SEVERITY_STYLES = {
  high:   { label: "High priority",   cls: "text-red-400 border-red-500/30 bg-red-500/10" },
  medium: { label: "Worth reviewing", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  low:    { label: "Interesting spot", cls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
};

const STREET_LABEL: Record<string, string> = {
  river: "River", turn: "Turn", flop: "Flop", preflop: "Pre-flop",
};

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function HandCard({ hand, index, onOpen }: {
  hand: SessionHandCandidate;
  index: number;
  onOpen: (hand: SessionHandCandidate) => void;
}) {
  const sev = SEVERITY_STYLES[hand.severity];
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Hand #{hand.hand_index}</span>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", sev.cls)}>
              {sev.label}
            </span>
          </div>
          <h3 className="font-semibold text-foreground text-sm leading-snug">{hand.reason}</h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          {hand.positions}
        </span>
        <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          {hand.pot_bb}bb pot
        </span>
        <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          to {STREET_LABEL[hand.street_depth] ?? hand.street_depth}
        </span>
        {hand.stakes && (
          <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
            {hand.stakes}
          </span>
        )}
      </div>

      <Button
        variant="poker"
        size="sm"
        className="w-full gap-2"
        onClick={() => onOpen(hand)}
      >
        Open Analysis
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

const LOADING_MESSAGES = [
  "Splitting session into individual hands…",
  "Parsing hand histories…",
  "Scoring strategic importance…",
  "Selecting top 3 spots…",
  "Generating session summary…",
];

export default function SessionAnalyzePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const session = useSessionAnalysis();

  const [text, setText] = useState("");
  const [setup, setSetup] = useState<AnalysisSetupValue>(() => {
    if (typeof window === "undefined") return ANALYSIS_SETUP_DEFAULT;
    try {
      const s = localStorage.getItem(SETUP_KEY);
      return s ? JSON.parse(s) : ANALYSIS_SETUP_DEFAULT;
    } catch { return ANALYSIS_SETUP_DEFAULT; }
  });
  const [msgIdx, setMsgIdx] = useState(0);
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSetupChange = (v: AnalysisSetupValue) => {
    setSetup(v);
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(v)); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 100) return;
    setMsgIdx(0);
    msgTimer.current = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 1800);
    await session.analyze(text.trim(), { gameType: setup.gameType, playerCount: setup.playerCount });
    if (msgTimer.current) clearInterval(msgTimer.current);
  };

  const handleReset = () => {
    session.reset();
    setText("");
  };

  const handleOpenHand = (hand: SessionHandCandidate) => {
    sessionStorage.setItem("poker_session_hand_prefill", hand.hand_text);
    router.push("/analyze/hand?from=session");
  };

  const isLoading = session.status === "loading";
  const hasResult = session.status === "success" && !!session.result;
  const stats = session.result?.session_stats;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">

          {/* Back */}
          <Link
            href="/analyze"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analyze
          </Link>

          {/* ── Input state ───────────────────────────────────────────── */}
          {!hasResult && !isLoading && (
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                    <BarChart2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <CardTitle>Session Analysis</CardTitle>
                </div>
                <CardDescription>
                  Paste all hands from a session. AI identifies your most important spots — you don&apos;t have to.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {authLoading && (
                  <div className="py-10 flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-t-violet-500 animate-spin" />
                  </div>
                )}

                {!authLoading && !user && <LoginCTA />}

                {!authLoading && user && (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Game setup */}
                    <AnalysisSetup
                      value={setup}
                      onChange={handleSetupChange}
                      className="pb-4 border-b border-border/30"
                    />

                    {/* Session paste area */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80">
                        Session hands
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Paste your full session history here…\n\nExample: copy all hands from your GGPoker or PokerStars session replayer and paste them here. The AI will parse every hand and surface the 3 most important spots to review.`}
                        rows={12}
                        className="w-full rounded-lg border border-border/70 bg-card/50 px-4 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all resize-y"
                      />
                      <p className="text-xs text-muted-foreground/60">
                        GGPoker and PokerStars formats supported · Minimum 1 hand
                      </p>
                    </div>

                    {session.error && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{session.error}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="poker"
                      size="lg"
                      className="w-full"
                      disabled={text.trim().length < 100}
                    >
                      Find My Key Spots
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Loading state ─────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-blue-400 animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-medium text-foreground">Analyzing your session…</p>
                <p className="text-sm text-muted-foreground animate-fade-in" key={msgIdx}>
                  {LOADING_MESSAGES[msgIdx]}
                </p>
              </div>
            </div>
          )}

          {/* ── Results ───────────────────────────────────────────────── */}
          {hasResult && stats && session.result && (
            <div className="space-y-8 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Session Summary</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {stats.hands_parsed} of {stats.total_hands_found} hands parsed
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  New Session
                </Button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Hands" value={stats.hands_parsed.toString()} sub="parsed" />
                <StatTile label="Avg pot" value={`${stats.avg_pot_bb}bb`} />
                <StatTile label="Biggest pot" value={`${stats.biggest_pot_bb}bb`} />
                <StatTile label="VPIP" value={`${stats.hero_vpip_pct}%`} sub="pre-flop" />
              </div>

              {/* AI summary */}
              <div className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Zap className="h-4 w-4 text-violet-400" />
                  Coaching insight
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stats.ai_summary}
                </p>
                <div className="flex gap-4 pt-1 text-xs text-muted-foreground/60">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Aggression: {stats.hero_aggression_pct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    VPIP: {stats.hero_vpip_pct}%
                  </span>
                </div>
              </div>

              {/* Top 3 hands */}
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Top {session.result.selected_hands.length} spots to review
                </h2>
                <div className="space-y-4">
                  {session.result.selected_hands.map((hand, i) => (
                    <HandCard
                      key={i}
                      hand={hand}
                      index={i + 1}
                      onOpen={handleOpenHand}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

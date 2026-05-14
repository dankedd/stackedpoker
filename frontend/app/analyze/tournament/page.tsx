"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, RotateCcw, Trophy, ChevronRight, ChevronDown, ChevronLeft,
  Zap, AlertTriangle, X, BookmarkCheck, TrendingUp, Target,
  Flame, Shield, Activity,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTournamentAnalysis } from "@/hooks/useTournamentAnalysis";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAuth } from "@/contexts/AuthContext";
import { LoginCTA } from "@/components/poker/UpgradePrompt";
import { GGPokerAccordion } from "@/components/poker/GGPokerGuide";
import { HandReplay } from "@/components/replay/HandReplay";
import { cn } from "@/lib/utils";
import type { SessionHandCandidate, AnalysisResponse, TournamentStats } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOURNAMENT_TYPES = ["MTT", "SNG", "Bounty", "Hyper Turbo", "Satellite", "WSOP-style"];
const FIELD_SIZES = ["< 50", "50–200", "200–1000", "1000+"];

const SEVERITY_STYLES = {
  high:   { label: "High priority",    dot: "bg-red-400",   cls: "text-red-400 border-red-500/30 bg-red-500/10" },
  medium: { label: "Worth reviewing",  dot: "bg-amber-400", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  low:    { label: "Interesting spot", dot: "bg-blue-400",  cls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
};

const STAGE_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  deep:      { label: "Deep Stack",      cls: "text-violet-400 border-violet-500/30 bg-violet-500/10", dot: "bg-violet-400" },
  middle:    { label: "Middle Stage",    cls: "text-blue-400 border-blue-500/30 bg-blue-500/10",       dot: "bg-blue-400" },
  short:     { label: "Short Stack",     cls: "text-amber-400 border-amber-500/30 bg-amber-500/10",   dot: "bg-amber-400" },
  push_fold: { label: "Push/Fold Zone",  cls: "text-red-400 border-red-500/30 bg-red-500/10",         dot: "bg-red-400" },
};

const STREET_LABEL: Record<string, string> = {
  river: "River", turn: "Turn", flop: "Flop", preflop: "Pre-flop",
};

const LOADING_MESSAGES = [
  "Splitting tournament into individual hands…",
  "Parsing hand histories…",
  "Extracting blind levels and stack depths…",
  "Scoring by ICM importance…",
  "Selecting top tournament spots…",
  "Generating ICM-aware coaching…",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string;
  accent?: "violet" | "amber" | "red" | "emerald" | "blue";
}) {
  const valCls = accent === "violet" ? "text-violet-400"
    : accent === "amber"   ? "text-amber-400"
    : accent === "red"     ? "text-red-400"
    : accent === "emerald" ? "text-emerald-400"
    : accent === "blue"    ? "text-blue-400"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3.5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", valCls)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/55 mt-0.5">{sub}</p>}
    </div>
  );
}

function StageBar({ stats }: { stats: TournamentStats }) {
  const segments = [
    { pct: stats.deep_handed_pct,  color: "bg-violet-500", label: `Deep ${stats.deep_handed_pct}%` },
    { pct: stats.middle_pct,       color: "bg-blue-500",   label: `Middle ${stats.middle_pct}%` },
    { pct: stats.short_stack_pct,  color: "bg-amber-500",  label: `Short ${stats.short_stack_pct}%` },
    { pct: stats.push_fold_pct,    color: "bg-red-500",    label: `P/F ${stats.push_fold_pct}%` },
  ];
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
      <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-violet-400" />
        Stack Depth Profile
      </p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.label}
              className={cn("transition-all duration-500", s.color)}
              style={{ width: `${s.pct}%` }}
              title={s.label}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {[
          { color: "bg-violet-400", label: "Deep (>50bb)",     pct: stats.deep_handed_pct },
          { color: "bg-blue-400",   label: "Middle (25–50bb)", pct: stats.middle_pct },
          { color: "bg-amber-400",  label: "Short (15–25bb)",  pct: stats.short_stack_pct },
          { color: "bg-red-400",    label: "Push/Fold (<15bb)",pct: stats.push_fold_pct },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/65">
            <div className={cn("h-2 w-2 rounded-full shrink-0", s.color)} />
            {s.label}
            <span className="font-semibold text-foreground/70">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TournamentHandCard({
  hand, onOpen,
}: {
  hand: SessionHandCandidate;
  onOpen: (hand: SessionHandCandidate) => void;
}) {
  const sev   = SEVERITY_STYLES[hand.severity];
  const stage = hand.tournament_stage ? STAGE_STYLES[hand.tournament_stage] : null;
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3.5 hover:border-border/80 hover:bg-card/80 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-xs text-muted-foreground/60">Hand #{hand.hand_index}</span>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0", sev.cls)}>
              {sev.label}
            </span>
            {stage && (
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0", stage.cls)}>
                {stage.label}
              </span>
            )}
            {hand.is_all_in && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 shrink-0 flex items-center gap-1">
                <Flame className="h-2.5 w-2.5" />
                All-in
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-sm leading-snug">{hand.reason}</h3>
        </div>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          {hand.positions}
        </span>
        <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          {hand.pot_bb}bb pot
        </span>
        <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
          to {STREET_LABEL[hand.street_depth] ?? hand.street_depth}
        </span>
        {hand.effective_stack_bb > 0 && (
          <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
            {hand.effective_stack_bb}bb eff
          </span>
        )}
        {hand.blind_level && (
          <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground/70 border border-border/30 font-mono">
            {hand.blind_level}
          </span>
        )}
        {hand.stakes && (
          <span className="inline-flex items-center text-xs bg-secondary/60 px-2.5 py-1 rounded-full text-muted-foreground border border-border/40">
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
        Analyze Hand
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CompactHandRow({
  hand, onAnalyze,
}: {
  hand: SessionHandCandidate;
  onAnalyze: (hand: SessionHandCandidate) => void;
}) {
  const stage  = hand.tournament_stage ? STAGE_STYLES[hand.tournament_stage] : null;
  const dotCls = stage?.dot ?? SEVERITY_STYLES[hand.severity].dot;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/20 rounded-lg transition-colors">
      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotCls)} />
      <span className="text-xs text-muted-foreground/50 w-12 shrink-0">#{hand.hand_index}</span>
      <span className="text-xs text-muted-foreground/80 flex-1 min-w-0 truncate">{hand.positions}</span>
      <span className="text-xs text-muted-foreground/60 shrink-0">{hand.effective_stack_bb}bb</span>
      {hand.is_all_in && (
        <Flame className="h-3 w-3 text-red-400/70 shrink-0" />
      )}
      <span className="text-xs text-muted-foreground/50 w-12 text-right shrink-0 capitalize">
        {STREET_LABEL[hand.street_depth] ?? hand.street_depth}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
        onClick={() => onAnalyze(hand)}
      >
        Analyze
      </Button>
    </div>
  );
}

function CoachingFallback({ result }: { result: AnalysisResponse }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/25 shrink-0">
          <span className="text-lg font-bold text-amber-400">{result.overall_score}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Overall Score</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {result.mistakes_count} mistake{result.mistakes_count !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Zap className="h-4 w-4 text-amber-400" />
          Coaching
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{result.ai_coaching}</p>
      </div>
      {result.findings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground px-1">Key Findings</p>
          {result.findings.map((f, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border px-4 py-3 space-y-1",
                f.severity === "mistake"    ? "border-red-500/20 bg-red-500/5" :
                f.severity === "suboptimal" ? "border-amber-500/20 bg-amber-500/5" :
                "border-border/50 bg-card/40",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize text-muted-foreground">{f.street}</span>
                <span className={cn("text-xs font-medium",
                  f.severity === "mistake"    ? "text-red-400" :
                  f.severity === "suboptimal" ? "text-amber-400" :
                  "text-emerald-400",
                )}>· {f.severity}</span>
              </div>
              <p className="text-sm text-foreground">{f.recommendation}</p>
              <p className="text-xs text-muted-foreground">{f.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fullscreen hand overlay ───────────────────────────────────────────────────

function HandOverlay({
  open, onClose, onPrev, onNext, hasPrev, hasNext, activeHand, handAnalysis,
}: {
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  activeHand: SessionHandCandidate | null;
  handAnalysis: ReturnType<typeof useAnalysis>;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else      document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const sev       = activeHand ? SEVERITY_STYLES[activeHand.severity] : null;
  const stage     = activeHand?.tournament_stage ? STAGE_STYLES[activeHand.tournament_stage] : null;
  const isLoading = handAnalysis.status === "loading";
  const hasResult = handAnalysis.status === "success" && !!handAnalysis.result;
  const hasError  = handAnalysis.status === "error";

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/85 backdrop-blur-md transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-background",
          "transition-[opacity,transform] duration-200 ease-out",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none",
        )}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-border/50 shrink-0 bg-background/95 backdrop-blur sticky top-0 z-10">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Back to tournament</span>
          </button>

          {activeHand && (
            <>
              <div className="h-4 w-px bg-border/50 shrink-0 hidden sm:block" />
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground shrink-0">
                  Hand #{activeHand.hand_index}
                </span>
                {sev && (
                  <span className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-flex",
                    sev.cls,
                  )}>
                    {sev.label}
                  </span>
                )}
                {stage && (
                  <span className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-flex",
                    stage.cls,
                  )}>
                    {stage.label}
                  </span>
                )}
                {activeHand.is_all_in && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 shrink-0 hidden sm:inline-flex items-center gap-1">
                    <Flame className="h-2.5 w-2.5" />
                    All-in
                  </span>
                )}
                <div className="hidden lg:flex items-center gap-1.5 ml-1">
                  {activeHand.positions && (
                    <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground border border-border/40">
                      {activeHand.positions}
                    </span>
                  )}
                  {activeHand.effective_stack_bb > 0 && (
                    <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground border border-border/40">
                      {activeHand.effective_stack_bb}bb eff
                    </span>
                  )}
                  {activeHand.blind_level && (
                    <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground/70 border border-border/30 font-mono">
                      {activeHand.blind_level}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground/50 truncate hidden md:block ml-1">
                  {activeHand.reason}
                </span>
              </div>
            </>
          )}

          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              title="Previous hand (←)"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                hasPrev
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              title="Next hand (→)"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                hasNext
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed",
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-border/50 mx-1" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-6 min-h-[400px] h-full">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-amber-400 animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-medium text-foreground">Analyzing hand…</p>
                <p className="text-sm text-muted-foreground">
                  Parsing → Classifying → Running heuristics → AI coaching
                </p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="max-w-2xl mx-auto px-4 py-10">
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{handAnalysis.error}</p>
              </div>
            </div>
          )}

          {hasResult && handAnalysis.result && (
            <div className={cn(
              "mx-auto px-4 sm:px-6 py-8",
              handAnalysis.result.replay ? "max-w-[1680px] xl:px-10" : "max-w-2xl",
            )}>
              {handAnalysis.result.replay ? (
                <HandReplay
                  analysis={handAnalysis.result.replay}
                  filename={`Hand #${activeHand?.hand_index ?? ""}`}
                  validation={{
                    confidence: 1.0,
                    hero_detected_by: "hand_history",
                    warnings: [],
                    errors: [],
                    is_valid: true,
                  }}
                />
              ) : (
                <CoachingFallback result={handAnalysis.result} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TournamentAnalyzePage() {
  const { user, loading: authLoading } = useAuth();
  const tournament  = useTournamentAnalysis();
  const handAnalysis = useAnalysis();

  const [text, setText]               = useState("");
  const [tournamentType, setType]     = useState("MTT");
  const [fieldSize, setFieldSize]     = useState("50–200");
  const [buyIn, setBuyIn]             = useState("");
  const [msgIdx, setMsgIdx]           = useState(0);
  const msgTimer                      = useRef<ReturnType<typeof setInterval> | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeHand, setActiveHand]   = useState<SessionHandCandidate | null>(null);
  const [allHandsOpen, setAllOpen]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 100) return;
    setMsgIdx(0);
    msgTimer.current = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 2000);
    await tournament.analyze(text.trim(), {
      tournamentType,
      fieldSize,
      buyIn,
    });
    if (msgTimer.current) clearInterval(msgTimer.current);
  };

  const handleReset = () => {
    tournament.reset();
    setText("");
    setOverlayOpen(false);
    setActiveHand(null);
    setAllOpen(false);
  };

  const navHands = useMemo(
    () => [...(tournament.result?.all_hands ?? [])].sort((a, b) => a.hand_index - b.hand_index),
    [tournament.result?.all_hands],
  );

  const openHandInOverlay = (hand: SessionHandCandidate) => {
    setActiveHand(hand);
    setOverlayOpen(true);
    handAnalysis.reset();
    handAnalysis.analyze(hand.hand_text, { gameType: "Hold'em", playerCount: 6 });
  };

  const navIdx  = activeHand ? navHands.findIndex(h => h.hand_index === activeHand.hand_index) : -1;
  const hasPrev = navIdx > 0;
  const hasNext = navIdx >= 0 && navIdx < navHands.length - 1;

  const isLoading = tournament.status === "loading";
  const hasResult = tournament.status === "success" && !!tournament.result;
  const stats     = tournament.result?.tournament_stats;

  const selectedIndices = new Set(tournament.result?.selected_hands.map(h => h.hand_index) ?? []);
  const otherHands = (tournament.result?.all_hands ?? []).filter(h => !selectedIndices.has(h.hand_index));

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">

          <Link
            href="/analyze"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analyze
          </Link>

          {/* ── Import guide ─────────────────────────────────────────── */}
          {!hasResult && !isLoading && (
            <GGPokerAccordion className="mb-6" />
          )}

          {/* ── Input ────────────────────────────────────────────────── */}
          {!hasResult && !isLoading && (
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <CardTitle>Tournament Analysis</CardTitle>
                </div>
                <CardDescription>
                  Paste your tournament hand history. The engine ranks every hand by ICM importance
                  and surfaces your highest-leverage spots.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {authLoading && (
                  <div className="py-10 flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-t-amber-500 animate-spin" />
                  </div>
                )}

                {!authLoading && !user && <LoginCTA />}

                {!authLoading && user && (
                  <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Tournament type */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80">Tournament type</label>
                      <div className="flex flex-wrap gap-1.5">
                        {TOURNAMENT_TYPES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setType(t)}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                              tournamentType === t
                                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                                : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Field size + buy-in */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground/80">Field size</label>
                        <div className="flex flex-col gap-1.5">
                          {FIELD_SIZES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setFieldSize(s)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-xs font-medium border transition-all text-left",
                                fieldSize === s
                                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80",
                              )}
                            >
                              {s} players
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground/80">Buy-in (optional)</label>
                        <input
                          type="text"
                          value={buyIn}
                          onChange={(e) => setBuyIn(e.target.value)}
                          placeholder="e.g. $109"
                          className="w-full h-9 rounded-lg border border-border bg-input/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
                        />
                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                          GGPoker and PokerStars tournament exports supported.
                        </p>
                      </div>
                    </div>

                    {/* Paste area */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80">
                        Tournament hand history
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Paste your full tournament hand history here…\n\nExport all hands from your tournament session in GGPoker or PokerStars, then paste here. The engine parses every hand, extracts blind levels and stack depths, and ranks spots by ICM importance.`}
                        rows={12}
                        className="w-full rounded-lg border border-border/70 bg-card/50 px-4 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all resize-y"
                      />
                    </div>

                    {tournament.error && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{tournament.error}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="poker"
                      size="lg"
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-lg shadow-amber-900/30"
                      disabled={text.trim().length < 100}
                    >
                      Analyze Tournament
                      <Trophy className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Loading ──────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-amber-400 animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-medium text-foreground">Analyzing your tournament…</p>
                <p className="text-sm text-muted-foreground animate-fade-in" key={msgIdx}>
                  {LOADING_MESSAGES[msgIdx]}
                </p>
              </div>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────── */}
          {hasResult && stats && tournament.result && (
            <div className="space-y-7 animate-fade-in">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
                    <h1 className="text-2xl font-bold text-foreground">Tournament Analysis</h1>
                    {stats.tournament_type && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        {stats.tournament_type}
                      </span>
                    )}
                    {stats.buy_in && (
                      <span className="text-xs font-mono text-muted-foreground/60 bg-secondary/50 border border-border/40 px-2 py-0.5 rounded-md">
                        {stats.buy_in}
                      </span>
                    )}
                    {stats.field_size && (
                      <span className="text-xs text-muted-foreground/60 bg-secondary/50 border border-border/40 px-2 py-0.5 rounded-md">
                        {stats.field_size} field
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {stats.hands_parsed} of {stats.total_hands_found} hands parsed
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 shrink-0">
                  <RotateCcw className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>

              {/* Save badge */}
              {user && tournament.result.saved_id && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                  <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-400">Tournament saved to your account</span>
                  <Link href="/history" className="ml-auto text-xs text-emerald-400/70 hover:text-emerald-400 underline underline-offset-2 transition-colors">
                    View History →
                  </Link>
                </div>
              )}
              {user && tournament.result && !tournament.result.saved_id && (() => {
                if (tournament.result.save_error) {
                  console.error("[tournament-save] failed:", tournament.result.save_error);
                }
                return (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400">
                      Analysis complete — history save failed
                      {tournament.result.save_error && (
                        <span className="ml-1 opacity-70">({tournament.result.save_error})</span>
                      )}
                    </span>
                  </div>
                );
              })()}

              {/* Dashboard tiles — row 1 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  label="Hands"
                  value={stats.hands_parsed.toString()}
                  sub="parsed"
                />
                <StatTile
                  label="Avg stack"
                  value={`${stats.avg_stack_bb}bb`}
                  sub={`peak ${stats.peak_stack_bb}bb`}
                  accent="violet"
                />
                <StatTile
                  label="All-in spots"
                  value={stats.all_in_spots.toString()}
                  sub="jam / reshove"
                  accent={stats.all_in_spots > 5 ? "amber" : undefined}
                />
                <StatTile
                  label="Push/fold zone"
                  value={`${stats.push_fold_pct}%`}
                  sub="of hands <15bb"
                  accent={stats.push_fold_pct > 25 ? "red" : undefined}
                />
              </div>

              {/* Dashboard tiles — row 2 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  label="VPIP"
                  value={`${stats.hero_vpip_pct}%`}
                  sub="pre-flop"
                  accent={stats.hero_vpip_pct > 35 ? "amber" : undefined}
                />
                <StatTile
                  label="Aggression"
                  value={`${stats.hero_aggression_pct}%`}
                  sub="bet/raise rate"
                  accent={stats.hero_aggression_pct < 25 ? "amber" : "emerald"}
                />
                <StatTile
                  label="3-bet pots"
                  value={stats.three_bet_count.toString()}
                  sub="total"
                />
                <StatTile
                  label="Biggest pot"
                  value={`${stats.biggest_pot_bb}bb`}
                  sub="largest hand"
                  accent="blue"
                />
              </div>

              {/* Stage profile bar */}
              <StageBar stats={stats} />

              {/* AI coaching */}
              <div className="rounded-2xl border border-amber-500/25 bg-card/50 p-5 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  ICM Coaching
                  <div className="ml-auto flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] text-amber-400/60 font-normal">Tournament-aware</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground/85 leading-relaxed">{stats.ai_summary}</p>
                <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground/55">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Aggression: {stats.hero_aggression_pct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    VPIP: {stats.hero_vpip_pct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    3-bets: {stats.three_bet_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    All-ins: {stats.all_in_spots}
                  </span>
                </div>
              </div>

              {/* Top spots */}
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Top {tournament.result.selected_hands.length} tournament spots to review
                </h2>
                <div className="space-y-4">
                  {tournament.result.selected_hands.map((hand, i) => (
                    <TournamentHandCard key={i} hand={hand} onOpen={openHandInOverlay} />
                  ))}
                </div>
              </div>

              {/* All hands — collapsible */}
              {otherHands.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                  <button
                    onClick={() => setAllOpen(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-foreground">All tournament hands</span>
                      <span className="text-xs text-muted-foreground/60 bg-secondary/60 border border-border/40 px-2 py-0.5 rounded-full">
                        {otherHands.length} more
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      allHandsOpen && "rotate-180",
                    )} />
                  </button>

                  <div className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    allHandsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}>
                    <div className="overflow-hidden">
                      <div className="px-2 pb-3 pt-1 space-y-0.5 border-t border-border/30">
                        {otherHands.map((hand) => (
                          <CompactHandRow
                            key={hand.hand_index}
                            hand={hand}
                            onAnalyze={openHandInOverlay}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      <HandOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        onPrev={() => hasPrev && openHandInOverlay(navHands[navIdx - 1])}
        onNext={() => hasNext && openHandInOverlay(navHands[navIdx + 1])}
        hasPrev={hasPrev}
        hasNext={hasNext}
        activeHand={activeHand}
        handAnalysis={handAnalysis}
      />

      <Footer />
    </div>
  );
}

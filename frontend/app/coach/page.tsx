"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bot, AlertTriangle, BookOpen, ChevronRight, MessageSquare, Sparkles } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CoachChat, type CoachChatHandle } from "@/components/learn/CoachChat";
import { useAuth } from "@/hooks/useAuth";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { COACH_REVIEW_STORAGE_KEY } from "@/lib/learn/coachReviewStorage";
import type { CoachLessonReviewContext } from "@/lib/learn/coachReview";
import { cn } from "@/lib/utils";

// ── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Why should I c-bet small on dry boards?",
  "When is it correct to fold to a pot-sized bet?",
  "How do I balance my bluff-to-value ratio?",
  "What hands should I 3-bet for value from the BTN?",
  "How do I play flush draws out of position?",
  "When should I use a donk bet?",
];

const SEVERITY_STYLE: Record<string, string> = {
  mild: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  moderate: "bg-orange-500/10 border-orange-500/25 text-orange-400",
  severe: "bg-red-500/10 border-red-500/25 text-red-400",
};

function humanize(id: string): string {
  return id.replace(/_/g, " ");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoachPage() {
  return (
    <Suspense>
      <CoachPageContent />
    </Suspense>
  );
}

function CoachPageContent() {
  const { user, session } = useAuth();
  const { progress } = useLearnProgress();
  const searchParams = useSearchParams();
  const chatRef = useRef<CoachChatHandle>(null);

  const [review, setReview] = useState<CoachLessonReviewContext | null>(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);

  // Read (and consume) the pending Coach Review payload LessonPlayer left in
  // sessionStorage right before navigating here — real per-lesson performance
  // data, never fabricated. Read once on mount only.
  useEffect(() => {
    if (searchParams.get("review") !== "1") {
      setReviewLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(COACH_REVIEW_STORAGE_KEY);
      sessionStorage.removeItem(COACH_REVIEW_STORAGE_KEY);
      if (raw) setReview(JSON.parse(raw) as CoachLessonReviewContext);
    } catch {
      // Missing/corrupt payload — falls back to general coaching below.
    }
    setReviewLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLeaks = progress.leaks.filter((l) => !l.resolved).slice(0, 3);
  const weakConcepts = Object.entries(progress.concepts)
    .filter(([, entry]) => entry.mastery_level <= 2)
    .sort((a, b) => a[1].mastery_level - b[1].mastery_level)
    .slice(0, 5)
    .map(([id]) => id);

  const coachContext = review
    ? { source: "lesson_review", lessonReview: review }
    : { source: "coach_page" };
  const initialMessage = review ? `Review my "${review.lessonTitle}" lesson.` : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* ── Hero header ── */}
          <div className="relative mb-10 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/50 via-background/70 to-blue-950/25 px-8 py-8 sm:px-10">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 shrink-0">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400/60 mb-1.5">
                  AI Coaching
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 tracking-tight">
                  {review ? "Lesson Review" : "Your Personal Coach"}
                </h1>
                <p className="text-muted-foreground max-w-lg leading-relaxed">
                  {review
                    ? `Reviewing "${review.lessonTitle}" — scored ${review.avgScore}/100.`
                    : "Concept-driven, Socratic coaching — adapts to your leaks, study history, and current skill level."}
                </p>
              </div>
            </div>
          </div>

          {/* ── Auth gate ── */}
          {!user && (
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-900/25 via-card/80 to-blue-900/15 p-8 text-center mb-8">
              <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full bg-violet-500/15 blur-3xl" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-500/30 mx-auto mb-4">
                  <Bot className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Unlock your coaching session</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                  Your coach remembers your leaks, study history, and adapts to your skill level over time.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/signup"
                    className="group relative overflow-hidden inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    Get started free
                  </Link>
                  <Link
                    href="/login"
                    className="px-5 py-2.5 rounded-xl border border-border/50 bg-card/40 text-foreground text-sm font-medium hover:bg-card/60 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Main layout ── */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: Chat ── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl border border-border/40 bg-gradient-to-b from-card/80 to-card/60 overflow-hidden flex flex-col shadow-xl shadow-black/20" style={{ minHeight: 540, maxHeight: "72vh" }}>
                {/* Chat header — single unified header, no model badge */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-card/40 backdrop-blur-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-md shadow-violet-500/25">
                    <Bot className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Stacked Coach</p>
                    <p className="text-[10px] text-muted-foreground/50">Your personal poker strategy coach</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400/70 font-medium">Online</span>
                  </div>
                </div>

                {session?.access_token && reviewLoaded ? (
                  <CoachChat
                    ref={chatRef}
                    token={session.access_token}
                    context={coachContext}
                    initialMessage={initialMessage}
                    banner={
                      review ? (
                        <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3.5 py-2.5 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            Reviewing <span className="font-semibold text-foreground">{review.lessonTitle}</span> — the
                            coach can see what you got right and where you struggled.
                          </p>
                        </div>
                      ) : undefined
                    }
                    className="flex-1 overflow-hidden"
                  />
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Blurred preview */}
                    <div className="flex-1 p-5 space-y-4 select-none pointer-events-none opacity-35 blur-[3px]">
                      {[
                        { role: "coach", text: "Hey! I'm your GTO-trained poker coach. What spot are you working on?" },
                        { role: "user", text: "When should I c-bet on wet boards?" },
                        { role: "coach", text: "Great question. On wet boards like J♠T♥9♦, your range advantage determines sizing..." },
                      ].map((m, i) => (
                        <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}>
                          <div className={cn("h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs", m.role === "coach" ? "bg-gradient-to-br from-violet-600 to-blue-500" : "bg-secondary/60")} >
                            {m.role === "coach" ? "🤖" : ""}
                          </div>
                          <div className={cn(
                            "max-w-[78%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed",
                            m.role === "coach"
                              ? "bg-card/80 border border-border/40 rounded-tl-sm"
                              : "bg-violet-600/25 border border-violet-500/25 rounded-tr-sm"
                          )}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Overlay CTA */}
                    <div className="border-t border-border/30 bg-card/30 p-5 text-center">
                      <p className="text-sm text-muted-foreground mb-4">Sign in to start your coaching session</p>
                      <Link
                        href="/login"
                        className="group relative overflow-hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <MessageSquare className="h-4 w-4" />
                        Sign in to chat
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested questions */}
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-2.5">
                  Ask your coach
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => chatRef.current?.sendMessage(q)}
                      disabled={!user}
                      className="text-xs px-3 py-1.5 rounded-full border border-border/35 bg-card/40 text-muted-foreground/70 hover:border-violet-500/35 hover:text-violet-300 hover:bg-violet-500/8 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right: Context panel ── */}
            <div className="lg:w-72 xl:w-80 shrink-0 space-y-4">

              {/* Active leaks */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
                <div className="flex items-center gap-2 mb-3.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Active Leaks</p>
                </div>
                {activeLeaks.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeLeaks.map((leak) => (
                      <div key={leak.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-secondary/10 border border-border/25">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md border capitalize shrink-0 mt-0.5",
                            SEVERITY_STYLE[leak.severity]
                          )}
                        >
                          {leak.severity[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground capitalize">{humanize(leak.concept_id)}</p>
                          <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5 capitalize">{humanize(leak.leak_type)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50">
                    {user ? "No active leaks detected — nice work." : "Sign in to see your active leaks."}
                  </p>
                )}
                <Link
                  href="/progress"
                  className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-300 transition-colors mt-3.5 font-medium"
                >
                  View all leaks <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Concepts to review */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
                <div className="flex items-center gap-2 mb-3.5">
                  <BookOpen className="h-3.5 w-3.5 text-violet-400/70" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Concepts to Review</p>
                </div>
                {weakConcepts.length > 0 ? (
                  <div className="space-y-1.5">
                    {weakConcepts.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => chatRef.current?.sendMessage(`Can you help me understand ${humanize(id)}?`)}
                        disabled={!user}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/15 border border-border/25 hover:border-violet-500/20 hover:bg-violet-500/5 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-xs text-foreground/80 capitalize">{humanize(id)}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50">
                    {user ? "No weak concepts flagged yet — keep learning." : "Sign in to see concepts to review."}
                  </p>
                )}
                <Link
                  href="/learn"
                  className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-300 transition-colors mt-3.5 font-medium"
                >
                  Learning hub <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">Quick links</p>
                {[
                  { label: "Learning Hub", href: "/learn" },
                  { label: "Progress Dashboard", href: "/progress" },
                  { label: "Range Trainer", href: "/train/ranges" },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/25 bg-secondary/8 hover:border-violet-500/25 hover:bg-violet-500/5 transition-colors group"
                  >
                    <span className="text-xs font-medium text-muted-foreground/70 group-hover:text-foreground transition-colors">
                      {label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-violet-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

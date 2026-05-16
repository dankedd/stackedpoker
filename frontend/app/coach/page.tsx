"use client";

import Link from "next/link";
import { Bot, AlertTriangle, BookOpen, ChevronRight, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CoachChat } from "@/components/learn/CoachChat";
import { useAuth } from "@/hooks/useAuth";
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

// ── Mock leaks + concepts ─────────────────────────────────────────────────────

const MOCK_LEAKS = [
  { concept: "C-bet sizing", severity: "moderate", note: "Betting too large on dry boards" },
  { concept: "Blind defense", severity: "severe", note: "Over-folding to BTN opens" },
  { concept: "Turn barrels", severity: "mild", note: "Giving up too often on turns" },
];

const MOCK_CONCEPTS = [
  "Pot odds",
  "Positional advantage",
  "Range balance",
  "Board texture",
  "Bluff catchers",
];

const SEVERITY_STYLE: Record<string, string> = {
  mild: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  moderate: "bg-orange-500/10 border-orange-500/25 text-orange-400",
  severe: "bg-red-500/10 border-red-500/25 text-red-400",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const { user, session } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* ── Header ── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-0.5">
                  AI Coaching
                </p>
                <h1 className="text-3xl font-bold text-foreground">Your Coach</h1>
              </div>
            </div>
            <p className="text-muted-foreground mt-1 ml-[52px]">
              Ask anything. Get personalised, concept-driven poker coaching.
            </p>
          </div>

          {/* ── Auth gate ── */}
          {!user && (
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-blue-600/5 p-8 text-center mb-8">
              <Bot className="h-10 w-10 text-violet-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Sign in to chat with your coach</h2>
              <p className="text-muted-foreground text-sm mb-5">
                Your coach remembers your leaks, study history, and adapts to your skill level.
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
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
          )}

          {/* ── Main layout ── */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: Chat ── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex flex-col" style={{ minHeight: 520, maxHeight: "70vh" }}>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Stacked Coach</p>
                    <p className="text-[10px] text-emerald-400">Online · GTO + Exploitative</p>
                  </div>
                </div>

                {session?.access_token ? (
                  <CoachChat
                    token={session.access_token}
                    context={{ source: "coach_page" }}
                    className="flex-1 overflow-hidden"
                  />
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Blurred preview */}
                    <div className="flex-1 p-4 space-y-4 select-none pointer-events-none opacity-40 blur-[2px]">
                      {[
                        { role: "coach", text: "Hey! I'm your poker coach. Ask me anything about strategy..." },
                        { role: "user", text: "When should I c-bet on wet boards?" },
                        { role: "coach", text: "Great question. On wet boards like JT9 two-tone, you want to..." },
                      ].map((m, i) => (
                        <div key={i} className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "")}>
                          <div className={cn("h-6 w-6 rounded-full shrink-0", m.role === "coach" ? "bg-violet-600" : "bg-secondary")} />
                          <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-xs", m.role === "coach" ? "bg-card border border-border/50" : "bg-violet-600/20 border border-violet-500/30")}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Overlay CTA */}
                    <div className="border-t border-border/40 p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">Sign in to start your coaching session</p>
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Sign in to chat
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested questions */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">
                  Suggested questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="text-xs px-3 py-1.5 rounded-full border border-border/40 bg-secondary/20 text-muted-foreground hover:border-violet-500/30 hover:text-violet-400 hover:bg-violet-500/5 transition-colors"
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
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-foreground">Your Active Leaks</h3>
                </div>
                <div className="space-y-2.5">
                  {MOCK_LEAKS.map((leak) => (
                    <div key={leak.concept} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize shrink-0 mt-0.5",
                          SEVERITY_STYLE[leak.severity]
                        )}
                      >
                        {leak.severity}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{leak.concept}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{leak.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/progress"
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-3"
                >
                  View all leaks <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Concepts to review */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-foreground">Concepts to Review</h3>
                </div>
                <div className="space-y-1.5">
                  {MOCK_CONCEPTS.map((concept) => (
                    <div
                      key={concept}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 border border-border/30"
                    >
                      <span className="text-xs text-foreground">{concept}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
                <Link
                  href="/learn"
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-3"
                >
                  Go to learning hub <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground mb-2">Quick links</h3>
                {[
                  { label: "Learning Hub", href: "/learn" },
                  { label: "Progress Dashboard", href: "/progress" },
                  { label: "Range Trainer", href: "/train/ranges" },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/30 bg-secondary/10 hover:border-violet-500/25 hover:bg-violet-500/5 transition-colors group"
                  >
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {label}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-violet-400 transition-colors" />
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

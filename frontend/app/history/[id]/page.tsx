"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Star, StarOff, MessageSquare, Trash2, CheckCircle2,
  AlertCircle, AlertTriangle, Info, Loader2, Spade, Clock,
  TrendingUp, Target, Layers, ChevronDown, ChevronUp, X,
  BookOpen, Trophy,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { ReplayAnalysis, ActionCoaching, HandSummaryData } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// DB row type
// ─────────────────────────────────────────────────────────────────────────────

interface Analysis {
  id: string;
  input_type: "text" | "image";
  game_type: string | null;
  stakes: string | null;
  hero_position: string | null;
  hero_cards: string[] | null;
  board: string[] | null;
  overall_score: number | null;
  ai_coaching: string | null;
  mistakes_count: number;
  analyzed_at: string;
  site: string | null;
  effective_stack_bb: number | null;
  spot_classification: { primary_label?: string; pot_type?: string; stack_depth?: string } | null;
  board_texture: { description?: string; wetness?: string; connectivity?: string } | null;
  replay_state: ReplayAnalysis | null;
  findings: unknown[] | null;
  title: string | null;
  is_favorite: boolean;
  notes: string | null;
  tags: string[];
  analysis_type: "hand" | "session" | "tournament";
}

// ─────────────────────────────────────────────────────────────────────────────
// Card components
// ─────────────────────────────────────────────────────────────────────────────

function CardFace({ card, size = "md" }: { card: string; size?: "sm" | "md" | "lg" }) {
  const rank = card.slice(0, -1).replace("T", "10");
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const sym = ({ h: "♥", d: "♦", c: "♣", s: "♠" } as Record<string, string>)[suit] ?? "";
  const cls = {
    sm:  "w-9  h-[52px] rounded-lg  p-1   text-[10px]",
    md:  "w-11 h-16     rounded-xl  p-1.5 text-xs",
    lg:  "w-14 h-[82px] rounded-xl  p-2   text-sm",
  }[size];
  const symCls = { sm: "text-sm", md: "text-base", lg: "text-xl" }[size];
  return (
    <div className={cn("inline-flex flex-col items-center justify-between bg-white shadow-lg shadow-black/40 select-none flex-shrink-0", cls)}>
      <span className={cn("font-black leading-none", isRed ? "text-red-600" : "text-slate-900")}>{rank}</span>
      <span className={cn("leading-none", symCls, isRed ? "text-red-600" : "text-slate-900")}>{sym}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score ring
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const { color, label } =
    score >= 90 ? { color: "#34d399", label: "S-tier"  } :
    score >= 75 ? { color: "#60a5fa", label: "Solid"   } :
    score >= 60 ? { color: "#fbbf24", label: "Decent"  } :
    score >= 40 ? { color: "#fb923c", label: "Sloppy"  } :
                  { color: "#f87171", label: "Leaky"   };
  const r = 32, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground leading-none">{score}</span>
          <span className="text-[9px] text-muted-foreground/60">/100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action quality icon
// ─────────────────────────────────────────────────────────────────────────────

function QualityIcon({ quality }: { quality: string }) {
  const map = {
    Elite:    { icon: CheckCircle2, cls: "text-emerald-400" },
    Good:     { icon: CheckCircle2, cls: "text-blue-400"    },
    Standard: { icon: Info,         cls: "text-slate-400"   },
    Mistake:  { icon: AlertTriangle,cls: "text-orange-400"  },
    Punt:     { icon: AlertCircle,  cls: "text-red-400"     },
  } as const;
  const { icon: Icon, cls } = map[quality as keyof typeof map] ?? { icon: Info, cls: "text-slate-400" };
  return <Icon className={cn("h-4 w-4 flex-shrink-0", cls)} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
        }
      </button>
      {open && <div className="px-6 pb-6 pt-0 border-t border-border/30">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function generateTitle(a: Analysis): string {
  if (a.title) return a.title;
  const cards = a.hero_cards;
  if (!cards?.length) return "Hand Analysis";
  const cardStr = cards.map(c => { const r = c.slice(0, -1).toUpperCase(); return r === "T" ? "10" : r; }).join("");
  const suited = cards.length === 2 && cards[0].slice(-1) === cards[1].slice(-1) ? "s" : "o";
  const pair = cards.length === 2 && cards[0].slice(0, -1) === cards[1].slice(0, -1);
  const label = pair ? `${cardStr[0]}${cardStr[0]}` : `${cardStr}${suited}`;
  const pos = a.hero_position ?? "";
  const spot = a.spot_classification?.primary_label;
  if (spot) return `${label} — ${spot}`;
  return pos ? `${label} from ${pos}` : label;
}

const STREET_ORDER = ["preflop", "flop", "turn", "river"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ── Load analysis ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("hand_analyses")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (error || !data) { setNotFound(true); }
      else {
        setAnalysis(data as Analysis);
        setIsFavorite(data.is_favorite ?? false);
        setNote(data.notes ?? "");
        if (data.notes) setNoteOpen(true);
      }
      setLoading(false);
    })();
  }, [user, id]);

  const handleNoteChange = (val: string) => {
    setNote(val);
    setNoteSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase.from("hand_analyses").update({ notes: val || null }).eq("id", id);
      setNoteSaved(true);
    }, 1200);
  };

  const toggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    const supabase = createClient();
    await supabase.from("hand_analyses").update({ is_favorite: next }).eq("id", id);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (notFound || !analysis) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar variant="static" />
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <p className="text-2xl font-bold text-foreground mb-2">Analysis not found</p>
            <p className="text-muted-foreground mb-6">This analysis may have been deleted or doesn&apos;t belong to your account.</p>
            <Link href="/history" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
              ← Back to Hand History
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const replay = analysis.replay_state;
  const verdict = replay?.overall_verdict;
  const summary = replay?.hand_summary;
  const actions = replay?.actions ?? [];
  const title = generateTitle(analysis);

  // Group actions by street
  const byStreet: Record<string, typeof actions> = {};
  for (const a of actions) {
    if (!byStreet[a.street]) byStreet[a.street] = [];
    byStreet[a.street].push(a);
  }

  const boardCards = [
    ...(summary?.board?.flop ?? analysis.board?.slice(0, 3) ?? []),
    ...(summary?.board?.turn ?? analysis.board?.slice(3, 4) ?? []),
    ...(summary?.board?.river ?? analysis.board?.slice(4, 5) ?? []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">

          {/* ── Nav breadcrumb ── */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Hand History
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen(o => !o)}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-xl border transition-all",
                  noteOpen
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                    : "border-border/40 bg-card/60 text-muted-foreground hover:text-foreground"
                )}
                title="Notes"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFavorite}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-xl border transition-all",
                  isFavorite
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-border/40 bg-card/60 text-muted-foreground hover:text-amber-400"
                )}
                title={isFavorite ? "Unfavorite" : "Favorite"}
              >
                {isFavorite
                  ? <Star className="h-4 w-4 fill-current" />
                  : <StarOff className="h-4 w-4" />
                }
              </button>
            </div>
          </div>

          {/* ── Title block ── */}
          <div className="mb-8">
            <div className="flex items-start gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20 flex-shrink-0 mt-0.5">
                <Spade className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug">{title}</h1>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(analysis.analyzed_at)}
                  {analysis.stakes && <><span className="opacity-40">·</span><span>{analysis.stakes}</span></>}
                  {analysis.site && <><span className="opacity-40">·</span><span>{analysis.site}</span></>}
                </p>
              </div>
            </div>
          </div>

          {/* ── Notes panel ── */}
          {noteOpen && (
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Study Notes
                </span>
                <div className="flex items-center gap-2">
                  {noteSaved && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                  <button
                    onClick={() => setNoteOpen(false)}
                    className="text-muted-foreground/50 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <textarea
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder="Add your study notes — key takeaways, leaks to work on, range adjustments to review…"
                rows={4}
                className="w-full bg-background/50 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          )}

          {/* ── Overview card ── */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 mb-6">
            {/* Hand details */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">Hand Overview</p>

              <div className="flex items-center gap-2 mb-4">
                {(summary?.hero_cards ?? analysis.hero_cards ?? []).map((c, i) => (
                  <CardFace key={i} card={c} size="lg" />
                ))}
                {summary?.villain_cards?.map((c, i) => (
                  <CardFace key={`v${i}`} card={c} size="md" />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground/50 text-xs">Position</span>
                  <p className="font-semibold text-foreground">{summary?.hero_position ?? analysis.hero_position ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50 text-xs">Stack depth</span>
                  <p className="font-semibold text-foreground">
                    {(summary?.effective_stack_bb ?? analysis.effective_stack_bb)
                      ? `${summary?.effective_stack_bb ?? analysis.effective_stack_bb}BB`
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground/50 text-xs">Spot type</span>
                  <p className="font-semibold text-foreground">{analysis.spot_classification?.primary_label ?? analysis.spot_classification?.pot_type ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/50 text-xs">Game type</span>
                  <p className="font-semibold text-foreground capitalize">{analysis.game_type ?? "—"}</p>
                </div>
              </div>

              {boardCards.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <span className="text-muted-foreground/50 text-xs block mb-2">Board</span>
                  <div className="flex items-center gap-1.5">
                    {boardCards.map((c, i) => <CardFace key={i} card={c} size="sm" />)}
                    {analysis.board_texture?.description && (
                      <span className="ml-2 text-xs text-muted-foreground/60">{analysis.board_texture.description}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Score panel */}
            {analysis.overall_score !== null && (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-6 flex flex-col items-center justify-center gap-4 min-w-[140px]">
                <ScoreRing score={analysis.overall_score} />
                {analysis.mistakes_count > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-orange-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {analysis.mistakes_count} mistake{analysis.mistakes_count !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Verdict ── */}
          {verdict && (
            <Section title="AI Verdict">
              <div className="pt-4 space-y-5">
                {verdict.summary && (
                  <p className="text-sm text-foreground/90 leading-relaxed">{verdict.summary}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {verdict.key_strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Strengths
                      </p>
                      <ul className="space-y-1.5">
                        {verdict.key_strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {verdict.key_mistakes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Mistakes
                      </p>
                      <ul className="space-y-1.5">
                        {verdict.key_mistakes.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-orange-500 mt-0.5 flex-shrink-0">✗</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ── AI Coaching ── */}
          {analysis.ai_coaching && (
            <Section title="Full AI Coaching" defaultOpen={!verdict}>
              <div className="pt-4">
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
                  {analysis.ai_coaching}
                </p>
              </div>
            </Section>
          )}

          {/* ── Action Timeline ── */}
          {actions.length > 0 && (
            <Section title="Action-by-Action Coaching">
              <div className="pt-4 space-y-6">
                {STREET_ORDER.filter(s => byStreet[s]).map(street => (
                  <div key={street}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
                      {street}
                    </p>
                    <div className="space-y-2">
                      {byStreet[street].map((action, idx) => {
                        const coaching = action.coaching as ActionCoaching | undefined;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "rounded-xl border p-3.5 transition-all",
                              action.is_hero
                                ? coaching?.quality === "Elite" || coaching?.quality === "Good"
                                  ? "border-emerald-500/20 bg-emerald-500/5"
                                  : coaching?.quality === "Mistake" || coaching?.quality === "Punt"
                                  ? "border-orange-500/20 bg-orange-500/5"
                                  : "border-violet-500/15 bg-violet-500/5"
                                : "border-border/30 bg-card/30"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {coaching && <QualityIcon quality={coaching.quality} />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={cn(
                                    "text-xs font-semibold",
                                    action.is_hero ? "text-violet-300" : "text-muted-foreground/70"
                                  )}>
                                    {action.player} {action.is_hero ? "(Hero)" : ""}
                                  </span>
                                  <span className="text-xs text-foreground font-medium capitalize">
                                    {action.action}
                                    {action.amount ? ` ${action.amount}` : ""}
                                  </span>
                                  {coaching && (
                                    <span className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded-md border font-medium",
                                      coaching.quality === "Elite"    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" :
                                      coaching.quality === "Good"     ? "border-blue-500/25    bg-blue-500/10    text-blue-400"    :
                                      coaching.quality === "Standard" ? "border-border/30      bg-secondary/30   text-muted-foreground" :
                                      coaching.quality === "Mistake"  ? "border-orange-500/25  bg-orange-500/10  text-orange-400"  :
                                                                        "border-red-500/25     bg-red-500/10     text-red-400"
                                    )}>
                                      {coaching.quality} · {coaching.score}/100
                                    </span>
                                  )}
                                </div>
                                {coaching?.explanation && (
                                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                                    {coaching.explanation}
                                  </p>
                                )}
                                {coaching?.adjustment && coaching.adjustment !== coaching.explanation && (
                                  <p className="text-xs text-violet-400/80 mt-1 leading-relaxed">
                                    → {coaching.adjustment}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Spot + Board texture meta ── */}
          {(analysis.spot_classification || analysis.board_texture) && (
            <Section title="Spot Details" defaultOpen={false}>
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {analysis.spot_classification && Object.entries(analysis.spot_classification).map(([k, v]) => (
                  v ? (
                    <div key={k}>
                      <span className="text-[10px] text-muted-foreground/50 capitalize block">{k.replace(/_/g, " ")}</span>
                      <span className="text-sm font-medium text-foreground capitalize">{String(v)}</span>
                    </div>
                  ) : null
                ))}
                {analysis.board_texture && Object.entries(analysis.board_texture).map(([k, v]) => (
                  v ? (
                    <div key={k}>
                      <span className="text-[10px] text-muted-foreground/50 capitalize block">{k.replace(/_/g, " ")}</span>
                      <span className="text-sm font-medium text-foreground capitalize">{String(v)}</span>
                    </div>
                  ) : null
                ))}
              </div>
            </Section>
          )}

          {/* ── Tags ── */}
          {(analysis.tags?.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.tags.map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-lg bg-secondary/50 text-muted-foreground/70 border border-border/30">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* ── Bottom nav ── */}
          <div className="mt-10 pt-6 border-t border-border/30 flex items-center justify-between">
            <Link
              href="/history"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to History
            </Link>
            <Link
              href="/analyze"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-violet-900/25"
            >
              <Spade className="h-4 w-4" />
              Analyze new hand
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

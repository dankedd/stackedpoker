"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star, StarOff, Trash2, MessageSquare, ChevronRight,
  Search, Filter, BarChart3, TrendingUp, Clock, Trophy,
  Spade, Layers, X, CheckCircle2, AlertCircle, Tag,
  Loader2, RotateCcw, SlidersHorizontal, BookOpen, Zap,
  Calendar, FileText, Camera, Target,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SpotClassification {
  primary_label?: string;
  street?: string;
}

interface HandAnalysis {
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
  spot_classification: SpotClassification | null;
  // extended columns (added via migration)
  title: string | null;
  is_favorite: boolean;
  notes: string | null;
  tags: string[];
  analysis_type: "hand" | "session" | "tournament";
}

// ─────────────────────────────────────────────────────────────────────────────
// Card utilities
// ─────────────────────────────────────────────────────────────────────────────

function CardFaceMini({ card }: { card: string }) {
  const rank = card.slice(0, -1).replace("T", "10");
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const sym = ({ h: "♥", d: "♦", c: "♣", s: "♠" } as Record<string, string>)[suit] ?? "";
  return (
    <div className="inline-flex h-8 w-6 flex-col items-center justify-between rounded bg-white p-0.5 shadow-md shadow-black/40 text-[9px] leading-none select-none flex-shrink-0">
      <span className={cn("font-black", isRed ? "text-red-600" : "text-slate-900")}>{rank}</span>
      <span className={cn("text-sm leading-none", isRed ? "text-red-600" : "text-slate-900")}>{sym}</span>
    </div>
  );
}

function CardFaceBoard({ card }: { card: string }) {
  const rank = card.slice(0, -1).replace("T", "10");
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  const sym = ({ h: "♥", d: "♦", c: "♣", s: "♠" } as Record<string, string>)[suit] ?? "";
  return (
    <div className="inline-flex h-7 w-5 flex-col items-center justify-between rounded bg-white/90 p-0.5 shadow text-[8px] leading-none select-none flex-shrink-0">
      <span className={cn("font-black leading-none", isRed ? "text-red-600" : "text-slate-900")}>{rank}</span>
      <span className={cn("text-xs leading-none", isRed ? "text-red-600" : "text-slate-900")}>{sym}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score badge
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const { label, cls } =
    score >= 90 ? { label: "S-tier",    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" } :
    score >= 75 ? { label: "Solid",     cls: "bg-blue-500/15    text-blue-400    border-blue-500/30"    } :
    score >= 60 ? { label: "Decent",    cls: "bg-amber-500/15   text-amber-400   border-amber-500/30"   } :
    score >= 40 ? { label: "Sloppy",    cls: "bg-orange-500/15  text-orange-400  border-orange-500/30"  } :
                  { label: "Leaky",     cls: "bg-red-500/15     text-red-400     border-red-500/30"     };
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold", cls)}>
      <span className="text-[10px] opacity-80">{score}</span>
      <span className="opacity-60">/100</span>
      <span className="ml-0.5">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Title generator
// ─────────────────────────────────────────────────────────────────────────────

function generateTitle(a: HandAnalysis): string {
  if (a.title) return a.title;
  const cards = a.hero_cards;
  if (!cards?.length) return "Hand Analysis";
  const cardStr = cards.map(c => {
    const r = c.slice(0, -1).toUpperCase();
    return r === "T" ? "10" : r;
  }).join("");
  const suited = cards.length === 2 && cards[0].slice(-1) === cards[1].slice(-1) ? "s" : "o";
  const pair = cards.length === 2 && cards[0].slice(0, -1) === cards[1].slice(0, -1);
  const label = pair ? `${cardStr[0]}${cardStr[0]}` : `${cardStr}${suited}`;
  const pos = a.hero_position ?? "";
  const spot = a.spot_classification?.primary_label;
  if (spot) return `${label} — ${spot}`;
  return pos ? `${label} from ${pos}` : label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis type indicator
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META = {
  hand:       { label: "Hand",       icon: FileText, cls: "text-violet-400" },
  session:    { label: "Session",    icon: Layers,   cls: "text-blue-400"   },
  tournament: { label: "Tournament", icon: Trophy,   cls: "text-amber-400"  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
          : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-border/60"
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis card
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  analysis: HandAnalysis;
  isFavorite: boolean;
  note: string;
  confirmingDelete: boolean;
  onToggleFavorite: (id: string) => void;
  onSaveNote: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function AnalysisCard({ analysis, isFavorite, note, confirmingDelete, onToggleFavorite, onSaveNote, onDelete, onCancelDelete }: CardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [localNote, setLocalNote] = useState(note);
  const [noteSaved, setNoteSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title = generateTitle(analysis);
  const typeMeta = TYPE_META[analysis.analysis_type ?? "hand"];
  const TypeIcon = typeMeta.icon;
  const hasNote = note.trim().length > 0;

  const handleNoteChange = (val: string) => {
    setLocalNote(val);
    setNoteSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSaveNote(analysis.id, val);
      setNoteSaved(true);
    }, 1200);
  };

  return (
    <div className={cn(
      "relative rounded-2xl border bg-card/60 p-5 card-lift flex flex-col",
      "hover:bg-card/80",
      confirmingDelete
        ? "border-red-500/40 bg-red-500/5"
        : isFavorite
        ? "border-amber-500/20 hover:border-amber-500/30"
        : "border-border/50 hover:border-violet-500/20"
    )}>
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        {/* Hero cards */}
        <div className="flex items-center gap-1.5 min-w-0">
          {analysis.hero_cards?.slice(0, 2).map((c, i) => (
            <CardFaceMini key={i} card={c} />
          ))}
          {analysis.hero_position && (
            <span className="ml-1 text-xs text-muted-foreground/70 font-medium truncate">
              {analysis.hero_position}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setNoteOpen(o => !o); }}
            title="Notes"
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-lg transition-all",
              noteOpen || hasNote
                ? "text-blue-400 bg-blue-500/10"
                : "text-muted-foreground/50 hover:text-foreground hover:bg-white/5"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(analysis.id)}
            title={isFavorite ? "Unfavorite" : "Favorite"}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-lg transition-all",
              isFavorite
                ? "text-amber-400 bg-amber-500/10"
                : "text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-500/10"
            )}
          >
            {isFavorite ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
          </button>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => onDelete(analysis.id)}
              title="Delete"
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancelDelete}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 pr-1">
        {title}
      </h3>

      {/* ── Meta row ── */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/60 mb-3">
        <span className={cn("flex items-center gap-1", typeMeta.cls)}>
          <TypeIcon className="h-3 w-3" />
          {typeMeta.label}
        </span>
        {analysis.game_type && <><span className="opacity-40">·</span><span className="capitalize">{analysis.game_type}</span></>}
        {analysis.stakes && <><span className="opacity-40">·</span><span>{analysis.stakes}</span></>}
        {analysis.effective_stack_bb && <><span className="opacity-40">·</span><span>{analysis.effective_stack_bb}BB</span></>}
        <span className="opacity-40">·</span>
        <span className="flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {formatDate(analysis.analyzed_at)}
        </span>
      </div>

      {/* ── Board ── */}
      {analysis.board && analysis.board.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          {analysis.board.map((c, i) => <CardFaceBoard key={i} card={c} />)}
          <span className="ml-1 text-[10px] text-muted-foreground/40">
            {analysis.board.length === 3 ? "Flop" : analysis.board.length === 4 ? "Turn" : "River"}
          </span>
        </div>
      )}

      {/* ── Score + spot ── */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <ScoreBadge score={analysis.overall_score} />
        {analysis.mistakes_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-orange-400/80">
            <AlertCircle className="h-3 w-3" />
            {analysis.mistakes_count} mistake{analysis.mistakes_count !== 1 ? "s" : ""}
          </span>
        )}
        {analysis.spot_classification?.primary_label && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400/80 border border-violet-500/15">
            {analysis.spot_classification.primary_label}
          </span>
        )}
        {analysis.input_type === "image" && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
            <Camera className="h-2.5 w-2.5" />
            Screenshot
          </span>
        )}
      </div>

      {/* ── Tags ── */}
      {analysis.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {analysis.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/50 text-muted-foreground/60 border border-border/30">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Note editor ── */}
      {noteOpen && (
        <div className="border-t border-border/30 pt-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground/70">Study notes</span>
            {noteSaved && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Saved
              </span>
            )}
          </div>
          <textarea
            value={localNote}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Add your study notes, key takeaways, leaks to work on..."
            rows={3}
            className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmingDelete && (
        <div className="border-t border-red-500/20 pt-3 mb-3">
          <p className="text-xs text-red-400 mb-2">Delete this analysis? This cannot be undone.</p>
          <button
            type="button"
            onClick={() => onDelete(analysis.id)}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
          >
            Yes, delete
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-auto pt-3 border-t border-border/20 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/40">
          {analysis.site ?? "Hand history"}
        </span>
        <Link
          href={`/history/${analysis.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-violet-400 transition-colors font-medium"
        >
          Open
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats tile
// ─────────────────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-5 py-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/50">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-16 text-center col-span-full">
      <div className="flex justify-center mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border/60">
          {filtered
            ? <Filter className="h-7 w-7 text-muted-foreground/40" />
            : <BookOpen className="h-7 w-7 text-muted-foreground/40" />
          }
        </div>
      </div>
      {filtered ? (
        <>
          <p className="text-foreground font-semibold mb-2">No matching analyses</p>
          <p className="text-sm text-muted-foreground/60">
            Try adjusting your filters or search query.
          </p>
        </>
      ) : (
        <>
          <p className="text-foreground font-semibold mb-2">No analyses yet</p>
          <p className="text-sm text-muted-foreground/60 mb-6">
            Start building your study library by analyzing your first hand.
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/25"
          >
            <Spade className="h-4 w-4" />
            Analyze a Hand
          </Link>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = "newest" | "oldest" | "best" | "worst";
type TypeFilter = "all" | "hand" | "session" | "tournament";
type GameFilter = "all" | "cash" | "tournament";
type ScoreFilter = "all" | "great" | "good" | "poor";

const PAGE_SIZE = 24;

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [all, setAll] = useState<HandAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayed, setDisplayed] = useState(PAGE_SIZE);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [showFavs, setShowFavs] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Local state (optimistic) ──────────────────────────────────────────────
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("hand_analyses")
        .select([
          "id", "input_type", "game_type", "stakes", "hero_position",
          "hero_cards", "board", "overall_score", "ai_coaching",
          "mistakes_count", "analyzed_at", "site", "effective_stack_bb",
          "spot_classification", "title", "is_favorite", "notes",
          "tags", "analysis_type",
        ].join(", "))
        .eq("user_id", user.id)
        .order("analyzed_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[history] Supabase fetch error:", error.message, error.code, (error as { details?: string }).details);
      }
      if (!error && data) {
        const rows = data as unknown as HandAnalysis[];
        setAll(rows);
        const favs: Record<string, boolean> = {};
        const nts: Record<string, string> = {};
        rows.forEach((a) => {
          favs[a.id] = a.is_favorite ?? false;
          if (a.notes) nts[a.id] = a.notes;
        });
        setFavorites(favs);
        setNotes(nts);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed: filtered + sorted list ─────────────────────────────────────
  const filtered = useMemo(() => {
    let list = all.filter(a => !deletedIds.has(a.id));

    if (showFavs) list = list.filter(a => favorites[a.id]);
    if (typeFilter !== "all") list = list.filter(a => (a.analysis_type ?? "hand") === typeFilter);
    if (gameFilter !== "all") list = list.filter(a => a.game_type === gameFilter);
    if (scoreFilter === "great") list = list.filter(a => (a.overall_score ?? 0) >= 80);
    if (scoreFilter === "good")  list = list.filter(a => { const s = a.overall_score ?? 0; return s >= 60 && s < 80; });
    if (scoreFilter === "poor")  list = list.filter(a => (a.overall_score ?? 100) < 60);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(a =>
        generateTitle(a).toLowerCase().includes(q) ||
        a.stakes?.toLowerCase().includes(q) ||
        a.hero_position?.toLowerCase().includes(q) ||
        a.game_type?.toLowerCase().includes(q) ||
        a.site?.toLowerCase().includes(q) ||
        a.spot_classification?.primary_label?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q)) ||
        notes[a.id]?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "oldest") list = [...list].sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime());
    if (sortBy === "best")   list = [...list].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));
    if (sortBy === "worst")  list = [...list].sort((a, b) => (a.overall_score ?? 100) - (b.overall_score ?? 100));

    return list;
  }, [all, deletedIds, favorites, showFavs, typeFilter, gameFilter, scoreFilter, search, sortBy, notes]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const visible = all.filter(a => !deletedIds.has(a.id));
    const scored = visible.filter(a => a.overall_score !== null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, a) => s + (a.overall_score ?? 0), 0) / scored.length)
      : null;
    const favCount = Object.values(favorites).filter(Boolean).length;
    const sessions = visible.filter(a => a.analysis_type === "session").length;
    return { total: visible.length, avgScore, favCount, sessions };
  }, [all, deletedIds, favorites]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async (id: string) => {
    const next = !favorites[id];
    setFavorites(f => ({ ...f, [id]: next }));
    const supabase = createClient();
    await supabase.from("hand_analyses").update({ is_favorite: next }).eq("id", id);
  }, [favorites]);

  const saveNote = useCallback(async (id: string, text: string) => {
    setNotes(n => ({ ...n, [id]: text }));
    const supabase = createClient();
    await supabase.from("hand_analyses").update({ notes: text || null }).eq("id", id);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    if (confirmDel === id) {
      // confirmed
      setDeletedIds(s => new Set([...s, id]));
      setConfirmDel(null);
      const supabase = createClient();
      supabase.from("hand_analyses").delete().eq("id", id);
    } else {
      setConfirmDel(id);
    }
  }, [confirmDel]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setGameFilter("all");
    setScoreFilter("all");
    setShowFavs(false);
    setSortBy("newest");
  };

  const hasActiveFilters = typeFilter !== "all" || gameFilter !== "all" || scoreFilter !== "all" || showFavs || search.trim().length > 0;

  const visibleList = filtered.slice(0, displayed);
  const canLoadMore = displayed < filtered.length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">

          {/* ── Header ── */}
          <div className="mb-8 animate-fade-in">
            <p className="text-sm font-medium text-violet-400 mb-1">Study Library</p>
            <h1 className="text-3xl font-bold text-foreground">Hand History</h1>
            <p className="text-muted-foreground mt-1.5">
              Review previous analyses, revisit key spots, and track your progress.
            </p>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 animate-fade-in">
            <StatTile
              label="Total Analyses"
              value={loading ? "—" : stats.total}
              sub="lifetime"
              icon={BarChart3}
              color="text-violet-400"
            />
            <StatTile
              label="Avg Score"
              value={loading ? "—" : stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
              sub="across all hands"
              icon={TrendingUp}
              color="text-emerald-400"
            />
            <StatTile
              label="Starred"
              value={loading ? "—" : stats.favCount}
              sub="key hands saved"
              icon={Star}
              color="text-amber-400"
            />
            <StatTile
              label="Sessions"
              value={loading ? "—" : stats.sessions}
              sub="session reviews"
              icon={Layers}
              color="text-blue-400"
            />
          </div>

          {/* ── Search + Filter bar ── */}
          <div className="mb-6 space-y-3 animate-fade-in">
            <div className="flex gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by hand, position, stakes, notes…"
                  className="w-full bg-card/60 border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter toggle (mobile) */}
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                className={cn(
                  "sm:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                  filtersOpen || hasActiveFilters
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                    : "border-border/50 bg-card/60 text-muted-foreground"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {hasActiveFilters && <span className="text-xs">•</span>}
              </button>
            </div>

            {/* Filter chips row */}
            <div className={cn("flex flex-wrap gap-2 items-center", filtersOpen || "hidden sm:flex")}>
              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="h-8 bg-card/60 border border-border/50 rounded-lg px-2 text-xs text-foreground focus:outline-none focus:border-violet-500/40 cursor-pointer"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="best">Best score</option>
                <option value="worst">Worst score</option>
              </select>

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {/* Type */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "hand", "session", "tournament"] as TypeFilter[]).map(t => (
                  <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                    {t === "all" ? "All types" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </FilterChip>
                ))}
              </div>

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {/* Game */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "cash", "tournament"] as GameFilter[]).map(g => (
                  <FilterChip key={g} active={gameFilter === g} onClick={() => setGameFilter(g)}>
                    {g === "all" ? "Any game" : g.charAt(0).toUpperCase() + g.slice(1)}
                  </FilterChip>
                ))}
              </div>

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {/* Score */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  ["all", "Any score"],
                  ["great", "≥80 Great"],
                  ["good",  "60–79 Decent"],
                  ["poor",  "<60 Leaky"],
                ] as [ScoreFilter, string][]).map(([v, label]) => (
                  <FilterChip key={v} active={scoreFilter === v} onClick={() => setScoreFilter(v)}>
                    {label}
                  </FilterChip>
                ))}
              </div>

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {/* Favorites toggle */}
              <FilterChip active={showFavs} onClick={() => setShowFavs(f => !f)}>
                <span className="flex items-center gap-1">
                  <Star className={cn("h-3 w-3", showFavs ? "fill-current text-amber-400" : "")} />
                  Starred only
                </span>
              </FilterChip>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Results count + CTA ── */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "analysis" : "analyses"}
                  {hasActiveFilters && all.length > filtered.length && (
                    <span className="text-muted-foreground/50"> of {all.length} total</span>
                  )}
                </>
              )}
            </p>
            <Link
              href="/analyze"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors px-3 py-1.5 rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10"
            >
              <Zap className="h-3.5 w-3.5" />
              New analysis
            </Link>
          </div>

          {/* ── Grid ── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/30 bg-card/40 p-5 h-56 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filtered={hasActiveFilters} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleList.map(a => (
                  <AnalysisCard
                    key={a.id}
                    analysis={a}
                    isFavorite={favorites[a.id] ?? false}
                    note={notes[a.id] ?? ""}
                    confirmingDelete={confirmDel === a.id}
                    onToggleFavorite={toggleFavorite}
                    onSaveNote={saveNote}
                    onDelete={handleDeleteClick}
                    onCancelDelete={() => setConfirmDel(null)}
                  />
                ))}
              </div>

              {/* Load more */}
              {canLoadMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setDisplayed(d => d + PAGE_SIZE)}
                    className="px-6 py-2.5 rounded-xl border border-border/50 bg-card/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all"
                  >
                    Load more ({filtered.length - displayed} remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Footer CTA (mobile) ── */}
          <div className="mt-10 sm:hidden flex justify-center">
            <Link
              href="/analyze"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-900/25"
            >
              <Spade className="h-4 w-4" />
              Analyze a new hand
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
